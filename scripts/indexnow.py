#!/usr/bin/env python3
"""Anmäler maskinval.se:s sidor till IndexNow (Bing, Yandex, Seznam, Naver m.fl.).

Bing var inte kopplat (2026-11-19), och ChatGPT-sökningen bygger på Bings
index. IndexNow kräver inget konto: nyckeln ligger öppet i
public/<nyckel>.txt, och sökmotorn hämtar den för att se att anmälan kommer
från sajten själv. Nyckeln är ingen hemlighet.

    python3 scripts/indexnow.py                 # alla adresser i sitemapen
    python3 scripts/indexnow.py URL [URL ...]   # bara de angivna
    python3 scripts/indexnow.py --torr          # visa vad som skulle skickas
"""
import json
import re
import sys
import urllib.error
import urllib.request

HOST = "maskinval.se"
NYCKEL = "89648fd41acd96245257527d91bbb9d4"
NYCKELADRESS = f"https://{HOST}/{NYCKEL}.txt"
SLUTPUNKT = "https://api.indexnow.org/indexnow"
MAX_PER_ANROP = 10_000  # IndexNow tar högst 10 000 adresser per anrop


def hamta(url: str) -> str:
    req = urllib.request.Request(url, headers={"User-Agent": "maskinval-indexnow/1.0"})
    with urllib.request.urlopen(req, timeout=60) as r:
        return r.read().decode("utf-8")


def sitemapadresser() -> list[str]:
    xml = hamta(f"https://{HOST}/sitemap.xml")
    adresser = re.findall(r"<loc>\s*([^<\s]+)\s*</loc>", xml)
    # Ett sitemapindex pekar på fler sitemaps.
    if "<sitemapindex" in xml:
        alla: list[str] = []
        for delkarta in adresser:
            alla += re.findall(r"<loc>\s*([^<\s]+)\s*</loc>", hamta(delkarta))
        adresser = alla
    return [a.replace("&amp;", "&") for a in adresser if a.startswith(f"https://{HOST}/")]


def anmal(adresser: list[str]) -> None:
    for i in range(0, len(adresser), MAX_PER_ANROP):
        del_ = adresser[i:i + MAX_PER_ANROP]
        kropp = json.dumps({"host": HOST, "key": NYCKEL, "keyLocation": NYCKELADRESS, "urlList": del_}).encode()
        req = urllib.request.Request(SLUTPUNKT, data=kropp, method="POST",
                                     headers={"Content-Type": "application/json; charset=utf-8"})
        try:
            with urllib.request.urlopen(req, timeout=60) as r:
                print(f"{len(del_)} adresser: HTTP {r.status}")
        except urllib.error.HTTPError as e:
            # 200/202 = mottaget. 403 = nyckeln hittades inte, 422 = adress utanför värden.
            print(f"{len(del_)} adresser: HTTP {e.code} {e.read()[:300]!r}")
            sys.exit(1)


def main() -> None:
    args = [a for a in sys.argv[1:] if not a.startswith("--")]
    torr = "--torr" in sys.argv
    if hamta(NYCKELADRESS).strip() != NYCKEL:
        sys.exit(f"Nyckelfilen {NYCKELADRESS} svarar inte med nyckeln -- är sajten driftsatt?")
    adresser = args or sitemapadresser()
    print(f"{len(adresser)} adresser, t.ex. {adresser[:3]}")
    if not torr:
        anmal(adresser)


if __name__ == "__main__":
    main()
