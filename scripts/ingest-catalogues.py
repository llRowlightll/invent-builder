#!/usr/bin/env python3
"""
Läser in tillverkarkatalogerna i docs/kataloger/ i knowledge_chunks.

VARFÖR ETT SKRIPT OCH INTE EN MIGRATION. Katalogerna ger 6 425 textstycken på
8,7 MB. Det går inte att lägga i en SQL-fil, och tabellen har bara en
select-policy -- det finns alltså ingen skrivväg med den publika nyckeln.
Skriptet anropar därför en TILLFÄLLIG laddfunktion (tmp_ingest_chunks) som
skapas före körningen och släpps direkt efteråt.

Kör:  python3 scripts/ingest-catalogues.py

Idempotent: filer som redan finns i knowledge_chunks hoppas över, så en
avbruten körning kan startas om utan dubbletter.
"""
import json
import os
import subprocess
import sys
import time
import urllib.request

HAR = os.path.dirname(os.path.abspath(__file__))
ROT = os.path.dirname(HAR)
SRC = os.path.join(ROT, "docs", "kataloger")

URL = "https://buqfbcztspswezwyafxo.supabase.co"
KEY = os.environ.get("SUPABASE_ANON_KEY") or (
    "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9."
    "eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJ1cWZiY3p0c3Bzd2V6d3lhZnhvIiwicm9sZSI6"
    "ImFub24iLCJpYXQiOjE3Nzg1NDY2NjksImV4cCI6MjA5NDEyMjY2OX0."
    "U3MdNO-2XXDNjtiIBbfiC9TRiLoPY94afwp9-MF2HME"
)
SECRET = os.environ.get("INGEST_SECRET", "b7f3c1ae-9d42-4e08-a15c-6f2d83b40e77")

# Snittet bland befintliga chunks är ~1000 tecken, taket 4000. Kortare än
# MINLEN är sidhuvuden och sidnummer, som bara stör sökningen.
MAXLEN, MINLEN, BATCH = 1500, 120, 150

# Fil -> (märke, [familjeslugar]). Uttryckligen skriven, inte härledd ur
# filnamnet: en automatisk textmatchning gav "DNC -> Metal Work" och
# "EMC -> VTSA", och sådana tysta fel är vad det här arbetet ska stoppa.
MAP = {
    "festo-ADVUL-202566.pdf": ("Festo", ["advu"]),
    "festo-CPX-202694.pdf": ("Festo", ["cpx"]),
    "festo-DAPS-202737.pdf": ("Festo", ["daps"]),
    "festo-DFM-202749.pdf": ("Festo", ["dfm"]),
    "festo-DFPD-202756.pdf": ("Festo", ["dfpd"]),
    "festo-DGCI-202774.pdf": ("Festo", ["dgci"]),
    "festo-DHPS-202808.pdf": ("Festo", ["dhps"]),
    "festo-DHRC-202809.pdf": ("Festo", ["dhrc"]),
    "festo-DHWC-202833.pdf": ("Festo", ["dhwc"]),
    "festo-DNC-202856.pdf": ("Festo", ["dnc"]),
    "festo-DRVS-202903.pdf": ("Festo", ["drvs"]),
    "festo-DSBF-202905.pdf": ("Festo", ["dsbf"]),
    "festo-DSBG-202907.pdf": ("Festo", ["dsbs"]),
    "festo-DSM-202916.pdf": ("Festo", ["dsm"]),
    "festo-DSMI-202918.pdf": ("Festo", ["dsmi"]),
    "festo-DSR-202929.pdf": ("Festo", ["dsr"]),
    "festo-DZH-251564.pdf": ("Festo", ["dzh"]),
    "festo-EGZ-202984.pdf": ("Festo", ["egz"]),
    "festo-EHPS-202989.pdf": ("Festo", ["ehps"]),
    "festo-EPCE-203026.pdf": ("Festo", ["epco"]),
    "festo-EPCS-203028.pdf": ("Festo", ["epcs"]),
    "festo-HE-LO-203131.pdf": ("Festo", ["he-d-mini"]),
    "festo-HGPD-203146.pdf": ("Festo", ["hgpd"]),
    "festo-HGPL-215990.pdf": ("Festo", ["hgpl"]),
    "festo-HGPP-203152.pdf": ("Festo", ["hgpp"]),
    "festo-HGPT-203154.pdf": ("Festo", ["hgpt", "hgpt-b"]),
    "festo-HGRT-203160.pdf": ("Festo", ["hgrt"]),
    "festo-MH1-203291.pdf": ("Festo", ["mfh"]),
    "festo-VAD-VAK-203828.pdf": ("Festo", ["vadmi"]),
    "festo-VOFC-203884.pdf": ("Festo", ["vofc"]),
    "festo-VTOP-203913.pdf": ("Festo", ["vtop-"]),
    "festo-VUVS-VTUS-203918.pdf": ("Festo", ["vuvs"]),
    "festo-VZBE-203930.pdf": ("Festo", ["vzbe", "vzba"]),
    "festo-VZWD-203945.pdf": ("Festo", ["vzwe"]),
    "festo-VZWF-203946.pdf": ("Festo", ["vzwf-b-l"]),
    "festo-VZXA-203952.pdf": ("Festo", ["vzxa"]),
    "festo-VZXF-203954.pdf": ("Festo", ["vzxf-l"]),
    # Delas av alla gripdon -- ingen enskild familj äger den.
    "festo-ADAPTER-FOR-GRIPPERS-202549.pdf": ("Festo", []),
    # Låg redan på disk men lästes aldrig in.
    "202650_documentation.pdf": ("Festo", []),            # CMMP-AS servodrivare
    "202668_documentation.pdf": ("Festo", []),            # CMMT-AS servodrivare
    "202715_documentation.pdf": ("Festo", ["cpx-ap-i"]),  # CPX-E automationssystem
    "202970_documentation.pdf": ("Festo", ["egc-fa"]),
    "202980_documentation.pdf": ("Festo", ["egsk"]),
    "203016_documentation.pdf": ("Festo", []),            # EMME-AS servomotorer
    "bosch-EMC.pdf": ("Bosch Rexroth", ["emc"]),
    "metalwork-ELEKTRO.pdf": ("Metal Work", ["elektro"]),
    "camozzi-6E.pdf": ("Camozzi", ["serie 6e"]),
    "camozzi-DRCS.pdf": ("Camozzi", []),
    "camozzi-electrics.pdf": ("Camozzi", ["5e"]),
    "parker-electromechanical.pdf": ("Parker", ["eth", "hmr", "osp-e"]),
    # Short Form täcker hela Camozzis sortiment -- verifierat med textsökning:
    # 39 träffar på gripdonsserierna, 9 på vriddon.
    "camozzi-short-form.pdf": ("Camozzi", [
        "serie cgan", "serie cgps", "serie cgpt", "serie arp", "serie 24",
        "serie 31", "serie 32", "serie 32 tandem", "serie 40k", "serie 41k",
        "serie 50", "serie 63", "serie 63 end lock", "serie 90", "serie d",
        "serie e", "serie en", "serie k", "serie k8", "serie kl",
        "serie mx safemax", "serie qc", "serie qn"]),
}


