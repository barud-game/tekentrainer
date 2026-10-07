# S Pen Tekentrainer

Elf tekenoefeningen voor de S Pen (lijnen, curves, slingerlijn, cirkels, ellipsen, hoeken,
proporties, perspectief, dozen, arcering, geheugen). Elke streek wordt meteen nagekeken en
het niveau groeit mee.

Daarnaast is er de minigame **Krabbelkunst**: teken lijn voor lijn een echte krabbel uit de
[Quick, Draw!-dataset](https://quickdraw.withgoogle.com/data) van Google (CC BY 4.0) na, arceer de
schaduw en zie je eigen tekening terug. Elke poging wordt lokaal gelogd; in het menu kun je die
oefendata als JSON exporteren.

De zware variant is **Ontwerpschets**: teken een echte perspectiefschets van een productontwerper uit
de [OpenSketch-dataset](https://repo-sam.inria.fr/d3/OpenSketch/) (Gryaditskaya et al., CC0) na, in de
volgorde van de ontwerper: eerst de opzet (assen, hulplijnen), dan de vorm. Elke stap is een groepje
lijnen; nagekeken wordt op dekking, nauwkeurigheid, losse streken, één vaste streek per lijn en
lijnkwaliteit.

**App:** https://barud-game.github.io/tekentrainer/ — open in Chrome op de telefoon,
menu ⋮ → *App installeren*. Werkt daarna ook offline.

## Aanpassen

De broncode staat in `bron/`:
- `index.html` — de app (menu, tekenscherm, niveaus, scores)
- `hulp.js` — gedeelde rekenhulp
- `oefeningen/*.js` — één bestand per oefening (zie `CONTRACT.md`)
- `extra/quickdraw-data.js` — geselecteerde Quick, Draw!-krabbels; `extra/minigame.js` — Krabbelkunst
- `extra/opensketch-data.js` — omgezette OpenSketch-schetsen; `extra/ontwerpschets.js` — Ontwerpschets.
  De data maak je opnieuw met `python3 extra/maak_opensketch.py <map>` (zie de uitleg bovenin dat script).

Opnieuw bouwen (Python 3 + PyQt5 voor de iconen):

```
cd bron
python3 bouw_app.py      # maakt bron/app/
cp app/* ..              # zet de nieuwe app in de root voor GitHub Pages
```
