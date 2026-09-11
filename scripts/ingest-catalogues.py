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
    # ── Andra svängen: familjer som saknades efter första omgången ────────
    # SMC:s manualer bär "CD"-prefix och kortare serienamn än våra
    # familjeslugar, vilket den första sökningen missade.
    "smc-cj2-om_cj2-z_om0067p_en.pdf": ("SMC", ["cj2"]),
    "smc-cjp-om_cjp-z_om0207qen.pdf": ("SMC", ["cjp"]),
    "smc-cjp-om_cjp2_om0002k_en.pdf": ("SMC", ["cjp"]),
    "smc-cp96-om_cp96n_om0197qen.pdf": ("SMC", ["cp96"]),
    "smc-cp96-om_cp96x-c_om0002qen.pdf": ("SMC", ["cp96"]),
    "smc-cp96-om_cp96x_mm0049qen.pdf": ("SMC", ["cp96"]),
    # CY1F/CY1L/CY1S är systrar i CY1-serien som CY1R tillhör.
    "smc-cy1r-om_cy1f_om0002f_en.pdf": ("SMC", ["cy1r"]),
    "smc-cy1r-om_cy1l_om0002c_en.pdf": ("SMC", ["cy1r"]),
    "smc-cy1r-om_cy1s-z_om0078p_en.pdf": ("SMC", ["cy1r"]),
    "smc-mgpm-om_mgp-z_mgpx-om0047pen-b.pdf": ("SMC", ["mgpm"]),
    "smc-mhz2-om_mhz2_omd0047en-a.pdf": ("SMC", ["mhz2"]),
    # "Valve terminal MPA-S" -- verifierat, 681 träffar på MPA/VMPA.
    "festo-VMPA-TYP32-203792.pdf": ("Festo", ["mpa"]),
    # ── SMC: driftmanualer ────────────────────────────────────────────────
    # SMC publicerar inga kataloger med beställnyckel på webben -- bara
    # driftmanualer. De bär tekniska data och mått, vilket räcker för
    # kunskapssökningen, men inte orderkodens grammatik. Hämtade från
    # /binaries/content/assets/.../operation-manuals/en/.
    "smc-CM2-om_cm2-az1_om0261qen.pdf": ("SMC", ["cm2"]),
    "smc-CM2-om_cm2-z_om0064p_en.pdf": ("SMC", ["cm2"]),
    "smc-CM2-om_cm2_om0081p_en.pdf": ("SMC", ["cm2"]),
    "smc-CM2-om_cm2_om0300qen.pdf": ("SMC", ["cm2"]),
    "smc-CQ2-om_cdq2eb_om0288q_en.pdf": ("SMC", ["cq2"]),
    "smc-CQ2-om_cm2y_om0001hen.pdf": ("SMC", ["cq2"]),
    "smc-CQ2-om_cq2-x3423_om0295qen.pdf": ("SMC", ["cq2"]),
    "smc-CQ2-om_cq2x_om0002m-en.pdf": ("SMC", ["cq2"]),
    "smc-CS1-cs1_om0004f_gb.pdf": ("SMC", ["cs1"]),
    "smc-CS1-ex140-scs-omf0012en-b.pdf": ("SMC", ["cs1"]),
    "smc-EX500-om_ex500-gdn1_devicenet_en.pdf": ("SMC", ["ex500"]),
    "smc-EX500-om_ex500-gen1_ethernetip_en-a.pdf": ("SMC", ["ex500"]),
    "smc-EX500-om_ex500-gen2_ethernetip_en-b.pdf": ("SMC", ["ex500"]),
    "smc-EX500-om_ex500-gpn2_profinet_en-a.pdf": ("SMC", ["ex500"]),
    "smc-LESH-om_lesh_stepdc_en.pdf": ("SMC", ["lesh"]),
    "smc-LEY-om_hf2a-ley_doc1069086en.pdf": ("SMC", ["ley"]),
    "smc-LEY-om_le2y_le2yg_doc1068298en.pdf": ("SMC", ["ley"]),
    "smc-LEY-om_ley_leyg_battery-less_stepdc_en.pdf": ("SMC", ["ley"]),
    "smc-LEY-om_ley_leyg_omz0015en.pdf": ("SMC", ["ley"]),
    "smc-MB-om_d-m7ba_omz0004en-a.pdf": ("SMC", ["mb"]),
    "smc-MB-om_ex600-axx_analogue-unitsen-d.pdf": ("SMC", ["mb"]),
    "smc-MB-om_idg-x017_doc1074090en.pdf": ("SMC", ["mb"]),
    "smc-MB-om_idg-x032_doc1074092en.pdf": ("SMC", ["mb"]),
    "smc-MGPL-om_mgpl-z_om0242qen.pdf": ("SMC", ["mgpl"]),
    "smc-MHC2-om_mhc2_omg0048en.pdf": ("SMC", ["mhc2"]),
    "smc-MHC2-om_mhc2_omg0120en.pdf": ("SMC", ["mhc2"]),
    "smc-MHZ2-om_jmhz2-16d-x7400b_omy0014en-a.pdf": ("SMC", ["mhz2"]),
    "smc-MHZ2-om_jmhz2-16d-x7500ac_doc1023845en.pdf": ("SMC", ["mhz2"]),
    "smc-MHZ2-om_jmhz2-16d-x7500ac_omy0028en.pdf": ("SMC", ["mhz2"]),
    "smc-MHZ2-om_jmhz2-assista_omy0009en-a.pdf": ("SMC", ["mhz2"]),
    "smc-MXS-om_mxs-x2578_doc1082441en.pdf": ("SMC", ["mxs"]),
    "smc-MXS-om_mxs_omg0114en.pdf": ("SMC", ["mxs"]),
    "smc-SV1000-om_sv1000_2000_3000_4000_ome0002en-c.pdf": ("SMC", ["sv1000"]),
    "smc-SY3000-om_25a-jsy_omz0002en-c.pdf": ("SMC", ["sy3000", "sy"]),
    "smc-SY3000-om_25a-jsy_omz0004en-c.pdf": ("SMC", ["sy3000", "sy"]),
    "smc-SY3000-om_jsy1000v_omw0002en-e.pdf": ("SMC", ["sy3000", "sy"]),
    "smc-SY3000-om_jsy1000v_omw0004en-c.pdf": ("SMC", ["sy3000", "sy"]),
    "smc-VF3000-om_vf1000_3000_5000-omn0002en-a.pdf": ("SMC", ["vf3000"]),
    "smc-VQ1000-om_vq1000-2000_vq1000v-omm0002en-b.pdf.pdf": ("SMC", ["vq1000", "vq"]),
    "smc-ZH-om_izh10_oml0002en-c.pdf": ("SMC", ["zh"]),
    "smc-ZH-om_zhp_om00201en.pdf": ("SMC", ["zh"]),
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
    """
    Skickar via curl, inte urllib.

    Pythons SSL-verifiering använder ett eget certifikatpaket som inte
    installeras automatiskt av python.org-bygget på macOS -- utan att någon
    kört "Install Certificates.command" faller varje anrop på
    CERTIFICATE_VERIFY_FAILED. curl använder systemets betrodda certifikat och
    fungerar direkt, och finns på varje Mac.
    """
    import tempfile
    with tempfile.NamedTemporaryFile("w", suffix=".json", delete=False) as f:
        json.dump(body, f)
        tmp = f.name
    try:
        for forsok in range(3):
            r = subprocess.run(
                ["curl", "-sS", "--fail-with-body", "--max-time", "180",
                 "-X", "POST", URL + path,
                 "-H", "Content-Type: application/json",
                 "-H", "apikey: " + KEY,
                 "-H", "Authorization: Bearer " + KEY,
                 "--data-binary", "@" + tmp],
                capture_output=True, text=True)
            if r.returncode == 0:
                return r.stdout
            if forsok == 2:
                raise RuntimeError(f"curl {r.returncode}: {(r.stderr or r.stdout)[:300]}")
            time.sleep(2 * (forsok + 1))
    finally:
        os.unlink(tmp)


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
