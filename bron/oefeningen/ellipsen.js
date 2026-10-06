// Ellipsen in een kader, van bijna-cirkel (niveau 1) tot smal en gedraaid (niveau 5).
// Score = mix van vormscore (is het een nette, gesloten ellips met ongeveer de juiste verhouding en draaiing?)
// en passingscore (ligt hij op de exacte doel-ellips die het kader raakt?). De mix hangt van het niveau af.
(function () {
  const H = window.Hulp;
  const BINS = 72;
  const FBINS = 36; // bakjes voor de gefitte ellips (symmetrie / puntigheid)
  // Per niveau: verhouding lange/korte as, draaiing, grootte (fractie van het vlak), hulp.
  // vorm = aandeel van de score dat uit de vormscore komt (de rest is passing in het kader).
  // sluit = [gat (t.o.v. grootte) waarbij sluiting 0 wordt, exponent op de dekking]: laag niveau milder.
  const NIVEAUS = {
    1: { ratio: [1.0, 1.3], draai: [0, 0], maat: [0.62, 0.72], ghost: 0.5, streepjes: true, vorm: 0.85, sluit: [2.4, 1] },
    2: { ratio: [1.25, 1.7], draai: [0, 90], maat: [0.55, 0.7], ghost: 0.25, streepjes: true, vorm: 0.7, sluit: [1.9, 1.5] },
    3: { ratio: [1.4, 2.1], draai: [-35, 35], maat: [0.5, 0.68], ghost: 0, streepjes: true, vorm: 0.5, sluit: [0.9, 2] },
    4: { ratio: [1.6, 2.6], draai: [-90, 90], maat: [0.4, 0.62], ghost: 0, streepjes: true, vorm: 0.2, sluit: [0.9, 2] },
    5: { ratio: [2.0, 3.4], draai: [-90, 90], maat: [0.32, 0.58], ghost: 0, streepjes: false, vorm: 0.1, sluit: [0.9, 2] },
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
      a, b, t, ghost: n.ghost, streepjes: n.streepjes, niveau, vorm: n.vorm,
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

  // Radiale afstand van punt tot ellips {cx,cy,a,b,t} (+ = buiten) en hoek in het ellipsstelsel.
  function radiaal(e, p) {
    const { u, v } = lokaal(e, p);
    const r = Math.max(1e-6, Math.hypot(u / e.a, v / e.b));
    return { d: Math.hypot(u, v) * (1 - 1 / r), r, phi: Math.atan2(v / e.b, u / e.a) };
  }

  // Ellips fitten op punten (kleinste kwadraten van de radiale afwijking, Levenberg-Marquardt, start via PCA).
  function fitEllips(pts) {
    const mx = H.gemiddelde(pts.map((p) => p.x)), my = H.gemiddelde(pts.map((p) => p.y));
    const lf = H.lijnFit(pts);
    const sa = Math.sqrt(2) * H.sd(pts.map((p) => (p.x - mx) * lf.dx + (p.y - my) * lf.dy));
    const sb = Math.sqrt(2) * H.sd(pts.map((p) => -(p.x - mx) * lf.dy + (p.y - my) * lf.dx));
    let par = [mx, my, Math.max(sa, 3), Math.max(sb, 3), lf.hoek];
    const res = (q) => {
      const e = { cx: q[0], cy: q[1], a: Math.max(q[2], 1), b: Math.max(q[3], 1), t: q[4] };
      return pts.map((p) => radiaal(e, p).d);
    };
    const kost = (r) => r.reduce((s, x) => s + x * x, 0);
    let r0 = res(par), k0 = kost(r0), lam = 1;
    for (let it = 0; it < 40; it++) {
      const J = par.map((_, j) => {
        const q = par.slice(); const h = j === 4 ? 1e-4 : 1e-3 * Math.max(1, Math.abs(par[j]));
        q[j] += h; const r1 = res(q);
        return r1.map((x, i) => (x - r0[i]) / h);
      });
      const A = par.map((_, i) => par.map((__, j) => J[i].reduce((s, x, m) => s + x * J[j][m], 0)));
      const g = par.map((_, i) => J[i].reduce((s, x, m) => s + x * r0[m], 0));
      for (let i = 0; i < 5; i++) A[i][i] *= 1 + lam;
      // Gauss-eliminatie voor A * dx = -g
      const M = A.map((rij, i) => rij.concat(-g[i]));
      let ok = true;
      for (let i = 0; i < 5 && ok; i++) {
        let piv = i;
        for (let k = i + 1; k < 5; k++) if (Math.abs(M[k][i]) > Math.abs(M[piv][i])) piv = k;
        if (Math.abs(M[piv][i]) < 1e-12) { ok = false; break; }
        [M[i], M[piv]] = [M[piv], M[i]];
        for (let k = i + 1; k < 5; k++) { const f = M[k][i] / M[i][i]; for (let c = i; c < 6; c++) M[k][c] -= f * M[i][c]; }
      }
      if (!ok) break;
      const dx = new Array(5);
      for (let i = 4; i >= 0; i--) { let s = M[i][5]; for (let c = i + 1; c < 5; c++) s -= M[i][c] * dx[c]; dx[i] = s / M[i][i]; }
      const q = par.map((x, i) => x + dx[i]);
      const r1 = res(q), k1 = kost(r1);
      if (k1 < k0) { const klein = k0 - k1 < 1e-6 * k0; par = q; r0 = r1; k0 = k1; lam = Math.max(lam / 3, 1e-4); if (klein) break; }
      else lam *= 4;
    }
    let [cx, cy, a, b, t] = par;
    a = Math.max(a, 1); b = Math.max(b, 1);
    if (b > a) { [a, b] = [b, a]; t += Math.PI / 2; }
    t = ((t % Math.PI) + Math.PI) % Math.PI;
    return { cx, cy, a, b, t };
  }

  // Hoe goed is de getekende lijn een nette ellips? Alles genormeerd op de grootte van de gefitte ellips.
  function vormMeting(o, ruw) {
    const pts = H.herbemonsterN(H.herbemonster(ruw, 2), 180);
    const fit = fitEllips(pts);
    const size = (fit.a + fit.b) / 2;
    const rs = pts.map((p) => radiaal(fit, p));
    const rms = Math.sqrt(H.gemiddelde(rs.map((x) => x.d * x.d))) / size;

    // Wiebelig: afwijking van de eigen (gladgestreken) afwijking, d.w.z. hoogfrequent.
    const w = 7, ds = rs.map((x) => x.d);
    const wiebel = Math.sqrt(H.gemiddelde(ds.map((d, i) => {
      let s = 0, n = 0;
      for (let k = -w; k <= w; k++) { const j = i + k; if (j >= 0 && j < ds.length) { s += ds[j]; n++; } }
      return (d - s / n) ** 2;
    }))) / size;

    // Dekking en sluiting (hoek om het midden van de fit, en afstand tussen begin en eind).
    const bak = Array.from({ length: FBINS }, () => []);
    for (const x of rs) bak[Math.floor((x.phi + Math.PI) / (2 * Math.PI) * FBINS) % FBINS].push(x.d);
    const dekking = bak.filter((b) => b.length).length / FBINS;
    const gat = H.afstand(pts[0], pts[pts.length - 1]) / size;
    const [gatSlecht, dekExp] = (NIVEAUS[o.niveau] || NIVEAUS[4]).sluit; // beginners: mildere sluiting
    const sluit = Math.pow(dekking, dekExp) * H.lin(gat, 0.25, gatSlecht);

    // Symmetrie: afwijking in tegenoverliggende (punt) en gespiegelde (as) bakjes moet gelijk zijn.
    const f = bak.map((b) => (b.length ? H.gemiddelde(b) : null));
    let asym = 0, na = 0;
    for (let k = 0; k < FBINS; k++) {
      const punt = f[(k + FBINS / 2) % FBINS], spiegel = f[FBINS - 1 - k];
      if (f[k] !== null && punt !== null) { asym += Math.abs(f[k] - punt); na++; }
      if (f[k] !== null && spiegel !== null) { asym += Math.abs(f[k] - spiegel); na++; }
    }
    asym = na ? asym / na / size : 0;

    // Puntig (oog) of hoekig: afwijking aan de uiteinden van de lange as t.o.v. de diagonalen.
    const waar = (cond) => {
      const v = f.filter((x, k) => x !== null && cond(-Math.PI + (k + 0.5) * 2 * Math.PI / FBINS));
      return v.length ? H.gemiddelde(v) : 0;
    };
    const uiteinde = waar((p) => Math.abs(Math.cos(p)) > 0.9);
    const diag = waar((p) => Math.abs(Math.cos(p)) > 0.45 && Math.abs(Math.cos(p)) < 0.85);
    const punt = (uiteinde - diag) / size; // > 0: puntige uiteinden, < 0: hoekig

    // Verhouding en draaiing t.o.v. de opdracht.
    const fr = fit.a / fit.b, dr = o.a / o.b;
    const ratioFout = Math.abs(Math.log(fr / dr));
    const draaiFout = H.lijnHoekVerschil(fit.t, o.t);
    const gewicht = H.clamp((Math.min(fr, dr) - 1.1) / 0.3, 0, 1); // bij bijna-cirkel telt draaiing niet
    const draaiEff = draaiFout * gewicht;

    const c = {
      netjes: H.lin(rms, 0.015, 0.10),
      wiebel: H.lin(wiebel, 0.008, 0.04),
      sym: H.lin(asym, 0.02, 0.09),
      sluit,
      ratio: H.lin(ratioFout, 0.1, 0.4),
      draai: H.lin(draaiEff, 8, 30),
    };
    const score = Math.round(100 * c.netjes * c.wiebel * c.sym * c.sluit * c.ratio * c.draai);
    return { score, fit, c, rms, wiebel, asym, punt, ratioFout, fr, dr, draaiEff, dekking, gat };
  }

  // Passing t.o.v. de exacte doel-ellips (de oude beoordeling).
  function passingMeting(o, ruw) {
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
    if (!gedekt.length) return null;
    const dekking = gedekt.length / BINS;
    const fout = H.gemiddelde(gedekt.map(Math.abs)) / size;
    const strayFrac = stray / pts.length;
    const score = Math.round(100 * H.lin(fout, 0.012, 0.11) * Math.pow(dekking, 2) * (1 - Math.min(0.5, strayFrac)));
    return { score, offs, dekking, strayFrac, size };
  }

  function nakijken(o, streken) {
    const ruw = streken[streken.length - 1].punten;
    if (ruw.length < 8 || H.lengte(ruw) < (o.a + o.b) * 1.5) return { ongeldig: 'Te kort: teken de hele ellips in één streek.' };
    const pas = passingMeting(o, ruw);
    if (!pas) return { ongeldig: 'Teken de ellips in het kader.' };
    const vorm = vormMeting(o, ruw);
    const wv = o.vorm === undefined ? NIVEAUS[o.niveau || 4].vorm : o.vorm;
    const score = Math.round(wv * vorm.score + (1 - wv) * pas.score);
    return { score, vm: vorm, tip: tip(o, vorm, pas, wv, score), offs: pas.offs, fit: vorm.fit, vorm: vorm.score, passing: pas.score };
  }

  function tip(o, vm, pas, wv, score) {
    const size = pas.size;
    const waar = (cond) => {
      const v = pas.offs.filter((x, k) => x !== null && cond(-Math.PI + (k + 0.5) * 2 * Math.PI / BINS));
      return v.length ? H.gemiddelde(v) : 0;
    };
    const zij = waar((f) => Math.abs(Math.cos(f)) > 0.95);
    const bovenOnder = waar((f) => Math.abs(Math.sin(f)) > 0.95);
    // Vormtips: ernst 0..1, gewogen met het vormaandeel van dit niveau.
    const vormTips = [];
    if (vm.dekking < 0.9 || vm.c.sluit < 0.7) vormTips.push([1 - vm.c.sluit + 0.3, 'Niet gesloten. Ga door tot voorbij je beginpunt.']);
    if (vm.punt > 0.03) vormTips.push([vm.punt * 12, 'Puntige uiteinden (een oog). Houd je tempo in de bocht en draai rond.']);
    else if (vm.punt < -0.03) vormTips.push([-vm.punt * 12, 'Te hoekig. Laat de bochten soepeler verlopen.']);
    if (vm.c.ratio < 0.8) vormTips.push([1 - vm.c.ratio, vm.fr > vm.dr ? 'Te smal: maak hem boller, dichter bij de verhouding van het kader.' : 'Te rond: maak hem langer en smaller zoals het kader.']);
    if (vm.c.draai < 0.8) vormTips.push([1 - vm.c.draai, 'Scheef: laat de lange as meelopen met het kader.']);
    if (vm.c.sym < 0.75) vormTips.push([1 - vm.c.sym, 'Niet symmetrisch: beide helften moeten elkaars spiegelbeeld zijn.']);
    if (Math.abs(vm.punt) < 0.03 && (vm.c.wiebel < 0.75 || vm.c.netjes < 0.6)) vormTips.push([1 - Math.min(vm.c.wiebel, vm.c.netjes + 0.2), 'Lijn wiebelt. Trek sneller vanuit je schouder.']);
    // Passingtips (kader).
    const passTips = [];
    if (pas.dekking < 0.9) passTips.push([1, 'Niet gesloten. Ga door tot voorbij je beginpunt.']);
    if (Math.abs(zij) > 0.035 * size) passTips.push([Math.abs(zij) / size, zij < 0 ? 'Raakt de korte zijden niet. Ga verder door naar de streepjes.' : 'Schiet over de korte zijden heen.']);
    if (Math.abs(bovenOnder) > 0.035 * size) passTips.push([Math.abs(bovenOnder) / size, bovenOnder < 0 ? 'Raakt de lange zijden niet. Maak hem boller.' : 'Steekt over de lange zijden heen.']);
    if (pas.strayFrac > 0.1) passTips.push([pas.strayFrac, 'Een deel van je lijn ligt ver naast de vorm.']);
    const tips = vormTips.map(([e, t]) => [e * (0.3 + wv), t]).concat(passTips.map(([e, t]) => [e * (1.3 - wv), t]));
    if (!tips.length) return score >= 85 ? 'Mooi rond en gesloten.' : vm.score >= 85 ? 'Mooie vorm! Zet hem nu precies in het kader.' : 'Lijn wiebelt. Trek sneller vanuit je schouder.';
    // Op lage niveaus telt passing pas mee als de vorm goed is.
    if (wv >= 0.5 && vormTips.length && vm.score < 70) return vormTips.sort((x, y) => y[0] - x[0])[0][1];
    tips.sort((x, y) => y[0] - x[0]);
    const top = tips[0][1];
    if (wv >= 0.7 && !vormTips.length && passTips.length) return 'Mooie vorm! Probeer nu ook de zijden van het kader te raken.';
    return top;
  }

  function tekenUitslag(ctx, o, streken, u, vlak) {
    const size = (o.a + o.b) / 2;
    // Op lage niveaus: de gefitte ellips (jouw vorm) als doorgetrokken lijn.
    const wv = o.vorm === undefined ? NIVEAUS[o.niveau || 4].vorm : o.vorm;
    if (wv >= 0.5 && u.fit) {
      ctx.save();
      ctx.translate(u.fit.cx, u.fit.cy);
      ctx.rotate(u.fit.t);
      ctx.strokeStyle = vlak.kleur.tekstZacht;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.ellipse(0, 0, u.fit.a, u.fit.b, 0, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }
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
        else if (wv < 0.5 && Math.abs(off) > 0.06 * size) { ctx.fillStyle = vlak.kleur.fout; ctx.beginPath(); ctx.arc(x, y, 4.5, 0, 7); ctx.fill(); }
      }
    });
  }

  Tekentrainer.registreer({
    id: 'ellipsen',
    naam: 'Ellipsen',
    uitleg: 'Teken in één streek een nette ellips die het kader raakt. Eerst telt vooral de vorm, later ook de passing.',
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
