// De Slingerlijn: één vloeiende streek met constant tempo langs een slingerende contour.
(function () {
  const H = window.Hulp;

  // Per niveau (afstanden in mm, tempo in mm/s):
  //  T = brede band (uitslag/hulpband), tempo = streefsnelheid van de stip, bereik = goed tempo, stip = meelopende stip,
  //  hulp = hulplijn ('band' brede band, 'dun' dunne lijn, 'stip' stippellijn, 'anker' alleen ankerpunten bij de toppen),
  //  gem / p90 = [goed, slecht] voor gemiddelde en 90e-percentiel afstand tot de contour, top = idem voor hoe dicht je
  //  bij de toppen/bochten van de contour komt (amplitude; alleen niveau 3-5),
  //  rit = [goed, slecht] rms synchrone afstand (ritme, amplitude en golflengte tegelijk), cv = [goed, slecht] snelheidsvariatie,
  //  bib = [goed, slecht] bibber (rms), dek = afstand waarbinnen contour als 'gedekt' telt, se = marge voor start/eind,
  //  pen = strafpunten voor mis start/eind, draai = max. rotatie van de opgave (graden),
  //  gew = gewichten [vorm, bibber, stoppen, tempo, druk, ritme].
  const NIVEAUS = {
    1: { T: 6.0, tempo: 45, bereik: [30, 80], stip: true, hulp: 'band', gem: [1.8, 9], p90: [3.6, 12], rit: [3, 14], cv: [0.25, 0.6], bib: [0.15, 0.6], dek: 9, se: 12, pen: 10, draai: 0, gew: [0.45, 0.20, 0.15, 0.10, 0.10, 0] },
    2: { T: 5.0, tempo: 60, bereik: [40, 100], stip: true, hulp: 'band', gem: [1.5, 7.5], p90: [3, 10], rit: [3, 14], cv: [0.25, 0.6], bib: [0.15, 0.6], dek: 7.5, se: 10, pen: 10, draai: 6, gew: [0.45, 0.20, 0.15, 0.10, 0.10, 0] },
    3: { T: 3.5, tempo: 0, bereik: [45, 120], stip: false, hulp: 'dun', gem: [0.7, 3.0], p90: [1.5, 5.0], top: [0.8, 3.5], rit: [1.0, 5], cv: [0.18, 0.5], bib: [0.12, 0.5], dek: 6, se: 8, pen: 12, draai: 14, gew: [0.38, 0.14, 0.10, 0.14, 0.04, 0.20] },
    4: { T: 2.5, tempo: 0, bereik: [50, 110], stip: false, hulp: 'stip', gem: [0.7, 3.0], p90: [1.5, 5.0], top: [0.8, 3.6], rit: [1.4, 7], cv: [0.15, 0.45], bib: [0.12, 0.5], dek: 5, se: 6.5, pen: 15, draai: 25, gew: [0.38, 0.14, 0.09, 0.14, 0.04, 0.21] },
    5: { T: 2.0, tempo: 0, bereik: [55, 105], stip: false, hulp: 'anker', gem: [0.6, 2.4], p90: [1.2, 4.0], top: [0.4, 2.0], rit: [0.8, 4.0], cv: [0.12, 0.4], bib: [0.12, 0.5], dek: 4.5, se: 5.5, pen: 18, draai: 30, gew: [0.38, 0.13, 0.08, 0.14, 0.04, 0.23] },
  };

  // ---------- meetkunde ----------
  function chaikin(pts, n) {
    for (let k = 0; k < n; k++) {
      const u = [pts[0]];
      for (let i = 0; i < pts.length - 1; i++) {
        const a = pts[i], b = pts[i + 1];
        u.push({ x: 0.75 * a.x + 0.25 * b.x, y: 0.75 * a.y + 0.25 * b.y });
        u.push({ x: 0.25 * a.x + 0.75 * b.x, y: 0.25 * a.y + 0.75 * b.y });
      }
      u.push(pts[pts.length - 1]);
      pts = u;
    }
    return pts;
  }

  // Ruwe vorm (eenheden willekeurig) per niveau.
  function ruweVorm(niveau, rng) {
    const j = (a) => rng.tussen(-a, a);
    if (niveau === 1) {
      return chaikin([{ x: 0, y: 0.7 + j(0.08) }, { x: 1.0 + j(0.1), y: 0.1 + j(0.08) }, { x: 2.0, y: 0.6 + j(0.08) }], 5)
        .map((p) => ({ x: p.x * 1.0, y: p.y }));
    }
    if (niveau === 2) {
      return chaikin([{ x: 0, y: 0.9 + j(0.1) }, { x: 0.7, y: 0.1 + j(0.1) }, { x: 1.3, y: 0.9 + j(0.1) }, { x: 2.0, y: 0.1 + j(0.1) }], 5);
    }
    if (niveau === 3) {
      // 6-7 toppen, wisselende amplitude en afstand
      const n = rng.kies([6, 7]), w = 2.0, v = [];
      for (let i = 0; i < n; i++) {
        v.push({ x: w * i / (n - 1) + (i && i < n - 1 ? j(0.07) : 0), y: (i % 2 ? 0.08 + rng.tussen(0, 0.2) : 0.92 - rng.tussen(0, 0.2)) });
      }
      return chaikin(v, 5);
    }
    if (niveau === 4) {
      const kiesVorm = rng();
      if (kiesVorm < 0.34) { // golf met wisselende periode en afnemende amplitude
        const k = rng.tussen(2.6, 3.4), chirp = rng.tussen(0.25, 0.5), r = [];
        for (let q = 0; q <= 500; q++) {
          const x = q / 500;
          r.push({ x: x * 2.4, y: Math.exp(-0.9 * x) * Math.sin(2 * Math.PI * (k * x + chirp * x * x * k)) });
        }
        return r;
      }
      if (kiesVorm < 0.67) { // spiraal naar binnen
        const draaien = rng.tussen(1.35, 1.6), th = draaien * 2 * Math.PI, r = [];
        for (let k = 0; k <= 400; k++) {
          const a = th * k / 400, rr = 1 - 0.78 * (a / th);
          r.push({ x: rr * Math.cos(a), y: rr * Math.sin(a) });
        }
        return r;
      }
      const a = 1, b = rng.tussen(2.1, 2.6), tm = Math.PI * 1.1, r = []; // lus (trochoïde)
      for (let k = 0; k <= 400; k++) {
        const t = -tm + 2 * tm * k / 400;
        r.push({ x: a * t - b * Math.sin(t), y: -b * Math.cos(t) });
      }
      return r;
    }
    // niveau 5: scherpe bochten, wisselende kromming
    const n = rng.kies([9, 10, 11]), v = [];
    let x = 0;
    for (let i = 0; i < n; i++) {
      v.push({ x, y: i % 2 ? 0.05 + rng.tussen(0, 0.45) : 0.95 - rng.tussen(0, 0.45) });
      x += rng.tussen(0.16, 0.5);
    }
    return chaikin(v, 2);
  }

  // Zet een polylijn om naar punten op gelijke afstand (px).
  function gelijkeStap(pts, stap) { return H.herbemonster(pts.map((p) => ({ x: p.x, y: p.y, p: 0, t: 0 })), stap).map((p) => ({ x: p.x, y: p.y })); }

  function nieuweOpgave(niveau, rng, vlak) {
    const n = NIVEAUS[niveau];
    const mm = vlak.pxPerMm;
    const k = H.clamp(Math.min(vlak.w, vlak.h) / (mm * 100), 0.55, 1);
    const Tpx = n.T * mm * k;
    let ruw = ruweVorm(niveau, rng);
    // Passend maken in het vlak (uniform schalen, midden).
    if (n.draai) { // gedraaide opgave
      const hk = rng.tussen(-n.draai, n.draai) * Math.PI / 180, cs = Math.cos(hk), sn = Math.sin(hk);
      ruw = ruw.map((p) => ({ x: p.x * cs - p.y * sn, y: p.x * sn + p.y * cs }));
    }
    const marge = Math.max(Tpx * 2, 30);
    const bx = [marge + 8, vlak.w - marge - 8], by = [Math.max(marge, 34) + 20, vlak.h - Math.max(marge, 34)];
    const minx = Math.min(...ruw.map((p) => p.x)), maxx = Math.max(...ruw.map((p) => p.x));
    const miny = Math.min(...ruw.map((p) => p.y)), maxy = Math.max(...ruw.map((p) => p.y));
    const s = Math.min((bx[1] - bx[0]) / Math.max(1e-6, maxx - minx), (by[1] - by[0]) / Math.max(1e-6, maxy - miny));
    const ox = (bx[0] + bx[1]) / 2 - s * (minx + maxx) / 2, oy = (by[0] + by[1]) / 2 - s * (miny + maxy) / 2;
    const spiegelX = rng() < 0.5, spiegelY = rng() < 0.5;
    ruw = ruw.map((p) => {
      let x = ox + s * p.x, y = oy + s * p.y;
      if (spiegelX) x = vlak.w - x;
      if (spiegelY) y = vlak.h - y;
      return { x, y };
    });
    const pts = gelijkeStap(ruw, mm); // 1 mm
    const N = pts.length;
    const tang = [], kr = [];
    const hoek = (a, b) => Math.atan2(b.y - a.y, b.x - a.x);
    for (let i = 0; i < N; i++) {
      const a = pts[Math.max(0, i - 1)], b = pts[Math.min(N - 1, i + 1)];
      const d = Math.hypot(b.x - a.x, b.y - a.y) || 1;
      tang.push({ x: (b.x - a.x) / d, y: (b.y - a.y) / d });
      const i0 = Math.max(0, i - 4), i1 = Math.min(N - 1, i + 4);
      if (i1 - i0 < 3 || i === i0 || i === i1) { kr.push(0); continue; }
      let dh = hoek(pts[i], pts[i1]) - hoek(pts[i0], pts[i]);
      while (dh > Math.PI) dh -= 2 * Math.PI;
      while (dh < -Math.PI) dh += 2 * Math.PI;
      kr.push(dh / (i1 - i0));
    }
    const o = {
      niveau, T: n.T, Tpx, k, pts, tang, kr, gew: n.gew, bereik: n.bereik, tab: n, hulp: n.hulp, anker: vindAnkers(pts, kr).map((i) => ({ i, x: pts[i].x, y: pts[i].y })),
      start: pts[0], eind: pts[N - 1], lengteMm: N - 1,
      tempo: n.tempo, animeer: n.stip, stip: n.stip,
    };
    o.plek = vindPlek(o, vlak);
    return o;
  }

  // Ankerpunten: plekken met de sterkste kromming (toppen en bochten), minstens 10 mm uit elkaar.
  function vindAnkers(pts, kr) { // geeft indices in pts
    const ids = kr.map((v, i) => i).filter((i) => i > 5 && i < pts.length - 6);
    const mx = Math.max(0, ...ids.map((i) => Math.abs(kr[i])));
    const kand = ids.filter((i) => Math.abs(kr[i]) > 0.25 * mx && Math.abs(kr[i]) >= Math.abs(kr[i - 1]) && Math.abs(kr[i]) >= Math.abs(kr[i + 1]));
    kand.sort((a, b) => Math.abs(kr[b]) - Math.abs(kr[a]));
    const uit = [];
    for (const i of kand) if (uit.every((j) => Math.abs(i - j) > 10)) uit.push(i);
    return uit;
  }

  // Lege plek in het vlak, ver van de lijn, voor de score.
  function vindPlek(o, vlak) {
    let beste = { x: vlak.w / 2, y: vlak.h / 2 }, bw = -Infinity;
    const stap = Math.max(1, Math.floor(o.pts.length / 300));
    const sub = o.pts.filter((p, i) => i % stap === 0);
    for (let i = 0; i <= 20; i++) {
      for (let j = 0; j <= 12; j++) {
        const x = vlak.w * (0.25 + 0.5 * i / 20), y = vlak.h * (0.2 + 0.6 * j / 12);
        let m = Infinity;
        for (const p of sub) m = Math.min(m, Math.hypot(p.x - x, p.y - y));
        const w = Math.min(m, 140) - 0.05 * Math.hypot(x - vlak.w / 2, y - vlak.h / 2);
        if (w > bw) { bw = w; beste = { x, y }; }
      }
    }
    return beste;
  }

  function teken(ctx, o, vlak, info) {
    const c = vlak.kleur, P = o.pts;
    ctx.save();
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    if (o.hulp !== 'anker') {
      ctx.beginPath();
      ctx.moveTo(P[0].x, P[0].y);
      for (let i = 1; i < P.length; i++) ctx.lineTo(P[i].x, P[i].y);
      if (o.hulp === 'band') { ctx.strokeStyle = c.hulpZacht; ctx.lineWidth = 2 * o.Tpx; ctx.stroke(); }
      ctx.strokeStyle = c.hulp;
      ctx.lineWidth = o.hulp === 'band' ? 1.5 : 1.2;
      if (o.hulp === 'stip') ctx.setLineDash([2, 9]);
      ctx.stroke();
      ctx.setLineDash([]);
    } else { // alleen ankerpunten bij de toppen
      ctx.fillStyle = c.hulp;
      for (const a of o.anker) { ctx.beginPath(); ctx.arc(a.x, a.y, 3.2, 0, Math.PI * 2); ctx.fill(); }
    }
    // eindvlag
    const e = o.eind;
    ctx.strokeStyle = c.hulp;
    ctx.lineWidth = 2.5;
    ctx.beginPath(); ctx.moveTo(e.x, e.y); ctx.lineTo(e.x, e.y - 28); ctx.stroke();
    ctx.fillStyle = c.accent;
    ctx.beginPath(); ctx.moveTo(e.x, e.y - 28); ctx.lineTo(e.x + 18, e.y - 21); ctx.lineTo(e.x, e.y - 14); ctx.closePath(); ctx.fill();
    // startstip
    ctx.fillStyle = c.accent;
    ctx.beginPath(); ctx.arc(o.start.x, o.start.y, 8, 0, Math.PI * 2); ctx.fill();
    // meelopende tempo-stip (lus als voorbeeldtempo)
    if (o.stip && !(info && info.verborgen)) {
      const L = P.length - 1;
      const s = (((info && info.nu) || 0) / 1000 * o.tempo) % (L + 0.9 * o.tempo); // 1 punt = 1 mm
      const idx = H.clamp(Math.floor(s), 0, L);
      ctx.fillStyle = c.accent;
      ctx.strokeStyle = c.hulp;
      ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(P[idx].x, P[idx].y, 5.5, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    }
    ctx.restore();
  }

  // ---------- nakijken ----------
  function gladMaken(r) {
    const n = r.length, s = [];
    for (let i = 0; i < n; i++) {
      const h = Math.min(2, i, n - 1 - i);
      let x = 0, y = 0;
      for (let j = i - h; j <= i + h; j++) { x += r[j].x; y += r[j].y; }
      s.push({ x: x / (2 * h + 1), y: y / (2 * h + 1), p: r[i].p, t: r[i].t });
    }
    return s;
  }

  function nakijken(o, streken, vlak) {
    const mm = vlak.pxPerMm, T = o.Tpx, C = o.pts, NC = C.length, tb = o.tab;
    const dekPx = tb.dek * mm;
    const ruwP = streken[streken.length - 1].punten;
    if (ruwP.length < 8 || H.lengte(ruwP) < o.lengteMm * mm * 0.4) return { ongeldig: 'Te kort: trek in één streek van de stip naar de vlag.' };
    const r = H.herbemonster(ruwP, mm);
    const n = r.length;
    const dur = r[n - 1].t - r[0].t;
    if (n < 8 || !(dur > 150)) return { ongeldig: 'Te kort of te snel: probeer opnieuw.' };
    const sm = gladMaken(r);

    // snelheid (mm/s) per punt op de gladde lijn, over venster van +-2
    const v = [];
    for (let i = 0; i < n; i++) {
      const a = Math.max(0, i - 2), b = Math.min(n - 1, i + 2);
      const dt = sm[b].t - sm[a].t;
      v.push(dt > 0 ? H.afstand(sm[a], sm[b]) / mm / (dt / 1000) : 0);
    }
    const w = []; // tijdsgewicht per punt (ms)
    for (let i = 0; i < n; i++) w.push((sm[Math.min(n - 1, i + 1)].t - sm[Math.max(0, i - 1)].t) / 2);
    const t0 = sm[0].t, t1 = sm[n - 1].t;
    const kern = []; // indices in de middelste 80% van de tijd
    for (let i = 0; i < n; i++) if (sm[i].t >= t0 + 0.1 * dur && sm[i].t <= t1 - 0.1 * dur) kern.push(i);

    // afstand tot contour, gesigneerd + richting
    const af = [], dev = [], inw = [], mjs = [];
    let tegen = 0, stappen = 0, vorig = -1;
    const zoek = (i, j0, j1) => {
      let m = Infinity, mj = j0;
      for (let j = j0; j <= j1; j++) {
        const d = Math.hypot(C[j].x - sm[i].x, C[j].y - sm[i].y);
        if (d < m) { m = d; mj = j; }
      }
      return [m, mj];
    };
    for (let i = 0; i < n; i++) {
      // volg de contour in volgorde (anders springt je bij lussen/spiralen naar de verkeerde tak)
      let [m, mj] = vorig < 0 ? zoek(i, 0, Math.floor(NC * 0.25)) : zoek(i, Math.max(0, vorig - 4), Math.min(NC - 1, vorig + 30));
      if (m > 2.5 * dekPx) [m, mj] = zoek(i, 0, NC - 1);
      vorig = mj;
      mjs.push(mj);
      af.push(m);
      const nx = -o.tang[mj].y, ny = o.tang[mj].x;
      const d = (sm[i].x - C[mj].x) * nx + (sm[i].y - C[mj].y) * ny;
      dev.push(d);
      const kk = o.kr[mj];
      inw.push(Math.abs(kk) > 0.008 ? d * Math.sign(kk) : null);
      if (i > 0 && H.afstand(sm[i], sm[i - 1]) > 0.3 * mm) {
        stappen++;
        const dx = sm[i].x - sm[i - 1].x, dy = sm[i].y - sm[i - 1].y;
        if (dx * o.tang[mj].x + dy * o.tang[mj].y < 0) tegen++;
      }
    }
    // dekking: contourpunten met een streekpunt binnen de dek-marge
    let gedekt = 0;
    for (let j = 0; j < NC; j++) {
      let m = Infinity;
      for (let i = 0; i < n; i += 1) { const d = Math.hypot(C[j].x - sm[i].x, C[j].y - sm[i].y); if (d < m) m = d; if (m <= dekPx) break; }
      if (m <= dekPx) gedekt++;
    }
    const dekking = gedekt / NC;
    const gem = H.gemiddelde(af) / mm;
    const sorted = af.slice().sort((a, b) => a - b);
    const p90 = sorted[Math.min(n - 1, Math.floor(0.9 * n))] / mm;
    // toppen: hoe dicht komt je streek bij de sterkste bochten van de contour (verraadt te lage/hoge amplitude)
    let top = 0;
    if (o.anker.length) {
      for (const a of o.anker) {
        let m = Infinity;
        for (let i = 0; i < n; i++) m = Math.min(m, Math.hypot(sm[i].x - a.x, sm[i].y - a.y));
        top += m;
      }
      top /= o.anker.length * mm;
    }
    let A = tb.top && o.anker.length
      ? 100 * (H.lin(gem, tb.gem[0], tb.gem[1]) + H.lin(p90, tb.p90[0], tb.p90[1]) + H.lin(top, tb.top[0], tb.top[1])) / 3
      : 100 * (H.lin(gem, tb.gem[0], tb.gem[1]) + H.lin(p90, tb.p90[0], tb.p90[1])) / 2;
    if (dekking < 0.9) A = Math.min(A, 60);
    const startFout = H.afstand(sm[0], o.start) > tb.se * mm;
    const eindFout = H.afstand(sm[n - 1], o.eind) > tb.se * mm;
    const pen = (startFout || eindFout) ? tb.pen : 0;

    // ritme/periode: waar je zou moeten zijn als je op dezelfde fractie van de lijn zat als op de contour (synchroon),
    // de rms afstand daartoe. Straft te kleine/grote amplitude en verschoven golven, ook waar de band zelf steil loopt.
    let ritS = 0;
    {
      const cum = [0];
      for (let i = 1; i < n; i++) cum.push(cum[i - 1] + H.afstand(sm[i], sm[i - 1]));
      const tot = cum[n - 1] || 1;
      for (let i = 0; i < n; i++) {
        const q = C[Math.round(cum[i] / tot * (NC - 1))];
        ritS += (sm[i].x - q.x) ** 2 + (sm[i].y - q.y) ** 2;
      }
    }
    const rit = Math.sqrt(ritS / n) / mm;
    const R = 100 * H.lin(rit, tb.rit[0], tb.rit[1]);

    // amplitude/grootte: spreiding van je streek tegenover de contour (rotatie-onafhankelijk)
    const spreid = (pp) => {
      const mx = H.gemiddelde(pp.map((q) => q.x)), my = H.gemiddelde(pp.map((q) => q.y));
      return Math.sqrt(H.gemiddelde(pp.map((q) => (q.x - mx) ** 2 + (q.y - my) ** 2)));
    };
    const grootte = spreid(sm) / spreid(C);

    // bibber
    let ss = 0;
    for (let i = 0; i < n; i++) ss += ((r[i].x - sm[i].x) ** 2 + (r[i].y - sm[i].y) ** 2);
    const rms = Math.sqrt(ss / n) / mm;
    const B = 100 * H.lin(rms, tb.bib[0], tb.bib[1]);

    // stoppen
    const med = H.mediaan(kern.map((i) => v[i]));
    let slow = 0, tot = 0;
    const stops = [];
    let run = null;
    for (const i of kern) {
      tot += w[i];
      if (v[i] < 0.15 * med) {
        slow += w[i];
        if (run && run.last === i - 1) { run.last = i; run.ms += w[i]; } else { run = { first: i, last: i, ms: w[i] }; stops.push(run); }
      }
    }
    const stopFrac = tot > 0 ? slow / tot : 0;
    const S = 100 * H.lin(stopFrac, 0, 0.10);

    // tempo
    let dist = 0;
    for (let a = 1; a < kern.length; a++) dist += H.afstand(sm[kern[a]], sm[kern[a - 1]]);
    const kernTijd = kern.length > 1 ? (sm[kern[kern.length - 1]].t - sm[kern[0]].t) / 1000 : 0;
    const vGem = kernTijd > 0 ? dist / mm / kernTijd : 0;
    const [lo, hi] = o.bereik;
    const bereikS = vGem >= lo && vGem <= hi ? 1 : vGem < lo ? H.lin(vGem, lo, lo / 2) : H.lin(vGem, hi, hi * 1.6);
    const vk = kern.map((i) => v[i]);
    const cvV = H.gemiddelde(vk) > 0 ? H.sd(vk) / H.gemiddelde(vk) : 1;
    const Tm = 100 * (bereikS + H.lin(cvV, tb.cv[0], tb.cv[1])) / 2;

    // druk
    const p = r.map((q) => q.p);
    const lo5 = Math.floor(n * 0.1), pm = p.slice(lo5, n - lo5);
    const mono = Math.max(...p) - Math.min(...p) < 1e-3;
    const pg = H.gemiddelde(pm);
    const cvP = pg > 0 ? H.sd(pm) / pg : 0;
    const D = mono ? 100 : 100 * H.lin(cvP, 0.15, 0.5);

    // kriebel
    const pad = H.lengte(sm) / mm;
    const kriebel = pad / o.lengteMm > 1.25 || (stappen > 0 && tegen / stappen > 0.05);

    const g = o.gew;
    let score = g[0] * A + g[1] * B + g[2] * S + g[3] * Tm + g[4] * D + g[5] * R - pen - (kriebel ? 15 : 0);
    score = Math.round(H.clamp(score, 0, 100));

    // bochten afgesneden?
    const iw = inw.filter((x) => x !== null);
    const snijdt = iw.length > 20 && H.gemiddelde(iw) > 0.35 * T && iw.filter((x) => x > 0.3 * T).length / iw.length > 0.5;

    let tip;
    if (kriebel) tip = 'Trek één lijn zonder te corrigeren.';
    else if (stopFrac > 0.05) tip = 'Je stopt halverwege, houd je tempo vast tot de vlag.';
    else if (B < 60 && vGem < lo) tip = 'Te voorzichtig. Trek sneller en gebruik je arm.';
    else if (vGem > hi && A < 70) tip = 'Te snel. Zoek een rustiger ritme.';
    else if (A < 80 && grootte < 0.9) tip = 'Je golven zijn te klein, ga tot aan de toppen.';
    else if (A < 80 && grootte > 1.1) tip = 'Je golven zijn te groot, stop op de toppen.';
    else if (R < 60 && A < 85) tip = 'Je ritme loopt uit de pas, houd de golflengte gelijk aan de lijn.';
    else if (snijdt && A < 90) tip = 'Je snijdt de bochten af, kijk vooruit langs de lijn.';
    else if (dekking < 0.9 || startFout || eindFout) tip = 'Begin bij de stip en trek door tot de vlag.';
    else if (A < 80) tip = o.hulp === 'band' ? 'Blijf in de band. Kijk vooruit langs de lijn.' : 'Blijf dicht op de lijn. Kijk vooruit langs de lijn.';
    else if (B < 60) tip = vGem < lo ? 'Te voorzichtig. Trek sneller en gebruik je arm.' : 'Lijn trilt. Trek ontspannen vanuit je schouder.';
    else if (Tm < 60) tip = vGem < lo ? 'Te traag. Trek met meer vaart.' : vGem > hi ? 'Te snel. Zoek een rustiger ritme.' : 'Houd je snelheid gelijk van begin tot eind.';
    else if (D < 60 && !mono) tip = 'Houd je pendruk gelijkmatig.';
    else if (R < 70) tip = 'Let op de afstand tussen de toppen, houd het ritme van de lijn aan.';
    else tip = score >= 85 ? 'Mooi vloeiend en gelijkmatig.' : 'Goed bezig. Blijf dichter op de lijn.';

    // voor de uitslag: stukken buiten T en stoppunten
    const buiten = [];
    let cur = null;
    for (let i = 0; i < n; i++) {
      if (af[i] > T) { if (!cur) { cur = []; buiten.push(cur); if (i > 0) cur.push({ x: sm[i - 1].x, y: sm[i - 1].y }); } cur.push({ x: sm[i].x, y: sm[i].y }); } else cur = null;
    }
    const stopPlek = stops.filter((s) => s.ms > 80).map((s) => ({ x: sm[s.first].x, y: sm[s.first].y }));

    return {
      score, tip, A: Math.round(A), B: Math.round(B), S: Math.round(S), tempoScore: Math.round(Tm), druk: Math.round(D), ritme: Math.round(R), grootte, top,
      stopFrac, vGem, rms, dekking, kriebel, snijdt, buiten, stopPlek,
    };
  }

  function tekenUitslag(ctx, o, streken, u, vlak) {
    const c = vlak.kleur, P = o.pts;
    ctx.save();
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.setLineDash([10, 8]);
    ctx.strokeStyle = c.goed;
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.moveTo(P[0].x, P[0].y);
    for (let i = 1; i < P.length; i++) ctx.lineTo(P[i].x, P[i].y);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.strokeStyle = c.fout;
    ctx.lineWidth = 4;
    for (const seg of u.buiten || []) {
      if (seg.length < 2) continue;
      ctx.beginPath();
      ctx.moveTo(seg[0].x, seg[0].y);
      for (let i = 1; i < seg.length; i++) ctx.lineTo(seg[i].x, seg[i].y);
      ctx.stroke();
    }
    ctx.fillStyle = c.fout;
    for (const s of u.stopPlek || []) { ctx.beginPath(); ctx.arc(s.x, s.y, 6, 0, Math.PI * 2); ctx.fill(); }
    ctx.restore();
  }

  Tekentrainer.registreer({
    id: 'slingerlijn',
    naam: 'Slingerlijn',
    uitleg: 'Trek in één vloeiende streek van de stip naar de vlag, binnen de band, zonder te stoppen.',
    fundament: 'Zelfverzekerde lijnen met constant tempo vanuit schouder en elleboog; de basis van schone lineart.',
    meerdereStreken: false,
    toonUitslag: 1500,
    nieuweOpgave,
    teken,
    nakijken,
    tekenUitslag,
    scorePlek: (o) => o.plek,
  });
})();
