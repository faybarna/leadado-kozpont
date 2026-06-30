# Leadadó Központ — kampány-kiküldés munkalap (07.01)

Ez az egyetlen igazságforrás a kampány-nyitó email kiküldéséhez.
**Folyamat:** Barna kipipálja ki megy / ki marad ki + beírja az emailt → „**start**" → Claude
egy **piszkozatot (draft)** készít minden „MEGY" címzetthez a Gmailbe, névre + linkre
személyre szabva. A piszkozatokat Barna nézi át és küldi el (Claude nem küld, csak draftol).

- **Jelszó:** `lead123!` (most marad)
- **Forma:** sima szöveg (nem HTML)
- **⚠️ Minden címzettnek KÜLÖN levél** — soha nem közös To/CC (személyes link!).

---

## Zárolt levélszöveg

**Tárgy:** `Megújult a Leadadó Központ — itt a saját hozzáférésed`

**Törzs** (a `{{NÉV}}` és `{{LINK}}` automatikusan behelyettesítve):

```
Szia {{NÉV}},

Elindul a legújabb fejlesztésünk, a Leadadó Központ — innentől minden, ami a közös
munkához kell, egy helyen van, és valós időben látod, hol tartanak a hozzám beküldött
ügyfeleid.

Mit találsz odabent:
- Saját Ügyleteim — élőben követed minden ügyfeled állását (kalkulációtól folyósításig),
  egy összegző kártya pedig mutatja a havi lezárt ügyleteidet és az EH-dat.

- Értesítések a telefonodra — automata push üzenet, amint mozdul egy ügyleted:
  státuszváltás, sürgetendő tétel, sikeres folyósítás vagy sikeres számlanyitás.

- AI Asszisztens bekötve — bankszámla-feltételek, dokumentumkérdések, tipikus
  ügyfélhelyzetek; kérdezd meg, mielőtt telefonálnál.

- Hiteladatlapok és sablonok — termékenként, mindig az aktuális verzió.

- Dokumentum-igénylisták — interaktív checklist: pontosan mit kérj be az ügyféltől
  induláskor, hogy ne akadjon el az ügylet hiánypótláson.

- Lead beküldése egy gombbal — a Saját Ügyleteim tetején a „➕ Új lead leadása"
  gombbal pár kattintással átadod az új ügyfelet (bankszámla vagy hitel), és egyből
  a Te neveden érkezik be hozzám. Strukturált űrlap, így rögtön minden fontos adat
  megvan — nincs többé oda-vissza levelezés.

A személyes hozzáférésed:
Linked: {{LINK}}
Jelszó: lead123!

A link csak a Te ügyleteidet mutatja — kérlek, ne add tovább.

Tedd ki a telefonod kezdőképernyőjére (2 perc) — így egy ikonról nyílik, és csak így
kaphatsz értesítést:
- iPhone: nyisd meg a linket Safariban, alul a Megosztás ikon, majd „Főképernyőhöz adás".
- Android: nyisd meg Chrome-ban, a felugró „Alkalmazás telepítése" sáv, vagy a menü → Telepítés.
- Képes útmutató: https://faybarna.github.io/leadado-kozpont/onboarding/telepites.html

Ha valami nem nyílik vagy hibás adatot látsz, írj — egy perc és megoldom.

Sok sikert, sok leadet,
Üdv
Barna
```

---

## Címzett-tábla

Jelöld a **Megy?** oszlopot (`I` = megy / `N` = kihagy), és írd be az **Email**-t.
Üres email = nem tudok draftot készíteni hozzá (kihagyom és jelzem).

