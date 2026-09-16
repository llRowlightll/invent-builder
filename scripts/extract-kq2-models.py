#!/usr/bin/env python3
"""
Läser modellnumren i måttabellerna i SMC:s KQ2-katalog och skriver
src/lib/catalog/kq2-models.ts.

Katalogen (docs/kataloger/smc-kat-kq2.pdf, CAT.ES50-37D, 228 sidor) har ett
kapitel per kombination av frigöringsknapp (oval/rund), slangmått (metriskt/
tum) och gängstandard. Varje sida i ett kapitel bär rubriken
"[Oval Type] Applicable Tubing: <Metric|Inch> Size, Connection Thread: <...>".
Måttabellerna listar varje modellnummer med platshållare för materialet
(m/l/□ = A mässing eller N förnicklad mässing; G = rostfritt 303 skrivs ut)
och med tätningssymbolen S (gängtätning) eller P (plantätning) och 1 (oval
knapp) utskrivna.

Bara de metriska kapitlen tas med (sida 5–27, 57–72, 87–94 och 101–132,
165–184, 201–208). Tumkapitlen (UNF/NPT, tumslang med M/R, NPT- och
R-plantätning, tum-Uni) följer samma nyckel men är USA-marknadens koder.

Kör:  python3 scripts/extract-kq2-models.py
"""
import collections, json, re, subprocess, sys
from pathlib import Path

PDF = Path("docs/kataloger/smc-kat-kq2.pdf")
OUT = Path("src/lib/catalog/kq2-models.ts")

CHAPTERS = {
    "M, R, Rc": "MR",
    "G": "G",
    "R, Rc": "RP",
    "Rc, G, NPT, NPTF": "U",
}
HEADER = re.compile(r"(Oval Type)?\s*Applicable Tubing: (Metric|Inch) Size, Connection Thread: ([A-Za-z, ]+?)\s*$", re.M)
MODEL = re.compile(r"(?<![\w-])KQ2([A-Z]{1,2})(\d{2})-([GU]?\d{2}|M[356])([^\s\d]?)(S|P)?(1)?(?=[\s,/)]|$)")

# Rader som finns i tabellen på sidan men saknas i pdf:ens textlager (sedda i
# den renderade sidan): (knapp, kapitel, typ, slang, port, material, tätning).
MANUAL = [
    ("round", "MR", "H", "04", "08", "A", ""),  # KQ2H04-08A, sida 106
]

