# S Pen Tekentrainer

Elf tekenoefeningen voor de S Pen (lijnen, curves, slingerlijn, cirkels, ellipsen, hoeken,
proporties, perspectief, dozen, arcering, geheugen). Elke streek wordt meteen nagekeken en
het niveau groeit mee.

**App:** https://barud-game.github.io/tekentrainer/ — open in Chrome op de telefoon,
menu ⋮ → *App installeren*. Werkt daarna ook offline.

## Aanpassen

De broncode staat in `bron/`:
- `index.html` — de app (menu, tekenscherm, niveaus, scores)
- `hulp.js` — gedeelde rekenhulp
- `oefeningen/*.js` — één bestand per oefening (zie `CONTRACT.md`)

Opnieuw bouwen (Python 3 + PyQt5 voor de iconen):

```
cd bron
python3 bouw_app.py      # maakt bron/app/
cp app/* ..              # zet de nieuwe app in de root voor GitHub Pages
```
