# Session Handoff — 07.01 kampány: személyes kártya + launch-higiénia + GYIK
**Dátum:** 2026.06.27. | **Státusz:** Lezárva ✅

## Mit csináltunk
- **07.01 kampány megtervezve** (leadadó ranglista + start bónusz), döntések rögzítve (lásd lent).
- **Személyes összegző kártya** beépítve a Saját Ügyleteim tetejére — kliens-oldali, B-ready (commit `e5237cbb`).
- **Launch-higiénia:** `changelog.json` 07.01 indulási bejegyzés + **Versenyek menü elrejtve** launchra (commit `73e9bd2c`).
- **GYIK feltöltve** — 11 kérdéses natív accordion (commit `e5843455`), majd csiszolva: EH-kérdés törölve + magyarosítás (commit `88c6ccbe`).
- **Tisztázva:** EH = „egység" (NEM „egységhitel"); Pingelés = emlékeztető a megkötésre (NEM aktiválás); versenyek/bónusz **kötés-alapúak**.

## Kód változtatások

### 1. `assets/script.js` — személyes összegző kártya (ÚJ `renderSzemelyesOsszegzo`)
**UTÁNA** (új függvény a `renderPipelineTable` ELÉ, ~213. sor; lezárt = statusz tartalmazza „Megkötve"/„Folyósítva"):
```js
function renderSzemelyesOsszegzo(data) {
  // Ez a hónap (a "frissitve" bélyegből vett aktuális hó) + következő havi elszámolás (ha >0) + Folyamatban.
  // Mind kliens-oldalon a saját JSON-ból. B-HOOK: ha van data.osszegzo = {negyedev:{db,eh,cimke}, ev:{db,eh}},
  // a negyedéves/éves tile-ok MAGUKTÓL megjelennek.
  ...
}
```
A `renderPipelineTable` return ELÉ beszúrva: `renderSzemelyesOsszegzo(data) +` a `<p class="pipeline-meta">` elé.
**CSS:** `assets/style.css` — `.osszegzo-*` osztályok (zöld = hónap, réz = következő hó, ink = aggregált tile).
**Verifikáció (Python-tükör, preview nincs a repóra):** Robi JSON → Június 2/445, Július 1/266, Folyamatban 22/2502; December→Január évforduló + ezres-elválasztó zöld.

### 2. `changelog.json` — launch-bejegyzés
**UTÁNA** (tömb élére; az „Új" badge `isRecent` szerint 14 napig automatikus):
```json
{ "datum": "2026-07-01", "cim": "Elindult a megújult Leadadó Központ", "leiras": "..." }
```

### 3. Versenyek menü elrejtése (reversibilis, `LAUNCH:` kommentek)
- `index.html`: oldalsáv nav-link + mobil „több" panel item + a `#versenyek` szekció HTML-kommentbe zárva.
- `assets/script.js`: `versenyek` kivéve a scroll-spy `mbnSectionIds`-ből és a `SEARCH_INDEX`-ből.
- **Visszahozás:** csak töröld a `LAUNCH:` komment-kereteket → jön a nevesített ranglistával.

### 4. `index.html` — GYIK (#faq), natív `<details>` accordion (nincs JS)
- 11 kérdés; az 1. `open` alapból. CSS: `.faq-*` (custom `+`/`–` jelölő).
- EH-magyarázó kérdés TÖRÖLVE. Pingelés-válasz: „emlékeztető a megkötésre/elfogadásra".
- Magyarosítás: „közös ügyfeleid" / „adataidat nyitják meg" / „le nem zárul" / Q7 „/" → kötőszó.

## Döntések és elvek
- **EH = „egység"** (teljesítmény-mérőszám). NEM „egységhitel" (a régi handoff tévesen oldotta fel). Mindenki ismeri → GYIK-ben nem magyarázzuk.
- **Számolási elv (versenyek + bónusz): KÖTÉS-alapú** — bankszámla `3. Megkötve`, hitel `5. Folyósítva`. NEM aktiválás/kifizetés (bankonként eltér). **Pingelés = emlékeztető a megkötésre**, nem aktiválás.
- **Ranglista KÉTLÉPCSŐS:** (A) launchra a havi személyes kártya, nulla backend — KÉSZ. (B) kampány során nevesített összehasonlító ranglista **db + EH** szerint (az EH a leadadók közt nem titok); Kód.gs aggregál → `data/leaderboard.json`; mivel nyers URL-en bárki letölthetné, **worker mögé** (a partner-JSON-védelemmel egy menetben).
- **Start bónusz = csak comp-szabály (NEM rendszer-funkció):** új munkatárs, aki megszerzi a **pénzügyi közvetítői végzettséget** → a végzettség hónapja + a következő hónap ablakban (a +1 hónap szándékos: a csonka első hó kiegyenlítésére, mindenkinek teljes), ha **min. 10 megkötött bankszámla** (`3. Megkötve`, kumulatív) → egyszeri **50.000 Ft**. A haladás-követés Barnánál/közös jegyzetben, nem a portálon.
- **Versenyek launchra rejtve** (ne legyen két „hamarosan").

## Aktuális backlog státusz
- [x] Személyes összegző kártya (havi + következő havi + folyamatban), B-ready
- [x] Launch-higiénia: 07.01 changelog-bejegyzés + Versenyek menü rejtés
- [x] GYIK (11 kérdés) feltöltve + csiszolva
- [ ] **KÖVETKEZŐ — Mobil-verifikáció (Barna):** kártya + tábla + GYIK telefonon, valós tokennel, 07.01 ELŐTT
- [ ] 🏆 **Nevesített ranglista backend:** Kód.gs `osszegzo` precompute a partner-JSON-okba (a negyedéves/éves tile-okat élesíti) + `leaderboard.json` aggregálás + worker mögé
- [ ] 🎁 **Start bónusz + onboarding email** szövegek (comp-szabály kommunikációja, nem build)
- [ ] ⏳ Worker push-teszt (Off + státuszváltás a néma baseline-ütem után) — előző körből nyitva
- [ ] ⏳ Heti digest élesítés: `/test-weekly` → `WEEKLY_ENABLED="true"`
- [ ] 🔒 Partner-adat a worker mögé (igazi adatvédelem) — a nevesített ranglistával egy menetben

## Rendszer aktuális állapota
| Komponens | Állapot |
|---|---|
| Frontend (GitHub Pages, `main`) | élő; személyes kártya + GYIK kint, Versenyek rejtve |
| Személyes kártya | kliens-oldali, B-hook kész (`data.osszegzo` fogadása) |
| Kód.gs `osszegzo` precompute | NINCS még — a B-tile-okhoz + ranglistához kell |
| Service worker | `lk-v6`, partner-JSON `no-store` |
| Worker `leadado-push` | élő; push-teszt függőben (Barna) |
| Heti digest | kód kész, `WEEKLY_ENABLED=false` |
| Memóriák | frissítve (project_leadado_kozpont: EH=egység, kötés-alapú elv, kampány-állapot) |

## Következő session nyitó promptja
> Leadadó: építsük meg a nevesített ranglista backendjét — Kód.gs `exportPartnerJsonFiles()`-be a partner-JSON-okba `osszegzo` precompute (negyedéves/éves lezárt db+EH), és az aggregált `data/leaderboard.json`. A frontend `renderSzemelyesOsszegzo` már fogadja a `data.osszegzo`-t. Utána a start bónusz + onboarding email szövegek.
