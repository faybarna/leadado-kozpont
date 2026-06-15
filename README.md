# Leadadó Központ — Telepítési útmutató

Ez a mappa a teljes weboldalt tartalmazza. Nincs szükség programozásra —
a GitHub webes felülete drag & drop-ot támogat.

---

## 1. Új repó létrehozása (5 perc)

1. Lépj be a [github.com](https://github.com) fiókodba (`faybarna`)
2. Jobb felül **+** → **New repository**
3. **Repository name:** `leadado-kozpont`
4. Állítsd **Public**-ra (ez kell a GitHub Pages-hez)
5. NE jelöld be a "Add a README file" opciót (ebben a mappában már van egy)
6. **Create repository**

---

## 2. Fájlok feltöltése (2 perc)

1. Az új, üres repó oldalán kattints: **uploading an existing file**
2. Húzd be **az összes fájlt és mappát** ebből a mappából a böngészőablakba:
   - `index.html`
   - `changelog.json`
   - `README.md`
   - `assets/` mappa (benne: `style.css`, `script.js`)
3. Görgess le, **Commit changes**

> A `assets` mappát egyben húzd be — a Github megtartja a mappastruktúrát.

---

## 3. GitHub Pages bekapcsolása (1 perc)

1. A repó tetején: **Settings**
2. Bal oldali menü: **Pages**
3. **Branch:** válaszd `main`, mappa: `/ (root)`
4. **Save**
5. Várj ~1-2 percet, majd frissítsd az oldalt — megjelenik a publikus link:
   ```
   https://faybarna.github.io/leadado-kozpont/
   ```

---

## 4. Tesztelés

- Nyisd meg a linket telefonon és gépen is
- Jelszó: **lead123!**
- Ellenőrizd: AI Asszisztens link, Drive mappa link, dokumentum-igénylisták,
  Újdonságok napló megjelenik

---

## 5. Hogyan tovább

- **Új changelog-bejegyzés felvétele:** `changelog.json` megnyitása a GitHub
  felületén → ceruza ikon (Edit) → új sor hozzáadása a tömb elejéhez:
  ```json
  {
    "datum": "2026-06-20",
    "cim": "Új eszköz: ...",
    "leiras": "Rövid leírás, mit lehet most csinálni."
  }
  ```
  → **Commit changes** → 1 perc múlva élesben látszik.

- **Nagyobb bővítés** (Dokumentum Checklist beágyazás, képzési anyagok PDF
  feltöltése): Claude Code session a `leadado-kozpont` repóra — ezek a fájlok
  a `bogixbarna_ops` repóból átemelhetők.

- **Domain csere később:** ha lesz saját domain (pl. `faybarna.hu`), a
  Settings → Pages → "Custom domain" mezőbe beírva, és egy CNAME rekorddal
  a domain-szolgáltatónál átirányítható. Nem kell újraépíteni semmit.

---

## Biztonsági megjegyzés

A jelszó kliensoldali — ez **nem titkosítás**, hanem szűrő a véletlen
rátalálás és a Google-indexelés ellen. Mivel a tartalom (eszközök, sablonok,
linkek) nem tartalmaz ügyfél-PII-t, ez arányos védelem. Ha a jövőben
ügyfél-specifikus adat kerülne fel, az **más típusú hozzáférés-védelmet**
igényel — az egy külön tétel.
