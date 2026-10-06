// Ellipsen in een kader, van bijna-cirkel (niveau 1) tot smal en gedraaid (niveau 5).
(function () {
  const H = window.Hulp;
  const BINS = 72;

  // Per niveau: verhouding lange/korte as, draaiing, grootte (fractie van het vlak), hulp.
  const NIVEAUS = {
    1: { ratio: [1.0, 1.3], draai: [0, 0], maat: [0.62, 0.72], ghost: 0.5, streepjes: true },
    2: { ratio: [1.25, 1.7], draai: [0, 90], maat: [0.55, 0.7], ghost: 0.25, streepjes: true },
    3: { ratio: [1.4, 2.1], draai: [-35, 35], maat: [0.5, 0.68], ghost: 0, streepjes: true },
    4: { ratio: [1.6, 2.6], draai: [-90, 90], maat: [0.4, 0.62], ghost: 0, streepjes: true },
    5: { ratio: [2.0, 3.4], draai: [-90, 90], maat: [0.32, 0.58], ghost: 0, streepjes: false },
  };

  function nieuweOpgave(niveau, rng, vlak) {
    const n = NIVEAUS[niveau];
    const ratio = rng.tussen(n.ratio[0], n.ratio[1]);
    const draai = niveau === 2 ? rng.kies([0, 90]) : rng.tussen(n.draai[0], n.draai[1]);
    const t = draai * Math.PI / 180;
    // Lange as zo groot als past: de gedraaide omhullende moet binnen het vlak blijven.
    const want = rng.tussen(n.maat[0], n.maat[1]);
    let a = want * Math.min(vlak.w, vlak.h) * 0.5 * Math.sqrt(ratio);
    let b = a / ratio;
    const halfW = Math.abs(a * Math.cos(t)) + Math.abs(b * Math.sin(t));
    const halfH = Math.abs(a * Math.sin(t)) + Math.abs(b * Math.cos(t));
    const k = Math.min(1, (vlak.w * 0.44) / halfW, (vlak.h * 0.40) / halfH);
    a *= k; b *= k;
    return {
      cx: vlak.w / 2 + rng.tussen(-0.04, 0.04) * vlak.w,
      cy: vlak.h * 0.53 + rng.tussen(-0.03, 0.03) * vlak.h,
      a, b, t, ghost: n.ghost, streepjes: n.streepjes,
    };
  }

  function inLokaal(ctx, o, fn) {
    ctx.save();
    ctx.translate(o.cx, o.cy);
    ctx.rotate(o.t);
    fn();
    ctx.restore();
  }

  function teken(ctx, o, vlak) {
    inLokaal(ctx, o, () => {
      ctx.strokeStyle = vlak.kleur.hulp;
      ctx.lineWidth = 2;
      ctx.strokeRect(-o.a, -o.b, 2 * o.a, 2 * o.b);
      if (o.streepjes) {
        const s = 12;
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(-o.a - s, 0); ctx.lineTo(-o.a + s, 0);
        ctx.moveTo(o.a - s, 0); ctx.lineTo(o.a + s, 0);
        ctx.moveTo(0, -o.b - s); ctx.lineTo(0, -o.b + s);
        ctx.moveTo(0, o.b - s); ctx.lineTo(0, o.b + s);
        ctx.stroke();
      }
      if (o.ghost > 0) {
        ctx.globalAlpha = o.ghost;
        ctx.strokeStyle = vlak.kleur.hulpZacht;
        ctx.lineWidth = 6;
        ctx.beginPath();
        ctx.ellipse(0, 0, o.a, o.b, 0, 0, Math.PI * 2);
        ctx.stroke();
      }
    });
  }

  // Punt naar ellips-assenstelsel.
  function lokaal(o, p) {
    const dx = p.x - o.cx, dy = p.y - o.cy, c = Math.cos(o.t), s = Math.sin(o.t);
    return { u: dx * c + dy * s, v: -dx * s + dy * c };
  }

  function nakijken(o, streken) {
    const ruw = streken[streken.length - 1].punten;
    if (ruw.length < 8 || H.lengte(ruw) < (o.a + o.b) * 1.5) return { ongeldig: 'Te kort: teken de hele ellips in één streek.' };
    const pts = H.herbemonster(ruw, 2);
    const size = (o.a + o.b) / 2;
    const bins = Array.from({ length: BINS }, () => []);
    let stray = 0;
    for (const p of pts) {
      const { u, v } = lokaal(o, p);
      const r = Math.hypot(u / o.a, v / o.b);
      if (r < 0.5 || r > 1.7) { stray++; continue; }
      // Afstand tot de ideale ellips langs de straal vanuit het midden (+ = buiten).
      const d = Math.hypot(u, v) * (1 - 1 / r);
      const phi = Math.atan2(v / o.b, u / o.a);
      bins[Math.floor((phi + Math.PI) / (2 * Math.PI) * BINS) % BINS].push(d);
    }
    const offs = bins.map((b) => (b.length ? H.gemiddelde(b) : null));
    const gedekt = offs.filter((x) => x !== null);
    if (!gedekt.length) return { ongeldig: 'Teken de ellips in het kader.' };

    const dekking = gedekt.length / BINS;
    const fout = H.gemiddelde(gedekt.map(Math.abs)) / size;
    const strayFrac = stray / pts.length;
    const score = Math.round(100 * H.lin(fout, 0.012, 0.11) * Math.pow(dekking, 2) * (1 - Math.min(0.5, strayFrac)));

    return { score, tip: tip(offs, dekking, strayFrac, size, score), offs };
  }

  function tip(offs, dekking, strayFrac, size, score) {
    const waar = (cond) => {
      const v = offs.filter((o, k) => o !== null && cond(-Math.PI + (k + 0.5) * 2 * Math.PI / BINS));
      return v.length ? H.gemiddelde(v) : 0;
    };
    const zij = waar((f) => Math.abs(Math.cos(f)) > 0.95);
    const bovenOnder = waar((f) => Math.abs(Math.sin(f)) > 0.95);
    const diag = waar((f) => Math.abs(Math.cos(f)) > 0.55 && Math.abs(Math.cos(f)) < 0.85) - (zij + bovenOnder) / 2;
    const opties = [
      [diag, 'Puntige uiteinden (een oog). Houd je tempo in de bocht en draai rond.', 'Te hoekig. Laat de bochten soepeler verlopen.'],
      [zij, 'Raakt de korte zijden niet. Ga verder door naar de streepjes.', 'Schiet over de korte zijden heen.'],
      [bovenOnder, 'Raakt de lange zijden niet. Maak hem boller.', 'Steekt over de lange zijden heen.'],
    ];
    const tips = [];
    if (dekking < 0.9) tips.push([1, 'Niet gesloten. Ga door tot voorbij je beginpunt.']);
    for (const [v, neg, pos] of opties) if (Math.abs(v) > 0.035 * size) tips.push([Math.abs(v) / size, v < 0 ? neg : pos]);
    if (strayFrac > 0.1) tips.push([strayFrac, 'Een deel van je lijn ligt ver naast de vorm.']);
    if (!tips.length) return score >= 85 ? 'Mooi rond en gesloten.' : 'Lijn wiebelt. Trek sneller vanuit je schouder.';
    tips.sort((x, y) => y[0] - x[0]);
    return tips[0][1];
  }

  function tekenUitslag(ctx, o, streken, u, vlak) {
    const size = (o.a + o.b) / 2;
    inLokaal(ctx, o, () => {
      ctx.setLineDash([10, 8]);
      ctx.strokeStyle = vlak.kleur.goed;
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.ellipse(0, 0, o.a, o.b, 0, 0, Math.PI * 2);
      ctx.stroke();
      ctx.setLineDash([]);
      for (let k = 0; k < BINS; k++) {
        const off = u.offs[k];
        const phi = -Math.PI + (k + 0.5) * 2 * Math.PI / BINS;
        const x = o.a * Math.cos(phi), y = o.b * Math.sin(phi);
        if (off === null) { ctx.fillStyle = vlak.kleur.tekstZacht; ctx.beginPath(); ctx.arc(x, y, 3, 0, 7); ctx.fill(); }
        else if (Math.abs(off) > 0.06 * size) { ctx.fillStyle = vlak.kleur.fout; ctx.beginPath(); ctx.arc(x, y, 4.5, 0, 7); ctx.fill(); }
      }
    });
  }

  Tekentrainer.registreer({
    id: 'ellipsen',
    naam: 'Ellipsen',
    uitleg: 'Teken in één streek een ellips die alle vier de zijden van het kader raakt.',
    fundament: 'Gesloten, ronde vormen vanuit je schouder; de basis van elk 3D-object.',
    meerdereStreken: false,
    toonUitslag: 1300,
    nieuweOpgave,
    teken,
    nakijken,
    tekenUitslag,
    scorePlek: (o) => ({ x: o.cx, y: o.cy }),
  });
})();