def main():
    text = subprocess.run(["pdftotext", "-layout", str(PDF), "-"], check=True, capture_output=True).stdout.decode("utf-8")
    pages = text.split("\f")
    rows = collections.defaultdict(set)   # (button, chapter) -> set of (type, tube, port, mat, seal)
    page_of = {}
    for pi, page in enumerate(pages, 1):
        h = HEADER.search(page)
        if not h:
            continue
        oval, size, thread = h.group(1), h.group(2), h.group(3).strip()
        if size != "Metric" or thread not in CHAPTERS:
            continue
        button = "oval" if oval else "round"
        chapter = CHAPTERS[thread]
        for m in MODEL.finditer(page):
            start = m.start()
            if page[max(0, start - 3):start].endswith("10-"):
                continue  # exempel på Clean-serien
            t, tube, port, mat, seal, btn = m.groups()
            if (btn == "1") != (button == "oval"):
                continue  # hänvisning till den andra knapptypen
            if t in ("C", "P") and port != "00":
                continue
            mat = mat if mat in ("A", "N", "G") else ("m" if mat else "")
            rows[(button, chapter)].add((t, tube, port, mat, seal or ""))
            page_of.setdefault((button, chapter, t), pi)
    for button, chapter, t, tube, port, mat, seal in MANUAL:
        rows[(button, chapter)].add((t, tube, port, mat, seal))

    # Materialet: m/A/N -> "" (A eller N väljs), G -> "G" (bara rostfritt),
    # slangkopplingar (00/99/slangmått) -> "A" (fast). Reservdelslistorna
    # skriver ut A och N var för sig; finns platshållaren eller båda
    # bokstäverna för samma modell är materialet valbart.
    out = {}
    for (button, chapter), s in rows.items():
        mats = collections.defaultdict(set)
        for t, tube, port, mat, seal in s:
            mats[(t, tube, port, seal)].add(mat)
        merged = set()
        for (t, tube, port, seal), ms in mats.items():
            if "G" in ms:
                merged.add((t, tube, port, "G", seal))
                ms = ms - {"G"}
                if not ms:
                    continue
            if "m" in ms or "" in ms or ms >= {"A", "N"}:
                merged.add((t, tube, port, "m" if "m" in ms or ms >= {"A", "N"} else "", seal))
            else:
                merged.add((t, tube, port, next(iter(ms)), seal))
        by = collections.defaultdict(lambda: collections.defaultdict(set))
        for t, tube, port, mat, seal in merged:
            if chapter == "MR" and re.fullmatch(r"\d{2}", port) and mat == "A" and seal == "":
                key = port + "A"           # slang mot slang: KQ2H06-00A
            elif t == "N" and re.fullmatch(r"\d{2}", port) and mat == "" and seal == "":
                key = port + "-"           # nippel utan materialbokstav: KQ2N04-99, KQ2N04-06
            elif mat == "G":
                key = port + "G" + seal    # KQ2H23-M3G
            else:
                key = port + seal          # KQ2H06-01S, KQ2H06-01P, KQ2H06-G01, KQ2H06-M5
            by[t][tube].add(key)
        out[f"{button}|{chapter}"] = {t: {tube: sorted(v) for tube, v in sorted(tubes.items())} for t, tubes in sorted(by.items())}

    n = sum(len(v) for tubes in out.values() for t in tubes.values() for v in t.values())
    lines = [
        "/**",
        " * GENERERAD av scripts/extract-kq2-models.py ur docs/kataloger/smc-kat-kq2.pdf",
        " * (CAT.ES50-37D) -- redigera inte för hand.",
        " *",
        " * Modellnumren i måttabellerna, per frigöringsknapp (round/oval) och kapitel:",
        " *   MR  metriskt slangmått, gänga M, R, Rc (tätningsmedel S, gasket)   sida 5–27 (oval), 101–132 (rund)",
        " *   G   metriskt slangmått, gänga G (plantätning)                       sida 57–64 (oval), 165–172 (rund)",
        " *   RP  metriskt slangmått, gänga R, Rc med plantätning (P)             sida 65–72 (oval), 173–184 (rund)",
        " *   U   metriskt slangmått, Uni-gänga (Rc, G, NPT, NPTF)                sida 87–94 (oval), 201–208 (rund)",
        " * Nyckel: typ -> slang -> portposter. En portpost är porten plus det som är",
        " * fast i tabellen: A (slang mot slang), G (bara rostfritt), S (tätningsmedel),",
        " * P (plantätning), - (ingen materialbokstav: nipplarna KQ2N□□-99 och KQ2N□□-□□).",
        " * Utan bokstav väljs materialet A eller N.",
        f" * {n} poster. Raderna i MANUAL i skriptet saknas i pdf:ens textlager men står",
        " * i den renderade tabellen.",
        " */",
        "export type KQ2ModelTable = Record<string, Record<string, string[]>>;",
        "export const KQ2_MODELS: Record<string, KQ2ModelTable> = " + json.dumps(out, ensure_ascii=False, separators=(",", ":"), indent=None) + ";",
        "",
    ]
    OUT.write_text("\n".join(lines), encoding="utf-8")
    for k in sorted(out):
        print(k, sum(len(v) for t in out[k].values() for v in t.values()), "poster,", len(out[k]), "typer")
    print("skrev", OUT, n, "poster")

if __name__ == "__main__":
    main()