| Megy? | Név | Email | Link (?p= token) |
|---|---|---|---|
| N | Fáy Barna (te magad) | fay.barna@ovb.hu | fay-barna-e749fc50 |
| I | Gentischer Richárd (Ricsi – tesztelt ✅) | gentischer.richard@ovb.hu | gentischer-richard-1667baf1 |
| I | Angelcsev Zoé | angelcsev.zoe@ovb.hu | angelcsev-zoe-4a167fe4 |
| I | Bagócsi Renáta | nyitraibagocsi.renata@ovb.hu | bagocsi-renata-d2145295 |
| I | Bencsik Pál | bencsik.pal@ovb.hu | bencsik-pal-f511d9cb |
| I | Blanka Barbara | blanka.barbara@ovb.hu | blanka-barbara-98f366e5 |
| N | Csombók István | csombok.istvan@ovb.hu | csombok-istvan-e5a6e743 |
| I | Encz Emese Sarolta | encz.emese@ovb.hu | encz-emese-e00abd89 |
| I | Esch Patricia | esch.patricia@ovb.hu | esch-patricia-78135933 |
| I | Fábián Kristóf | f.kristof0110@gmail.com | fabian-kristof-1a3ed13a |
| N | Fenyves Ádám Kristóf | fenyves.adam@ovb.hu | fenyves-adam-fed27360 |
| I | Gaál Boglárka | gaal.boglarka@ovb.hu | gaal-boglarka-65d33764 |
| N | Gaál Philip Paul | gaal.philip@ovb.hu | gaal-philip-8f68d9d9 |
| I | Gulyás Gyula | gulyas.gyula1@ovb.hu | gulyas-gyula-3e7d80fd |
| N | Hajtó Krisztián | hajto.krisztian@ovb.hu | hajto-krisztian-39c0cb52 |
| I | Holló Bernadett | hollo.bernadett@ovb.hu | hollo-detti-c8c8050e |
| N | Iski Tamás | iski.tamas@ovb.hu | iski-tamas-dc30543f |
| I | Kács Szabolcs | szabikacs@gmail.com | kacs-szabolcs-ed40ef17 |
| I | Keserű Flóra Luca | keseruluca1@gmail.com | keseru-flora-f8fd0ba8 |
| I | Kis Izabella | kis.izabella@ovb.hu | kis-izabella-05e0d3c0 |
| I | Konkoly Szilárd | konkoly.szilard@ovb.hu | konkoly-szilard-13bb3569 |
| N | Kópis László | kopis.laszlo@ovb.hu | kopis-laszlo-b0341314 |
| I | Lamatsch Roland | lamatsch.roland@gmail.com | lamatsch-roland-101ac616 |
| N | Lőrincz Sándor | lorincz.sandor@ovb.hu | lorincz-sandor-a043bae1 |
| I | Mátyus Dávid | matyus.david@ovb.hu | matyus-david-603803a8 |
| I | Nánási Fatime | nanasi.fatime@ovb.hu | nanasi-fatime-ba675543 |
| I | Perecz Gergely | perecz.gergely@ovb.hu | perecz-gergely-2b26fa8a |
| N | Petrei Tamás | petrei.tamas@ovb.hu | petrei-tamas-849e63f8 |
| I | Pirka András Levente | pirkaandrasvagyoneked@gmail.com | pirka-andras-1cc2784d |
| I | Lőrinc Róbert (Robi) | premium@lorincrobert.com | robi-7f3a2b91 |
| I | Rostás Tibor | r.tibusz@gmail.com | rostas-tibor-638b34fa |
| I | Sellei Abigél | sellei.abigel@ovb.hu | sellei-abigel-3851d6ca |
| I | Séra Milán | sera.milan@ovb.hu | sera-milan-d89c078b |
| I | Steinmetz Edvárd | edvard.ovb@gmail.com | steinmetz-edvard-32e97cc3 |
| N | Varga Glória | ⚠ EMAIL KELL (08.01, ügylettel) | varga-gloria-548655d6 |
| N | Varga Sándor | sandorvarga000@gmail.com | varga-sandor-a5534ea9 |

> Link teljes alakja: `https://faybarna.github.io/leadado-kozpont/?p=<token>`
>
> **KÉTLÉPCSŐS ROLLOUT (Barna döntése 2026-06-30):**
> - **1. kör (07.01) — `I` = 26 fő.** Akiknél nincs idő-előtti kiszivárgás kockázata.
> - **2. kör (08.01) — `N` = 9 fő:** Csombók István, Fenyves Ádám Kristóf, Gaál Philip Paul,
>   Hajtó Krisztián, Iski Tamás, Kópis László, Lőrincz Sándor, Petrei Tamás, Varga Sándor.
>   („start"-kor csak az `I` sorokra készül draft; a `N` sorok 08.01-kor `I`-re válthatók.)
>
> **Emailek forrása:** `leadad_partnerek_email_cimei.csv` (2026-06-27) + 2026-06-30 frissítés.
> **2026-06-30 hozzáadva 1. körbe:** Bagócsi Renáta (token+JSON él) és Blanka Barbara (06-29 felvéve).
>
> ⚠️ **Varga Glória — 1. körös, DE blokkolt:** (a) hiányzik az email-címe (`⚠ EMAIL KELL`),
> (b) nincs még JSON-ja (nincs ügylete → üres pipeline). Email + (ideális esetben) első ügylet
> JSON-ja kell, mielőtt draftot kap. A többi token-de-nincs-JSON (Gentischer Gellért, Kozma Dávid,
> Huszár-Varga Diána) nincs az 1. körben.
>
> **Kihagyandók (megfontolás alatt):** Csaba és a Róbert Károly körúti iroda — nincs
> Leadadó GPT hozzáférésük. A fenti 34-ben nincs egyértelmű „Csaba"/„Róbert Károly";
> ha más néven futnak, állítsd őket `N`-re „start" előtt.

---

## „start" — mi történik

1. Beolvasom ezt a táblát; minden `I` soron, amihez van email, **draftot** készítek
   (tárgy + behelyettesített törzs, sima szöveg, egy címzett / draft).
2. `N` vagy üres-email sorokat kihagyom, és a végén listázom kik maradtak ki és miért.
3. Visszajelzem hány draft készült. Te nézed át és küldöd — én nem küldök el semmit.

**Email-címek:** ha nem írod be kézzel, „start"-kor megpróbálom Gmail-keresésből
kitölteni (from:/to: név) — de a draftokat akkor is TE ellenőrzöd küldés előtt, mert
rossz címzett = valakinek a személyes linkje rossz kézbe kerülne.
