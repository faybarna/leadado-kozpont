#!/usr/bin/env python3
"""
Leadadó portál health-check — közel 0 token, determinisztikus.
Végigmegy a partner JSON-okon, és ellenőrzi az ÉLES oldalon, hogy minden
token feloldódik-e (nincs 404, érvényes JSON, friss adat). 25 főnél egy
néma törött token = egy elvesztett partner — ez fogja ki.

Használat:
  python3 tools/internal/healthcheck.py          # csak hibákat ír
  python3 tools/internal/healthcheck.py --all     # minden partnert kilistáz

Kilépési kód: 0 = minden OK, 1 = van hiba (routine ebből tudja, mikor szóljon).
"""

import json
import sys
import glob
import os
import urllib.request
import urllib.error
from datetime import datetime

BASE = "https://faybarna.github.io/leadado-kozpont"
PARTNERS_DIR = os.path.join(os.path.dirname(__file__), "..", "..", "data", "partners")
STALE_NAP = 3  # ennyi napnál régebbi 'frissitve' már gyanús


def check_token(token):
    """Visszaad: (ok: bool, uzenet: str)"""
    url = f"{BASE}/data/partners/{token}.json"
    try:
        with urllib.request.urlopen(url, timeout=15) as r:
            if r.status != 200:
                return False, f"HTTP {r.status}"
            data = json.loads(r.read().decode("utf-8"))
    except urllib.error.HTTPError as e:
        return False, f"HTTP {e.code} (404 = a token nem oldódik fel az élesen)"
    except Exception as e:
        return False, f"hiba: {e}"

    if "ugyletek" not in data:
        return False, "érvénytelen JSON (nincs 'ugyletek' mező)"

    frissitve = data.get("frissitve", "")
    stale = ""
    # 'frissitve' formátum: "2026.06.18. 17:00"
    try:
        dt = datetime.strptime(frissitve.strip(), "%Y.%m.%d. %H:%M")
        kor = (datetime.now() - dt).days
        if kor > STALE_NAP:
            stale = f" ⚠ {kor} napja nem frissült"
    except Exception:
        stale = " ⚠ ismeretlen 'frissitve' formátum"

    return True, f"OK ({len(data['ugyletek'])} ügylet){stale}"


def main():
    show_all = "--all" in sys.argv
    tokens = [
        os.path.basename(p)[:-5]
        for p in sorted(glob.glob(os.path.join(PARTNERS_DIR, "*.json")))
    ]

    hibak = []
    for t in tokens:
        ok, msg = check_token(t)
        if not ok:
            hibak.append((t, msg))
            print(f"❌ {t}: {msg}")
        elif show_all:
            print(f"✅ {t}: {msg}")
        elif "⚠" in msg:
            print(f"⚠  {t}: {msg}")

    print(f"\n{len(tokens)} token ellenőrizve · {len(hibak)} hiba")
    sys.exit(1 if hibak else 0)


if __name__ == "__main__":
    main()
