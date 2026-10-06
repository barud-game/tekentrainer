// Kijk, verberg, teken: een vorm even zien, die verdwijnt, en dan uit je hoofd natekenen.
(function () {
  const H = window.Hulp;
  const N = 64;                     // punten per vorm na herbemonstering
  const D2R = Math.PI / 180;

  // Per niveau: toontijd in ms en of het ankerkruis (startpunt) getoond wordt.
  const TOON = { 1: 4000, 2: 3000, 3: 3000, 4: 3000, 5: 2000 };
  const ANKER = { 1: true, 2: true, 3: false, 4: false, 5: false };

  // ---------- meetkunde ----------
  const sub = (a, b) => ({ x: a.x - b.x, y: a.y - b.y });
  const hoekTussen = (a, b) => {
    const la = Math.hypot(a.x, a.y), lb = Math.hypot(b.x, b.y);
    if (!la || !lb) return 0;
    const c = H.clamp((a.x * b.x + a.y * b.y) / (la * lb), -1, 1);
    return Math.acos(c) / D2R;
  };

  // Herbemonster een gesloten lijn (laatste punt sluit terug naar het eerste) naar n punten.
  function resSluit(pts, n) {
    const p = [];
    for (const q of pts) if (!p.length || H.afstand(p[p.length - 1], q) > 1e-9) p.push({ x: q.x, y: q.y });
    if (p.length < 2) return Array.from({ length: n }, () => ({ x: p[0].x, y: p[0].y }));
    p.push({ x: p[0].x, y: p[0].y });
    const cum = [0];
    for (let i = 1; i < p.length; i++) cum.push(cum[i - 1] + H.afstand(p[i - 1], p[i]));
    const L = cum[cum.length - 1];
    const uit = [];
    let j = 1;
    for (let k = 0; k < n; k++) {
      const s = L * k / n;
      while (j < p.length - 1 && cum[j] < s) j++;
      const d = cum[j] - cum[j - 1] || 1;
      const f = (s - cum[j - 1]) / d;
      uit.push({ x: p[j - 1].x + (p[j].x - p[j - 1].x) * f, y: p[j - 1].y + (p[j].y - p[j - 1].y) * f });
    }
    return uit;
  }

  const omtrekGesloten = (pts) => H.lengte(pts) + H.afstand(pts[pts.length - 1], pts[0]);

  function middelpunt(pts) {
    return { x: H.gemiddelde(pts.map((p) => p.x)), y: H.gemiddelde(pts.map((p) => p.y)) };
  }
  function bbox(pts) {
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    for (const p of pts) { x0 = Math.min(x0, p.x); y0 = Math.min(y0, p.y); x1 = Math.max(x1, p.x); y1 = Math.max(y1, p.y); }
    return { x0, y0, x1, y1, w: x1 - x0, h: y1 - y0 };
  }
  // Centroïde naar de oorsprong en schaal naar eenheids-RMS-straal.
  function normaliseer(pts) {
    const c = middelpunt(pts);
    const s = Math.sqrt(H.gemiddelde(pts.map((p) => (p.x - c.x) ** 2 + (p.y - c.y) ** 2))) || 1;
    return pts.map((p) => ({ x: (p.x - c.x) / s, y: (p.y - c.y) / s }));
  }

  // Hoekpunten: richtingswijziging > 40 graden in een venster van 5 punten (gesloten lijn).
  // De hoek zelf wordt gemeten uit de richtingen vlak voor en na de piek, zodat de meting
  // niet afhangt van waar de herbemonstering toevallig valt.
  function detecteerHoeken(P) {
    const n = P.length, at = (i) => P[((i % n) + n) % n];
    const w = [];
    for (let i = 0; i < n; i++) w.push(hoekTussen(sub(at(i), at(i - 2)), sub(at(i + 2), at(i))));
    const uit = [];
    for (let i = 0; i < n; i++) {
      if (w[i] <= 40) continue;
      let top = true;
      for (let d = -2; d <= 2 && top; d++) {
        if (!d) continue;
        const v = w[((i + d) % n + n) % n];
        if (d < 0 ? v >= w[i] : v > w[i]) top = false;
      }
      if (!top) continue;
      const draai = hoekTussen(sub(at(i - 2), at(i - 5)), sub(at(i + 5), at(i + 2)));
      uit.push({ i, x: at(i).x, y: at(i).y, draai });
    }
    return uit;
  }

  // ---------- vormen (rond de oorsprong, grootste afmeting = s) ----------
  const cirkel = (s) => Array.from({ length: 96 }, (_, k) => ({ x: s / 2 * Math.cos(k / 96 * 2 * Math.PI - Math.PI / 2), y: s / 2 * Math.sin(k / 96 * 2 * Math.PI - Math.PI / 2) }));
  const rechthoek = (w, h) => [{ x: -w / 2, y: -h / 2 }, { x: w / 2, y: -h / 2 }, { x: w / 2, y: h / 2 }, { x: -w / 2, y: h / 2 }];
  const driehoek = (b, h) => [{ x: 0, y: -h / 2 }, { x: b / 2, y: h / 2 }, { x: -b / 2, y: h / 2 }];
  function druppel(s) {
    const uit = [];
    for (let k = 0; k < 96; k++) {
      const t = k / 96 * 2 * Math.PI;
      uit.push({ x: Math.sin(t) * Math.sin(t / 2), y: -Math.cos(t) });
    }
    const b = bbox(uit), f = s / Math.max(b.w, b.h);
    return uit.map((p) => ({ x: p.x * f, y: p.y * f }));
  }
  function ster(s) {
    const uit = [];
    for (let k = 0; k < 10; k++) {
      const r = k % 2 ? 0.45 : 1, a = -Math.PI / 2 + k * Math.PI / 5;
      uit.push({ x: r * Math.cos(a), y: r * Math.sin(a) });
    }
    const b = bbox(uit), f = s / Math.max(b.w, b.h);
    return uit.map((p) => ({ x: p.x * f, y: p.y * f }));
  }

  // Controle voor onregelmatige veelhoeken: elke hoek scherp genoeg en geen te korte zijde.
  function veelhoekGoed(v) {
    const n = v.length, omtrek = omtrekGesloten(v);
    for (let i = 0; i < n; i++) {
      const a = v[(i + n - 1) % n], b = v[i], c = v[(i + 1) % n];
      if (hoekTussen(sub(b, a), sub(c, b)) < 55) return false;
      if (H.afstand(b, c) < 0.1 * omtrek) return false;
    }
    return true;
  }
  function onregelmatig(s, rng) {
    for (let poging = 0; poging < 300; poging++) {
      const n = rng.kies([5, 6]), stap = 2 * Math.PI / n;
      const v = [];
      for (let k = 0; k < n; k++) {
        const a = k * stap + rng.tussen(-0.25, 0.25) * stap - Math.PI / 2, r = rng.tussen(0.55, 1);
        v.push({ x: r * Math.cos(a), y: r * Math.sin(a) });
      }
      if (!veelhoekGoed(v)) continue;
      const b = bbox(v), f = s / Math.max(b.w, b.h);
      return v.map((p) => ({ x: p.x * f, y: p.y * f }));
    }
    const v = Array.from({ length: 5 }, (_, k) => ({ x: Math.cos(k * 2 * Math.PI / 5 - Math.PI / 2), y: Math.sin(k * 2 * Math.PI / 5 - Math.PI / 2) }));
    const b = bbox(v), f = s / Math.max(b.w, b.h);
    return v.map((p) => ({ x: p.x * f, y: p.y * f }));
  }

  // Basisvorm kiezen: s = grootste afmeting.
  function basis(soort, s, rng) {
    switch (soort) {
      case 'cirkel': return { naam: 'cirkel', pts: cirkel(s) };
      case 'vierkant': return { naam: 'vierkant', pts: rechthoek(s, s) };
      case 'driehoek': return { naam: 'driehoek', pts: driehoek(s, s * 0.87) };
      case 'rechthoek2:1': return rng.kies([0, 1]) ? { naam: 'rechthoek', pts: rechthoek(s, s / 2) } : { naam: 'rechthoek', pts: rechthoek(s / 2, s) };
      case 'rechthoek1:3': return rng.kies([0, 1]) ? { naam: 'rechthoek', pts: rechthoek(s, s / 3) } : { naam: 'rechthoek', pts: rechthoek(s / 3, s) };
      case 'driehoek2:1': return rng.kies([0, 1]) ? { naam: 'driehoek', pts: driehoek(s, s / 2) } : { naam: 'driehoek', pts: driehoek(s / 2.2, s) };
      case 'driehoek1:3': return { naam: 'driehoek', pts: driehoek(s / 3, s) };
      case 'onregelmatig': return { naam: 'veelhoek', pts: onregelmatig(s, rng) };
      case 'druppel': return { naam: 'druppel', pts: druppel(s) };
      case 'ster': return { naam: 'ster', pts: ster(s) };
    }
    throw new Error('onbekende vorm ' + soort);
  }

  // Zet een vorm op een plek (bbox-midden op cx, cy) en bereken alles wat nakijken nodig heeft.
  function maakVorm(pts, cx, cy, naam) {
    const b = bbox(pts), mx = (b.x0 + b.x1) / 2, my = (b.y0 + b.y1) / 2;
    const dicht = pts.map((p) => ({ x: p.x - mx + cx, y: p.y - my + cy }));
    const p64 = resSluit(dicht, N);
    const c = middelpunt(p64);
    return { naam, dicht, p64, c, bb: bbox(p64), norm: normaliseer(p64), hoeken: detecteerHoeken(normaliseer(p64)), omtrek: omtrekGesloten(dicht) };
  }

  // ---------- opgave ----------
  function nieuweOpgave(niveau, rng, vlak) {
    const kader = { x: vlak.w * 0.03, y: vlak.h * 0.05, w: vlak.w * 0.94, h: vlak.h * 0.66 };
    const u = Math.min(kader.w, kader.h);
    const mid = { x: kader.x + kader.w / 2, y: kader.y + kader.h / 2 };
    const lang = kader.w >= kader.h ? 'x' : 'y';
    const vormen = [];

    // Positie langs de lange as (fractie) en de korte as (jitter).
    const op = (t, jit) => {
      const j = rng.tussen(-jit, jit);
      return lang === 'x'
        ? { x: kader.x + kader.w * t, y: mid.y + j * kader.h }
        : { x: mid.x + j * kader.w, y: kader.y + kader.h * t };
    };

    if (niveau === 1) {
      const soort = rng.kies(['cirkel', 'vierkant', 'driehoek']);
      const v = basis(soort, rng.tussen(0.5, 0.62) * u, rng);
      vormen.push(maakVorm(v.pts, mid.x + rng.tussen(-0.06, 0.06) * u, mid.y + rng.tussen(-0.05, 0.05) * u, v.naam));
    } else if (niveau === 2) {
      const soort = rng.kies(['rechthoek2:1', 'rechthoek1:3', 'driehoek2:1', 'driehoek1:3']);
      const v = basis(soort, rng.tussen(0.66, 0.8) * u, rng);
      vormen.push(maakVorm(v.pts, mid.x + rng.tussen(-0.06, 0.06) * u, mid.y + rng.tussen(-0.04, 0.04) * u, v.naam));
    } else if (niveau === 3) {
      const soort = rng.kies(['onregelmatig', 'onregelmatig', 'druppel', 'ster']);
      const v = basis(soort, rng.tussen(0.6, 0.76) * u, rng);
      vormen.push(maakVorm(v.pts, mid.x + rng.tussen(-0.05, 0.05) * u, mid.y + rng.tussen(-0.04, 0.04) * u, v.naam));
    } else if (niveau === 4) {
      const pool = ['cirkel', 'vierkant', 'driehoek', 'rechthoek2:1'];
      const a = rng.kies(pool);
      let b = rng.kies(pool);
      if (b === a) b = pool[(pool.indexOf(a) + 1 + Math.floor(rng() * 3)) % pool.length];
      const pa = op(rng.tussen(0.25, 0.3), 0.1), pb = op(rng.tussen(0.7, 0.75), 0.1);
      for (const [soort, p] of [[a, pa], [b, pb]]) {
        const v = basis(soort, rng.tussen(0.28, 0.4) * u, rng);
        vormen.push(maakVorm(v.pts, p.x, p.y, v.naam));
      }
    } else if (rng() < 0.5) {
      // Huisje: muur (vierkant), dak (driehoek) en deur (rechthoek).
      const w = rng.tussen(0.42, 0.52) * u, dakH = w * 0.45, dh = w * 0.5, dw = w * 0.24;
      const totH = w + dakH, cx = mid.x + rng.tussen(-0.05, 0.05) * u, top = mid.y - totH / 2 + rng.tussen(-0.03, 0.03) * u;
      vormen.push(maakVorm(rechthoek(w, w), cx, top + dakH + w / 2, 'muur'));
      vormen.push(maakVorm(driehoek(w * 1.18, dakH), cx, top + dakH / 2, 'dak'));
      vormen.push(maakVorm(rechthoek(dw, dh), cx, top + dakH + w - dh / 2, 'deur'));
    } else {
      const pool = ['cirkel', 'vierkant', 'driehoek', 'rechthoek2:1'];
      const ts = [0.2, 0.5, 0.8];
      for (let k = 0; k < 3; k++) {
        const p = op(ts[k] + rng.tussen(-0.02, 0.02), 0.1);
        const v = basis(rng.kies(pool), rng.tussen(0.22, 0.27) * u, rng);
        vormen.push(maakVorm(v.pts, p.x, p.y, v.naam));
      }
    }

    // Het score-blok komt in de lege strook onder het kader.
    const plek = { x: vlak.w / 2, y: kader.y + kader.h + (vlak.h - kader.y - kader.h) * 0.42 };
    return {
      niveau, kader, u, vormen, plek,
      verbergNa: TOON[niveau],
      anker: ANKER[niveau] ? { x: vormen[0].dicht[0].x, y: vormen[0].dicht[0].y } : null,
      animeer: true,
    };
  }

  // ---------- tekenen ----------
  function pad(ctx, pts) {
    ctx.beginPath();
    pts.forEach((p, i) => (i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y)));
    ctx.closePath();
  }

  function teken(ctx, o, vlak, info) {
    const k = o.kader, kl = vlak.kleur;
    ctx.save();
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
    ctx.setLineDash([8, 6]);
    ctx.strokeStyle = kl.hulpZacht;
    ctx.lineWidth = 2;
    ctx.strokeRect(k.x, k.y, k.w, k.h);
    ctx.setLineDash([]);

    if (!info.verborgen) {
      o.animeer = true;
      ctx.strokeStyle = kl.hulp;
      ctx.lineWidth = 3;
      for (const v of o.vormen) { pad(ctx, v.dicht); ctx.stroke(); }
      // Aftelbalk boven het kader.
      const f = H.clamp(1 - info.sinds / o.verbergNa, 0, 1);
      const bw = k.w * 0.5, bx = k.x + (k.w - bw) / 2, by = Math.max(4, k.y * 0.4);
      ctx.lineWidth = 5;
      ctx.strokeStyle = kl.hulpZacht;
      ctx.beginPath(); ctx.moveTo(bx, by); ctx.lineTo(bx + bw, by); ctx.stroke();
      if (f > 0) {
        ctx.strokeStyle = kl.accent;
        ctx.beginPath(); ctx.moveTo(bx, by); ctx.lineTo(bx + bw * f, by); ctx.stroke();
      }
    } else {
      o.animeer = false;
    }

    if (o.anker) {
      const s = 0.025 * o.u;
      ctx.strokeStyle = kl.accent;
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.moveTo(o.anker.x - s, o.anker.y); ctx.lineTo(o.anker.x + s, o.anker.y);
      ctx.moveTo(o.anker.x, o.anker.y - s); ctx.lineTo(o.anker.x, o.anker.y + s);
      ctx.stroke();
    }
    ctx.restore();
  }

  // ---------- klaar? ----------
  function strekenGesloten(streek, o) {
    const p = streek.punten;
    if (p.length < 8) return false;
    const b = bbox(p), diag = Math.hypot(b.w, b.h);
    const kleinste = Math.min(...o.vormen.map((v) => Math.hypot(v.bb.w, v.bb.h)));
    if (diag < 0.5 * kleinste) return false;
    return H.afstand(p[0], p[p.length - 1]) <= 0.08 * diag;
  }

  function wijsToe(o, streken) {
    const groepen = o.vormen.map(() => []);
    for (const s of streken) {
      const c = middelpunt(H.herbemonster(s.punten, 4));
      let best = 0, bd = Infinity;
      o.vormen.forEach((v, i) => { const d = H.afstand(c, v.c); if (d < bd) { bd = d; best = i; } });
      groepen[best].push(s);
    }
    return groepen;
  }

  function isKlaar(o, streken) {
    if (!streken.length || !strekenGesloten(streken[streken.length - 1], o)) return false;
    const groepen = wijsToe(o, streken);
    return groepen.every((g) => g.some((s) => strekenGesloten(s, o)));
  }

  // ---------- nakijken ----------
  function vergelijkVorm(v, groep, o) {
    const kd = Math.hypot(o.kader.w, o.kader.h);
    const gesorteerd = groep.slice().sort((a, b) => a.punten[0].t - b.punten[0].t);
    const ruw = [];
    for (const s of gesorteerd) for (const p of s.punten) ruw.push(p);
    const D = resSluit(ruw, N);
    const dc = middelpunt(D), bD = bbox(D);

    const dx = dc.x - v.c.x, dy = dc.y - v.c.y;
    const pos = H.lin(Math.hypot(dx, dy) / kd, 0.01, 0.15);

    const r = Math.sqrt(Math.max(bD.w * bD.h, 1) / Math.max(v.bb.w * v.bb.h, 1));
    const maat = H.lin(Math.abs(Math.log(r)), 0.03, 0.5);
    const q = (Math.max(bD.w, 1) / Math.max(bD.h, 1)) / (v.bb.w / v.bb.h);

    const Dn = normaliseer(D);
    let best = Infinity;
    for (const dir of [1, -1]) {
      for (let k = 0; k < N; k++) {
        let som = 0;
        for (let i = 0; i < N; i++) {
          const a = Dn[(((dir * i + k) % N) + N) % N], b = v.norm[i];
          som += Math.hypot(a.x - b.x, a.y - b.y);
        }
        if (som / N < best) best = som / N;
      }
    }
    const vorm = H.lin(best, 0.02, 0.12);

    let hoek = null;
    if (v.hoeken.length) {
      const gez = detecteerHoeken(Dn);
      let tot = 0;
      for (const e of v.hoeken) {
        let bk = null, bd = 0.4;
        for (const g of gez) { const d = Math.hypot(g.x - e.x, g.y - e.y); if (d < bd) { bd = d; bk = g; } }
        tot += bk ? H.lin(Math.abs(bk.draai - e.draai), 3, 25) : 0;
      }
      hoek = tot / v.hoeken.length;
    }

    const w = hoek === null ? [0.30, 0.25, 0.45, 0] : [0.25, 0.20, 0.35, 0.20];
    const som = w[0] * pos + w[1] * maat + w[2] * vorm + w[3] * (hoek || 0);
    // Een vorm die op de verkeerde plek of maat staat kan niet hoog scoren, ook al klopt de vorm.
    const score = 100 * som * (0.55 + 0.45 * Math.min(pos, maat));

    // Grote afwijkingen voor de uitslag.
    const grens = 0.1 * Math.hypot(v.bb.w, v.bb.h), dichtGesloten = v.dicht.concat([v.dicht[0]]);
    const fouten = D.filter((p) => H.polyAfstand(p, dichtGesloten) > grens).map((p) => ({ x: p.x, y: p.y }));

    return { score, pos, maat, vorm, hoek, r, q, dx, dy, fouten, ontbreekt: false };
  }

  function nakijken(o, streken) {
    const bruikbaar = streken.filter((s) => s.punten.length >= 2);
    const kleinsteOmtrek = Math.min(...o.vormen.map((v) => v.omtrek));
    const totaal = bruikbaar.reduce((s, st) => s + H.lengte(st.punten), 0);
    if (bruikbaar.length < 1 || totaal < 0.4 * kleinsteOmtrek) return { ongeldig: 'Te kort, teken de hele vorm opnieuw.' };

    const groepen = wijsToe(o, bruikbaar);
    const res = o.vormen.map((v, i) => groepen[i].length && groepen[i].reduce((s, st) => s + H.lengte(st.punten), 0) > 0.2 * v.omtrek
      ? vergelijkVorm(v, groepen[i], o)
      : { score: 0, ontbreekt: true, fouten: [] });
    const score = Math.round(H.clamp(H.gemiddelde(res.map((x) => x.score)), 0, 100));
    return { score, tip: kiesTip(res, o, score), res, fouten: [].concat(...res.map((x) => x.fouten)) };
  }

  function kiesTip(res, o, score) {
    const slecht = res.reduce((a, b) => (b.score < a.score ? b : a));
    if (slecht.ontbreekt) return o.vormen.length > 1 ? 'Een vorm ontbreekt. Onthoud alle ' + o.vormen.length + ' vormen.' : 'Teken de hele vorm.';
    const kand = [];
    const rel = Math.max(Math.abs(slecht.dx) / o.kader.w, Math.abs(slecht.dy) / o.kader.h);
    if (slecht.r < 0.8 || slecht.r > 1.25) kand.push([(1 - slecht.maat) * 0.2 + 0.3, slecht.r < 1 ? 'Te klein: teken groter, de vorm was ruimer.' : 'Te groot: teken kleiner, de vorm was compacter.']);
    if (rel > 0.06) {
      const horiz = Math.abs(slecht.dx) / o.kader.w >= Math.abs(slecht.dy) / o.kader.h;
      const tekst = horiz
        ? (slecht.dx < 0 ? 'Te ver naar links: begin verder naar rechts.' : 'Te ver naar rechts: begin verder naar links.')
        : (slecht.dy < 0 ? 'Te ver naar boven: teken lager.' : 'Te ver naar onder: teken hoger.');
      kand.push([(1 - slecht.pos) * 0.25 + 0.3, tekst]);
    }
    if (slecht.q < 0.85 || slecht.q > 1.18) kand.push([Math.min(1, Math.abs(Math.log(slecht.q)) / 0.5) * 0.35 + 0.2, 'Verhouding scheef: de vorm was ' + (slecht.q < 1 ? 'breder' : 'hoger') + ' dan jij tekende.']);
    if (slecht.hoek !== null && slecht.hoek < 0.6) kand.push([(1 - slecht.hoek) * 0.2 + 0.25, 'Hoeken te rond of ontbrekend: zet scherp om in de hoek.']);
    if (kand.length) { kand.sort((a, b) => b[0] - a[0]); return kand[0][1]; }
    if (score >= 85) return slecht.hoek !== null ? 'Sterk, je hoekpunten zaten erop.' : 'Sterk, plek en maat kloppen.';
    return 'Vorm wijkt af: let op de verhoudingen tussen de zijden.';
  }

  function tekenUitslag(ctx, o, streken, u, vlak) {
    ctx.save();
    ctx.lineJoin = 'round';
    ctx.setLineDash([10, 8]);
    ctx.strokeStyle = vlak.kleur.goed;
    ctx.lineWidth = 2.5;
    for (const v of o.vormen) { pad(ctx, v.dicht); ctx.stroke(); }
    ctx.setLineDash([]);
    ctx.fillStyle = vlak.kleur.fout;
    for (const p of (u.fouten || [])) { ctx.beginPath(); ctx.arc(p.x, p.y, 3.5, 0, Math.PI * 2); ctx.fill(); }
    ctx.restore();
  }

  Tekentrainer.registreer({
    id: 'geheugen',
    naam: 'Kijk, verberg, teken',
    uitleg: 'Onthoud de vorm voordat hij verdwijnt en teken hem op dezelfde plek na.',
    fundament: 'Observatie en visueel geheugen: plek, maat, verhoudingen en hoeken van een vorm inschatten.',
    meerdereStreken: true,
    stilNa: 2500,
    toonUitslag: 2200,
    nieuweOpgave,
    teken,
    isKlaar,
    nakijken,
    tekenUitslag,
    scorePlek: (o) => o.plek,
  });
})();
