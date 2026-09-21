#!/usr/bin/env python3
"""
Delar en familjemigration i delar om högst 14 kB för apply_migration.

VARFÖR. Migrationerna som scripts/gen-<familj>-migration.ts skriver är
20–200 kB, men verktyget som tillämpar dem på databasen tar högst ~14 kB per
anrop. Delningen måste ske vid satsgränser och får inte luras av ";" inne i
strängar, dollarciterade block eller SQL-kommentarer (rubrikkommentaren
innehåller ofta beställkoder med ";" i förklaringen).

Varje del körs som en egen migration (i sin egen transaktion), så begin;/commit;
på toppnivå tas bort. Delarna döps <slug>_order_code_from_catalogue_part_NN.

Kör:  python3 scripts/split-migration.py <fil.sql> <utkatalog> [maxbytes]
"""
import os
import sys


def satser(sql):
    """Delar SQL:en i satser vid ';' utanför strängar, $$-block och kommentarer."""
    ut, buf = [], []
    i, n = 0, len(sql)
    while i < n:
        c = sql[i]
        if sql.startswith("--", i):
            j = sql.find("\n", i)
            j = n if j < 0 else j + 1
            buf.append(sql[i:j]); i = j; continue
        if c == "'":
            j = i + 1
            while j < n:
                if sql[j] == "'":
                    if j + 1 < n and sql[j + 1] == "'":
                        j += 2; continue
                    break
                j += 1
            buf.append(sql[i:j + 1]); i = j + 1; continue
        if c == "$":
            # dollarcitat: $$ eller $tag$
            k = i + 1
            while k < n and (sql[k].isalnum() or sql[k] == "_"):
                k += 1
            if k < n and sql[k] == "$":
                tag = sql[i:k + 1]
                j = sql.find(tag, k + 1)
                if j < 0:
                    raise SystemExit("oavslutat dollarcitat")
                buf.append(sql[i:j + len(tag)]); i = j + len(tag); continue
        if c == ";":
            buf.append(c)
            ut.append("".join(buf)); buf = []; i += 1; continue
        buf.append(c); i += 1
    rest = "".join(buf)
    if rest.strip():
        ut.append(rest)
    return ut


def main():
    if len(sys.argv) < 3:
        raise SystemExit(__doc__)
    fil, utdir = sys.argv[1], sys.argv[2]
    maxb = int(sys.argv[3]) if len(sys.argv) > 3 else 14000
    slug = os.path.basename(fil).split("_", 1)[1].replace("_order_code_from_catalogue.sql", "").replace(".sql", "")
    sql = open(fil, encoding="utf-8").read()
    delar, kommentar = [], ""
    for s in satser(sql):
        # Satsens kropp utan inledande kommentarrader (rubriken sitter ihop
        # med "begin;").
        rader = s.split("\n")
        k = 0
        while k < len(rader) and (not rader[k].strip() or rader[k].lstrip().startswith("--")):
            k += 1
        kropp = "\n".join(rader[k:]).strip()
        # begin;/commit; bort -- varje del är sin egen transaktion; rubriken
        # följer med till nästa sats.
        if kropp.lower() in ("begin;", "commit;"):
            kommentar += "\n".join(rader[:k]) + "\n"
            continue
        delar.append(kommentar + s)
        kommentar = ""
    os.makedirs(utdir, exist_ok=True)
    parter, cur = [], ""
    for s in delar:
        if len(s.encode()) > maxb:
            raise SystemExit(f"en enskild sats är {len(s.encode())} B > {maxb}: {s[:80]!r}")
        if len((cur + s).encode()) > maxb and cur.strip():
            parter.append(cur); cur = ""
        cur += s
    if cur.strip():
        parter.append(cur)
    for i, p in enumerate(parter, 1):
        namn = f"{slug}_order_code_from_catalogue_part_{i:02d}"
        with open(os.path.join(utdir, namn + ".sql"), "w", encoding="utf-8") as f:
            f.write(p.strip() + "\n")
        print(f"{namn}  {len(p.encode()):>6} B")
    print(f"{len(parter)} delar av {os.path.basename(fil)}")


if __name__ == "__main__":
    main()
