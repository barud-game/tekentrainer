// Hoekjager: richting en hoek schatten en in één beweging uitvoeren.
(function () {
  const H = window.Hulp;
  const RAD = Math.PI / 180;

  // Per niveau: maximale hoekfout (graden voor score 0) en of de start meetelt.
  const EMAX = { 1: 25, 2: 20, 3: 15, 4: 12, 5: 10 };
  const GENOEMD4 = [30, 45, 60, 75, 105, 120, 135, 150];

  // Gesigneerde fouten van de laatste pogingen (voor "je wijkt steeds dezelfde kant op").
  const vorige = [];

  // Wiskundige hoek (graden, 0 = rechts, tegen de klok in) -> eenheidsrichting op het canvas.
  const richting = (deg) => ({ x: Math.cos(deg * RAD), y: -Math.sin(deg * RAD) });
  const mod180 = (d) => ((d % 180) + 180) % 180;

  function nieuweOpgave(niveau, rng, vlak) {
    const m = Math.min(vlak.w, vlak.h);
    let soort, ref = 0, doel = 0, verberg = false;
    if (niveau === 1) { soort = 'kopie'; ref = rng.kies([0, 90, 45, 135]); }
    else if (niveau === 2) { soort = 'kopie'; ref = rng.kies([15, 30, 45, 60, 75, 105, 120, 135, 150, 165, 0, 90]); }
    else if (niveau === 3) { soort = rng() < 0.5 ? 'kopie' : 'loodrecht'; ref = Math.round(rng.tussen(5, 175)); }
    else if (niveau === 4) { soort = 'hoek'; doel = rng.kies(GENOEMD4); }
    else if (rng() < 0.5) { soort = rng() < 0.5 ? 'kopie' : 'loodrecht'; ref = Math.round(rng.tussen(5, 175)); verberg = true; }
    else { soort = 'hoek'; do { doel = Math.round(rng.tussen(7, 173)); } while (doel % 15 === 0); }
    if (soort === 'kopie') doel = ref;
    else if (soort === 'loodrecht') doel = mod180(ref + 90);

    const o = { niveau, soort, ref, doel, verberg, emax: EMAX[niveau], m, w: vlak.w, h: vlak.h };
    if (verberg) o.verbergNa = 2000;
    if (soort === 'hoek') {
      o.start = { x: vlak.w * 0.45, y: vlak.h * 0.68 };
      o.hulpLen = m * 0.32;
    } else {
      o.start = { x: vlak.w * 0.6, y: vlak.h * 0.6 };
      const c = { x: vlak.w * 0.26, y: vlak.h * 0.6 }, r = richting(ref), half = m * 0.17;
      o.refLijn = { x1: c.x - r.x * half, y1: c.y - r.y * half, x2: c.x + r.x * half, y2: c.y + r.y * half };
    }
    o.zin = soort === 'kopie' ? 'Teken evenwijdig' : soort === 'loodrecht' ? 'Teken loodrecht' : 'Teken ' + doel + '°';
    return o;
  }

  function lijn(ctx, x1, y1, x2, y2) {
    ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke();
  }

  function tekenZin(ctx, o, vlak, extra) {
    const px = Math.round(H.clamp(o.m * 0.05, 16, 34));
    ctx.save();
    ctx.font = '600 ' + px + 'px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = vlak.kleur.tekst;
    ctx.fillText(o.zin + (extra || ''), vlak.w / 2, vlak.h * 0.08);
    ctx.restore();
  }

  function stip(ctx, o, vlak) {
    ctx.save();
    ctx.fillStyle = vlak.kleur.accent;
    ctx.beginPath();
    ctx.arc(o.start.x, o.start.y, Math.max(7, o.m * 0.014), 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  function teken(ctx, o, vlak, info) {
    const verborgen = !!(info && info.verborgen && o.verberg);
    ctx.save();
    ctx.lineCap = 'round';
    ctx.lineWidth = 2.5;
    ctx.strokeStyle = vlak.kleur.hulp;
    if (o.soort === 'hoek') {
      const s = o.start;
      lijn(ctx, s.x, s.y, s.x + o.hulpLen, s.y);
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(s.x, s.y, o.m * 0.12, 0, -o.doel * RAD, true);
      ctx.stroke();
    } else if (!verborgen) {
      const l = o.refLijn;
      lijn(ctx, l.x1, l.y1, l.x2, l.y2);
    }
    ctx.restore();
    stip(ctx, o, vlak);
    tekenZin(ctx, o, vlak, verborgen ? ' (uit je hoofd)' : '');
  }

  function isKlaar() { return true; }

  // Hoek van een stuk punten (graden, wiskundig, 0..180) via PCA.
  const hoekVan = (pts) => mod180(-H.lijnFit(pts).hoek / RAD);

  function nakijken(o, streken) {
    const ruw = streken[streken.length - 1].punten;
    const L = H.lengte(ruw);
    if (ruw.length < 8 || L < 40) return { ongeldig: 'Te kort, trek een langere lijn.' };

    const pts = H.herbemonster(ruw, 3);
    const n = pts.length;
    const kern = pts.slice(Math.floor(n * 0.1), Math.max(Math.floor(n * 0.1) + 3, Math.ceil(n * 0.95)));
    const fit = H.lijnFit(kern);
    const gemeten = mod180(-fit.hoek / RAD);
    const e = H.lijnHoekVerschil(gemeten * RAD, o.doel * RAD);
    const fout = ((gemeten - o.doel + 270) % 180 + 180) % 180 - 90; // gesigneerd, tegen de klok in = +
    const steiler = Math.abs(Math.sin(gemeten * RAD)) > Math.abs(Math.sin(o.doel * RAD));

    // Rechtheid
    let maxAfw = 0;
    for (const p of kern) maxAfw = Math.max(maxAfw, Math.abs(H.lijnAfstand(p, { x: fit.mx, y: fit.my }, fit.dx, fit.dy)));
    const afw = maxAfw / L;

    // Start
    const dStart = H.afstand(ruw[0], o.start);
    const startRel = dStart / L;

    // Buiging: eerste 30% t.o.v. laatste 30%
    const k30 = Math.max(3, Math.floor(n * 0.3));
    const buig = n >= 8 ? H.lijnHoekVerschil(hoekVan(pts.slice(0, k30)) * RAD, hoekVan(pts.slice(n - k30)) * RAD) : 0;

    const sv = H.snelheden(ruw);
    const traag = sv.length > 0 && H.mediaan(sv) < 0.0012 * o.m;

    const A = H.lin(e, 1.5, o.emax);
    const R = H.lin(afw, 0.012, 0.06);
    const S = H.lin(dStart, 0.02 * L, 0.15 * L);
    const metStart = o.niveau > 1;
    const wA = metStart ? 0.7 : 0.78, wR = metStart ? 0.2 : 0.22, wS = metStart ? 0.1 : 0;
    const score = Math.round(100 * (wA * A + wR * R + wS * S));

    // Tips
    const kant = Math.abs(fout) > 4 ? Math.sign(fout) : 0;
    const steeds = kant !== 0 && vorige.length >= 2 && vorige.slice(-2).every((v) => v === kant);
    vorige.push(kant);
    if (vorige.length > 6) vorige.shift();

    let tip = '';
    if (o.soort === 'loodrecht' && H.lijnHoekVerschil(gemeten * RAD, o.ref * RAD) < 6) {
      tip = 'Je tekende evenwijdig in plaats van loodrecht.';
    } else {
      const kand = [];
      if (Math.abs(fout) > 4) {
        const t = steiler ? 'Je lijn is te steil. Maak hem vlakker.' : 'Je lijn is te vlak. Maak hem steiler.';
        kand.push([wA * (1 - A), steeds ? 'Je wijkt steeds dezelfde kant op: ' + t.charAt(0).toLowerCase() + t.slice(1) : t]);
      }
      if (buig > 6) kand.push([0.35 + 0.65 * Math.min(1, (buig - 6) / 10), 'Je buigt aan het einde af. Blijf je doel aankijken en trek door.']);
      if (R < 0.6) {
        kand.push([wR * (1 - R) + (traag ? 0.05 : 0),
          traag ? 'Trek in één vloeiende, snelle beweging.' : 'Je lijn wiebelt. Trek vanuit je schouder, niet je pols.']);
      }
      if (metStart && S < 0.5) kand.push([wS * (1 - S), 'Begin precies op de stip.']);
      kand.sort((a, b) => b[0] - a[0]);
      tip = kand.length ? kand[0][1] : (score >= 85 ? 'Scherp gezien, mooie rechte lijn.' : 'Bijna. Let op hoek en rechtheid.');
    }

    return { score, tip, e, fout, gemeten, fit: { mx: fit.mx, my: fit.my, dx: fit.dx, dy: fit.dy }, lengte: L, A, R, S, buig };
  }

  const HALF = 0.36;

  function tekenUitslag(ctx, o, streken, u, vlak) {
    const m = o.m, s = o.start, d = richting(o.doel), half = m * HALF;
    ctx.save();
    ctx.lineCap = 'round';
    if (o.verberg && o.refLijn) {
      ctx.strokeStyle = vlak.kleur.hulpZacht;
      ctx.lineWidth = 3;
      const l = o.refLijn;
      lijn(ctx, l.x1, l.y1, l.x2, l.y2);
    }
    ctx.setLineDash([10, 8]);
    ctx.strokeStyle = vlak.kleur.goed;
    ctx.lineWidth = 2.5;
    lijn(ctx, s.x - d.x * half, s.y - d.y * half, s.x + d.x * half, s.y + d.y * half);
    ctx.setLineDash([]);
    const groot = u.e > o.emax / 2;
    if (groot) {
      const f = u.fit, h2 = u.lengte / 2;
      ctx.strokeStyle = vlak.kleur.fout;
      ctx.lineWidth = 1.5;
      lijn(ctx, f.mx - f.dx * h2, f.my - f.dy * h2, f.mx + f.dx * h2, f.my + f.dy * h2);
    }
    // Hoekfout als tekst aan het uiteinde van de doellijn
    const px = Math.round(H.clamp(m * 0.035, 13, 24));
    ctx.font = '600 ' + px + 'px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    let ex = s.x + d.x * (half + px * 1.6), ey = s.y + d.y * (half + px * 1.6);
    if (ex < px * 2 || ex > vlak.w - px * 2 || ey < px * 2 || ey > vlak.h - px * 2) {
      ex = s.x - d.x * (half + px * 1.6); ey = s.y - d.y * (half + px * 1.6);
    }
    ex = H.clamp(ex, px * 2, vlak.w - px * 2);
    ey = H.clamp(ey, px * 2, vlak.h - px * 2);
    ctx.fillStyle = groot ? vlak.kleur.fout : vlak.kleur.tekst;
    ctx.fillText('fout ' + (Math.round(u.e * 10) / 10) + '°', ex, ey);
    ctx.restore();
  }

  // Lege plek weg van de lijnen: kies het rasterpunt met de grootste afstand tot alle lijnen.
  function scorePlek(o, vlak) {
    const m = o.m, s = o.start, d = richting(o.doel), half = m * HALF;
    const segs = [[{ x: s.x - d.x * half, y: s.y - d.y * half }, { x: s.x + d.x * half, y: s.y + d.y * half }]];
    if (o.refLijn) segs.push([{ x: o.refLijn.x1, y: o.refLijn.y1 }, { x: o.refLijn.x2, y: o.refLijn.y2 }]);
    if (o.soort === 'hoek') segs.push([s, { x: s.x + o.hulpLen, y: s.y }]);
    let beste = { x: vlak.w / 2, y: vlak.h / 2 }, bd = -1;
    for (let i = 0; i <= 6; i++) for (let j = 0; j <= 4; j++) {
      const p = { x: vlak.w * (0.2 + 0.6 * i / 6), y: vlak.h * (0.28 + 0.6 * j / 4) };
      let dm = Infinity;
      for (const sg of segs) dm = Math.min(dm, H.segmentAfstand(p, sg[0], sg[1]));
      dm = Math.min(dm, H.afstand(p, s));
      if (dm > bd) { bd = dm; beste = p; }
    }
    return beste;
  }

  Tekentrainer.registreer({
    id: 'hoeken',
    naam: 'Hoekjager',
    uitleg: 'Trek vanaf de stip in één snelle beweging een rechte lijn in de gevraagde richting.',
    fundament: 'Richting en hoek schatten en in één beweging uitvoeren; de basis voor perspectief en lijnen die kloppen.',
    meerdereStreken: false,
    toonUitslag: 1600,
    nieuweOpgave,
    teken,
    isKlaar,
    nakijken,
    tekenUitslag,
    scorePlek,
  });
})();
