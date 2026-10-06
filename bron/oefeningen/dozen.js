// Doos afmaken: een 3D-doos in perspectief; teken de ontbrekende ribben vanaf het gemarkeerde hoekpunt.
(function () {
  const H = window.Hulp;
  const RAD = Math.PI / 180;

  // Per niveau: draaihoeken (graden), camera-afstand (in doosgroottes; klein = sterke convergentie),
  // aantal ontbrekende ribben, hulplijnen, en of verborgen ribben meedoen.
  const NIVEAUS = {
    1: { yaw: [38, 52], pitch: [26, 36], roll: [0, 0], cam: 14, mist: 3, aantal: 3, gids: true, verborgen: false },
    2: { yaw: [38, 52], pitch: [26, 36], roll: [0, 0], cam: 14, mist: 3, aantal: 3, gids: false, verborgen: false },
    3: { yaw: [20, 62], pitch: [14, 38], roll: [-14, 14], cam: 4.6, mist: 5, aantal: 5, gids: false, verborgen: false },
    4: { yaw: [22, 58], pitch: [0, 7], roll: [0, 0], cam: 3.2, mist: 7, aantal: 7, gids: false, verborgen: true },
    5: { yaw: [0, 360], pitch: [-55, 55], roll: [-40, 40], cam: 2.7, mist: 6, aantal: 6, gids: false, verborgen: true },
  };

  // Hoekpunt i: bit0 = x, bit1 = y, bit2 = z. Rib = twee hoekpunten die in precies één bit verschillen.
  const RIBBEN = [];
  for (let i = 0; i < 8; i++) for (let k = 0; k < 3; k++) if (!(i & (1 << k))) RIBBEN.push({ a: i, b: i | (1 << k), as: k });

  function shuffle(lijst, rng) {
    const l = lijst.slice();
    for (let i = l.length - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); [l[i], l[j]] = [l[j], l[i]]; }
    return l;
  }

  function projecteer(n, rng, dims) {
    const yaw = rng.tussen(n.yaw[0], n.yaw[1]) * RAD * (rng() < 0.5 ? -1 : 1);
    const pitch = rng.tussen(n.pitch[0], n.pitch[1]) * RAD * (rng() < 0.5 ? -1 : 1);
    const roll = rng.tussen(n.roll[0], n.roll[1]) * RAD;
    const cy = Math.cos(yaw), sy = Math.sin(yaw), cx = Math.cos(pitch), sx = Math.sin(pitch), cz = Math.cos(roll), sz = Math.sin(roll);
    const diag = Math.hypot(dims[0], dims[1], dims[2]);
    const cam = n.cam * diag / 1.7;
    const pts = [];
    for (let i = 0; i < 8; i++) {
      let x = ((i & 1) ? 0.5 : -0.5) * dims[0], y = ((i & 2) ? 0.5 : -0.5) * dims[1], z = ((i & 4) ? 0.5 : -0.5) * dims[2];
      let t = x * cy + z * sy; z = -x * sy + z * cy; x = t;      // yaw (om y)
      t = y * cx - z * sx; z = y * sx + z * cx; y = t;           // pitch (om x)
      t = x * cz - y * sz; y = x * sz + y * cz; x = t;           // roll (om z)
      const zc = cam + z;                                         // z > 0 = verder weg
      pts.push({ x: x * cam / zc, y: -y * cam / zc, z });
    }
    return pts;
  }

  const gebied = (vlak) => vlak.w >= vlak.h * 1.15
    ? { x0: vlak.w * 0.04, x1: vlak.w * 0.60, y0: vlak.h * 0.10, y1: vlak.h * 0.92, score: { x: vlak.w * 0.80, y: vlak.h * 0.5 } }
    : { x0: vlak.w * 0.05, x1: vlak.w * 0.95, y0: vlak.h * 0.08, y1: vlak.h * 0.70, score: { x: vlak.w * 0.5, y: vlak.h * 0.86 } };

  const vlakArea = (v, ids) => {
    let s = 0;
    for (let i = 0; i < ids.length; i++) { const p = v[ids[i]], q = v[ids[(i + 1) % ids.length]]; s += p.x * q.y - q.x * p.y; }
    return Math.abs(s) / 2;
  };

  function bouw(n, rng, vlak) {
    const dims = [rng.tussen(0.8, 1.25), rng.tussen(0.8, 1.25), rng.tussen(0.8, 1.25)];
    for (let poging = 0; poging < 30; poging++) {
      const v = projecteer(n, rng, dims);
      // Voorvlak: per as de nabije kant, daarvan het vlak met de grootste oppervlakte.
      let front = null, besteArea = -1;
      for (let k = 0; k < 3; k++) {
        const kant = [0, 1].map((s) => { const ids = []; for (let i = 0; i < 8; i++) if (((i >> k) & 1) === s) ids.push(i); return ids; });
        const diep = kant.map((ids) => H.gemiddelde(ids.map((i) => v[i].z)));
        const ids = diep[0] <= diep[1] ? kant[0] : kant[1];
        const ordered = [ids[0], ids[1], ids[3], ids[2]];
        const a = vlakArea(v, ordered);
        if (a > besteArea) { besteArea = a; front = ids; }
      }
      let verborgen = 0;
      for (let i = 1; i < 8; i++) if (v[i].z > v[verborgen].z) verborgen = i;
      if (front.includes(verborgen)) continue;

      // Naar het vlak schalen en centreren.
      const g = gebied(vlak);
      const minx = Math.min(...v.map((p) => p.x)), maxx = Math.max(...v.map((p) => p.x));
      const miny = Math.min(...v.map((p) => p.y)), maxy = Math.max(...v.map((p) => p.y));
      const k = Math.min((g.x1 - g.x0) / (maxx - minx), (g.y1 - g.y0) / (maxy - miny));
      const cx = (g.x0 + g.x1) / 2, cy = (g.y0 + g.y1) / 2, mx = (minx + maxx) / 2, my = (miny + maxy) / 2;
      const punten = v.map((p) => ({ x: cx + (p.x - mx) * k, y: cy + (p.y - my) * k, z: p.z }));
      let D = 0;
      for (const a of front) for (const b of front) D = Math.max(D, H.afstand(punten[a], punten[b]));
      if (D < Math.min(vlak.w, vlak.h) * 0.12) continue;
      // Geen bijna-samenvallende hoekpunten (dan is een rib niet te tekenen).
      let kort = Infinity;
      for (const r of RIBBEN) kort = Math.min(kort, H.afstand(punten[r.a], punten[r.b]));
      if (kort < D * 0.18) continue;
      return { punten, front, verborgen, D };
    }
    return null;
  }

  function nieuweOpgave(niveau, rng, vlak) {
    const n = NIVEAUS[niveau];
    let doos = null;
    while (!doos) doos = bouw(n, rng, vlak);
    const { punten, front, verborgen, D } = doos;

    const ribben = RIBBEN.map((r, i) => {
      const inFront = front.includes(r.a) && front.includes(r.b);
      const verb = r.a === verborgen || r.b === verborgen;
      return { i, a: r.a, b: r.b, as: r.as, inFront, verb, status: inFront ? 'gegeven' : 'weg' };
    });
    const zichtbaar = shuffle(ribben.filter((r) => !r.inFront && !r.verb), rng);
    const kandidaten = n.verborgen ? shuffle(ribben.filter((r) => !r.inFront), rng) : zichtbaar;
    // Op niveau 4/5 blijven er alleen zichtbare ribben als gegeven over.
    let mist = [];
    if (n.verborgen) {
      const gegeven = zichtbaar.slice(0, kandidaten.length - n.aantal);
      mist = kandidaten.filter((r) => !gegeven.includes(r));
    } else mist = kandidaten.slice(0, n.aantal);
    for (const r of ribben) if (!r.inFront) r.status = mist.includes(r) ? 'mist' : (r.verb ? 'verborgen' : 'gegeven');

    // Beginpunt: een hoekpunt dat al bestaat (voorvlak of eind van een gegeven rib); anders het nabije uiteinde.
    const bekend = new Set(front);
    for (const r of ribben) if (r.status === 'gegeven') { bekend.add(r.a); bekend.add(r.b); }
    for (const r of mist) {
      let s = r.a, e = r.b;
      const ak = bekend.has(r.a), bk = bekend.has(r.b);
      if (ak && !bk) { s = r.a; e = r.b; }
      else if (bk && !ak) { s = r.b; e = r.a; }
      else if (punten[r.a].z > punten[r.b].z) { s = r.b; e = r.a; }
      r.s = s; r.e = e;
    }
    return {
      niveau, punten, ribben, mist: mist.slice().sort((x, y) => x.i - y.i), front, D, gids: n.gids,
      gebied: gebied(vlak),
    };
  }

  const P = (o, i) => o.punten[i];
  const lijn = (ctx, a, b) => { ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke(); };

  function teken(ctx, o, vlak, info) {
    const m = Math.min(vlak.w, vlak.h);
    ctx.save();
    ctx.lineCap = 'round';
    if (o.gids) {
      // Dunne hulplijnen: de gegeven ribben doorgetrokken richting hun verdwijnpunt.
      const assen = new Set(o.mist.map((r) => r.as));
      ctx.strokeStyle = vlak.kleur.hulpZacht;
      ctx.lineWidth = 1;
      ctx.setLineDash([6, 6]);
      const L = Math.hypot(vlak.w, vlak.h);
      for (const r of o.ribben) {
        if (r.status !== 'gegeven' || !assen.has(r.as)) continue;
        const a = P(o, r.a), b = P(o, r.b), d = H.afstand(a, b);
        const ux = (b.x - a.x) / d, uy = (b.y - a.y) / d;
        lijn(ctx, { x: a.x - ux * L, y: a.y - uy * L }, { x: a.x + ux * L, y: a.y + uy * L });
      }
      ctx.setLineDash([]);
    }
    ctx.strokeStyle = vlak.kleur.hulp;
    ctx.lineWidth = 2.2;
    for (const r of o.ribben) if (r.status === 'gegeven' || r.inFront) lijn(ctx, P(o, r.a), P(o, r.b));
    // Beginpunten van de ontbrekende ribben.
    ctx.fillStyle = vlak.kleur.accent;
    const rad = Math.max(5, m * 0.012);
    const gezet = new Set();
    for (const r of o.mist) {
      if (gezet.has(r.s)) continue;
      gezet.add(r.s);
      ctx.beginPath(); ctx.arc(P(o, r.s).x, P(o, r.s).y, rad, 0, Math.PI * 2); ctx.fill();
    }
    // Teller.
    const n = Math.min(o.mist.length, (info && info.streken ? info.streken.length : 0));
    ctx.fillStyle = vlak.kleur.tekstZacht;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    ctx.font = '600 ' + Math.round(H.clamp(m * 0.045, 16, 30)) + 'px sans-serif';
    ctx.fillText(n + '/' + o.mist.length, 14, 12);
    ctx.restore();
  }

  function isKlaar(o, streken) { return streken.length >= o.mist.length; }

  // ---------- nakijken ----------
  function hoekVan(v) { return Math.atan2(v.y, v.x); }
  function wikkel(h) { while (h > Math.PI / 2) h -= Math.PI; while (h <= -Math.PI / 2) h += Math.PI; return h; }

  function koppel(o, streken) {
    const paren = [];
    streken.forEach((st, si) => {
      const p0 = st.punten[0], pn = st.punten[st.punten.length - 1];
      o.mist.forEach((r, ri) => {
        const b = P(o, r.s), e = P(o, r.e);
        // Begin (en bij gedeelde hoekpunten ook het eind) bepaalt bij welke rib de streek hoort.
        const d = Math.min(H.afstand(p0, b) + 0.5 * H.afstand(pn, e), H.afstand(pn, b) + 0.5 * H.afstand(p0, e));
        paren.push({ si, ri, d });
      });
    });
    paren.sort((x, y) => x.d - y.d);
    const sGebruikt = new Set(), rGebruikt = new Set(), uit = [];
    for (const p of paren) {
      if (sGebruikt.has(p.si) || rGebruikt.has(p.ri)) continue;
      sGebruikt.add(p.si); rGebruikt.add(p.ri);
      let pts = streken[p.si].punten;
      const b = P(o, o.mist[p.ri].s);
      if (H.afstand(pts[pts.length - 1], b) < H.afstand(pts[0], b)) pts = pts.slice().reverse();
      uit.push({ ri: p.ri, rib: o.mist[p.ri], pts });
    }
    return uit;
  }

  function nakijken(o, streken) {
    const D = o.D;
    for (const st of streken) if (st.punten.length < 3 || H.lengte(st.punten) < D * 0.1) return { ongeldig: 'Te kort: trek elke rib in één lange streek.' };
    const gekoppeld = koppel(o, streken);
    const per = [];
    for (const g of gekoppeld) {
      const b = P(o, g.rib.s), e = P(o, g.rib.e);
      const p0 = g.pts[0], pn = g.pts[g.pts.length - 1];
      const L = H.afstand(p0, pn) || 1;
      const s = H.afstand(p0, b) / D;
      let dx = (pn.x - p0.x) / L, dy = (pn.y - p0.y) / L, r = 0;
      for (const p of g.pts) r = Math.max(r, Math.abs(H.lijnAfstand(p, p0, dx, dy)));
      r /= L;
      const ideaal = { x: e.x - b.x, y: e.y - b.y };
      const iL = Math.hypot(ideaal.x, ideaal.y);
      const cos = ((pn.x - p0.x) * ideaal.x + (pn.y - p0.y) * ideaal.y) / (L * iL);
      const alfa = Math.acos(H.clamp(cos, -1, 1)) / RAD;
      const eind = H.afstand(pn, e) / D;
      const sn = H.snelheden(g.pts);
      const mid = sn.slice(Math.floor(sn.length * 0.15), Math.ceil(sn.length * 0.85));
      const cv = mid.length >= 4 && H.gemiddelde(mid) > 0 ? H.sd(mid) / H.gemiddelde(mid) : 0;
      let score = 100 * (0.15 * H.lin(s, 0, 0.10) + 0.15 * H.lin(r, 0.01, 0.06) + 0.40 * H.lin(alfa, 2, 14) + 0.30 * H.lin(eind, 0.03, 0.20));
      if (cv > 0.6) score *= 0.9;
      per.push({ ri: g.ri, rib: g.rib, pts: g.pts, s, r, alfa, eind, cv, lenFout: L / iL - 1, score });
    }

    // Parallelcontrole per as: gegeven + getekende ribben die evenwijdig/convergerend horen te zijn.
    const getekend = new Map(per.map((x) => [x.rib.i, x]));
    let som = 0, aantal = 0, signed = 0;
    for (let k = 0; k < 3; k++) {
      const leden = [];
      let u = null, beste = -1;
      for (const r of o.ribben) {
        if (r.as !== k) continue;
        const d = getekend.get(r.i);
        if (!(d || r.status === 'gegeven' || r.inFront)) continue;
        const a = P(o, r.a), b = P(o, r.b);
        const nab = a.z <= b.z ? a : b, ver = a.z <= b.z ? b : a;
        const diep = Math.abs(a.z - b.z);
        if (diep > beste) { beste = diep; u = { x: ver.x - nab.x, y: ver.y - nab.y }; }
        leden.push({ r, d, a, b });
      }
      if (leden.length < 2) continue;
      const ul = Math.hypot(u.x, u.y); u = { x: u.x / ul, y: u.y / ul };
      const ori = (v) => (v.x * u.x + v.y * u.y < 0 ? { x: -v.x, y: -v.y } : v);
      for (const l of leden) {
        l.ideaal = ori({ x: P(o, l.r.b).x - P(o, l.r.a).x, y: P(o, l.r.b).y - P(o, l.r.a).y });
        l.mid = { x: (P(o, l.r.a).x + P(o, l.r.b).x) / 2, y: (P(o, l.r.a).y + P(o, l.r.b).y) / 2 };
        l.dir = l.d ? ori({ x: l.d.pts[l.d.pts.length - 1].x - l.d.pts[0].x, y: l.d.pts[l.d.pts.length - 1].y - l.d.pts[0].y }) : l.ideaal;
        if (l.d) l.mid = { x: (l.d.pts[0].x + l.d.pts[l.d.pts.length - 1].x) / 2, y: (l.d.pts[0].y + l.d.pts[l.d.pts.length - 1].y) / 2 };
      }
      // Uiteen/naar elkaar (langs u, weg van de kijker): positief = uiteen.
      const uiteen = (x, y, imid, jmid) => {
        const zijde = Math.sign(u.x * (jmid.y - imid.y) - u.y * (jmid.x - imid.x));
        return zijde * Math.atan2(x.x * y.y - x.y * y.x, x.x * y.x + x.y * y.y);
      };
      for (let i = 0; i < leden.length; i++) for (let j = i + 1; j < leden.length; j++) {
        if (!leden[i].d && !leden[j].d) continue;
        // De zijde bepalen we op de ideale middens (stabiel), de hoeken op de getekende richtingen.
        const im = { x: (P(o, leden[i].r.a).x + P(o, leden[i].r.b).x) / 2, y: (P(o, leden[i].r.a).y + P(o, leden[i].r.b).y) / 2 };
        const jm = { x: (P(o, leden[j].r.a).x + P(o, leden[j].r.b).x) / 2, y: (P(o, leden[j].r.a).y + P(o, leden[j].r.b).y) / 2 };
        const ex = uiteen(leden[i].dir, leden[j].dir, im, jm) - uiteen(leden[i].ideaal, leden[j].ideaal, im, jm);
        som += Math.abs(ex) / RAD; aantal++; signed += ex / RAD;
      }
    }
    const par = aantal ? som / aantal : 0;
    const parSigned = aantal ? signed / aantal : 0;
    const straf = 15 * (1 - H.lin(par, 3, 14));

    const totaal = per.reduce((t, x) => t + x.score, 0) / o.mist.length;
    const score = Math.round(H.clamp(totaal - straf, 0, 100));

    // Tips: de grootste afwijking t.o.v. haar drempel wint.
    const gem = (f) => H.gemiddelde(per.map(f));
    const lenGem = gem((x) => x.lenFout);
    const zelfde = per.filter((x) => Math.sign(x.lenFout) === Math.sign(lenGem)).length / Math.max(1, per.length);
    const onrust = per.filter((x) => x.cv > 0.6).length / Math.max(1, per.length);
    const kand = [
      [par / 6, parSigned < 0 ? 'Je ribben lopen te veel naar elkaar toe.' : 'Je ribben lopen te veel uit elkaar.'],
      [Math.max(gem((x) => x.r) / 0.03, onrust >= 0.4 ? 1.3 : 0), 'Trek in één vloeiende beweging vanuit je schouder.'],
      [zelfde >= 0.7 ? Math.abs(lenGem) / 0.12 : 0, lenGem > 0 ? 'Je ribben worden te lang; kijk vooruit naar het eindpunt.' : 'Je ribben worden te kort; kijk vooruit naar het eindpunt.'],
      [gem((x) => x.s) / 0.06, 'Begin precies op de hoek.'],
      [gem((x) => x.alfa) / 8, 'Let op de richting: laat elke rib meelopen met de evenwijdige ribben.'],
    ].filter((k) => k[0] > 1).sort((a, b) => b[0] - a[0]);
    const tip = kand.length ? kand[0][1] : (score >= 85 ? 'Mooi: rechte, stevige ribben.' : 'Kijk nog even naar de richting en het eindpunt.');

    return { score, tip, per, par, straf };
  }

  function tekenUitslag(ctx, o, streken, u, vlak) {
    ctx.save();
    ctx.lineCap = 'round';
    ctx.strokeStyle = vlak.kleur.goed;
    ctx.globalAlpha = 0.55;
    ctx.lineWidth = 1.5;
    for (const r of o.ribben) {
      if (r.status === 'mist') continue;
      ctx.setLineDash(r.status === 'verborgen' ? [4, 6] : []);
      lijn(ctx, P(o, r.a), P(o, r.b));
    }
    ctx.globalAlpha = 1;
    ctx.setLineDash([10, 8]);
    ctx.lineWidth = 2.5;
    for (const r of o.mist) lijn(ctx, P(o, r.s), P(o, r.e));
    ctx.setLineDash([]);
    ctx.strokeStyle = vlak.kleur.fout;
    ctx.lineWidth = 3;
    for (const x of u.per) {
      if (x.score >= 60) continue;
      ctx.beginPath();
      x.pts.forEach((p, k) => (k ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y)));
      ctx.stroke();
    }
    ctx.restore();
  }

  Tekentrainer.registreer({
    id: 'dozen',
    naam: 'Dozen',
    uitleg: 'Maak de doos af: trek elke ontbrekende rib in één streek vanaf de stip.',
    fundament: 'Evenwijdige ribben convergeren naar dezelfde verdwijnpunten; trek rechte, zelfverzekerde lijnen.',
    meerdereStreken: true,
    stilNa: 0,
    toonUitslag: 2200,
    nieuweOpgave,
    teken,
    isKlaar,
    nakijken,
    tekenUitslag,
    scorePlek: (o) => o.gebied.score,
  });
})();
