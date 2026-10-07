"""Zet OpenSketch-schetsen (product designers, CC0) om naar extra/opensketch-data.js voor Ontwerpschets.

Nodig: de twee zips van https://repo-sam.inria.fr/d3/OpenSketch/ uitgepakt in één map:
  sketches_json_first_viewpoint/            (Data/sketches/sketches_json_first_viewpoint.zip)
  sketches_labeling_first_viewpoint/        (Data/labeling/sketches_labeling_first_viewpoint.zip)

  python3 extra/maak_opensketch.py /pad/naar/map

Per schets: alleen niet-gewiste streken met een bruikbaar lijntype, dubbel overgetrokken lijnen
eruit, gladgestreken en vereenvoudigd. Daarna in de volgorde van een ontwerper: eerst de opzet
(assen, hulplijnen), dan de vorm (silhouet, randen, doorsneden). Arcering blijft weg: de
arceervlakken in OpenSketch liggen verspreid over het product en passen niet in één schaduwvlak.
Elke stap is een groepje van 2-4 lijnen."""
import glob
import json
import math
import os
import sys

import numpy as np

UIT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "opensketch-data.js")

# lijntypes uit OpenSketch (zie Data/labeling/downloads.html)
OPZET = {3, 4, 6, 7, 8, 9, 10}          # verborgen randen, assen, hulplijnen, lijnen naar VP, vierkant voor ellips, raaklijnen
VORM = {0, 1, 2, 5, 11, 24}             # silhouet, randen, dalen, doorsneden, omtrek

NAMEN = {
    "bumps": "Hobbelvlak", "flange": "Flens", "hairdryer": "Föhn", "house": "Huisje", "mixer": "Keukenmixer",
    "mouse": "Computermuis", "potato_chip": "Chipje", "shampoo_bottle": "Shampoofles", "tubes": "Buizen",
    "vacuum_cleaner": "Stofzuiger", "waffle_iron": "Wafelijzer", "wobble_surface": "Golvend vlak",
}

MAX_OPZET, MAX_VORM = 12, 26
MIN_LIJNEN, MAX_SCHETSEN = 14, 48
SNIPPER = 0.15                          # meer inkt in losse stukjes: te versnipperd


def lengte(p):
    return float(np.sum(np.hypot(*np.diff(p, axis=0).T))) if len(p) > 1 else 0.0


def herbemonster(p, stap):
    d = np.concatenate([[0], np.cumsum(np.hypot(*np.diff(p, axis=0).T))])
    if d[-1] < stap:
        return p[[0, -1]]
    t = np.linspace(0, d[-1], max(2, int(d[-1] / stap) + 1))
    return np.stack([np.interp(t, d, p[:, 0]), np.interp(t, d, p[:, 1])], axis=1)


def glad(p, n=2):
    if len(p) < 5:
        return p
    q = p.copy()
    for _ in range(n):
        q[1:-1] = (q[:-2] + 2 * q[1:-1] + q[2:]) / 4
    return q


def rdp(p, eps):
    if len(p) < 3:
        return p
    a, b = p[0], p[-1]
    ab = b - a
    n = np.hypot(*ab)
    if n < 1e-9:
        d = np.hypot(*(p - a).T)
    else:
        d = np.abs(ab[0] * (p[:, 1] - a[1]) - ab[1] * (p[:, 0] - a[0])) / n
    i = int(np.argmax(d))
    if d[i] <= eps:
        return np.stack([a, b])
    return np.concatenate([rdp(p[: i + 1], eps)[:-1], rdp(p[i:], eps)])


def draaiing(p):
    """opgetelde (getekende) richtingsverandering per punt, op een grof bemonsterde versie"""
    v = np.diff(p, axis=0)
    w = np.arctan2(v[:, 1], v[:, 0])
    return np.concatenate([[0, 0], np.cumsum((np.diff(w) + np.pi) % (2 * np.pi) - np.pi)])


def soort(p, diag):
    L = lengte(p)
    a, b = p[0], p[-1]
    ab = b - a
    n = np.hypot(*ab)
    if n > 1e-9:
        dev = np.abs(ab[0] * (p[:, 1] - a[1]) - ab[1] * (p[:, 0] - a[0])) / n
        if dev.max() < max(0.012 * L, 0.004 * diag) and L > 0:
            return "lijn", p
    if L > diag * 0.08:
        q = herbemonster(p, L / 80)
        dr = draaiing(q)
        # ontwerpers draaien een ellips vaak twee, drie keer rond: houd één ronde over
        rond = np.nonzero(np.abs(dr) >= 2 * np.pi)[0]
        if len(rond):
            q = q[: rond[0] + 2]
        w, h = q.max(axis=0) - q.min(axis=0)
        bol = min(w, h) > 0.15 * max(w, h)          # een haakje is smal, een ellips niet
        if bol and len(rond) and np.hypot(*(q[-1] - q[0])) < 0.3 * lengte(q):
            return "ellips", q
        if bol and abs(dr[-1]) > 1.6 * np.pi and np.hypot(*(q[-1] - q[0])) < 0.15 * L:
            return "ellips", q
        if len(rond):
            return "curve", q
    return "curve", p


