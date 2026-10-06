// Richting verdwijnpunt: schat de richting naar een verdwijnpunt (VP) en trek vanuit elk kruisje
// één rechte lijn die erheen wijst. Basis van perspectief.
(function () {
  const H = window.Hulp;
  const RAD = 180 / Math.PI;

  // Per niveau: aantal startpunten, hoek-tolerantie (graden), afstand startpunt-VP (fractie van min(w,h)),
  // aantal VP's, hulpstraal, VP buiten beeld.
  const NIVEAUS = {
    1: { n: [3, 3], thetaMax: 12, afstand: [0.45, 0.8], vps: 1, hulp: true, buiten: false },
    2: { n: [3, 4], thetaMax: 9, afstand: [0.4, 0.8], vps: 1, hulp: false, buiten: false },
    3: { n: [4, 4], thetaMax: 7, afstand: [0.35, 0.75], vps: 2, hulp: false, buiten: false },
    4: { n: [4, 5], thetaMax: 5, afstand: [0.25, 0.45], vps: 2, hulp: false, buiten: false },
    5: { n: [4, 5], thetaMax: 4, afstand: [0.3, 3], vps: 1, hulp: false, buiten: true },
  };

  // ---------- opgave ----------
  function nieuweOpgave(niveau, rng, vlak) {
    const cfg = NIVEAUS[niveau];
    const w = vlak.w, h = vlak.h, m = Math.min(w, h);
    const marge = 0.07 * m;
    const n = Math.floor(rng.tussen(cfg.n[0], cfg.n[1] + 1 - 1e-9));
    const vps = [];
    if (cfg.buiten) {
      for (let poging = 0; poging < 200; poging++) {
        const a = rng.tussen(0, 2 * Math.PI), d = rng.tussen(0.75, 1.5) * w;
        const x = w / 2 + Math.cos(a) * d, y = h / 2 + Math.sin(a) * d;
        if (x < -0.08 * m || x > w + 0.08 * m || y < -0.08 * m || y > h + 0.08 * m) { vps.push({ x, y, vorm: 'rond' }); break; }
      }
      if (!vps.length) vps.push({ x: w * 1.4, y: h * 0.3, vorm: 'rond' });
    } else if (cfg.vps === 1) {
      vps.push({ x: rng.tussen(0.35, 0.65) * w, y: rng.tussen(0.28, 0.5) * h, vorm: 'rond' });
    } else {
      const yl = rng.tussen(0.3, 0.5) * h, yr = rng.tussen(0.3, 0.5) * h;
      vps.push({ x: rng.tussen(0.1, 0.2) * w, y: yl, vorm: 'rond' });
      vps.push({ x: rng.tussen(0.8, 0.9) * w, y: yr, vorm: 'vierkant' });
    }

    const starts = [];
    for (let i = 0; i < n; i++) {
      const vp = cfg.vps === 2 ? i % 2 : 0;
      let relax = 1, gelukt = false, kies = null;
      for (let poging = 0; poging < 900 && !gelukt; poging++) {
        if (poging % 150 === 149) relax *= 0.8;
        const x = rng.tussen(marge, w - marge), y = rng.tussen(0.14 * h, h - marge);
        const V = vps[vp], d = Math.hypot(V.x - x, V.y - y);
        kies = { x, y, vp };
        if (d < cfg.afstand[0] * m * relax || d > cfg.afstand[1] * m) continue;
        if (vps.some((q) => Math.hypot(q.x - x, q.y - y) < 0.14 * m)) continue;
        if (starts.some((s) => Math.hypot(s.x - x, s.y - y) < 0.2 * m * relax)) continue;
        // Lijnen naar hetzelfde VP niet bijna op elkaar.
        const hoek = Math.atan2(V.y - y, V.x - x);
        if (starts.some((s) => s.vp === vp && H.lijnHoekVerschil(hoek, Math.atan2(V.y - s.y, V.x - s.x)) < 7 * relax)) continue;
        gelukt = true;
      }
      starts.push(kies);
    }
    return { niveau, vps, starts, thetaMax: cfg.thetaMax, hulp: cfg.hulp, buiten: cfg.buiten, m, w, h };
  }

  // ---------- meetkunde ----------
  function eenheid(o, k) {
    const s = o.starts[k], V = o.vps[s.vp];
    const d = Math.hypot(V.x - s.x, V.y - s.y) || 1;
    return { ux: (V.x - s.x) / d, uy: (V.y - s.y) / d, d };
  }

  // Eindpunt van de ideale lijn: het VP, of (buiten beeld) de rand van het vlak.
  function eindpunt(o, k) {
    const s = o.starts[k], { ux, uy, d } = eenheid(o, k);
    let t = d;
    if (o.buiten) {
      t = Infinity;
      if (ux > 1e-9) t = Math.min(t, (o.w - s.x) / ux); else if (ux < -1e-9) t = Math.min(t, -s.x / ux);
      if (uy > 1e-9) t = Math.min(t, (o.h - s.y) / uy); else if (uy < -1e-9) t = Math.min(t, -s.y / uy);
      t = Math.min(d, Math.max(0, t));
    }
    return { x: s.x + ux * t, y: s.y + uy * t };
  }

  function geldig(o, st) {
    return st.punten.length >= 12 && H.lengte(st.punten) >= Math.min(60, 0.2 * o.m);
  }

  // Koppel elke geldige streek aan het dichtstbijzijnde nog vrije startpunt. Geeft per streek de index (of -1).
  function toewijzing(o, streken) {
    const vrij = o.starts.map(() => true);
    return streken.map((st) => {
      if (!geldig(o, st)) return -1;
      const p0 = st.punten[0];
      let best = -1, bd = Infinity;
      o.starts.forEach((s, k) => {
        const d = Math.hypot(s.x - p0.x, s.y - p0.y);
        if (vrij[k] && d < bd) { bd = d; best = k; }
      });
      if (best >= 0) vrij[best] = false;
      return best;
    });
  }

  // ---------- tekenen ----------
  function vpKleur(o, vlak, i) {
    return o.vps.length === 2 && i === 1 ? vlak.kleur.tekst : vlak.kleur.accent;
  }

  function vorm(ctx, vorm, x, y, r, vul) {
    ctx.beginPath();
    if (vorm === 'rond') ctx.arc(x, y, r, 0, 2 * Math.PI);
    else ctx.rect(x - r, y - r, 2 * r, 2 * r);
    if (vul) ctx.fill(); else ctx.stroke();
  }

  function teken(ctx, o, vlak, info) {
    const m = o.m, K = vlak.kleur;
    const gedaan = new Set();
    toewijzing(o, (info && info.streken) || []).forEach((k) => { if (k >= 0) gedaan.add(k); });
    ctx.save();
    ctx.lineCap = 'round';

    // Hulpstralen (niveau 1).
    if (o.hulp) {
      ctx.strokeStyle = K.hulp;
      ctx.globalAlpha = 0.55;
      ctx.lineWidth = 1.5;
      o.starts.forEach((s, k) => {
        const e = eindpunt(o, k);
        ctx.beginPath(); ctx.moveTo(s.x, s.y); ctx.lineTo(e.x, e.y); ctx.stroke();
      });
      ctx.globalAlpha = 1;
    }

    // Verdwijnpunt(en).
    const r = Math.max(7, 0.022 * m);
    o.vps.forEach((V, i) => {
      if (o.buiten) return;
      ctx.fillStyle = vpKleur(o, vlak, i);
      vorm(ctx, V.vorm, V.x, V.y, r, true);
      ctx.strokeStyle = K.hulp; ctx.lineWidth = 2;
      vorm(ctx, V.vorm, V.x, V.y, r + 4, false);
    });
    if (o.buiten) pijl(ctx, o, vlak);

    // Startkruisjes.
    const c = Math.max(8, 0.028 * m);
    o.starts.forEach((s, k) => {
      const klaar = gedaan.has(k);
      const kl = o.vps.length === 2 ? vpKleur(o, vlak, s.vp) : K.hulp;
      ctx.strokeStyle = klaar ? K.tekstZacht : kl;
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.moveTo(s.x - c, s.y); ctx.lineTo(s.x + c, s.y);
      ctx.moveTo(s.x, s.y - c); ctx.lineTo(s.x, s.y + c);
      ctx.stroke();
      if (o.vps.length === 2) {
        ctx.fillStyle = vpKleur(o, vlak, s.vp);
        vorm(ctx, o.vps[s.vp].vorm, s.x + c * 0.9, s.y - c * 0.9, Math.max(4, c * 0.4), true);
      }
      if (klaar) {
        ctx.strokeStyle = K.goed; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.arc(s.x, s.y, c * 1.25, 0, 2 * Math.PI); ctx.stroke();
      }
    });
    ctx.restore();
  }

  // Pijl aan de rand van het vlak in de richting van het VP buiten beeld.
  function pijl(ctx, o, vlak) {
    const V = o.vps[0], cx = o.w / 2, cy = o.h / 2, m = o.m;
    const dx = V.x - cx, dy = V.y - cy, L = Math.hypot(dx, dy) || 1, ux = dx / L, uy = dy / L;
    const ins = 0.06 * m;
    let t = Infinity;
    if (ux > 1e-9) t = Math.min(t, (o.w - ins - cx) / ux); else if (ux < -1e-9) t = Math.min(t, (ins - cx) / ux);
    if (uy > 1e-9) t = Math.min(t, (o.h - ins - cy) / uy); else if (uy < -1e-9) t = Math.min(t, (ins - cy) / uy);
    const px = cx + ux * t, py = cy + uy * t, s = Math.max(10, 0.035 * m);
    ctx.fillStyle = vlak.kleur.accent;
    ctx.beginPath();
    ctx.moveTo(px + ux * s, py + uy * s);
    ctx.lineTo(px - ux * s * 0.6 - uy * s * 0.8, py - uy * s * 0.6 + ux * s * 0.8);
    ctx.lineTo(px - ux * s * 0.6 + uy * s * 0.8, py - uy * s * 0.6 - ux * s * 0.8);
    ctx.closePath();
    ctx.fill();
  }

  // ---------- nakijken ----------
  function snelheidsProfiel(pts) {
    // Snelheid per ~40 ms venster, tegen jitter van losse events.
    const v = [];
    let a = pts[0];
    for (let i = 1; i < pts.length; i++) {
      const dt = pts[i].t - a.t;
      if (dt >= 40) { v.push(H.afstand(a, pts[i]) / dt); a = pts[i]; }
    }
    return v;
  }

  // Aantal pauzes (>120 ms nagenoeg stilstaan) midden in de streek.
  function pauzes(pts) {
    let n = 0, anker = 0;
    for (let i = 1; i < pts.length; i++) {
      if (H.afstand(pts[anker], pts[i]) > 2.5) {
        const eind = H.afstand(pts[i - 1], pts[i]) < 8 ? pts[i].t : pts[i - 1].t;
        if (anker > 0 && eind - pts[anker].t > 120) n++;
        anker = i;
      }
    }
    return n;
  }

  function meetStreek(o, st, k) {
    const s = o.starts[k], { ux, uy } = eenheid(o, k);
    const pts = st.punten;
    const dS = H.afstand(pts[0], s);
    const rest = pts.slice(Math.floor(pts.length * 0.1));
    const f = H.lijnFit(rest);
    let fx = f.dx, fy = f.dy;
    if (fx * ux + fy * uy < 0) { fx = -fx; fy = -fy; }
    const theta = Math.atan2(ux * fy - uy * fx, ux * fx + uy * fy) * RAD; // + = kloksgewijs (scherm)
    // Kant waarop de lijn langs het VP loopt.
    const horizontaal = Math.abs(ux) >= Math.abs(uy);
    const kantWaarde = theta * Math.sign(horizontaal ? ux || 1 : uy || 1); // + = onder / links
    const kant = horizontaal ? (kantWaarde > 0 ? 'onder' : 'boven') : (kantWaarde > 0 ? 'links' : 'rechts');

    const L = H.lengte(rest) || 1;
    const e = rest.map((p) => H.lijnAfstand(p, { x: f.mx, y: f.my }, f.dx, f.dy));
    const rms = Math.sqrt(H.gemiddelde(e.map((v) => v * v)));
    const derde = Math.max(1, Math.floor(e.length / 3));
    const bow = H.gemiddelde(e.slice(derde, e.length - derde)) -
      0.5 * (H.gemiddelde(e.slice(0, derde)) + H.gemiddelde(e.slice(e.length - derde)));
    const recht = rms / L;
    const krom = recht > 0.02 && Math.abs(bow) > 0.5 * rms;

    const sp = snelheidsProfiel(pts);
    const gem = H.gemiddelde(sp);
    const cv = gem > 0 ? H.sd(sp) / gem : 0;
    const pauze = pauzes(pts);

    const sHoek = 100 * H.lin(Math.abs(theta), 0, o.thetaMax);
    const sRecht = 100 * H.lin(recht, 0, 0.03);
    const sVloei = Math.max(0, 100 - 40 * Math.max(0, cv - 0.5) - 15 * pauze);
    const sStart = 100 * H.lin(dS, 25, 75);
    const score = 0.6 * sHoek + 0.25 * sRecht + 0.1 * sVloei + 0.05 * sStart;
    return { k, theta, kant, horizontaal, dS, recht, krom, cv, pauze, score };
  }

  function nakijken(o, streken) {
    const wijs = toewijzing(o, streken);
    const details = [];
    wijs.forEach((k, si) => { if (k >= 0) details.push(Object.assign(meetStreek(o, streken[si], k), { si })); });
    if (!details.length) return { ongeldig: 'Te kort: trek een lange lijn vanuit het kruisje.' };

    const n = o.starts.length;
    const ontbreekt = n - details.length;
    const score = Math.round(details.reduce((s, d) => s + d.score, 0) / n);

    // Tips met een ernst; de ergste wint.
    const kandidaten = [];
    if (ontbreekt > 0) kandidaten.push([10, 'Trek een lijn vanuit elk kruisje.']);
    const krom = details.filter((d) => d.krom);
    if (krom.length) {
      const zelfde = krom.length;
      kandidaten.push([H.gemiddelde(krom.map((d) => d.recht)) / 0.02 * (zelfde > 1 ? 1.1 : 0.9), 'Je lijnen buigen: trek sneller en vanuit je schouder.']);
    }
    for (const kant of ['boven', 'onder', 'links', 'rechts']) {
      const g = details.filter((d) => d.kant === kant && Math.abs(d.theta) > 1);
      if (g.length < 3 || g.length < 0.6 * details.length) continue;
      const gemAbs = H.gemiddelde(g.map((d) => Math.abs(d.theta)));
      if (gemAbs > 3) kandidaten.push([gemAbs / 3, 'Je lijnen wijzen steeds te ver ' + kant + (kant === 'links' || kant === 'rechts' ? ' van' : '') + ' het punt.']);
    }
    const aarzel = details.filter((d) => d.pauze > 0 || d.cv > 0.8);
    if (aarzel.length) kandidaten.push([1.5 * aarzel.length / details.length + 0.3, 'Je aarzelt halverwege: kijk naar het verdwijnpunt, niet naar je pen.']);
    const ver = details.filter((d) => d.dS > 25);
    if (ver.length) kandidaten.push([H.gemiddelde(ver.map((d) => d.dS)) / 25 * (ver.length / details.length), 'Begin precies op het kruisje.']);

    let tip;
    if (kandidaten.length) {
      kandidaten.sort((x, y) => y[0] - x[0]);
      tip = kandidaten[0][1];
    } else if (score >= 85) tip = 'Mooi: rechte lijnen die naar het punt wijzen.';
    else tip = 'Schat de richting eerst: kijk naar het verdwijnpunt en trek dan in één beweging.';
    return { score, tip, details, ontbreekt };
  }

  // ---------- uitslag ----------
  function tekenUitslag(ctx, o, streken, u, vlak) {
    const K = vlak.kleur, m = o.m;
    ctx.save();
    ctx.lineCap = 'round';
    ctx.setLineDash([10, 8]);
    ctx.strokeStyle = K.goed;
    ctx.lineWidth = 2.5;
    o.starts.forEach((s, k) => {
      const e = eindpunt(o, k);
      ctx.beginPath(); ctx.moveTo(s.x, s.y); ctx.lineTo(e.x, e.y); ctx.stroke();
    });
    ctx.setLineDash([]);
    const fs = Math.round(H.clamp(m * 0.032, 11, 15));
    ctx.font = '600 ' + fs + 'px ' + (getComputedStyle(document.body).fontFamily || 'sans-serif');
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    for (const d of u.details || []) {
      const slecht = Math.abs(d.theta) > o.thetaMax / 2;
      const pts = streken[d.si].punten;
      if (slecht) {
        ctx.strokeStyle = K.fout; ctx.lineWidth = 1.5;
        ctx.beginPath();
        pts.forEach((p, i) => (i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y)));
        ctx.stroke();
      }
      const a = pts[pts.length - 1], b = pts[Math.max(0, pts.length - 6)];
      const L = H.afstand(a, b) || 1;
      ctx.fillStyle = slecht ? K.fout : K.tekstZacht;
      ctx.fillText(Math.abs(d.theta).toFixed(1) + '°', a.x + (a.x - b.x) / L * 18, a.y + (a.y - b.y) / L * 14);
    }
    ctx.restore();
  }

  // Lege plek weg van de ideale lijnen, VP's en kruisjes (bij voorkeur onderin).
  function scorePlek(o, vlak) {
    const w = vlak.w, h = vlak.h, m = o.m;
    const lijnen = o.starts.map((s, k) => [s, eindpunt(o, k)]);
    const punten = o.starts.concat(o.vps.filter(() => !o.buiten));
    let beste = { x: w / 2, y: h * 0.8 }, bw = -Infinity;
    for (let i = 0; i <= 6; i++) {
      for (let j = 0; j <= 5; j++) {
        const p = { x: w * (0.2 + 0.6 * i / 6), y: h * (0.35 + 0.5 * j / 5) };
        let c = Infinity;
        for (const [a, b] of lijnen) c = Math.min(c, H.segmentAfstand(p, a, b));
        for (const q of punten) c = Math.min(c, H.afstand(p, q));
        const waarde = Math.min(c, 0.3 * m) + 0.25 * p.y;
        if (waarde > bw) { bw = waarde; beste = p; }
      }
    }
    return beste;
  }

  Tekentrainer.registreer({
    id: 'perspectief',
    naam: 'Richting verdwijnpunt',
    uitleg: 'Trek vanuit elk kruisje in één beweging een rechte lijn richting het verdwijnpunt.',
    fundament: 'Lijnrichting naar een verdwijnpunt inschatten en rechttrekken vanuit je schouder; de basis van perspectief.',
    meerdereStreken: true,
    stilNa: 0,
    toonUitslag: 2200,
    nieuweOpgave,
    teken,
    isKlaar(o, streken) { return toewijzing(o, streken).filter((k) => k >= 0).length >= o.starts.length; },
    nakijken,
    tekenUitslag,
    scorePlek,
  });
})();
