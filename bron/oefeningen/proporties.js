// Deel & Kopieer: meten op het oog. Een lijn of vlak eerlijk verdelen en lengtes herhalen.
(function () {
  const H = window.Hulp;
  const GRAAD = Math.PI / 180;
  const TOL = { 1: 0.15, 2: 0.15, 3: 0.12, 4: 0.10, 5: 0.10 };
  const FONT = 'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif';

  // ---------- opgave ----------

  function kiesSoort(niveau, rng) {
    const schuin = (a) => rng.tussen(-a, a);
    const gelijk = (n) => ({ soort: 'verdeel', fracs: Array.from({ length: n - 1 }, (_, i) => (i + 1) / n), gelijk: true });
    switch (niveau) {
      case 1: return Object.assign(gelijk(2), { hoek: 0 });
      case 2:
        return rng() < 0.55 ? Object.assign(gelijk(3), { hoek: 0 }) : { soort: 'kopieer', k: 1, hoek: 0 };
      case 3: {
        const hoek = rng.kies([0, 90, schuin(35)]);
        return rng() < 0.6 ? Object.assign(gelijk(rng.kies([4, 5, 5])), { hoek }) : { soort: 'kopieer', k: rng.kies([2, 2, 0.5]), hoek };
      }
      case 4: {
        const r = rng();
        const hoek = rng.kies([0, 90, schuin(25)]);
        if (r < 0.4) {
          const as = rng.kies([0, 90]);
          return Object.assign(gelijk(rng.kies([2, 3, 4])), { soort: 'rechthoek', hoek: as, zijde: as === 0 ? 'breedte' : 'hoogte' });
        }
        if (r < 0.7) return Object.assign(gelijk(rng.kies([3, 4, 5])), { hoek });
        return { soort: 'kopieer', k: rng.kies([1, 2, 1.5]), hoek };
      }
      default: {
        const hoek = rng() < 0.15 ? 90 : rng.tussen(-70, 70);
        const r = rng();
        if (r < 0.55) {
          const ratio = rng.kies([[2, 3], [3, 5], [2, 3]]);
          const s = ratio[0] + ratio[1];
          return { soort: rng() < 0.3 ? 'rechthoek' : 'verdeel', fracs: [ratio[0] / s], gelijk: false, ratio, hoek, zijde: 'dikke zijde' };
        }
        return { soort: 'kopieer', k: rng.kies([1.5, 1.5, 0.5, 2]), hoek };
      }
    }
  }

  function nieuweOpgave(niveau, rng, vlak) {
    const sp = kiesSoort(niveau, rng);
    const w = vlak.w, h = vlak.h, m = Math.min(w, h);
    const th = sp.hoek * GRAAD;
    const u = { x: Math.cos(th), y: Math.sin(th) };
    let v = { x: -u.y, y: u.x };
    if (v.y < -1e-9 || (Math.abs(v.y) < 1e-9 && v.x < 0)) v = { x: -v.x, y: -v.y };
    if (Math.abs(u.x) < 1e-9) u.x = 0;
    if (Math.abs(v.x) < 1e-9) v.x = 0;

    // Lokale uitgebreidheid (in eenheden van L): langs u en langs v.
    const r = sp.soort === 'rechthoek' ? 0.5 + rng() * 0.35 : 0;
    const gap = 0.3;
    const a1 = sp.soort === 'kopieer' ? Math.max(1, sp.k) : 1;
    const b1 = sp.soort === 'kopieer' ? gap : r;
    const hoeken = [[0, 0], [a1, 0], [a1, b1], [0, b1]].map(([a, b]) => ({ x: a * u.x + b * v.x, y: a * u.y + b * v.y }));
    const bx0 = Math.min(...hoeken.map((p) => p.x)), bx1 = Math.max(...hoeken.map((p) => p.x));
    const by0 = Math.min(...hoeken.map((p) => p.y)), by1 = Math.max(...hoeken.map((p) => p.y));

    const pad = 0.1 * m;
    const vx0 = 0.05 * w, vx1 = 0.95 * w, vy0 = 0.17 * h, vy1 = 0.95 * h;
    const Lmax = Math.min((vx1 - vx0 - 2 * pad) / Math.max(bx1 - bx0, 1e-6), (vy1 - vy0 - 2 * pad) / Math.max(by1 - by0, 1e-6));
    const L = Math.min(Lmax, 1.3 * m) * rng.tussen(0.75, 0.97);
    const vrijX = Math.max(0, vx1 - vx0 - 2 * pad - (bx1 - bx0) * L);
    const vrijY = Math.max(0, vy1 - vy0 - 2 * pad - (by1 - by0) * L);
    const A = {
      x: vx0 + pad + rng() * vrijX - bx0 * L,
      y: vy0 + pad + rng() * vrijY - by0 * L,
    };
    const B = { x: A.x + u.x * L, y: A.y + u.y * L };
    const Q = r * L;

    const o = {
      soort: sp.soort, niveau, A, B, u, v, L, Q, hoek: sp.hoek, tol: TOL[niveau],
      bbox: { x0: vx0 + 0, x1: vx1, y0: 0, y1: 0 },
    };
    o.bbox = {
      x0: A.x + bx0 * L - pad, x1: A.x + bx1 * L + pad,
      y0: A.y + by0 * L - pad, y1: A.y + by1 * L + pad,
    };
    if (sp.soort === 'kopieer') {
      o.k = sp.k;
      o.T = sp.k * L;
      o.S = { x: A.x + v.x * gap * L, y: A.y + v.y * gap * L };
      o.E = { x: o.S.x + u.x * o.T, y: o.S.y + u.y * o.T };
    } else {
      o.fracs = sp.fracs;
      o.gelijk = sp.gelijk;
      o.ratio = sp.ratio;
      o.zijde = sp.zijde;
    }
    if (niveau === 4) o.verbergNa = 3000;
    o.tekst = tekstVoor(o);
    return o;
  }

  function tekstVoor(o) {
    if (o.soort === 'kopieer') {
      if (o.k === 1) {
        const ah = Math.abs(o.hoek);
        return 'Teken dezelfde lengte ' + (ah < 10 ? 'eronder' : ah === 90 ? 'ernaast' : 'evenwijdig') + ', vanaf de stip';
      }
      const w = o.k === 2 ? 'een lijn van 2× deze lengte' : o.k === 0.5 ? 'een lijn van de helft van deze lengte' : 'een lijn van 1,5× deze lengte';
      return 'Teken ' + w + ', vanaf de stip';
    }
    const N = o.fracs.length;
    const wat = o.soort === 'rechthoek' ? 'de ' + o.zijde : 'de lijn';
    if (!o.gelijk) return 'Zet 1 streepje dat ' + wat + ' verdeelt in ' + o.ratio[0] + ' : ' + o.ratio[1];
    if (N === 1) return 'Zet 1 streepje dat ' + wat + ' in 2 gelijke delen verdeelt';
    return 'Zet ' + N + ' streepjes die ' + wat + ' in ' + (N + 1) + ' gelijke delen verdelen';
  }

  // ---------- tekenen ----------

  const punt = (o, a, b) => ({ x: o.A.x + o.u.x * a + o.v.x * b, y: o.A.y + o.u.y * a + o.v.y * b });

  function lijn(ctx, p, q) { ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(q.x, q.y); ctx.stroke(); }

  function tick(ctx, o, P, half) {
    lijn(ctx, { x: P.x - o.v.x * half, y: P.y - o.v.y * half }, { x: P.x + o.v.x * half, y: P.y + o.v.y * half });
  }

  // Taaksymbool: groot pictogram linksboven (vaste plek), tekst wordt een kleine ondertitel ernaast.
  function symboolLabel(o) {
    if (o.soort === 'kopieer') return o.k === 1 ? '=' : o.k === 0.5 ? '½×' : String(o.k).replace('.', ',') + '×';
    if (!o.gelijk) return o.ratio[0] + ':' + o.ratio[1];
    return o.fracs.length === 1 ? '½' : '1/' + (o.fracs.length + 1);
  }

  function tekenSymbool(ctx, o, vlak, x, y, S) {
    const kl = vlak.kleur;
    const p = S * 0.13, x0 = x + p, W = S - 2 * p, x1 = x0 + W;
    ctx.save();
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.setLineDash([]);
    ctx.strokeStyle = kl.hulp;
    ctx.lineWidth = 1.5;
    ctx.strokeRect(x, y, S, S);
    ctx.strokeStyle = kl.tekst;
    ctx.lineWidth = Math.max(2.5, S * 0.05);
    const tk = S * 0.1;
    const verticaal = (px, cy, h) => lijn(ctx, { x: px, y: cy - h }, { x: px, y: cy + h });
    if (o.soort === 'kopieer') {
      // bovenste referentielijn, eronder de te tekenen lijn (k× zo lang) vanaf de stip
      const eenheid = W * 0.4, yr = y + S * 0.2, yc = y + S * 0.48;
      lijn(ctx, { x: x0, y: yr }, { x: x0 + eenheid, y: yr });
      verticaal(x0, yr, tk); verticaal(x0 + eenheid, yr, tk);
      ctx.strokeStyle = kl.hulp;
      ctx.lineWidth = 1.5;
      ctx.setLineDash([3, 3]);
      lijn(ctx, { x: x0 + eenheid, y: yr + tk }, { x: x0 + eenheid, y: yc - tk });
      ctx.setLineDash([]);
      ctx.strokeStyle = kl.accent;
      ctx.lineWidth = Math.max(2.5, S * 0.05);
      lijn(ctx, { x: x0, y: yc }, { x: x0 + o.k * eenheid, y: yc });
      verticaal(x0 + o.k * eenheid, yc, tk);
      ctx.fillStyle = kl.accent;
      ctx.beginPath(); ctx.arc(x0, yc, S * 0.055, 0, Math.PI * 2); ctx.fill();
    } else if (o.soort === 'rechthoek') {
      const yt = y + S * 0.12, yb = y + S * 0.58;
      ctx.strokeRect(x0, yt, W, yb - yt);
      ctx.strokeStyle = kl.accent;
      for (const f of o.fracs) {
        if (o.zijde === 'hoogte') lijn(ctx, { x: x0, y: yt + (yb - yt) * f }, { x: x1, y: yt + (yb - yt) * f });
        else lijn(ctx, { x: x0 + W * f, y: yt }, { x: x0 + W * f, y: yb });
      }
    } else {
      const cy = y + S * 0.36;
      if (o.gelijk) {
        lijn(ctx, { x: x0, y: cy }, { x: x1, y: cy });
        verticaal(x0, cy, tk); verticaal(x1, cy, tk);
        ctx.strokeStyle = kl.accent;
        const n = o.fracs.length + 1;
        for (let i = 1; i < n; i++) verticaal(x0 + W * i / n, cy, n === 2 ? tk * 1.7 : tk * 1.3);
      } else {
        const xd = x0 + W * o.fracs[0];
        ctx.lineWidth = Math.max(4, S * 0.09);
        ctx.strokeStyle = kl.accent;
        lijn(ctx, { x: x0, y: cy }, { x: xd, y: cy });
        ctx.lineWidth = Math.max(2.5, S * 0.05);
        ctx.strokeStyle = kl.tekst;
        lijn(ctx, { x: xd, y: cy }, { x: x1, y: cy });
        verticaal(x0, cy, tk); verticaal(x1, cy, tk);
        ctx.strokeStyle = kl.accent;
        verticaal(xd, cy, tk * 1.6);
      }
    }
    ctx.fillStyle = kl.tekst;
    ctx.font = '700 ' + Math.round(S * 0.24) + 'px ' + FONT;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(symboolLabel(o), x + S / 2, y + S * 0.83);
    ctx.restore();
  }

  function tekenOpdracht(ctx, o, vlak) {
    const m = Math.min(vlak.w, vlak.h);
    const S = Math.round(H.clamp(m * 0.1, 48, 60));
    const x = 10, y = 8;
    tekenSymbool(ctx, o, vlak, x, y, S);
    // korte ondertitel rechts van het symbool, maximaal 2 regels
    const tx = x + S + 10, breed = Math.max(40, vlak.w - tx - 10);
    let px = Math.round(H.clamp(m * 0.032, 12, 16));
    let regels;
    for (;;) {
      ctx.font = '500 ' + px + 'px ' + FONT;
      regels = [];
      let huidig = '';
      for (const wrd of o.tekst.split(' ')) {
        const proef = huidig ? huidig + ' ' + wrd : wrd;
        if (huidig && ctx.measureText(proef).width > breed) { regels.push(huidig); huidig = wrd; } else huidig = proef;
      }
      regels.push(huidig);
      if (regels.length <= 2 || px <= 11) break;
      px--;
    }
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = vlak.kleur.tekst;
    const lh = px * 1.25, y0 = y + S / 2 - (regels.length - 1) * lh / 2;
    regels.forEach((r, i) => ctx.fillText(r, tx, y0 + i * lh));
  }

  // Referentie (lijn/rechthoek); bij verborgen alleen de eindmarkeringen van een verdeel-opgave.
  function tekenReferentie(ctx, o, vlak, verborgen) {
    const m = Math.min(vlak.w, vlak.h);
    const tk = Math.max(8, 0.035 * m);
    ctx.strokeStyle = vlak.kleur.hulp;
    ctx.lineCap = 'round';
    if (o.soort === 'kopieer') {
      if (!verborgen) {
        ctx.lineWidth = 3;
        lijn(ctx, o.A, o.B);
        ctx.lineWidth = 2.5;
        tick(ctx, o, o.A, tk);
        tick(ctx, o, o.B, tk);
      }
      return;
    }
    if (o.soort === 'rechthoek' && !verborgen) {
      ctx.lineWidth = 2;
      const c = [punt(o, 0, 0), punt(o, o.L, 0), punt(o, o.L, o.Q), punt(o, 0, o.Q)];
      ctx.beginPath();
      ctx.moveTo(c[0].x, c[0].y);
      for (let i = 1; i < 4; i++) ctx.lineTo(c[i].x, c[i].y);
      ctx.closePath();
      ctx.stroke();
    }
    if (!verborgen) { ctx.lineWidth = o.soort === 'rechthoek' ? 3.5 : 3; lijn(ctx, o.A, o.B); }
    ctx.lineWidth = 3;
    const h = o.soort === 'rechthoek' ? Math.max(tk, 0.5 * o.Q * 0.35) : tk * 1.3;
    tick(ctx, o, o.A, h);
    tick(ctx, o, o.B, h);
  }

  function teken(ctx, o, vlak, info) {
    tekenOpdracht(ctx, o, vlak);
    tekenReferentie(ctx, o, vlak, !!(info && info.verborgen));
    if (o.soort === 'kopieer') {
      const r = Math.max(5, 0.014 * Math.min(vlak.w, vlak.h));
      ctx.fillStyle = vlak.kleur.accent;
      ctx.beginPath();
      ctx.arc(o.S.x, o.S.y, r, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  // ---------- nakijken ----------

  // Streken die een markering zijn: kort langs de as. Positie = zwaartepunt op de as (px vanaf A).
  function markeringen(o, streken) {
    const uit = [];
    for (const st of streken) {
      const pts = st.punten;
      if (!pts || !pts.length) continue;
      const pad = H.lengte(pts);
      const rs = pts.length > 1 && pad > 0 ? H.herbemonster(pts, 2) : pts;
      const pr = rs.map((q) => (q.x - o.A.x) * o.u.x + (q.y - o.A.y) * o.u.y);
      const span = Math.max(...pr) - Math.min(...pr);
      if (span <= 0.12 * o.L && pad <= 0.12 * o.L + 1.6 * o.Q) uit.push({ p: H.gemiddelde(pr) });
    }
    uit.sort((a, b) => a.p - b.p);
    return uit;
  }

  function nakijkenVerdeel(o, streken) {
    const N = o.fracs.length, L = o.L;
    const mk = markeringen(o, streken);
    if (!mk.length) return { ongeldig: 'Zet kleine streepjes dwars op de lijn.' };
    const ideaal = o.fracs.map((f) => f * L);
    const juist = mk.length === N;
    let paren;
    if (juist) paren = ideaal.map((id, i) => ({ ideal: id, p: mk[i].p }));
    else {
      const gebruikt = new Set();
      paren = ideaal.map((id) => {
        let best = -1, bd = Infinity;
        mk.forEach((x, j) => { if (!gebruikt.has(j) && Math.abs(x.p - id) < bd) { bd = Math.abs(x.p - id); best = j; } });
        if (best < 0) return { ideal: id, p: null };
        gebruikt.add(best);
        return { ideal: id, p: mk[best].p };
      });
    }
    for (const q of paren) {
      q.d = q.p === null ? null : (q.p - q.ideal) / L;
      q.e = q.p === null ? 0.1 : Math.abs(q.d);
      q.s = 100 * H.lin(q.e, 0.005, o.tol);
    }
    let score = H.gemiddelde(paren.map((q) => q.s)) - (juist ? 0 : 30);
    score = Math.round(H.clamp(score, 0, 100));

    let tip;
    if (!juist) {
      tip = (N === 1 ? 'Het moet 1 streepje zijn' : 'Het moeten ' + N + ' streepjes zijn') + ', je zette er ' + mk.length + '.';
    } else if (score >= 90) {
      tip = 'Goed gezien.';
    } else {
      tip = verdeelTip(o, paren, L);
    }
    return { score, tip, soort: 'verdeel', paren, aantal: mk.length };
  }

  function verdeelTip(o, paren, L) {
    const N = paren.length;
    const pos = paren.map((q) => q.p);
    if (o.gelijk && N >= 2) {
      const ideaalDeel = L / (N + 1);
      const laatste = L - pos[N - 1];
      if ((laatste - ideaalDeel) / ideaalDeel < -0.15) return 'Het laatste deel wordt kleiner; verdeel eerst in het midden.';
    }
    if (o.gelijk && N >= 2) {
      const naar = [];
      for (const q of paren) {
        const richting = Math.sign(L / 2 - q.ideal);
        if (Math.abs(q.ideal - L / 2) > 0.05 * L) naar.push((q.p - q.ideal) * richting / L);
      }
      if (naar.length >= 2 && naar.every((x) => x > 0.01) && H.gemiddelde(naar) > 0.03) return 'Je streepjes liggen te dicht bij het midden.';
    }
    const delen = [];
    let vorig = 0, vorigIdeaal = 0;
    for (const q of paren) {
      delen.push(((q.p - vorig) - (q.ideal - vorigIdeaal)) / (q.ideal - vorigIdeaal));
      vorig = q.p; vorigIdeaal = q.ideal;
    }
    const gem = H.gemiddelde(delen);
    if (gem > 0.08) return 'Je maakt het stuk te lang. Vergelijk met de referentie.';
    if (gem < -0.08) return 'Je maakt het stuk te kort. Vergelijk met de referentie.';
    return o.gelijk ? 'Vergelijk de delen met elkaar; ze moeten even lang zijn.' : 'Schat de verhouding nog eens: vergelijk het korte en het lange stuk.';
  }

  function nakijkenKopieer(o, streken) {
    const pts = streken[streken.length - 1].punten;
    if (pts.length < 2 || H.lengte(pts) < 0.15 * o.T) return { ongeldig: 'Te kort, probeer opnieuw.' };
    const a = pts[0], b = pts[pts.length - 1];
    const vx = b.x - a.x, vy = b.y - a.y;
    let M = vx * o.u.x + vy * o.u.y;
    const teken = M < 0 ? -1 : 1;
    M = Math.abs(M);
    const verschil = Math.hypot(vx, vy);
    const alfa = verschil > 0 ? Math.atan2(Math.abs(vx * o.u.y - vy * o.u.x), M) / GRAAD : 90;
    const signed = (M - o.T) / o.T;
    const e = Math.abs(signed);
    const strafRichting = 2 * Math.max(0, alfa - 3);
    const score = Math.round(H.clamp(100 * H.lin(e, 0.005, o.tol) - strafRichting, 0, 100));
    let tip;
    if (score >= 90) tip = 'Goed gezien.';
    else if (Math.abs(signed) > 0.08) tip = 'Je maakt het stuk te ' + (signed < 0 ? 'kort' : 'lang') + '. Vergelijk met de referentie.';
    else if (alfa > 8) tip = 'Je lijn loopt scheef. Houd dezelfde richting als de referentie.';
    else tip = 'Bijna: vergelijk de lengte nog eens met de referentie.';
    return { score, tip, soort: 'kopieer', M, signed, alfa, teken };
  }

  function nakijken(o, streken) {
    if (o.soort === 'kopieer') return nakijkenKopieer(o, streken);
    return nakijkenVerdeel(o, streken);
  }

  function isKlaar(o, streken) {
    if (o.soort === 'kopieer') return streken.length >= 1;
    return markeringen(o, streken).length >= o.fracs.length;
  }

  // ---------- uitslag ----------

  function pct(d) { const x = Math.round(d * 100); return (x > 0 ? '+' : x < 0 ? '−' : '') + Math.abs(x) + '%'; }

  function label(ctx, vlak, tekst, P, kleur) {
    const px = Math.round(H.clamp(Math.min(vlak.w, vlak.h) * 0.032, 11, 18));
    ctx.font = '700 ' + px + 'px ' + FONT;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.lineWidth = 4;
    ctx.strokeStyle = vlak.kleur.papier || 'transparent';
    ctx.strokeText(tekst, P.x, P.y);
    ctx.fillStyle = kleur;
    ctx.fillText(tekst, P.x, P.y);
  }

  function tekenUitslag(ctx, o, streken, u, vlak) {
    const m = Math.min(vlak.w, vlak.h);
    ctx.save();
    if (o.niveau === 4) { ctx.globalAlpha = 0.45; tekenReferentie(ctx, o, vlak, false); ctx.globalAlpha = 1; }
    ctx.lineCap = 'round';
    if (u.soort === 'verdeel') {
      const half = o.soort === 'rechthoek' ? null : 0.06 * m;
      ctx.setLineDash([8, 6]);
      ctx.strokeStyle = vlak.kleur.goed;
      ctx.lineWidth = 2.5;
      for (const q of u.paren) {
        const P = punt(o, q.ideal, 0);
        if (half === null) lijn(ctx, punt(o, q.ideal, -0.03 * m), punt(o, q.ideal, o.Q + 0.03 * m));
        else tick(ctx, o, P, half);
      }
      ctx.setLineDash([]);
      const buiten = (o.soort === 'rechthoek' ? 0.03 * m : half) + 0.04 * m;
      for (const q of u.paren) {
        if (q.p === null) continue;
        const slecht = q.e > o.tol / 2;
        const kl = slecht ? vlak.kleur.fout : vlak.kleur.goed;
        if (slecht) {
          ctx.strokeStyle = vlak.kleur.fout;
          ctx.lineWidth = 4;
          lijn(ctx, punt(o, q.ideal, 0), punt(o, q.p, 0));
        }
        ctx.fillStyle = kl;
        const P = punt(o, q.p, 0);
        ctx.beginPath();
        ctx.arc(P.x, P.y, 5, 0, Math.PI * 2);
        ctx.fill();
        if (slecht) label(ctx, vlak, pct(q.d), punt(o, q.p, -buiten), vlak.kleur.fout);
      }
    } else {
      const S = o.S, E = o.E;
      const tk = Math.max(8, 0.035 * m);
      ctx.setLineDash([8, 6]);
      ctx.strokeStyle = vlak.kleur.goed;
      ctx.lineWidth = 3;
      lijn(ctx, S, E);
      ctx.setLineDash([]);
      ctx.lineWidth = 3;
      tick(ctx, o, E, tk);
      const slecht = Math.abs(u.signed) > o.tol / 2;
      const Ep = { x: S.x + o.u.x * u.M, y: S.y + o.u.y * u.M };
      if (slecht) {
        ctx.strokeStyle = vlak.kleur.fout;
        ctx.lineWidth = 5;
        lijn(ctx, E, Ep);
      }
      ctx.fillStyle = slecht ? vlak.kleur.fout : vlak.kleur.goed;
      ctx.beginPath();
      ctx.arc(Ep.x, Ep.y, 5, 0, Math.PI * 2);
      ctx.fill();
      if (slecht) label(ctx, vlak, pct(u.signed), { x: E.x + o.v.x * 0.07 * m, y: E.y + o.v.y * 0.07 * m }, vlak.kleur.fout);
      if (u.alfa > 8) label(ctx, vlak, Math.round(u.alfa) + '° scheef', { x: S.x + o.v.x * 0.07 * m, y: S.y + o.v.y * 0.07 * m }, vlak.kleur.fout);
    }
    ctx.restore();
  }

  // Lege plek boven of onder de opgave (anders links/rechts ervan).
  function scorePlek(o, vlak) {
    const b = o.bbox, m = Math.min(vlak.w, vlak.h);
    const top0 = 0.13 * vlak.h;
    const boven = b.y0 - top0, onder = vlak.h - b.y1;
    if (Math.max(boven, onder) >= 0.2 * m) {
      return boven >= onder
        ? { x: vlak.w / 2, y: top0 + boven / 2 }
        : { x: vlak.w / 2, y: b.y1 + onder / 2 };
    }
    const links = b.x0, rechts = vlak.w - b.x1;
    if (Math.max(links, rechts) >= 0.25 * vlak.w) {
      return links >= rechts ? { x: links / 2, y: vlak.h / 2 } : { x: b.x1 + rechts / 2, y: vlak.h / 2 };
    }
    return { x: vlak.w / 2, y: boven >= onder ? top0 + Math.max(boven, 0) / 2 : b.y1 + Math.max(onder, 0) / 2 };
  }

  Tekentrainer.registreer({
    id: 'proporties',
    naam: 'Proporties',
    uitleg: 'Verdeel lijnen en vlakken eerlijk en kopieer lengtes, op het oog.',
    fundament: 'Meten op het oog: elke goede tekening begint met proporties.',
    meerdereStreken: true,
    stilNa: 1500,
    toonUitslag: 2200,
    nieuweOpgave,
    teken,
    isKlaar,
    nakijken,
    tekenUitslag,
    scorePlek,
  });
})();
