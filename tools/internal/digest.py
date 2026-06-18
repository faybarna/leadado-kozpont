#!/usr/bin/env python3
"""
Leadadó heti digest generátor — 0 token, tiszta sablon.
A partner JSON-okból (data/partners/*.json) partnerenként összerak egy
rövid, e-mailbe illeszthető összefoglalót. LLM NEM kell hozzá.

Használat:
  python3 tools/internal/digest.py                 # összes partner
  python3 tools/internal/digest.py robi-7f3a2b91   # egy partner (token vagy fájlnév)
"""

import json
import sys
import glob
import os
from collections import Counter, defaultdict

PARTNERS_DIR = os.path.join(os.path.dirname(__file__), "..", "..", "data", "partners")

# A számozott státusz prefix alapján döntjük el, mi számít lezártnak.
LEZART_STATUSZOK = {"5. Folyósítva", "3. Megkötve"}
FIGYELEM_STATUSZOK = {"Ügyfélre/munkatársra várunk", "0. Új"}

# Az "aktuális" elszámolási hónap — élesben a routine a mai dátumból számolja.
AKTUALIS_HONAP = "2026. Június"
KOVETKEZO_HONAP = "2026. Július"

BASE_URL = "https://faybarna.github.io/leadado-kozpont"


def keresztnev(teljes_nev):
    """Magyar névsorrend: vezetéknév elöl, keresztnév a második tag."""
    reszek = teljes_nev.split()
    return reszek[1] if len(reszek) >= 2 else teljes_nev


def digest_for(path):
    data = json.load(open(path, encoding="utf-8"))
    partner = data.get("partner", "—")
    frissitve = data.get("frissitve", "—")
    ugyletek = data.get("ugyletek", [])

    token = os.path.basename(path)[:-5]
    link = f"{BASE_URL}/?p={token}"
    nev = keresztnev(partner)

    if not ugyletek:
        return (
            f"Szia {nev},\n\n"
            f"A héten nincs aktív ügyleted a rendszerben. "
            f"Ha van leadnivalód, töltsd fel az adatlapot — egy üzenet és indítjuk.\n\n"
            f"Saját Ügyleteim: {link}\n"
            f"(Frissítve: {frissitve})"
        )

    aktiv = [u for u in ugyletek if u.get("statusz") not in LEZART_STATUSZOK]
    lezart = [u for u in ugyletek if u.get("statusz") in LEZART_STATUSZOK]
    figyelem = [u for u in ugyletek if u.get("statusz") in FIGYELEM_STATUSZOK]

    # Elszámolási hónap szerinti csoportosítás (csak aktív, kitöltött hónap)
    honap_map = defaultdict(list)
    for u in aktiv:
        h = u.get("elszamolasi_honap", "").strip()
        if h:
            honap_map[h].append(u)

    eh_aktiv = sum(u.get("eh", 0) for u in aktiv)

    sorok = []
    sorok.append(f"Szia {nev},\n")
    sorok.append("Heti pillanatkép a pipeline-odról:\n")
    sorok.append(f"  • Aktív ügylet: {len(aktiv)} db (összesen {eh_aktiv} EH)")
    sorok.append(f"  • Lezárt / folyósított: {len(lezart)} db")

    if AKTUALIS_HONAP in honap_map:
        nev = ", ".join(u["ugyfel"] for u in honap_map[AKTUALIS_HONAP])
        sorok.append(f"  • Elszámolás ebben a hónapban ({AKTUALIS_HONAP}): {len(honap_map[AKTUALIS_HONAP])} db — {nev}")
    if KOVETKEZO_HONAP in honap_map:
        sorok.append(f"  • Következő hónap ({KOVETKEZO_HONAP}): {len(honap_map[KOVETKEZO_HONAP])} db várható elszámolás")

    if figyelem:
        nev = ", ".join(u["ugyfel"] for u in figyelem)
        sorok.append(f"\n  ⚠ Rád/ügyfélre vár ({len(figyelem)} db): {nev} — ezeken érdemes mozdítani.")

    sorok.append(f"\nRészletes nézeted bármikor: {link}")
    sorok.append(f"(Frissítve: {frissitve})")
    return "\n".join(sorok)


def main():
    if len(sys.argv) > 1:
        arg = sys.argv[1].replace(".json", "")
        paths = [os.path.join(PARTNERS_DIR, arg + ".json")]
    else:
        paths = sorted(glob.glob(os.path.join(PARTNERS_DIR, "*.json")))

    for p in paths:
        if not os.path.exists(p):
            print(f"!! nincs ilyen fájl: {p}")
            continue
        print("=" * 64)
        print(f"[{os.path.basename(p)}]")
        print(digest_for(p))
        print()


if __name__ == "__main__":
    main()
