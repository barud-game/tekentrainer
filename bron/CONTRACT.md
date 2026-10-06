# Tekentrainer: hoe een oefening eruitziet

De app (`index.html`) regelt: het tekenvlak, S Pen-invoer, inkt tekenen, niveaus 1–5
(automatisch omhoog/omlaag), scores bewaren, de score tonen en naar de volgende opgave gaan.
Een oefening is één bestand `oefeningen/<id>.js` dat zich aanmeldt met `Tekentrainer.registreer({...})`.
Bekijk `oefeningen/ellipsen.js` als voorbeeld.

## Wat de app aanlevert

- `vlak` = `{ w, h, pxPerMm, kleur }`: afmeting van het tekenvlak in CSS-pixels. Gebruik maten
  relatief aan `Math.min(vlak.w, vlak.h)` zodat het op elk scherm past (telefoon liggend of staand).
- `vlak.kleur` = kleuren uit het thema. **Gebruik alleen deze, nooit eigen kleurcodes**
  (een design-agent past het thema later aan):
  `hulp` (hulplijnen, kaders), `hulpZacht` (heel lichte hulp/ghost), `accent` (start-stip, nadruk),
  `goed` (ideale vorm in uitslag), `fout` (foutmarkeringen), `tekst`, `tekstZacht`, `inkt`.
- `streken` = array van streken; elke streek = `{ punten: [{x, y, p, t}, ...] }`
  (x/y in CSS-pixels, p = druk 0..1, t = ms). Alleen S Pen-streken (of muis in testmodus).
- `rng` = random-generator: `rng()` → 0..1, `rng.tussen(a, b)`, `rng.kies(lijst)`.
- `window.Hulp` (zie `hulp.js`): `lin(x, goed, slecht)` → 0..1, `herbemonster`, `herbemonsterN`,
  `lijnFit` (PCA), `lijnAfstand`, `segmentAfstand`, `polyAfstand`, `snelheden`, `lijnHoekVerschil`,
  `gemiddelde`, `sd`, `mediaan`, `lengte`, `afstand`, `clamp`.

## Wat de oefening aanlevert

```js
Tekentrainer.registreer({
  id: 'ellipsen',                 // = bestandsnaam
  naam: 'Ellipsen',               // kort, Nederlands
  uitleg: 'Teken in één streek een ellips die de 4 streepjes raakt.',  // 1 zin, staat boven in beeld
  fundament: 'Vloeiende gesloten vormen vanuit je schouder.',          // 1 zin voor het menu

  meerdereStreken: false,  // true = opgave bestaat uit meerdere streken; app toont dan een "Klaar"-knop
  stilNa: 0,               // ms; >0 = bij meerdere streken automatisch nakijken na zoveel ms zonder pen
  toonUitslag: 1400,       // ms dat de uitslag blijft staan

  // Nieuwe opgave voor niveau 1..5. Geef een eigen object terug. Optionele velden die de app leest:
  //   verbergNa: ms  -> daarna roept de app teken() aan met info.verborgen = true (geheugen-oefeningen)
  //   animeer: true  -> de app tekent elk frame opnieuw (bv. een meelopende tempo-stip)
  nieuweOpgave(niveau, rng, vlak) { return {...}; },

  // Hulplagen tekenen (kaders, stippen, gidsen). info = { nu, sinds, verborgen, streken }.
  teken(ctx, opgave, vlak, info) {},

  // Na elke pen-op: moet er nu nagekeken worden? (Optioneel; standaard: !meerdereStreken.)
  isKlaar(opgave, streken) { return true; },

  // Nakijken. Geef { score: 0..100, tip: 'korte Nederlandse tip' } terug,
  // of { ongeldig: 'Te kort, probeer opnieuw' } om de streek(en) te negeren en opnieuw te laten proberen.
  // Extra velden mag je toevoegen; je krijgt het object terug in tekenUitslag.
  nakijken(opgave, streken, vlak) { return { score, tip }; },

  // Uitslag tekenen bovenop de inkt: ideale vorm (kleur.goed), fouten (kleur.fout).
  // De app tekent de score en tip zelf; scorePlek bepaalt waar (standaard midden van het vlak).
  tekenUitslag(ctx, opgave, streken, uitslag, vlak) {},
  scorePlek(opgave, vlak) { return { x: vlak.w / 2, y: vlak.h / 2 }; },  // optioneel

  // Na de uitslag (optioneel): geef 'stop' terug om niet automatisch door te gaan;
  // de app wacht dan op een tik op het vlak en roept daarna nieuweOpgave() aan.
  naUitslag(opgave, uitslag) {},
});
```

Extra mogelijkheden:
- `{ ongeldig: 'tekst', behoud: true }` toont alleen de melding; de streken blijven staan en je tekent verder.
- `uitslag.geenNiveau = true`: de score telt niet mee voor niveau, gemiddelde en beste (gebruikt door de minigame).
- Per opgave kun je `meerdereStreken`, `stilNa` en `toonUitslag` overschrijven door ze op het opgave-object te zetten.
- De app houdt de uitslag de eerste 5 keer per oefening vast tot een tik, en daarna lang genoeg om de tip te lezen.
  Houd tips daarom kort (liefst onder ±120 tekens; er passen er 4 regels).
- Elke poging wordt gelogd (localStorage `tt.log`, en in de Artifact-versie ook in de database);
  alle numerieke velden op het hoogste niveau van je uitslag komen als `deelscores` in dat log.

## Regels

- Alleen gewone browser-JavaScript, geen libraries, geen `import`, geen netwerk, geen localStorage
  (dat doet de app). Alles binnen je eigen bestand; zet hulpfuncties binnen een IIFE.
- Tekst voor de gebruiker in het Nederlands, kort en direct. Tips zeggen wat er mis ging én wat je anders doet.
- Score 0–100, waarbij een nette poging van een gevorderde ±85–95 haalt en een duidelijke fout < 60.
- Niveau 1 moet echt makkelijk zijn, niveau 5 pittig. De app gaat omhoog bij gemiddeld ≥ 80
  over de laatste 5, en omlaag als de laatste 3 alle onder 45 zijn.
- Lijndiktes in hulplagen ±1.5–2.5 px; laat de opgave het tekenvlak goed vullen.
- Test je nakijkfunctie met gesimuleerde streken (een perfecte en een paar typische fouten) in Node:
  `node` met een klein script dat `hulp.js` en je bestand laadt (zet `global.window = global` en een
  nep `Tekentrainer.registreer`). Een perfecte streek moet hoog scoren, fouten moeten de juiste tip geven.
