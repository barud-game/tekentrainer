// Stip naar stip: trek een rechte lijn van A naar B in één vloeiende armbeweging.
(function () {
  const H = window.Hulp;
  // Per niveau (alles hier te tunen):
  //  len: lengtebanden (fractie van vlakbreedte); hoeken: 'hv' | '45' | 'vrij' | 'bijna' (bijna-horizontaal/verticaal, 3-9 graden scheef)
  //  gids: 'aan' | 'vervaag' | 'uit'; aR / bR: grootte stip A / B (factor); startTol: px (verder van A starten = ongeldig);
  //  recht: [goed, slecht] als fractie van L (afwijking: 0.6*max + 0.6*rms); eind: [px, fractie van L] tolerantie;
  //  lMin: px; recht- en eindtolerantie rekenen met max(L, lMin), zodat korte lijnen niet onmogelijk strak hoeven;
  //  vloei: [cv goed, cv slecht]; haper: aftrek (punten) per haperpunt in vloeiendheid; hapMult: extra aftrek op totaalscore per haper (max 3);
  //  tempo: false of { basis ms, perPx ms/px, straf (max aftrek op totaalscore) }; w: weging [recht, eind, vloei].
  const BASIS = { aR: 1, startTol: 24, recht: [0.01, 0.08], vloei: [0.25, 0.85], haper: 10, hapMult: 0, lMin: 0, tempo: false, w: [0.45, 0.30, 0.25] };
  const NIVEAUS = {
    1: { len: [[0.35, 0.55]], hoeken: 'hv', gids: 'aan', bR: 1, eind: [8, 0.12] },
    2: { len: [[0.35, 0.55]], hoeken: '45', gids: 'aan', bR: 1, eind: [8, 0.12] },
    3: { len: [[0.35, 0.55]], hoeken: 'vrij', gids: 'vervaag', bR: 0.85, eind: [8, 0.12] },
    4: { len: [[0.10, 0.20], [0.60, 0.80]], hoeken: 'vrij', gids: 'uit', aR: 0.8, bR: 0.5, startTol: 20,
         recht: [0.005, 0.04], eind: [4, 0.05], vloei: [0.25, 0.8], lMin: 220, haper: 14, hapMult: 0.04,
         tempo: { basis: 700, perPx: 1.8, straf: 0.3 } },
    5: { len: [[0.10, 0.18], [0.65, 0.90]], hoeken: 'bijna', gids: 'uit', aR: 0.65, bR: 0.4, startTol: 16,
         recht: [0.004, 0.022], eind: [3, 0.025], vloei: [0.28, 0.65], lMin: 260, haper: 20, hapMult: 0.08,
         tempo: { basis: 500, perPx: 1.0, straf: 0.5 }, w: [0.40, 0.35, 0.25] },
  };
  for (const k in NIVEAUS) NIVEAUS[k] = Object.assign({}, BASIS, NIVEAUS[k]);

  let laatsteHoek = null; // vorige looprichting (rad), om herhaling te voorkomen

  const hoekVerschil = (a, b) => {
    let d = Math.abs(a - b) % (2 * Math.PI);
    return d > Math.PI ? 2 * Math.PI - d : d;
  };

  function nieuweOpgave(niveau, rng, vlak) {
    const n = NIVEAUS[niveau];
    const mn = Math.min(vlak.w, vlak.h);
    const marge = Math.max(14, mn * 0.08);

    // Hoek kiezen, niet gelijk aan de vorige.
    let hoek;
    for (let poging = 0; poging < 30; poging++) {
      if (n.hoeken === 'bijna') hoek = (rng.kies([0, 90, 180, 270]) + rng.kies([-1, 1]) * rng.tussen(3, 9)) * Math.PI / 180;
      else if (n.hoeken === 'hv') hoek = rng.kies([0, 90, 180, 270]) * Math.PI / 180;
      else if (n.hoeken === '45') hoek = rng.kies([0, 45, 90, 135, 180, 225, 270, 315]) * Math.PI / 180;
      else hoek = rng.tussen(0, 360) * Math.PI / 180;
      if (laatsteHoek === null || hoekVerschil(hoek, laatsteHoek) > (n.hoeken === 'vrij' ? 0.26 : 0.1)) break;
    }
    laatsteHoek = hoek;
    const ux = Math.cos(hoek), uy = Math.sin(hoek);

    // Lengte, begrensd zodat de lijn in het vlak past.
    const band = rng.kies(n.len);
    let L = rng.tussen(band[0], band[1]) * vlak.w;
    const kx = Math.abs(ux) > 1e-6 ? (vlak.w - 2 * marge) / Math.abs(ux) : Infinity;
    const ky = Math.abs(uy) > 1e-6 ? (vlak.h - 2 * marge) / Math.abs(uy) : Infinity;
    L = Math.min(L, kx, ky);

    // Midden zo kiezen dat beide uiteinden binnen de marge liggen.
    const hx = Math.abs(ux) * L / 2, hy = Math.abs(uy) * L / 2;
    const cx = rng.tussen(marge + hx, vlak.w - marge - hx);
    const cy = rng.tussen(marge + hy, vlak.h - marge - hy);
    const A = { x: cx - ux * L / 2, y: cy - uy * L / 2 };
    const B = { x: cx + ux * L / 2, y: cy + uy * L / 2 };
    const r = H.clamp(mn * 0.014, 6, 11);
    return {
      A, B, L, hoek, ux, uy, niveau,
      rA: Math.max(3, r * n.aR), rB: Math.max(3, r * n.bR),
      gids: n.gids,
      n,
      eind: n.eind,
      tempo: n.tempo,
      animeer: n.gids === 'vervaag',
    };
  }

  function teken(ctx, o, vlak, info) {
    let alpha = 1;
    if (o.gids === 'uit') alpha = 0;
    else if (o.gids === 'vervaag') alpha = 1 - H.clamp((info.sinds - 500) / 400, 0, 1);
    if (alpha > 0) {
      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.strokeStyle = vlak.kleur.hulp;
      ctx.lineWidth = 2;
      ctx.setLineDash([8, 8]);
      ctx.beginPath();
      ctx.moveTo(o.A.x, o.A.y);
      ctx.lineTo(o.B.x, o.B.y);
      ctx.stroke();
      ctx.restore();
    }
    // B: ring met stip
    ctx.save();
    ctx.strokeStyle = vlak.kleur.hulp;
    ctx.fillStyle = vlak.kleur.hulp;
    ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(o.B.x, o.B.y, o.rB, 0, Math.PI * 2); ctx.stroke();
    ctx.beginPath(); ctx.arc(o.B.x, o.B.y, Math.max(1.5, o.rB * 0.3), 0, Math.PI * 2); ctx.fill();
    // A: gevulde accentstip
    ctx.fillStyle = vlak.kleur.accent;
    ctx.beginPath(); ctx.arc(o.A.x, o.A.y, o.rA, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
  }

  // Snelheden (px/ms): punten minstens 12 ms uit elkaar, daarna 3-punts gladding.
  function gladdeSnelheden(pts) {
    const dun = [pts[0]];
    for (let i = 1; i < pts.length; i++) {
      if (pts[i].t - dun[dun.length - 1].t >= 12 || i === pts.length - 1) dun.push(pts[i]);
    }
    const v = H.snelheden(dun);
    return v.map((x, i) => {
      const a = v[Math.max(0, i - 1)], c = v[Math.min(v.length - 1, i + 1)];
      return (a + x + c) / 3;
    });
  }

  function nakijken(o, streken) {
    const ruw = streken[streken.length - 1].punten;
    const A = o.A, B = o.B, L = o.L;
    if (ruw.length < 8 || H.lengte(ruw) < 0.25 * L) return { ongeldig: 'Te kort. Trek de hele lijn van A naar B.' };
    if (H.afstand(ruw[0], A) > o.n.startTol) return { ongeldig: 'Start op stip A en trek dan naar B.' };

    const eerste = ruw[0], laatste = ruw[ruw.length - 1];
    const sx = laatste.x - eerste.x, sy = laatste.y - eerste.y;
    const sl = Math.hypot(sx, sy);
    if (sl < 0.2 * L) return { ongeldig: 'Te kort. Trek de hele lijn van A naar B.' };
    const dx = sx / sl, dy = sy / sl;

    // Rechtheid: gesigneerde afstand tot de lijn eerste -> laatste punt (herbemonsterd op 3 px).
    const pts = H.herbemonster(ruw, 3);
    const d = pts.map((p) => H.lijnAfstand(p, eerste, dx, dy));
    let dmax = 0, imax = 0;
    d.forEach((x, i) => { if (Math.abs(x) > dmax) { dmax = Math.abs(x); imax = i; } });
    const rms = Math.sqrt(H.gemiddelde(d.map((x) => x * x)));
    const Lt = Math.max(L, o.n.lMin);
    const dm = Math.max(0, dmax - 1), rm = Math.max(0, rms - 0.5);
    const sRecht = 100 * H.lin(0.6 * dm / Lt + 0.6 * rm / Lt, o.n.recht[0], o.n.recht[1]);

    // Eindpunten.
    const e = (H.afstand(eerste, A) + H.afstand(laatste, B)) / 2;
    const sEind = 100 * H.lin(e, o.eind[0], o.eind[0] + o.eind[1] * Lt);

    // Vloeiendheid.
    const v = gladdeSnelheden(ruw);
    const lo = Math.floor(v.length * 0.15), hi = Math.ceil(v.length * 0.85);
    const mid = v.slice(lo, hi);
    let cv = 0, hapers = 0;
    if (mid.length >= 3) {
      const gem = H.gemiddelde(mid);
      cv = gem > 0 ? H.sd(mid) / gem : 1;
      let in_ = false;
      for (const x of mid) {
        const laag = x < 0.2 * gem;
        if (laag && !in_) hapers++;
        in_ = laag;
      }
    }
    const sVloei = H.clamp(100 * H.lin(cv, o.n.vloei[0], o.n.vloei[1]) - o.n.haper * hapers, 0, 100);

    // Tempo (niveau 5).
    const duur = laatste.t - eerste.t;
    const maxDuur = o.tempo ? o.tempo.basis + o.tempo.perPx * L : Infinity;
    const traag = o.tempo ? Math.max(0, duur / maxDuur - 1) : 0;

    const w = o.n.w;
    let score = w[0] * sRecht + w[1] * sEind + w[2] * sVloei;
    if (o.tempo) score *= 1 - o.tempo.straf * H.clamp(traag, 0, 1);
    score *= 1 - o.n.hapMult * Math.min(hapers, 3);
    score = Math.round(H.clamp(score, 0, 100));

    // Tips: kandidaten met ernst (1 = net over de drempel).
    const mid3 = d.slice(Math.floor(d.length * 0.1), Math.ceil(d.length * 0.9));
    const med = H.mediaan(mid3);
    const zelfdeKant = mid3.filter((x) => Math.sign(x) === Math.sign(med)).length / Math.max(1, mid3.length);
    const proj = ((laatste.x - A.x) * o.ux + (laatste.y - A.y) * o.uy) / L;
    let trilling = 0;
    const dd = d;
    if (dd.length > 4) {
      let s = 0;
      for (let i = 1; i < dd.length - 1; i++) s += Math.abs(dd[i] - (dd[i - 1] + dd[i + 1]) / 2);
      trilling = s / (dd.length - 2);
    }
    const tips = [];
    if (Math.abs(med) > 0.02 * L && zelfdeKant > 0.75) {
      tips.push([Math.abs(med) / (0.02 * L), 'Je lijn buigt naar ' + (med > 0 ? 'rechts' : 'links') + '; trek vanuit je schouder.']);
    }
    if (hapers >= 2 || cv > 0.6) tips.push([Math.max(hapers / 2, cv / 0.6), 'Je stopt halverwege; trek in één vloeiende beweging.']);
    if (proj < 0.9) tips.push([(1 - proj) / 0.1,'Je schiet te kort; kijk naar B, niet naar je pen.']);
    else if (proj > 1.1) tips.push([(proj - 1) / 0.1, 'Je schiet te ver door; kijk naar B, niet naar je pen.']);
    if (trilling > 0.8) tips.push([trilling / 0.8, 'Je lijn trilt; ontspan je greep.']);
    if (traag > 0.1) tips.push([traag / 0.1, 'Te traag; trek in één snelle beweging.']);
    tips.sort((a, b) => b[0] - a[0]);
    const tip = tips.length ? tips[0][1] : (score >= 85 ? 'Mooi recht, in één beweging.' : 'Let op je eindpunten: begin en eindig op de stippen.');

    return { score, tip, sRecht, sEind, sVloei, cv, hapers, dmax, maxPunt: pts[imax], maxD: d[imax], proj, trilling, duur };
  }

  function tekenUitslag(ctx, o, streken, u, vlak) {
    ctx.save();
    ctx.setLineDash([10, 8]);
    ctx.strokeStyle = vlak.kleur.goed;
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.moveTo(o.A.x, o.A.y);
    ctx.lineTo(o.B.x, o.B.y);
    ctx.stroke();
    ctx.setLineDash([]);
    if (u.maxPunt && Math.abs(u.maxD) > Math.max(4, 0.02 * o.L)) {
      const p = u.maxPunt;
      const k = H.clamp(((p.x - o.A.x) * o.ux + (p.y - o.A.y) * o.uy), 0, o.L);
      const q = { x: o.A.x + o.ux * k, y: o.A.y + o.uy * k };
      ctx.strokeStyle = vlak.kleur.fout;
      ctx.fillStyle = vlak.kleur.fout;
      ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(q.x, q.y); ctx.lineTo(p.x, p.y); ctx.stroke();
      ctx.beginPath(); ctx.arc(p.x, p.y, 5, 0, Math.PI * 2); ctx.fill();
    }
    ctx.restore();
  }

  // Zoek een plek voor score + tip die de lijn zo min mogelijk bedekt.
  function scorePlek(o, vlak) {
    const mn = Math.min(vlak.w, vlak.h);
    const g = H.clamp(mn * 0.14, 40, 96);
    const hw = Math.min(vlak.w * 0.45, 200);
    const boven = g / 2 + 4, onder = g * 0.62 + 18;
    const midX = (o.A.x + o.B.x) / 2, midY = (o.A.y + o.B.y) / 2;
    const xs = [], ys = [];
    const xlo = Math.min(hw, vlak.w / 2), xhi = Math.max(vlak.w - hw, vlak.w / 2);
    for (let i = 0; i <= 8; i++) xs.push(xlo + (xhi - xlo) * i / 8);
    const ylo = boven, yhi = Math.max(boven, vlak.h - onder);
    for (let i = 0; i <= 12; i++) ys.push(ylo + (yhi - ylo) * i / 12);
    let beste = { x: vlak.w / 2, y: vlak.h / 2 }, bestScore = -Infinity;
    for (const x of xs) for (const y of ys) {
      const r = { l: x - hw, r: x + hw, t: y - g / 2, b: y + onder };
      let dmin = Infinity;
      for (let i = 0; i <= 40; i++) {
        const f = i / 40, px = o.A.x + (o.B.x - o.A.x) * f, py = o.A.y + (o.B.y - o.A.y) * f;
        const ddx = Math.max(r.l - px, 0, px - r.r), ddy = Math.max(r.t - py, 0, py - r.b);
        dmin = Math.min(dmin, Math.hypot(ddx, ddy));
      }
      const s = Math.min(dmin, 50) - 0.02 * Math.hypot(x - midX, y - midY);
      if (s > bestScore) { bestScore = s; beste = { x, y }; }
    }
    return beste;
  }

  Tekentrainer.registreer({
    id: 'lijnen',
    naam: 'Lijnen',
    uitleg: 'Trek in één vloeiende beweging een rechte lijn van stip A naar stip B.',
    fundament: 'Rechte lijnen vanuit je schouder en elleboog; de basis van contouren, perspectief en arcering.',
    meerdereStreken: false,
    toonUitslag: 1400,
    nieuweOpgave,
    teken,
    nakijken,
    tekenUitslag,
    scorePlek,
  });
})();