def post(path, body):
    req = urllib.request.Request(
        URL + path, data=json.dumps(body).encode(),
        headers={"Content-Type": "application/json", "apikey": KEY,
                 "Authorization": "Bearer " + KEY})
    for forsok in range(3):
        try:
            with urllib.request.urlopen(req, timeout=180) as r:
                return r.read().decode()
        except Exception as e:
            if forsok == 2:
                raise
            time.sleep(2 * (forsok + 1))


def stycken(text):
    """Delar texten vid radslut så att ett stycke aldrig kapas mitt i en rad."""
    ut, buf, n = [], [], 0
    for rad in text.split("\n"):
        rad = rad.rstrip()
        if not rad.strip():
            continue
        if n + len(rad) > MAXLEN and buf:
            ut.append("\n".join(buf))
            buf, n = [], 0
        buf.append(rad)
        n += len(rad) + 1
    if buf:
        ut.append("\n".join(buf))
    return [c for c in ut if len(c.strip()) >= MINLEN]


def main():
    if not os.path.isdir(SRC):
        sys.exit(f"hittar inte {SRC}")

    redan = set(json.loads(post("/rest/v1/rpc/tmp_ingest_known_files",
                                {"p_secret": SECRET}) or "[]"))
    if redan:
        print(f"redan inlästa filer: {len(redan)}")

    filer = [f for f in sorted(os.listdir(SRC))
             if f.endswith(".pdf") and f in MAP and f not in redan]
    if not filer:
        print("inget nytt att läsa in.")
        return

    tot = 0
    for fn in filer:
        marke, _ = MAP[fn]
        txt = subprocess.run(["pdftotext", "-layout", os.path.join(SRC, fn), "-"],
                             capture_output=True, text=True).stdout
        cs = stycken(txt)
        rader = [{"source_file": fn, "brand": marke, "chunk_index": i, "content": c}
                 for i, c in enumerate(cs)]
        for i in range(0, len(rader), BATCH):
            post("/rest/v1/rpc/tmp_ingest_chunks",
                 {"p_secret": SECRET, "p_rows": rader[i:i + BATCH]})
        tot += len(rader)
        print(f"  {len(cs):>5}  {fn}", flush=True)

    print(f"\nKLART: {tot} stycken ur {len(filer)} filer.")


if __name__ == "__main__":
    main()
