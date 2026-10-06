// Arceerveld: vul een vorm met evenwijdige streken (gelijke hoek, afstand en druk).
(function () {
  const H = window.Hulp;
  const RAD = Math.PI / 180;
  const MIN_STREKEN = 5, MAX_STREKEN = 20;
  const CEL = 8;           // px: rasterstap voor dekking
  const GRENS = 6;         // px buiten de vorm = "buiten"
  const MAX_KROM = 0.10;   // maximale afwijking/lengte van een 'rechte' streek (cirkels, bogen en krullen vallen erbuiten)

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

  // Eindig getal binnen 0..100 (NaN/Infinity worden 0), zodat de motor nooit een kapotte score krijgt.
  const fin = (v) => (Number.isFinite(v) ? H.clamp(v, 0, 100) : 0);
  const eindig = (v, standaard) => (Number.isFinite(v) ? v : standaard);

  // Geeft de rechte streken terug; de te kromme (cirkels, bogen) worden geteld in uit.krom.
  function geldigeStreken(o, streken) {
    const uit = [];
    uit.krom = 0;
    (streken || []).forEach((s, idx) => {
      const ruw = s && Array.isArray(s.punten) ? s.punten.filter((p) => p && Number.isFinite(p.x) && Number.isFinite(p.y)) : null;
      if (!ruw || ruw.length < 2) return;
      const len = H.lengte(ruw);
      if (!(len >= 0.15 * o.D)) return; // tikjes
      const pts = H.herbemonster(ruw, 4);
      if (pts.length < 3) return;
      const fit = H.lijnFit(pts);
      let maxAfw = 0;
      for (const p of pts) maxAfw = Math.max(maxAfw, Math.abs(H.lijnAfstand(p, { x: fit.mx, y: fit.my }, fit.dx, fit.dy)));
      const a = ruw[0], b = ruw[ruw.length - 1];
      if (!Number.isFinite(maxAfw) || maxAfw / len > MAX_KROM) { uit.krom++; return; }
      uit.push({
        idx, pts, len, hoek: fit.hoek, r: maxAfw / len,
        mid: { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 },
        dx: b.x - a.x, dy: b.y - a.y,
        druk: H.gemiddelde(ruw.map((p) => (Number.isFinite(p.p) ? p.p : 0.5))),
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
    const res = { n: st.length, fout: new Set(), gaten: [] };
    if (st.length < 3) { res.leeg = true; res.hoekScore = res.afstandScore = 0; res.dek = 0; res.onbedekt = cellen.map(() => true); return res; }

    // Criterium 1: hoek (evenwijdig, juiste schuinte, recht).
    const diffs = st.map((s) => wrap(s.hoek - laag.hoek) / RAD);
    const sdHoek = H.sd(diffs), gemDiff = H.gemiddelde(diffs);
    res.sdHoek = sdHoek; res.gemDiff = gemDiff;
    res.r = H.gemiddelde(st.map((s) => s.r));
    res.hoekScore = 100 * (0.4 * L(sdHoek, 2, 8) + 0.35 * L(Math.abs(gemDiff), 3, 12) + 0.25 * L(res.r, 0.02, 0.07));
    st.forEach((s, i) => { if (Math.abs(diffs[i]) > 6) res.fout.add(s.idx); });

    // Criterium 2: afstand (gelijkmatig, geen gaten). Loodrecht op de gemiddelde hoek.
    const th = laag.hoek + gemDiff * RAD, nx = -Math.sin(th), ny = Math.cos(th);
    const gesorteerd = st.map((s) => ({ s, q: s.mid.x * nx + s.mid.y * ny })).sort((a, b) => a.q - b.q);
    const gaten = [];
    for (let i = 1; i < gesorteerd.length; i++) gaten.push(gesorteerd[i].q - gesorteerd[i - 1].q);
    const mu = H.gemiddelde(gaten);
    res.mu = mu; res.doel = laag.d; res.th = th;
    const reg = regressie(gaten), m = gaten.length;
    res.cv = mu > 0 ? H.sd(gaten) / mu : 1;
    // Ondergrens voor de 'hoort-te-zijn' ruimte: voorkomt delen door (bijna) nul bij lijnen op één plek.
    const vloer = 0.3 * (laag.verloop ? Math.min(...laag.verloop.gaten) : laag.d);
    let ref;
    if (laag.verloop) {
      const kant = laag.verloop.kant;
      const f0 = reg.fit(0), f1 = reg.fit(m - 1);
      const groot = kant > 0 ? f0 : f1, klein = kant > 0 ? f1 : f0;
      res.verloopF = groot > 0 ? (groot - klein) / groot : 0;
      const resid = gaten.map((g, j) => g - reg.fit(j));
      res.residCv = mu > 0 ? H.sd(resid) / mu : 1;
      ref = (j) => Math.max(vloer, reg.fit(j));
    } else {
      res.afwDoel = Math.abs(mu - laag.d) / laag.d;
      const f0 = reg.fit(0), f1 = reg.fit(m - 1), groot = Math.max(f0, f1), klein = Math.min(f0, f1);
      res.trend = m >= 4 && groot > 0 ? (groot - klein) / groot : 0;
      const resid = gaten.map((g, j) => g - reg.fit(j));
      res.residCv = mu > 0 ? H.sd(resid) / mu : 1;
      const med = H.mediaan(gaten);
      const refMed = Math.max(vloer, med);
      ref = () => refMed;
    }
    // Grootste afwijking van één tussenruimte t.o.v. wat hij hoort te zijn.
    let maxAfw = 0;
    res.gatTeGroot = res.gatTeKlein = false;
    for (let j = 0; j < m; j++) {
      const r = ref(j), v = (gaten[j] - r) / r;
      maxAfw = Math.max(maxAfw, Math.abs(v));
      if (v > 0.4) { res.gatTeGroot = true; res.gaten.push({ q0: gesorteerd[j].q, q1: gesorteerd[j + 1].q }); }
      else if (v < -0.4) { res.gatTeKlein = true; res.fout.add(gesorteerd[j + 1].s.idx); }
    }
    res.maxAfw = maxAfw;
    if (laag.verloop) res.afstandScore = 100 * (0.4 * L(res.residCv, 0.08, 0.35) + 0.25 * H.lin(res.verloopF, 0.4, 0.05) + 0.35 * L(maxAfw, 0.3, 0.8));
    else res.afstandScore = 100 * (0.4 * L(res.cv, 0.08, 0.30) + 0.25 * L(res.afwDoel, 0.15, 0.5) + 0.35 * L(maxAfw, 0.3, 0.8));

    // Criterium 3 (deels): dekking van het vak door deze laag.
    // Ruime tolerantie: kleine onregelmaat telt bij Afstand, hier telt alleen echt leeg gebied.
    const tol = laag.verloop
      ? 0.75 * Math.max(...laag.verloop.gaten)
      : 0.75 * laag.d;
    res.onbedekt = cellen.map(([x, y]) => {
      for (const s of st) if (H.polyAfstand({ x, y }, s.pts) <= tol) return false;
      return true;
    });
    res.dek = 1 - res.onbedekt.filter(Boolean).length / Math.max(1, cellen.length);
    return res;
  }

  function groepeer(o, st) {
    const groepen = o.lagen.map(() => []);
    for (const s of st) {
      let best = 0, bd = Infinity;
      o.lagen.forEach((l, i) => { const d = H.lijnHoekVerschil(s.hoek, l.hoek); if (d < bd) { bd = d; best = i; } });
      groepen[best].push(s);
    }
    return groepen;
  }

  // Score = deels gemiddelde, deels zwakste criterium: één slecht onderdeel kun je niet wegpoetsen.
  function nakijken(o, streken) {
    const st = geldigeStreken(o, streken);
    if (st.length < MIN_STREKEN && st.krom >= st.length && st.krom > 0)
      return { ongeldig: 'Teken rechte, evenwijdige lijnen in het vlak', behoud: true };
    if (st.length < MIN_STREKEN)
      return { ongeldig: 'Nog ' + st.length + ' lijnen; teken er minstens ' + MIN_STREKEN + ' en tik dan op Klaar.', behoud: true };
    const groepen = groepeer(o, st);
    if (groepen.some((g) => g.length < 3))
      return { ongeldig: o.lagen.length > 1 ? 'Teken in beide richtingen minstens 3 lijnen en tik dan op Klaar.' : 'Teken minstens 3 lijnen onder de juiste hoek.', behoud: true };

    // Raster van cellen binnen de vorm.
    const cellen = [];
    for (let y = o.cy - o.R; y <= o.cy + o.R; y += CEL)
      for (let x = o.cx - o.R; x <= o.cx + o.R; x += CEL)
        if (buiten(o, x, y) <= 0) cellen.push([x, y]);

    const lagen = o.lagen.map((l, i) => analyseLaag(o, l, groepen[i], cellen));
    const gem = (k) => H.gemiddelde(lagen.map((l) => l[k]));

    // Buiten de vorm: aandeel punten > GRENS px buiten.
    let tot = 0, bui = 0;
    for (const s of st) for (const p of s.pts) { tot++; if (buiten(o, p.x, p.y) > GRENS) bui++; }
    const buitenPct = 100 * bui / Math.max(1, tot);
    const dek = gem('dek');
    const dekScore = Math.max(0, 100 * H.lin(dek, 0.85, 0.45) - 4 * buitenPct);

    const hoek = Math.round(fin(gem('hoekScore'))), afstand = Math.round(fin(gem('afstandScore'))), dekking = Math.round(fin(dekScore));
    const crit = [hoek, afstand, dekking];
    const score = Math.round(fin(0.6 * H.gemiddelde(crit) + 0.4 * Math.min(...crit)));

    // Gemarkeerde (foute) streken, gaten en onbedekte cellen.
    const fout = new Set();
    lagen.forEach((l) => l.fout.forEach((i) => fout.add(i)));
    const gaten = [];
    lagen.forEach((l) => l.gaten.forEach((g) => gaten.push({ th: l.th, q0: g.q0, q1: g.q1 })));
    const onbedekt = [];
    cellen.forEach((c, i) => { if (lagen.some((l) => l.onbedekt[i])) onbedekt.push(c); });

    const u = { score, hoek, afstand, dekking, fout: Array.from(fout), gaten, onbedekt, buitenPct: eindig(buitenPct, 0), dek: eindig(dek, 0) };
    u.tip = tip(lagen, u);
    return u;
  }

  function tip(lagen, u) {
    const max = (k) => Math.max(0, ...lagen.map((l) => (Number.isFinite(l[k]) ? l[k] : 0)));
    const kop = 'Hoek ' + u.hoek + ' · Afstand ' + u.afstand + ' · Dekking ' + u.dekking + ' — ';
    const zwak = [['hoek', u.hoek], ['afstand', u.afstand], ['dekking', u.dekking]].sort((a, b) => a[1] - b[1])[0];
    if (zwak[1] >= 85) return kop + 'mooie, gelijkmatige arcering.';
    let t;
    if (zwak[0] === 'hoek') {
      const kand = [
        [max('sdHoek') / 6, 'Je lijnen zijn niet evenwijdig; de rode lijnen staan scheef. Beweeg vanuit je schouder.'],
        [Math.max(0, ...lagen.map((l) => (Number.isFinite(l.gemDiff) ? Math.abs(l.gemDiff) : 0))) / 8, 'Al je lijnen wijken af van de hoek van het voorbeeld; kijk goed naar de schuine lijnen.'],
        [max('r') / 0.05, 'Je lijnen buigen; trek ze in één vlotte beweging.'],
      ].sort((a, b) => b[0] - a[0]);
      t = 'Hoek is je zwakste punt. ' + kand[0][1];
    } else if (zwak[0] === 'afstand') {
      const g = lagen.find((l) => l.gatTeGroot), k = lagen.find((l) => l.gatTeKlein);
      const tr = lagen.find((l) => l.trend > 0.3 && l.residCv < 0.25);
      const vl = lagen.find((l) => l.verloopF !== undefined && l.verloopF < 0.2);
      const afw = lagen.find((l) => l.afwDoel > 0.3);
      if (vl) t = 'Laat de afstand tussen de lijnen geleidelijk kleiner worden naar één kant.';
      else if (g) t = 'Er zitten gaten tussen je lijnen (rode vlakken); houd de ruimte overal gelijk.';
      else if (k) t = 'Sommige lijnen staan te dicht op elkaar (rood); houd de ruimte overal gelijk.';
      else if (tr) t = 'Je lijnen kruipen steeds dichter naar elkaar toe.';
      else if (afw) t = afw.mu > afw.doel ? 'Je lijnen staan te ver uit elkaar; zet ze dichter bij elkaar.' : 'Je lijnen staan te dicht op elkaar; geef meer ruimte.';
      else t = 'De ruimte tussen je lijnen is wisselend; kijk naar het voorbeeld.';
      t = 'Afstand is je zwakste punt. ' + t;
    } else {
      t = 'Dekking is je zwakste punt. ' + (u.buitenPct > 4 ? 'Je gaat buiten de vorm (rood); stop je streek bij de rand.' : 'Er blijven stukken leeg (rood); vul de hele vorm.');
    }
    return kop + t;
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
    // Te grote gaten tussen twee lijnen: duidelijker rood vlak (q = positie loodrecht op de lijnrichting).
    ctx.globalAlpha = 0.28;
    for (const g of u.gaten) {
      const ux = Math.cos(g.th), uy = Math.sin(g.th), nx = -uy, ny = ux, L = o.D, s0 = o.cx * ux + o.cy * uy;
      ctx.beginPath();
      ctx.moveTo(nx * g.q0 + ux * (s0 + L), ny * g.q0 + uy * (s0 + L));
      ctx.lineTo(nx * g.q1 + ux * (s0 + L), ny * g.q1 + uy * (s0 + L));
      ctx.lineTo(nx * g.q1 + ux * (s0 - L), ny * g.q1 + uy * (s0 - L));
      ctx.lineTo(nx * g.q0 + ux * (s0 - L), ny * g.q0 + uy * (s0 - L));
      ctx.closePath();
      ctx.fill();
    }
    ctx.globalAlpha = 1;
    // Doelhoek als dunne lijnen.
    ctx.strokeStyle = vlak.kleur.goed;
    ctx.lineWidth = 1.5;
    for (const l of o.lagen) lijnen(ctx, o, l, l.verloop ? l.ideaal : l.voorbeeld);
    ctx.restore();
    // Streken met afwijkende hoek of te dicht op de buurman: rood.
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
    // Stukken buiten de vorm: rood.
    ctx.lineWidth = 5;
    for (const s of streken) {
      const p = s.punten;
      if (!p || p.length < 2) continue;
      ctx.beginPath();
      for (let k = 1; k < p.length; k++) {
        if (buiten(o, p[k].x, p[k].y) > GRENS && buiten(o, p[k - 1].x, p[k - 1].y) > GRENS) { ctx.moveTo(p[k - 1].x, p[k - 1].y); ctx.lineTo(p[k].x, p[k].y); }
      }
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
  }

  Tekentrainer.registreer({
    id: 'arcering',
    naam: 'Arcering',
    uitleg: 'Vul de vorm met evenwijdige lijnen. Je score hangt af van drie dingen: Hoek (alle lijnen even schuin als het voorbeeld en recht), Afstand (overal dezelfde ruimte, geen gaten) en Dekking (de hele vorm gevuld, niet erbuiten). Pauzeren mag; tik op Klaar als je klaar bent.',
    fundament: 'Ritme en consistentie in evenwijdige lijnen; de basis voor schaduw, textuur en toon.',
    meerdereStreken: true,
    toonUitslag: 2200,
    nieuweOpgave,
    teken,
    isKlaar: (o, streken) => {
      const st = geldigeStreken(o, streken);
      return st.length >= MAX_STREKEN && groepeer(o, st).every((g) => g.length >= 3);
    },
    nakijken,
    tekenUitslag,
    scorePlek: (o) => ({ x: o.cx, y: o.cy }),
  });
})();