def afstand_tot(p, q):
    """kleinste afstand van elk punt van p tot de polylijn q (via dichte bemonstering van q)"""
    d = np.hypot(p[:, None, 0] - q[None, :, 0], p[:, None, 1] - q[None, :, 1])
    return d.min(axis=1)


def richting(p, kop):
    """looprichting (eenheidsvector) aan het begin (kop=True) of aan het eind van de streek"""
    n = max(2, len(p) // 8)
    v = p[n - 1] - p[0] if kop else p[-1] - p[-n]
    return v / max(np.hypot(*v), 1e-9)


def koppel(lijnen, diag):
    """ontwerpers zetten een lange lijn vaak in een paar stukken neer: plak opeenvolgende streken van
    dezelfde fase aan elkaar als de ene ongeveer begint waar de vorige eindigt, in dezelfde richting"""
    uit = []
    for l in sorted(lijnen, key=lambda l: l["i"]):
        v = uit[-1] if uit else None
        if v and v["fase"] == l["fase"]:
            a = v["p"]
            beste = None
            for b in (l["p"], l["p"][::-1]):
                gat = np.hypot(*(b[0] - a[-1]))
                if gat < diag * 0.015 and np.dot(richting(a, False), richting(b, True)) > 0.8:
                    beste = b if beste is None or gat < np.hypot(*(beste[0] - a[-1])) else beste
            if beste is not None:
                v["p"] = np.concatenate([a, beste])
                continue
        uit.append(dict(l))
    for l in uit:
        l["L"] = lengte(l["p"])
    return uit


def verwerk(sk, labels, diag):
    strokes = [s for s in sk["strokes"] if str(s.get("is_removed")).lower() != "true"]
    if len(strokes) != len(labels) or any(isinstance(s.get("points"), str) for s in strokes):
        return None
    lijnen = []
    for i, (s, lab) in enumerate(zip(strokes, labels)):
        ruw = s.get("points", [])
        ruw = [ruw] if isinstance(ruw, dict) else ruw   # een streek van één punt staat soms los opgeslagen
        pts = [(q["x"], q["y"]) for q in ruw if isinstance(q, dict) and q.get("p", 1) > 0.02]
        if len(pts) < 2:
            continue
        p = np.array(pts, dtype=float)
        fase = "opzet" if lab in OPZET else "vorm" if lab in VORM else None
        if not fase:
            continue
        p = herbemonster(p, diag * 0.004)
        p = glad(p, 3)
        if lengte(p) < diag * 0.008:
            continue
        lijnen.append({"i": i, "fase": fase, "p": p})

    lijnen = koppel(lijnen, diag)
    vk = [l["L"] for l in lijnen if l["fase"] == "vorm"]
    # aandeel van de vorm-inkt in korte stukjes: hoog = versnipperd getekend, past niet in deze minigame
    snipper = sum(L for L in vk if L < diag * 0.05) / max(sum(vk), 1e-9)
    lijnen = [l for l in lijnen if l["L"] >= diag * (0.06 if l["fase"] == "opzet" else 0.05)]

    # dubbel overgetrokken lijnen weg: de langste blijft, een lijn die grotendeels over een
    # al gekozen lijn valt (ontwerpers trekken lijnen vaak meerdere keren) vervalt
    tol = diag * 0.012
    gekozen = []
    for l in sorted(lijnen, key=lambda l: -l["L"]):
        q = herbemonster(l["p"], diag * 0.01)
        dubbel = False
        for g in gekozen:
            if afstand_tot(q, g["q"]).max() < 3 * tol and np.mean(afstand_tot(q, g["q"]) < tol) > 0.6:
                dubbel = True
                break
        if not dubbel:
            l["q"] = q
            gekozen.append(l)

    opzet = sorted([l for l in gekozen if l["fase"] == "opzet"], key=lambda l: -l["L"])[:MAX_OPZET]
    vorm_alle = [l for l in lijnen if l["fase"] == "vorm"]
    vorm = sorted([l for l in gekozen if l["fase"] == "vorm"], key=lambda l: -l["L"])[:MAX_VORM]
    for l in opzet + vorm:
        l["s"], l["p"] = soort(l["p"], diag)
        p = rdp(l["p"], diag * (0.0008 if l["s"] == "ellips" else 0.0025))
        if l["s"] == "lijn":
            p = l["p"][[0, -1]]
        l["uit"] = p

    dekking = 0.0
    if vorm and vorm_alle:
        inkt = np.concatenate([herbemonster(l["p"], diag * 0.01) for l in vorm_alle])
        gek = np.concatenate([herbemonster(l["p"], diag * 0.005) for l in vorm])
        dekking = float(np.mean(afstand_tot(inkt, gek) < tol * 1.5))
    gem_l = float(np.mean([l["L"] for l in vorm])) / diag if vorm else 0
    return opzet, vorm, dekking, snipper


def groepen(lijnen, max_n):
    """in tekenvolgorde, groepjes van 2..max_n; een ellips staat op zichzelf of met één ander"""
    lijnen = sorted(lijnen, key=lambda l: l["i"])
    uit, cur = [], []
    for l in lijnen:
        cur.append(l)
        n_ell = sum(1 for c in cur if c["s"] == "ellips")
        if len(cur) >= max_n or (n_ell and len(cur) >= 2):
            uit.append(cur)
            cur = []
    if cur:
        if len(cur) == 1 and uit and len(uit[-1]) < max_n + 1:
            uit[-1].append(cur[0])
        else:
            uit.append(cur)
    return uit


def main(map_):
    D = os.path.join(map_, "sketches_json_first_viewpoint")
    L = os.path.join(map_, "sketches_labeling_first_viewpoint")
    tekeningen = []
    for f in sorted(glob.glob(os.path.join(L, "*", "*", "strokes_lines_types_view1_presentation.json"))):
        ontw, obj = f.split(os.sep)[-3:-1]
        alt = os.path.join(L, ontw, obj, "view1_presentation.json")
        src = alt if os.path.exists(alt) else os.path.join(D, ontw, obj, "view1_presentation.json")
        if not os.path.exists(src):
            continue
        sk = json.load(open(src))
        labels = json.load(open(f))["strokes_line_types"]
        diag = math.hypot(sk["canvas"]["width"], sk["canvas"]["height"])
        r = verwerk(sk, labels, diag)
        if not r:
            print("overgeslagen (labels passen niet of kapot bestand):", ontw, obj)
            continue
        opzet, vorm, dekking, snipper = r
        if snipper > SNIPPER:
            print("overgeslagen (te versnipperd, %.2f):" % snipper, ontw, obj)
            continue
        if len(opzet) + len(vorm) < MIN_LIJNEN or len(vorm) < 8:
            print("overgeslagen (te weinig lijnen):", ontw, obj, len(opzet), len(vorm))
            continue
        alle = np.concatenate([l["uit"] for l in opzet + vorm])
        x0, y0 = alle.min(axis=0)
        x1, y1 = alle.max(axis=0)
        s = max(x1 - x0, y1 - y0)
        norm = lambda p: [[round((x - x0) / s, 3), round((y - y0) / s, 3)] for x, y in p]
        stappen = []
        for fase, lijst, n in (("opzet", opzet, 4), ("vorm", vorm, 3)):
            for g in groepen(lijst, n):
                stappen.append({"fase": fase, "lijnen": [{"soort": l["s"], "punten": norm(l["uit"])} for l in g]})
        t = {
            "id": "%s-%s" % (ontw.lower(), obj), "naam": NAMEN.get(obj, obj), "ontwerper": ontw.replace("Professional", "Designer ").replace("student", "Student "),
            "breedte": round((x1 - x0) / s, 3), "hoogte": round((y1 - y0) / s, 3), "stappen": stappen,
        }
        t["_score"] = (0 if ontw.startswith("Professional") else 1, abs(len(opzet) + len(vorm) - 28))
        tekeningen.append(t)
        print("ok:", ontw, obj, "dekking %.2f snipper %.2f" % (dekking, snipper), "opzet", len(opzet), "vorm", len(vorm), "stappen", len(stappen))

    # maximaal MAX_SCHETSEN: eerst professionals, en per object afwisselend
    tekeningen.sort(key=lambda t: t["_score"])
    per_obj = {}
    gekozen = []
    for t in tekeningen:
        obj = t["id"].split("-", 1)[1]
        if per_obj.get(obj, 0) < math.ceil(MAX_SCHETSEN / 12):
            per_obj[obj] = per_obj.get(obj, 0) + 1
            gekozen.append(t)
    gekozen = gekozen[:MAX_SCHETSEN]
    gekozen.sort(key=lambda t: t["id"])
    for t in gekozen:
        del t["_score"]

    with open(UIT, "w", encoding="utf-8") as fh:
        fh.write("// Gegenereerd door extra/maak_opensketch.py, niet met de hand aanpassen.\n")
        fh.write("// Bron: OpenSketch (Gryaditskaya et al., SIGGRAPH Asia 2019), CC0 — repo-sam.inria.fr/d3/OpenSketch\n")
        fh.write("window.OpenSketchData = {\n  bron: 'OpenSketch-dataset (CC0) — schetsen van productontwerpers',\n  tekeningen: [\n")
        for t in gekozen:
            fh.write(json.dumps(t, ensure_ascii=False, separators=(",", ":")) + ",\n")
        fh.write("  ],\n};\n")
    print(len(gekozen), "schetsen geschreven naar", UIT, os.path.getsize(UIT) // 1024, "KB")


if __name__ == "__main__":
    main(sys.argv[1] if len(sys.argv) > 1 else ".")
