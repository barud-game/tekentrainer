// Cirkels: één vloeiende, gesloten boog met de juiste maat en plek ("Rond sluiten").
(function () {
  const H = window.Hulp;
  const TAU = Math.PI * 2;

  // Per niveau: types, straal (fractie van korte zijde), tolerantie (fractie van doelstraal), hulp.
  const NIVEAUS = {
    1: { types: ['kader'], r: [0.27, 0.32], tol: 0.30, ghost: 0.4 },
    2: { types: ['middelpunt'], r: [0.2, 0.3], tol: 0.20, ghost: 0 },
    3: { types: ['punten'], r: [0.15, 0.33], tol: 0.15, ghost: 0 },
    4: { types: ['middelpunt'], r: [0.1, 0.2], tol: 0.11, ghost: 0, verbergNa: 1000 },
    5: { types: ['kader', 'middelpunt', 'punten'], r: [0.1, 0.34], tol: 0.08, ghost: 0 },
  };

  function nieuweOpgave(niveau, rng, vlak) {
    const n = NIVEAUS[niveau];
    const kort = Math.min(vlak.w, vlak.h);
    const type = rng.kies(n.types);
    const r = rng.tussen(n.r[0], n.r[1]) * kort;
    const m = 0.04 * kort + 4;
    const ruimteX = Math.max(0, vlak.w / 2 - r - m), ruimteY = Math.max(0, vlak.h / 2 - r - m);
    const cx = vlak.w / 2 + rng.tussen(-1, 1) * Math.min(ruimteX, niveau === 1 ? 0.05 * vlak.w : ruimteX);
    const cy = vlak.h * 0.52 + rng.tussen(-1, 1) * Math.min(ruimteY * 0.9, niveau === 1 ? 0.03 * vlak.h : ruimteY);
    const o = { type, cx: Math.min(vlak.w - r - m, Math.max(r + m, cx)), cy: Math.min(vlak.h - r - m, Math.max(r + m, cy)),
      r, tol: n.tol, ghost: n.ghost, niveau };
    if (n.verbergNa) o.verbergNa = n.verbergNa;
    if (type === 'middelpunt') o.hoek = rng.tussen(0, TAU);
    if (type === 'punten') {
      // Drie punten met minstens ~70 graden tussenruimte.
      for (let poging = 0; poging < 50; poging++) {
        const a = [rng.tussen(0, TAU), rng.tussen(0, TAU), rng.tussen(0, TAU)].sort((x, y) => x - y);
        const gaten = [a[1] - a[0], a[2] - a[1], TAU - (a[2] - a[0])];
        o.hoeken = a;
        if (Math.min(...gaten) > 1.2) break;
      }
      o.punten = o.hoeken.map((h) => ({ x: o.cx + r * Math.cos(h), y: o.cy + r * Math.sin(h) }));
    }
    return o;
  }

  function stip(ctx, x, y, rad, kleur) {
    ctx.fillStyle = kleur;
    ctx.beginPath(); ctx.arc(x, y, rad, 0, TAU); ctx.fill();
  }

  function teken(ctx, o, vlak, info) {
    const k = vlak.kleur;
    ctx.save();
    ctx.lineWidth = 2;
    ctx.strokeStyle = k.hulp;
    if (o.type === 'kader') {
      ctx.strokeRect(o.cx - o.r, o.cy - o.r, 2 * o.r, 2 * o.r);
      if (o.ghost > 0) {
        ctx.globalAlpha = o.ghost; ctx.strokeStyle = k.hulpZacht; ctx.lineWidth = 6;
        ctx.beginPath(); ctx.arc(o.cx, o.cy, o.r, 0, TAU); ctx.stroke();
        ctx.globalAlpha = 1;
      }
      ctx.strokeStyle = k.hulp; ctx.lineWidth = 3;
      const s = 10;
      ctx.beginPath();
      ctx.moveTo(o.cx - o.r - s, o.cy); ctx.lineTo(o.cx - o.r + s, o.cy);
      ctx.moveTo(o.cx + o.r - s, o.cy); ctx.lineTo(o.cx + o.r + s, o.cy);
      ctx.moveTo(o.cx, o.cy - o.r - s); ctx.lineTo(o.cx, o.cy - o.r + s);
      ctx.moveTo(o.cx, o.cy + o.r - s); ctx.lineTo(o.cx, o.cy + o.r + s);
      ctx.stroke();
    } else if (o.type === 'middelpunt') {
      if (!(info && info.verborgen)) {
        ctx.setLineDash([8, 7]);
        ctx.beginPath();
        ctx.moveTo(o.cx, o.cy);
        ctx.lineTo(o.cx + o.r * Math.cos(o.hoek), o.cy + o.r * Math.sin(o.hoek));
        ctx.stroke();
        ctx.setLineDash([]);
        stip(ctx, o.cx + o.r * Math.cos(o.hoek), o.cy + o.r * Math.sin(o.hoek), 3.5, k.hulp);
        stip(ctx, o.cx, o.cy, 6, k.accent);
      }
    } else {
      for (const p of o.punten) stip(ctx, p.x, p.y, 7, k.accent);
    }
    ctx.restore();
  }

  // Kåsa-fit: kleinste kwadraten cirkel door de punten.
  function kasaFit(pts) {
    const n = pts.length;
    const mx = H.gemiddelde(pts.map((p) => p.x)), my = H.gemiddelde(pts.map((p) => p.y));
    let suu = 0, svv = 0, suv = 0, suuu = 0, svvv = 0, suuv = 0, suvv = 0;
    for (const p of pts) {
      const u = p.x - mx, v = p.y - my;
      suu += u * u; svv += v * v; suv += u * v;
      suuu += u * u * u; svvv += v * v * v; suuv += u * u * v; suvv += u * v * v;
    }
    const det = suu * svv - suv * suv;
    if (!isFinite(det) || Math.abs(det) < 1e-9) return null;
    const b1 = 0.5 * (suuu + suvv), b2 = 0.5 * (svvv + suuv);
    const uc = (b1 * svv - b2 * suv) / det, vc = (suu * b2 - suv * b1) / det;
    const r = Math.sqrt(uc * uc + vc * vc + (suu + svv) / n);
    if (!isFinite(r) || r <= 0) return null;
    return { x: mx + uc, y: my + vc, r };
  }

  // Verhouding lange/korte as (PCA) van de punten.
  function asRatio(pts) {
    const mx = H.gemiddelde(pts.map((p) => p.x)), my = H.gemiddelde(pts.map((p) => p.y));
    let sxx = 0, syy = 0, sxy = 0;
    for (const p of pts) { const dx = p.x - mx, dy = p.y - my; sxx += dx * dx; syy += dy * dy; sxy += dx * dy; }
    const tr = sxx + syy, det = sxx * syy - sxy * sxy;
    const d = Math.sqrt(Math.max(0, tr * tr / 4 - det));
    const l1 = tr / 2 + d, l2 = Math.max(1e-9, tr / 2 - d);
    return Math.sqrt(l1 / l2);
  }

  function nakijken(o, streken) {
    const ruw = streken[streken.length - 1].punten;
    if (ruw.length < 15 || H.lengte(ruw) < o.r * 1.5) return { ongeldig: 'Te kort: teken de hele cirkel in één streek.' };
    const duur = ruw[ruw.length - 1].t - ruw[0].t;
    const pts = H.herbemonsterN(ruw, 64);
    const c = kasaFit(pts);
    if (!c) return { ongeldig: 'Dat was geen cirkel, probeer opnieuw.' };
    const r = c.r;

    // Rondheid.
    const e = pts.map((p) => Math.hypot(p.x - c.x, p.y - c.y) - r);
    const rms = Math.sqrt(H.gemiddelde(e.map((v) => v * v)));
    const R = H.lin(rms / r, 0.01, 0.12);

    // Hoek-sweep rond het midden (gesigneerd) en richtingswissel.
    const hoeken = pts.map((p) => Math.atan2(p.y - c.y, p.x - c.x));
    const stappen = [];
    for (let i = 1; i < hoeken.length; i++) {
      let d = hoeken[i] - hoeken[i - 1];
      while (d > Math.PI) d -= TAU;
      while (d < -Math.PI) d += TAU;
      stappen.push(d);
    }
    const som = stappen.reduce((s, v) => s + v, 0);
    const sweep = Math.abs(som) * 180 / Math.PI;
    const teken = som >= 0 ? 1 : -1;
    const terug = stappen.filter((d) => d * teken < 0).reduce((s, d) => s + Math.abs(d), 0) * 180 / Math.PI;
    const wissel = terug > 15;

    // Sluiting.
    const gap = H.afstand(pts[0], pts[pts.length - 1]);
    let G = H.lin(gap, 0.05 * r, 0.25 * r);
    if (sweep < 330) G = Math.min(G, 0.5);

    // Doelmatch.
    let fout, dx = 0, dy = 0, dr = 0;
    if (o.type === 'punten') {
      const afw = o.punten.map((p) => Math.abs(Math.hypot(p.x - c.x, p.y - c.y) - r));
      fout = H.gemiddelde(afw) / r;
      // Voor de tip: maat/positie t.o.v. de cirkel door de drie punten.
      dx = c.x - o.cx; dy = c.y - o.cy; dr = r - o.r;
    } else {
      dx = c.x - o.cx; dy = c.y - o.cy; dr = r - o.r;
      fout = Math.max(Math.abs(dr) / o.r, Math.hypot(dx, dy) / o.r);
    }
    const D = H.lin(fout, 0.04, o.tol);

    // Vloeiendheid.
    const sn = H.snelheden(H.herbemonster(ruw, 3));
    const gl = [];
    for (let i = 0; i + 3 <= sn.length; i += 1) gl.push((sn[i] + sn[i + 1] + sn[i + 2]) / 3);
    const cv = gl.length > 3 && H.gemiddelde(gl) > 0 ? H.sd(gl) / H.gemiddelde(gl) : 0.5;
    let V = H.lin(cv, 0.2, 0.8);
    if (wissel) V *= 0.7;

    let score = 100 * (0.40 * R + 0.20 * G + 0.25 * D + 0.15 * V);
    let traag = 0;
    if (o.niveau === 5 && duur > 1500) { traag = Math.min(25, (duur - 1500) / 100); score -= traag; }
    if (gap > 0.25 * r) score = Math.min(score, 55); // duidelijk open: nooit een voldoende
    score = Math.round(H.clamp(score, 0, 100));

    const ratio = asRatio(pts);
    const info = { ratio, gap, r, dx, dy, dr, V, wissel, traag, R, D, score, tol: o.tol };
    return { score, tip: tip(o, info), c, r, gap, ratio, e, begin: pts[0], eind: pts[pts.length - 1], pts };
  }

  function tip(o, i) {
    const r = i.r;
    if (i.gap > 0.25 * r) return 'Sluit de cirkel: ga door tot voorbij je beginpunt.';
    if (i.ratio > 1.15) return 'Je cirkel is een ei: draai je hele arm mee, niet alleen je pols.';
    if (i.V < 0.35 || i.wissel) return 'Je haperde. Maak één rustige beweging; oefen eerst in de lucht.';
    const lim = Math.max(0.08, i.tol * 0.45) * o.r;
    const delen = [];
    const maatFout = Math.abs(i.dr) > lim;
    if (maatFout) delen.push(i.dr < 0 ? 'te klein' : 'te groot');
    const pos = [];
    if (Math.abs(i.dx) > lim) pos.push(i.dx < 0 ? 'links' : 'rechts');
    if (Math.abs(i.dy) > lim) pos.push(i.dy < 0 ? 'boven' : 'onder');
    if (delen.length || pos.length) {
      let s = 'Iets ' + (delen[0] || 'verschoven');
      if (pos.length) s += (delen.length ? ' en ' : ' ') + 'naar ' + pos.join('-');
      return s.replace('verschoven naar', 'te ver naar') + '.';
    }
    if (i.traag > 5) return 'Te traag: maak de cirkel in minder dan 1,5 seconde.';
    if (i.score >= 85) return 'Mooi rond en gesloten.';
    return 'Bijna: trek rustiger en gelijkmatiger door.';
  }

  function tekenUitslag(ctx, o, streken, u, vlak) {
    const k = vlak.kleur;
    ctx.save();
    ctx.setLineDash([10, 8]);
    ctx.strokeStyle = k.goed; ctx.lineWidth = 2.5;
    ctx.beginPath(); ctx.arc(o.cx, o.cy, o.r, 0, TAU); ctx.stroke();
    ctx.setLineDash([]);
    if (u && u.c) {
      ctx.strokeStyle = k.tekstZacht; ctx.lineWidth = 1.2;
      ctx.beginPath(); ctx.arc(u.c.x, u.c.y, u.r, 0, TAU); ctx.stroke();
      if (u.ratio > 1.15 && u.pts) {
        u.pts.forEach((p, idx) => { if (Math.abs(u.e[idx]) > 0.08 * u.r) stip(ctx, p.x, p.y, 4, k.fout); });
      }
      if (u.gap > 0.12 * u.r) {
        ctx.strokeStyle = k.fout; ctx.lineWidth = 3;
        ctx.beginPath(); ctx.moveTo(u.begin.x, u.begin.y); ctx.lineTo(u.eind.x, u.eind.y); ctx.stroke();
        stip(ctx, u.begin.x, u.begin.y, 5, k.fout);
        stip(ctx, u.eind.x, u.eind.y, 5, k.fout);
      }
    }
    ctx.restore();
  }

  Tekentrainer.registreer({
    id: 'cirkels',
    naam: 'Cirkels',
    uitleg: 'Teken in één vloeiende streek een gesloten cirkel die past bij het doel.',
    fundament: 'Eén vloeiende, gesloten boog vanuit je schouder met juiste maat en plek; de basis voor wielen, hoofden en organische vormen.',
    meerdereStreken: false,
    toonUitslag: 1400,
    nieuweOpgave,
    teken,
    nakijken,
    tekenUitslag,
    scorePlek: (o) => ({ x: o.cx, y: o.cy }),
  });
})();
