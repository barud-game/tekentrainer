// Arceerveld: vul een vorm met evenwijdige streken (gelijke hoek, afstand en druk).
(function () {
  const H = window.Hulp;
  const RAD = Math.PI / 180;
  const MIN_STREKEN = 5, MAX_STREKEN = 20;
  const CEL = 8;           // px: rasterstap voor dekking
  const GRENS = 6;         // px buiten de vorm = "buiten"

  // Per niveau: vorm(en), hoeken (graden), afstand als fractie van de vormdiameter,
  // of de voorbeeldlijnen blijven staan, drempelfactor, soort (const/verloop/kruis).
  const NIVEAUS = {
    1: { vormen: ['vierkant'], hoeken: [45], d: 0.14, blijf: true, f: 1, soort: 'const' },
    2: { vormen: ['cirkel'], hoeken: [0, 30, 45, 60, 90], d: 0.11, blijf: false, f: 1, soort: 'const' },
    3: { vormen: ['blob'], hoeken: null, d: 0.085, blijf: false, f: 0.8, soort: 'const' },
    4: { vormen: ['vierkant', 'cirkel'], hoeken: [0, 30, 45, 60, 90, 120, 135, 150], d: 0.11, blijf: false, f: 1, soort: 'verloop' },
    5: { vormen: ['vierkant', 'cirkel', 'blob'], hoeken: [0, 30, 45, 60, 90, 120], d: 0.125, blijf: false, f: 0.7, soort: 'kruis' },
  };

  // ---------- vorm ----------
  function blobR(o, phi) {
    return o.R * (1 + o.a1 * Math.cos(2 * phi + o.p1) + o.a2 * Math.cos(3 * phi + o.p2));
  }
  // Afstand tot de rand in px; > 0 = buiten, <= 0 = binnen (bij benadering voor de blob).
  function buiten(o, x, y) {
    const dx = x - o.cx, dy = y - o.cy;
    if (o.vorm === 'vierkant') {
      const qx = Math.abs(dx) - o.R, qy = Math.abs(dy) - o.R;
      return Math.hypot(Math.max(qx, 0), Math.max(qy, 0)) + Math.min(Math.max(qx, qy), 0);
    }
    if (o.vorm === 'cirkel') return Math.hypot(dx, dy) - o.R;
    return Math.hypot(dx, dy) - blobR(o, Math.atan2(dy, dx));
  }
  function pad(ctx, o) {
    ctx.beginPath();
    if (o.vorm === 'vierkant') ctx.rect(o.cx - o.R, o.cy - o.R, 2 * o.R, 2 * o.R);
    else if (o.vorm === 'cirkel') ctx.arc(o.cx, o.cy, o.R, 0, Math.PI * 2);
    else {
      for (let i = 0; i <= 120; i++) {
        const f = i / 120 * Math.PI * 2, r = blobR(o, f);
        const x = o.cx + r * Math.cos(f), y = o.cy + r * Math.sin(f);
        if (i) ctx.lineTo(x, y); else ctx.moveTo(x, y);
      }
      ctx.closePath();
    }
  }

  // ---------- opgave ----------
  function nieuweOpgave(niveau, rng, vlak) {
    const n = NIVEAUS[niveau];
    const half = Math.min(vlak.w * 0.40, vlak.h * 0.38);
    const vorm = rng.kies(n.vormen);
    const o = {
      niveau, vorm, cx: vlak.w / 2, cy: vlak.h * 0.53, f: n.f, soort: n.soort, blijf: n.blijf,
      verbergNa: n.blijf ? 0 : 3000,
    };
    if (vorm === 'blob') {
      o.a1 = rng.tussen(0.07, 0.11); o.a2 = rng.tussen(0.05, 0.09);
      o.p1 = rng.tussen(0, 6.28); o.p2 = rng.tussen(0, 6.28);
      o.R = half / (1 + o.a1 + o.a2);
    } else o.R = half;
    o.D = 2 * o.R;
    const d = n.d * o.D;
    const hoek = (n.hoeken ? rng.kies(n.hoeken) : Math.round(rng.tussen(0, 36)) * 5) * RAD;
    if (n.soort === 'kruis') {
      const verschil = rng.kies([30, 45, 60, 75, 90]) * RAD;
      o.lagen = [{ hoek, d }, { hoek: hoek + verschil, d }];
    } else if (n.soort === 'verloop') {
      const kant = rng.kies([-1, 1]);
      let g = [];
      const dA = 1.55 * d, dB = 0.55 * d;
      // aantal gaten zodat de som ~ 92% van de diameter is
      let m = 2;
      while (m < 40 && m * (dA + dB) / 2 < 0.92 * o.D) m++;
      for (let j = 0; j < m; j++) g.push(dA + (dB - dA) * j / (m - 1));
      const som = g.reduce((s, v) => s + v, 0);
      g = g.map((v) => v * 0.92 * o.D / som);
      if (kant < 0) g.reverse();
      o.lagen = [{ hoek, d: H.gemiddelde(g), verloop: { kant, gaten: g } }];
    } else o.lagen = [{ hoek, d }];
    // Posities (loodrecht op de laag) van de voorbeeldlijnen.
    for (const l of o.lagen) {
      if (l.verloop) {
        l.voorbeeld = [-0.46 * o.D];
        for (const v of l.verloop.gaten) l.voorbeeld.push(l.voorbeeld[l.voorbeeld.length - 1] + v);
        l.ideaal = l.voorbeeld;
      } else {
        l.voorbeeld = [-l.d, 0, l.d];
        const k = Math.floor(0.5 * o.D / l.d);
        l.ideaal = [];
        for (let j = -k; j <= k; j++) l.ideaal.push(j * l.d);
      }
    }
    return o;
  }

  function lijnen(ctx, o, laag, posities) {
    const ux = Math.cos(laag.hoek), uy = Math.sin(laag.hoek), L = o.D;
    ctx.beginPath();
    for (const c of posities) {
      const px = o.cx - uy * c, py = o.cy + ux * c;
      ctx.moveTo(px - ux * L, py - uy * L);
      ctx.lineTo(px + ux * L, py + uy * L);
    }
    ctx.stroke();
  }

  function teken(ctx, o, vlak, info) {
    ctx.save();
    pad(ctx, o);
    ctx.fillStyle = vlak.kleur.hulpZacht;
    ctx.globalAlpha = 0.35;
    ctx.fill();
    ctx.globalAlpha = 1;
    ctx.strokeStyle = vlak.kleur.hulp;
    ctx.lineWidth = 2;
    ctx.stroke();
    if (!info.verborgen) {
      pad(ctx, o);
      ctx.clip();
      ctx.strokeStyle = vlak.kleur.accent;
      ctx.lineWidth = 2.5;
      for (const l of o.lagen) lijnen(ctx, o, l, l.voorbeeld);
    }
    ctx.restore();
  }

  // ---------- nakijken ----------
  const wrap = (rad) => { let d = rad % Math.PI; if (d > Math.PI / 2) d -= Math.PI; if (d <= -Math.PI / 2) d += Math.PI; return d; };

  function geldigeStreken(o, streken) {
    const uit = [];
    streken.forEach((s, idx) => {
      const ruw = s.punten;
      if (!ruw || ruw.length < 2) return;
      const len = H.lengte(ruw);
      if (len < 0.15 * o.D) return; // tikjes
      const pts = H.herbemonster(ruw, 4);
      if (pts.length < 3) return;
      const fit = H.lijnFit(pts);
      let maxAfw = 0;
      for (const p of pts) maxAfw = Math.max(maxAfw, Math.abs(H.lijnAfstand(p, { x: fit.mx, y: fit.my }, fit.dx, fit.dy)));
      const a = ruw[0], b = ruw[ruw.length - 1];
      uit.push({
        idx, pts, len, hoek: fit.hoek, r: maxAfw / len,
        mid: { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 },
        dx: b.x - a.x, dy: b.y - a.y,
        druk: H.gemiddelde(ruw.map((p) => (typeof p.p === 'number' ? p.p : 0.5))),
      });
    });
    return uit;
  }

  function regressie(ys) {
    const m = ys.length, xm = (m - 1) / 2, ym = H.gemiddelde(ys);
    let sxy = 0, sxx = 0;
    for (let j = 0; j < m; j++) { sxy += (j - xm) * (ys[j] - ym); sxx += (j - xm) ** 2; }
    const b = sxx ? sxy / sxx : 0, a = ym - b * xm;
    return { a, b, fit: (j) => a + b * j };
  }

  function analyseLaag(o, laag, st, cellen) {
    const f = o.f;
    const L = (x, g, s) => H.lin(x, g * f, s * f);
    const res = { n: st.length, fout: new Set() };
    if (st.length < 3) { res.leeg = true; res.hoekScore = res.afstandScore = res.rechtScore = res.dekScore = 0; res.dek = 0; res.tegen = 0; res.onbedekt = cellen.map(() => true); return res; }

    const diffs = st.map((s) => wrap(s.hoek - laag.hoek) / RAD);
    const sdHoek = H.sd(diffs), gemDiff = H.gemiddelde(diffs);
    res.sdHoek = sdHoek; res.gemDiff = gemDiff;
    res.hoekScore = 100 * (0.5 * L(sdHoek, 2, 10) + 0.5 * L(Math.abs(gemDiff), 3, 15));
    st.forEach((s, i) => { if (Math.abs(diffs[i]) > 6) res.fout.add(s.idx); });

    // Afstanden loodrecht op de gemiddelde hoek.
    const th = laag.hoek + gemDiff * RAD, nx = -Math.sin(th), ny = Math.cos(th);
    const gesorteerd = st.map((s) => ({ s, q: s.mid.x * nx + s.mid.y * ny })).sort((a, b) => a.q - b.q);
    const gaten = [];
    for (let i = 1; i < gesorteerd.length; i++) gaten.push(gesorteerd[i].q - gesorteerd[i - 1].q);
    const mu = H.gemiddelde(gaten);
    res.mu = mu; res.doel = laag.d;
    const reg = regressie(gaten), m = gaten.length;
    res.cv = mu > 0 ? H.sd(gaten) / mu : 1;
    let ref;
    if (laag.verloop) {
      const kant = laag.verloop.kant;
      const f0 = reg.fit(0), f1 = reg.fit(m - 1);
      const groot = kant > 0 ? f0 : f1, klein = kant > 0 ? f1 : f0;
      res.verloopF = groot > 0 ? (groot - klein) / groot : 0;
      const resid = gaten.map((g, j) => g - reg.fit(j));
      res.residCv = mu > 0 ? H.sd(resid) / mu : 1;
      res.afstandScore = 100 * (0.5 * L(res.residCv, 0.10, 0.40) + 0.5 * H.lin(res.verloopF, 0.4, 0.05));
      ref = (j) => Math.max(1e-6, reg.fit(j));
    } else {
      res.afwDoel = Math.abs(mu - laag.d) / laag.d;
      res.afstandScore = 100 * (0.6 * L(res.cv, 0.10, 0.40) + 0.4 * L(res.afwDoel, 0.15, 0.5));
      const f0 = reg.fit(0), f1 = reg.fit(m - 1), groot = Math.max(f0, f1), klein = Math.min(f0, f1);
      res.trend = m >= 4 && groot > 0 ? (groot - klein) / groot : 0;
      const resid = gaten.map((g, j) => g - reg.fit(j));
      res.residCv = mu > 0 ? H.sd(resid) / mu : 1;
      const med = H.mediaan(gaten);
      ref = () => med;
    }
    for (let j = 0; j < m; j++) {
      const r = ref(j);
      if (Math.abs(gaten[j] - r) / r > 0.4) res.fout.add(gesorteerd[j + 1].s.idx);
    }

    res.r = H.gemiddelde(st.map((s) => s.r));
    res.rechtScore = 100 * L(res.r, 0.02, 0.08);

    // Richting: tegen de meerderheid in.
    const ux = Math.cos(laag.hoek), uy = Math.sin(laag.hoek);
    const tekens = st.map((s) => (s.dx * ux + s.dy * uy >= 0 ? 1 : -1));
    const pos = tekens.filter((t) => t > 0).length;
    res.tegen = Math.min(pos, st.length - pos);

    // Dekking.
    const tol = laag.verloop
      ? 0.5 * Math.min(Math.max(...gaten), 1.2 * Math.max(...laag.verloop.gaten))
      : 0.5 * Math.min(mu, 1.5 * laag.d);
    res.onbedekt = cellen.map(([x, y]) => {
      for (const s of st) if (H.polyAfstand({ x, y }, s.pts) <= tol) return false;
      return true;
    });
    res.dek = 1 - res.onbedekt.filter(Boolean).length / Math.max(1, cellen.length);
    return res;
  }

  function nakijken(o, streken) {
    const st = geldigeStreken(o, streken);
    if (st.length < MIN_STREKEN) return { ongeldig: 'Te weinig streken: vul de vorm met minstens ' + MIN_STREKEN + ' lijnen.' };

    // Raster van cellen binnen de vorm.
    const cellen = [];
    for (let y = o.cy - o.R; y <= o.cy + o.R; y += CEL)
      for (let x = o.cx - o.R; x <= o.cx + o.R; x += CEL)
        if (buiten(o, x, y) <= 0) cellen.push([x, y]);

    // Lagen toewijzen op dichtstbijzijnde doelhoek (bij cross-hatching twee groepen).
    const groepen = o.lagen.map(() => []);
    for (const s of st) {
      let best = 0, bd = Infinity;
      o.lagen.forEach((l, i) => { const d = H.lijnHoekVerschil(s.hoek, l.hoek); if (d < bd) { bd = d; best = i; } });
      groepen[best].push(s);
    }
    const lagen = o.lagen.map((l, i) => analyseLaag(o, l, groepen[i], cellen));
    const gem = (k) => H.gemiddelde(lagen.map((l) => l[k]));

    // Buiten de vorm: aandeel punten > GRENS px buiten.
    let tot = 0, bui = 0;
    for (const s of st) for (const p of s.pts) { tot++; if (buiten(o, p.x, p.y) > GRENS) bui++; }
    const buitenPct = 100 * bui / Math.max(1, tot);
    const dek = gem('dek');
    const dekScore = Math.max(0, 100 * H.lin(dek, 0.9, 0.5) - 3 * buitenPct) * (lagen.every((l) => l.leeg) ? 0 : 1);
    const dekFinal = lagen.some((l) => l.leeg) ? Math.min(dekScore, 100 * H.lin(dek, 0.9, 0.5)) : dekScore;

    // Druk (muis: constant 0.5, dus CV 0).
    const drukken = st.map((s) => s.druk);
    const mp = H.gemiddelde(drukken);
    const cvDruk = mp > 0 ? H.sd(drukken) / mp : 0;
    const drukScore = 100 * H.lin(cvDruk, 0.15, 0.5);

    const tegen = lagen.reduce((s, l) => s + l.tegen, 0);
    const straf = Math.min(15, 5 * tegen);

    const raw = 0.30 * gem('hoekScore') + 0.30 * gem('afstandScore') + 0.15 * gem('rechtScore') + 0.15 * dekFinal + 0.10 * drukScore - straf;
    const score = Math.round(H.clamp(raw, 0, 100));

    // Gemarkeerde (foute) streken en onbedekte cellen.
    const fout = new Set();
    lagen.forEach((l) => l.fout.forEach((i) => fout.add(i)));
    const onbedekt = [];
    cellen.forEach((c, i) => { if (lagen.some((l) => l.onbedekt[i])) onbedekt.push(c); });

    const u = { score, fout: Array.from(fout), onbedekt, buitenPct, dek, cvDruk, tegen };
    u.tip = tip(o, lagen, u);
    return u;
  }

  function tip(o, lagen, u) {
    const geldig = lagen.filter((l) => !l.leeg);
    if (geldig.length < lagen.length) return 'Teken beide lagen: minstens 3 lijnen onder elke hoek.';
    const max = (k) => Math.max(...geldig.map((l) => l[k] || 0));
    const kand = [];
    const sd = max('sdHoek');
    if (sd > 6) kand.push([sd / 6, 'Je hoek schommelt; beweeg vanuit je schouder of draai je scherm.']);
    const dev = Math.max(...geldig.map((l) => Math.abs(l.gemDiff)));
    if (dev > 8) kand.push([dev / 8 * 0.9, 'Je hoek wijkt af van het voorbeeld; kijk goed naar de schuine lijnen.']);
    for (const l of geldig) {
      if (l.verloopF !== undefined) {
        if (l.verloopF < 0.2) kand.push([1 + (0.2 - l.verloopF) * 5, 'Laat de afstand steeds kleiner worden naar één kant.']);
        if (l.residCv > 0.25) kand.push([l.residCv / 0.25, 'Je afstanden lopen niet gelijkmatig af; kijk naar de ruimte tussen de lijnen.']);
      } else {
        if (l.trend > 0.3 && l.residCv < 0.25) kand.push([l.trend / 0.3 * 1.1, 'Je lijnen kruipen steeds dichter naar elkaar toe.']);
        else if (l.cv > 0.25) kand.push([l.cv / 0.25, 'Je afstanden lopen uiteen; kijk naar de ruimte tussen de lijnen.']);
        if (l.afwDoel > 0.3) kand.push([l.afwDoel / 0.3 * 0.8, l.mu > l.doel
          ? 'Je lijnen staan te ver uit elkaar; zet ze dichter bij elkaar.'
          : 'Je lijnen staan te dicht op elkaar; geef meer ruimte.']);
      }
    }
    const r = max('r');
    if (r > 0.05) kand.push([r / 0.05, 'Je lijnen buigen; trek ze in één snelle beweging.']);
    if (u.buitenPct > 5) kand.push([u.buitenPct / 5, 'Je gaat buiten de vorm; stop je streek bij de rand.']);
    else if (u.dek < 0.8) kand.push([0.8 / Math.max(u.dek, 0.05), 'Je stopt te vroeg; vul de hele vorm.']);
    if (u.cvDruk > 0.35) kand.push([u.cvDruk / 0.35, 'Houd je druk gelijk.']);
    const slecht = kand.filter((k) => k[0] >= 1).sort((a, b) => b[0] - a[0]);
    if (slecht.length) return slecht[0][1];
    return u.score >= 85 ? 'Mooie, gelijkmatige arcering.' : 'Houd hoek en afstand overal gelijk.';
  }

  // ---------- uitslag ----------
  function tekenUitslag(ctx, o, streken, u, vlak) {
    ctx.save();
    pad(ctx, o);
    ctx.clip();
    // Onbedekte delen licht gemarkeerd.
    ctx.fillStyle = vlak.kleur.fout;
    ctx.globalAlpha = 0.16;
    for (const [x, y] of u.onbedekt) ctx.fillRect(x - CEL / 2, y - CEL / 2, CEL, CEL);
    ctx.globalAlpha = 1;
    // Doelhoek als dunne lijnen.
    ctx.strokeStyle = vlak.kleur.goed;
    ctx.lineWidth = 1.5;
    for (const l of o.lagen) lijnen(ctx, o, l, l.verloop ? l.ideaal : l.voorbeeld);
    ctx.restore();
    // Streken met afwijkende hoek of afstand.
    ctx.strokeStyle = vlak.kleur.fout;
    ctx.lineWidth = 4;
    ctx.lineCap = 'round';
    ctx.globalAlpha = 0.8;
    for (const i of u.fout) {
      const p = streken[i] && streken[i].punten;
      if (!p || p.length < 2) continue;
      ctx.beginPath();
      ctx.moveTo(p[0].x, p[0].y);
      for (let k = 1; k < p.length; k++) ctx.lineTo(p[k].x, p[k].y);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
  }

  Tekentrainer.registreer({
    id: 'arcering',
    naam: 'Arcering',
    uitleg: 'Vul de vorm met evenwijdige lijnen: zelfde hoek, afstand en druk als het voorbeeld.',
    fundament: 'Ritme en consistentie in evenwijdige lijnen; de basis voor schaduw, textuur en toon.',
    meerdereStreken: true,
    stilNa: 1500,
    toonUitslag: 2200,
    nieuweOpgave,
    teken,
    isKlaar: (o, streken) => geldigeStreken(o, streken).length >= MAX_STREKEN,
    nakijken,
    tekenUitslag,
    scorePlek: (o) => ({ x: o.cx, y: o.cy }),
  });
})();
