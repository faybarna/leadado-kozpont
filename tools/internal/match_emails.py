#!/usr/bin/env python3
"""
Token → e-mail párosító. A partner JSON-ok 'partner' mezőjét veti össze egy
külső CSV-vel (Név,Email). A CSV NEM kerül a repóba — argumentumként adjuk meg.

Használat:
  python3 tools/internal/match_emails.py "/path/to/emails.csv"
"""

import json
import sys
import glob
import os
import csv
import unicodedata

PARTNERS_DIR = os.path.join(os.path.dirname(__file__), "..", "..", "data", "partners")


def norm(s):
    s = unicodedata.normalize("NFKD", s).encode("ascii", "ignore").decode().lower()
    return " ".join(s.split())


def main():
    if len(sys.argv) < 2:
        print("Adj meg egy CSV útvonalat.")
        sys.exit(1)

    # CSV beolvasás → normalizált név -> email
    csv_map = {}
    with open(sys.argv[1], encoding="utf-8") as f:
        reader = csv.reader(f)
        next(reader, None)  # fejléc
        for row in reader:
            if len(row) < 2 or "@" not in row[1]:
                continue
            csv_map[norm(row[0])] = (row[0].strip(), row[1].strip())

    matched, unmatched = [], []
    for p in sorted(glob.glob(os.path.join(PARTNERS_DIR, "*.json"))):
        token = os.path.basename(p)[:-5]
        partner = json.load(open(p, encoding="utf-8")).get("partner", "")
        key = norm(partner)
        hit = csv_map.get(key)
        # részleges egyezés, ha a teljes név nem stimmel (pl. közbülső név)
        if not hit:
            for ck, cv in csv_map.items():
                if key and (key in ck or ck in key):
                    hit = cv
                    break
        if hit:
            matched.append((token, partner, hit[1]))
        else:
            unmatched.append((token, partner))

    print(f"=== PÁROSÍTVA ({len(matched)}) ===")
    for t, p, e in matched:
        print(f"  {t:34s} {p:24s} -> {e}")
    if unmatched:
        print(f"\n=== NINCS E-MAIL ({len(unmatched)}) ===")
        for t, p in unmatched:
            print(f"  {t:34s} {p}")


if __name__ == "__main__":
    main()
