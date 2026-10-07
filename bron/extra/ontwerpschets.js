// Ontwerpschets: de zware versie van Krabbelkunst. Teken een echte schets van een productontwerper
// (OpenSketch) na in de volgorde van de ontwerper: eerst de opzet (hulplijnen), dan de vorm.
// Elke stap is een groepje van 2-4 lijnen in perspectief; je tekent ze allemaal en dan wordt nagekeken.
// Alle spelstatus zit in een closure; de motor vraagt na elke geldige uitslag om de volgende stap.
(function () {
  const H = window.Hulp;
  const FASEN = { opzet: 'Opzet', vorm: 'Vorm' };
  const FASE_TIP = { opzet: 'hulplijnen: licht en vlot, door tot het eind', vorm: 'de echte randen: stevig en in één streek' };
  const TOLFRAC = { 1: 0.026, 2: 0.022, 3: 0.019, 4: 0.016 };   // deel van de tekengrootte
  const ZIEN = { 2: 2500, 4: 2000 };                             // ms dat de lijnen zichtbaar blijven
  const SLECHT = 35;            // eronder: één keer opnieuw
  const SLEUTEL = 'tt.ontwerpschets', RECENT = 'tt.ontwerpschets.recent', GALERIJ = 'tt.ontwerpschets.galerij';
  const TOP = 46, ONDER = 40;   // ruimte voor HUD en voor tik-tekst/bronvermelding

  // ---------- opslag ----------
  function lees(k, d) { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : d; } catch (e) { return d; } }
  function schrijf(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); return true; } catch (e) { return false; } }
  const leesStand = () => Object.assign({ niveau: 1, klaar: 0, scores: [], sindsWissel: 0 }, lees(SLEUTEL, {}));

  // ---------- data ----------
  const goedePunten = (p) => (Array.isArray(p) ? p.filter((q) => Array.isArray(q) && isFinite(q[0]) && isFinite(q[1])) : []);
  function dataTekeningen() {
    const D = window.OpenSketchData;
    if (!D || !Array.isArray(D.tekeningen)) return [];
    return D.tekeningen.filter((t) => t && Array.isArray(t.stappen) && t.stappen.some((s) => s && Array.isArray(s.lijnen) && s.lijnen.some((l) => goedePunten(l.punten).length >= 2)));
  }
  function bron() { const D = window.OpenSketchData; return D && D.bron ? String(D.bron) : ''; }

  function maakStappen(t) {
    const st = [];
    for (const s of t.stappen) {
      if (!s || !Array.isArray(s.lijnen)) continue;
      const lijnen = s.lijnen.map((l) => ({ soort: l.soort === 'lijn' || l.soort === 'ellips' ? l.soort : 'curve', punten: goedePunten(l.punten) })).filter((l) => l.punten.length >= 2);
      if (lijnen.length) st.push({ fase: s.fase === 'opzet' ? 'opzet' : 'vorm', lijnen });
    }
    return st;
  }
  function kader(stappen) {
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    for (const s of stappen) for (const l of s.lijnen) for (const q of l.punten) { x0 = Math.min(x0, q[0]); x1 = Math.max(x1, q[0]); y0 = Math.min(y0, q[1]); y1 = Math.max(y1, q[1]); }
    if (!isFinite(x0)) { x0 = 0; y0 = 0; x1 = 1; y1 = 1; }
    return { x0, y0, w: Math.max(x1 - x0, 0.05), h: Math.max(y1 - y0, 0.05) };
  }
  function indeling(kd, vlak) {
    const m = Math.min(28, vlak.w * 0.05);
    const bw = Math.max(vlak.w - 2 * m, 10), bh = Math.max(vlak.h - TOP - ONDER - m * 0.5, 10);
    const s = Math.min(bw / kd.w, bh / kd.h);
    return { s, ox: (vlak.w - kd.w * s) / 2 - kd.x0 * s, oy: TOP + (bh - kd.h * s) / 2 - kd.y0 * s };
  }
  const naarPx = (lay, pts) => pts.map((q) => ({ x: lay.ox + q[0] * lay.s, y: lay.oy + q[1] * lay.s, p: 0.5, t: 0 }));
  const naarData = (lay, pts) => pts.map((q) => [(q.x - lay.ox) / lay.s, (q.y - lay.oy) / lay.s]);
  const dunnen = (pts, n) => { if (pts.length <= n) return pts; const u = []; for (let i = 0; i < n; i++) u.push(pts[Math.round(i * (pts.length - 1) / (n - 1))]); return u; };
  const rond3 = (pts) => pts.map((q) => [Math.round(q[0] * 1000) / 1000, Math.round(q[1] * 1000) / 1000]);

  // ---------- spelstatus ----------
  let st = null;              // lopende schets
  let laatsteVlak = { w: 0, h: 0 };
  let laatsteNiv = null;

  function kiesTekening(rng) {
    const alle = dataTekeningen();
    if (!alle.length) return null;
    let recent = lees(RECENT, []);
    if (!Array.isArray(recent)) recent = [];
    let kand = alle.filter((t) => recent.indexOf(t.id) < 0);
    if (!kand.length) kand = alle;
    const t = kand[Math.min(kand.length - 1, Math.floor(rng() * kand.length))];
    recent.push(t.id);
    recent = recent.slice(-Math.min(15, Math.max(1, alle.length - 1)));
    schrijf(RECENT, recent);
    return t;
  }

  function nieuweTekening(niveau, rng) {
    const t = kiesTekening(rng);
    if (!t) return null;
    const stappen = maakStappen(t);
    if (!stappen.length) return null;
    return { t, stappen, kd: kader(stappen), idx: 0, gedaan: [], niveau, poging: 0, wacht: false, eind: false, totaal: 0 };
  }

  function maakOpgave(vlak) {
    const lay = indeling(st.kd, vlak);
    const stap = st.stappen[st.idx];
    const o = {
      naam: st.t.naam || 'Schets', ontwerper: st.t.ontwerper || '', stap: st.idx, totaal: st.stappen.length, fase: stap.fase,
      niveau: st.niveau, lay, laatste: st.idx === st.stappen.length - 1, klaar: st.eind, toonUitslag: 1100,
      meerdereStreken: true, animeer: !!ZIEN[st.niveau],
      tol: Math.max(lay.s * Math.max(st.kd.w, st.kd.h) * (TOLFRAC[st.niveau] || 0.02), 2.2 * (vlak.pxPerMm || 96 / 25.4)),
    };
    o.doelen = stap.lijnen.map((l) => {
      const d = naarPx(lay, l.punten);
      if (l.soort === 'ellips' && H.afstand(d[0], d[d.length - 1]) > 0.5) d.push(Object.assign({}, d[0]));
      return { soort: l.soort, punten: d, fijn: H.herbemonster(d, 3) };
    });
    o.alle = [];
    for (const s of st.stappen) for (const l of s.lijnen) for (const q of l.punten) o.alle.push({ x: lay.ox + q[0] * lay.s, y: lay.oy + q[1] * lay.s });
    return o;
  }

  function nieuweOpgave(niveau, rng, vlak) {
    const zelfde = Math.abs(vlak.w - laatsteVlak.w) < 1 && Math.abs(vlak.h - laatsteVlak.h) < 1;
    laatsteVlak = { w: vlak.w, h: vlak.h };
    const stand = leesStand();
    // handmatig niveau (knoppen van de motor): alleen als de motor-waarde veranderd is
    if (laatsteNiv !== null && niveau !== laatsteNiv) { stand.niveau = H.clamp(niveau, 1, 4); stand.sindsWissel = 0; schrijf(SLEUTEL, stand); if (st && !st.eind) st.niveau = stand.niveau; }
    laatsteNiv = niveau;

    if (st && st.eind) { if (zelfde) st = null; }           // tik: nieuwe schets; resize: eindscherm blijft
    else if (st && st.wacht) { st.idx++; st.poging = 0; st.wacht = false; }
    if (!st) st = nieuweTekening(H.clamp(stand.niveau, 1, 4), rng);
    if (!st) return { geenData: true, niveau: 1, toonUitslag: 900, meerdereStreken: false, alle: [], doelen: [] };
    if (st.idx >= st.stappen.length) st.idx = st.stappen.length - 1;
    return maakOpgave(vlak);
  }

  // ---------- scoren ----------
  const rmsRecht = (pts) => {
    const f = H.lijnFit(pts);
    return Math.sqrt(H.gemiddelde(pts.map((q) => H.lijnAfstand(q, { x: f.mx, y: f.my }, f.dx, f.dy) ** 2)));
  };
  const bruikbaar = (streken) => streken.map((s) => s.punten).filter((p) => p.length >= 2 && H.lengte(p) >= 6);
  const minAfstand = (q, lijsten) => { let m = Infinity; for (const l of lijsten) m = Math.min(m, H.polyAfstand(q, l)); return m; };

  // dekking per doellijn: welk deel ervan ligt dicht bij een van je streken
  function dekkingen(o, lijsten, f) {
    return o.doelen.map((d) => {
      const ds = d.fijn.map((q) => minAfstand(q, lijsten));
      return { ds, dek: ds.filter((x) => x <= f * o.tol).length / Math.max(ds.length, 1) };
    });
  }

  // na elke pen-op: als alle lijnen van deze stap getekend zijn, meteen nakijken
  function isKlaar(o, streken) {
    if (o.geenData || o.klaar) return true;
    const lijsten = bruikbaar(streken);
    if (!lijsten.length) return false;
    return dekkingen(o, lijsten, 1.5).every((d) => d.dek >= 0.85);
  }

  // wiebel: hoe ver de streek gemiddeld van een gladgestreken versie van zichzelf ligt (in tol)
  function wiebel(p, tol) {
    const S = H.herbemonster(p, 3);
    if (S.length < 9) return 0;
    let som = 0, n = 0;
    for (let i = 3; i < S.length - 3; i++) {
      let mx = 0, my = 0;
      for (let j = i - 3; j <= i + 3; j++) { mx += S[j].x; my += S[j].y; }
      som += (S[i].x - mx / 7) ** 2 + (S[i].y - my / 7) ** 2; n++;
    }
    return Math.sqrt(som / n) / tol;
  }

  // kwaliteit van één streek bij zijn doellijn (0..1) met bijpassende tip
  function kwaliteit(doel, p, tol) {
    const gl = H.lin(wiebel(p, tol), 0.08, 0.3);
    if (doel.soort === 'lijn') {
      const dev = rmsRecht(H.herbemonster(p, 3)) / Math.max(H.lengte(p), 1);
      const re = H.lin(dev, 0.008, 0.04);
      return [Math.min(re, gl), 'Trek rechte lijnen in één vlotte beweging vanuit je schouder'];
    }
    if (doel.soort === 'ellips') {
      const D = doel.punten;
      const kd = D.reduce((a, q) => ({ x0: Math.min(a.x0, q.x), x1: Math.max(a.x1, q.x), y0: Math.min(a.y0, q.y), y1: Math.max(a.y1, q.y) }), { x0: Infinity, x1: -Infinity, y0: Infinity, y1: -Infinity });
      const dm = Math.max((kd.x1 - kd.x0 + kd.y1 - kd.y0) / 2, 1);
      const sl = H.lin(H.afstand(p[0], p[p.length - 1]) / dm, 0.06, 0.3);
      return sl <= gl ? [0.5 * sl + 0.5 * gl, 'Sluit de ellips: eindig waar je begon'] : [0.5 * sl + 0.5 * gl, 'Maak de ellips gladder, zonder knikken'];
    }
    return [gl, 'Maak de bochten vloeiender, zonder wiebels'];
  }

  function beoordeelStap(o, streken) {
    const lijsten = bruikbaar(streken);
    if (!lijsten.length) return { ongeldig: 'Teken de lijnen van deze stap en tik op Klaar', behoud: true };
    const tol = o.tol;
    const dk = dekkingen(o, lijsten, 1.2);
    const dekking = H.gemiddelde(dk.map((d) => d.dek));
    const slechtsteDek = Math.min.apply(null, dk.map((d) => d.dek));
    // nauwkeurigheid alleen over de stukken die je getekend hebt; een gemiste lijn telt bij dekking
    const raak = [].concat.apply([], dk.map((d) => d.ds.filter((x) => x <= 3 * tol)));
    const nauw = raak.length ? H.gemiddelde(raak) / tol : 3;

    // precisie: welk deel van je inkt ligt op een lijn van deze stap
    const doelLijnen = o.doelen.map((d) => d.punten);
    const fijnS = lijsten.map((p) => H.herbemonster(p, 4));
    const alleS = [].concat.apply([], fijnS);
    const precisie = alleS.filter((q) => minAfstand(q, doelLijnen) <= 1.8 * tol).length / Math.max(alleS.length, 1);

    // elke streek hoort bij de doellijn waar hij gemiddeld het dichtst bij ligt
    const perDoel = o.doelen.map(() => []);
    fijnS.forEach((p, j) => {
      let beste = -1, bd = Infinity;
      o.doelen.forEach((d, k) => { const g = H.gemiddelde(p.map((q) => H.polyAfstand(q, d.punten))); if (g < bd) { bd = g; beste = k; } });
      if (beste >= 0 && bd <= 2.5 * tol && H.lengte(lijsten[j]) >= 0.15 * H.lengte(o.doelen[beste].punten)) perDoel[beste].push(lijsten[j]);
    });
    const getekend = perDoel.filter((l) => l.length);
    const eenStreek = getekend.length ? getekend.filter((l) => l.length === 1).length / getekend.length : 0;
    let kw = 1, kwTip = '';
    o.doelen.forEach((d, k) => {
      if (perDoel[k].length !== 1) return;
      const r = kwaliteit(d, perDoel[k][0], tol);
      if (r[0] < kw) { kw = r[0]; kwTip = r[1]; }
    });

    const sDek = H.lin(1 - dekking, 0.05, 0.5), sNauw = H.lin(nauw, 0.25, 1), sPrec = H.lin(1 - precisie, 0.05, 0.4);
    let score = H.clamp(100 * (0.25 * sDek + 0.25 * sNauw + 0.1 * sPrec + 0.15 * eenStreek + 0.25 * kw), 0, 100);
    if (slechtsteDek < 0.5) score = Math.min(score, 55);        // een lijn (bijna) overgeslagen
    else if (slechtsteDek < 0.75) score = Math.min(score, 70);  // een lijn maar half getekend
    if (precisie < 0.7) score = Math.min(score, 75);            // veel inkt naast de lijnen
    const w = [
      [sDek, slechtsteDek < 0.5 ? 'Je mist een lijn: teken alle lijnen van deze stap' : 'Trek de lijnen helemaal door, van eind tot eind'],
      [sNauw, 'Blijf dichter bij de lijnen'],
      [sPrec, 'Teken alleen de lijnen van deze stap, geen losse streken'],
      [eenStreek, 'Zet elke lijn in één vaste streek, niet in stukjes'],
      [kw, kwTip],
    ];
    w.sort((a, b) => a[0] - b[0]);
    let tip;
    if (slechtsteDek < 0.5) tip = w.find((x) => x[1].indexOf('mist') >= 0)[1];
    else if (w[0][0] < 0.7 && w[0][1]) tip = w[0][1];
    else if (score >= 85) tip = ['Strak, zoals een ontwerper', 'Mooi neergezet', 'Vaste lijnen, door naar de volgende'][Math.floor(score) % 3];
    else tip = 'Nog iets nauwkeuriger en vaster';
    return { score, tip, dekking: dekking * 100, nauwkeurig: sNauw * 100, precisie: precisie * 100, eenStreek: eenStreek * 100, lijnkwaliteit: kw * 100 };
  }

  // ---------- nakijken ----------
  function nakijken(o, streken) {
    if (o.geenData) return { ongeldig: 'Er zijn nog geen schetsen geladen' };
    if (o.klaar) return { score: Math.round(st ? st.totaal : 0), tip: 'Tik voor een nieuwe schets', geenNiveau: true };
    const u = beoordeelStap(o, streken);
    if (u.ongeldig) return u;
    if (u.score < SLECHT && st && st.poging < 1) { st.poging++; return { ongeldig: 'Probeer deze stap nog eens' }; }
    u.geenNiveau = true;
    if (st && o.stap === st.idx && !st.wacht) {
      st.gedaan[o.stap] = { fase: o.fase, score: u.score, streken: bruikbaar(streken).map((p) => naarData(o.lay, H.herbemonsterN(p, Math.min(40, Math.max(2, p.length))))) };
      st.wacht = true;
      if (o.laatste) afronden();
    }
    return u;
  }

  function afronden() {
    const scores = st.gedaan.filter(Boolean).map((g) => g.score);
    st.totaal = scores.length ? H.gemiddelde(scores) : 0;
    st.eind = true;
    const stand = leesStand();
    stand.klaar++; stand.sindsWissel++;
    stand.scores.push(Math.round(st.totaal)); stand.scores = stand.scores.slice(-10);
    const l3 = stand.scores.slice(-3);
    if (stand.sindsWissel >= 2 && stand.niveau < 4 && l3.length >= 2 && H.gemiddelde(l3) >= 72) { stand.niveau++; stand.sindsWissel = 0; }
    else if (stand.sindsWissel >= 2 && stand.niveau > 1 && l3.length >= 3 && H.gemiddelde(l3) < 40) { stand.niveau--; stand.sindsWissel = 0; }
    schrijf(SLEUTEL, stand);
    bewaarGalerij();
  }

  function bewaarGalerij() {
    const rec = {
      id: st.t.id, naam: st.t.naam, datum: new Date().toISOString(), score: Math.round(st.totaal), b: st.kd.w, h: st.kd.h,
      stappen: st.gedaan.filter(Boolean).map((g) => ({ s: Math.round(g.score), f: g.fase, p: g.streken.map((p) => rond3(dunnen(p, 10))) })),
    };
    let g = lees(GALERIJ, []);
    if (!Array.isArray(g)) g = [];
    g.push(rec);
    g = g.slice(-10);
    if (!schrijf(GALERIJ, g)) { g = g.slice(-5); schrijf(GALERIJ, g); }
  }

  // ---------- tekenen ----------
  function lettertype() {
    try { return getComputedStyle(document.body).fontFamily || 'sans-serif'; } catch (e) { return 'sans-serif'; }
  }
  function kortTekst(ctx, tekst, maxB) {
    if (ctx.measureText(tekst).width <= maxB) return tekst;
    while (tekst.length > 1 && ctx.measureText(tekst + '…').width > maxB) tekst = tekst.slice(0, -1);
    return tekst + '…';
  }
  function pictogram(ctx, fase, x, y, k) {   // klein symbool voor de fase, 14 px breed
    ctx.save();
    ctx.strokeStyle = k; ctx.lineWidth = 1.6; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    ctx.beginPath();
    if (fase === 'opzet') { ctx.moveTo(x, y + 5); ctx.lineTo(x + 14, y - 1); ctx.moveTo(x, y - 1); ctx.lineTo(x + 14, y + 5); ctx.moveTo(x + 7, y - 6); ctx.lineTo(x + 7, y + 6); }
    else { ctx.moveTo(x, y - 2); ctx.lineTo(x + 7, y - 6); ctx.lineTo(x + 14, y - 2); ctx.lineTo(x + 14, y + 5); ctx.lineTo(x, y + 5); ctx.closePath(); }
    ctx.stroke();
    ctx.restore();
  }
  const kleurVoor = (vlak, s) => (s >= 75 ? vlak.kleur.goed : s >= 50 ? vlak.kleur.waarschuwing : vlak.kleur.fout);

  function polylijn(ctx, pts) {
    ctx.beginPath();
    pts.forEach((q, i) => { if (i) ctx.lineTo(q.x, q.y); else ctx.moveTo(q.x, q.y); });
    ctx.stroke();
  }
  function stip(ctx, x, y, r, k) { ctx.fillStyle = k; ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill(); }
  function raakpunten(d) {
    let a = d[0], b = d[0], c = d[0], e = d[0];
    for (const q of d) { if (q.x < a.x) a = q; if (q.x > b.x) b = q; if (q.y < c.y) c = q; if (q.y > e.y) e = q; }
    return [a, b, c, e];
  }

  function hud(ctx, o, vlak, fam) {
    const m = Math.min(28, vlak.w * 0.05), k = vlak.kleur;
    ctx.save();
    ctx.textBaseline = 'middle'; ctx.textAlign = 'left';
    const gedaan = st ? st.gedaan.filter(Boolean).map((g) => g.score) : [];
    const gemTxt = gedaan.length ? 'gem. ' + Math.round(H.gemiddelde(gedaan)) : '';
    ctx.font = '500 12px ' + fam;
    const gemB = gemTxt ? ctx.measureText(gemTxt).width + 10 : 0;
    ctx.font = '700 15px ' + fam; ctx.fillStyle = k.tekst;
    ctx.fillText(kortTekst(ctx, o.naam + (o.ontwerper ? '  ·  ' + o.ontwerper : ''), vlak.w - 2 * m - gemB), m, 15);
    ctx.font = '500 12px ' + fam; ctx.fillStyle = k.tekstZacht;
    if (gemTxt) { ctx.textAlign = 'right'; ctx.fillText(gemTxt, vlak.w - m, 15); ctx.textAlign = 'left'; }
    pictogram(ctx, o.fase, m, 33, k.accent);
    const n = o.doelen.length;
    ctx.fillText(kortTekst(ctx, FASEN[o.fase] + '  ·  stap ' + (o.stap + 1) + '/' + o.totaal + '  ·  ' + n + (n === 1 ? ' lijn' : ' lijnen') + ': ' + FASE_TIP[o.fase], vlak.w - 2 * m - 20), m + 20, 33);
    const b = bron();
    if (b) {
      ctx.font = '400 10px ' + fam; ctx.textAlign = 'center'; ctx.fillStyle = k.tekstZacht; ctx.globalAlpha = 0.8;
      ctx.fillText(kortTekst(ctx, b, vlak.w - 2 * m), vlak.w / 2, vlak.h - 9);
    }
    ctx.restore();
  }

  // eigen streken van eerdere stappen: opzet dun en licht, vorm in volle inkt (of in scorekleur)
  function eigenWerk(ctx, vlak, lay, tot, kleurig) {
    const k = vlak.kleur;
    st.gedaan.forEach((g, i) => {
      if (!g || i >= tot) return;
      const opzet = g.fase === 'opzet';
      ctx.strokeStyle = kleurig ? kleurVoor(vlak, g.score) : opzet ? k.hulp : k.inkt;
      ctx.lineWidth = opzet ? 1.5 : 2.6;
      ctx.globalAlpha = opzet ? 0.75 : 1;
      g.streken.forEach((p) => polylijn(ctx, naarPx(lay, p)));
    });
    ctx.globalAlpha = 1;
  }

  function eindscherm(ctx, o, vlak, fam) {
    const k = vlak.kleur, lay = o.lay;
    ctx.save();
    ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    // het origineel heel licht eronder, zodat je ziet wat de ontwerper deed
    ctx.globalAlpha = 0.3; ctx.strokeStyle = k.hulpZacht; ctx.lineWidth = 1.4;
    st.stappen.forEach((s) => s.lijnen.forEach((l) => polylijn(ctx, naarPx(lay, l.punten))));
    eigenWerk(ctx, vlak, lay, st.stappen.length, true);
    ctx.textBaseline = 'middle'; ctx.textAlign = 'left';
    const m = Math.min(28, vlak.w * 0.05), tot = Math.round(st.totaal);
    ctx.font = '700 16px ' + fam; ctx.fillStyle = k.tekst;
    ctx.fillText(kortTekst(ctx, o.naam + (o.ontwerper ? '  ·  naar ' + o.ontwerper : ''), vlak.w - 2 * m - 90), m, 15);
    ctx.font = '800 22px ' + fam; ctx.fillStyle = kleurVoor(vlak, tot); ctx.textAlign = 'right';
    ctx.fillText(String(tot), vlak.w - m, 16);
    ctx.textAlign = 'left'; ctx.font = '500 11px ' + fam;
    let x = m;
    [['goed', k.goed], ['matig', k.waarschuwing], ['fout', k.fout]].forEach((e) => {
      stip(ctx, x + 4, 34, 4, e[1]); ctx.fillStyle = k.tekstZacht; ctx.fillText(e[0], x + 12, 34);
      x += 14 + ctx.measureText(e[0]).width + 12;
    });
    ctx.fillText('dun = opzet, dik = vorm, grijs = origineel', x + 4, 34);
    ctx.textAlign = 'center'; ctx.font = '600 14px ' + fam; ctx.fillStyle = k.tekst;
    ctx.fillText('tik voor een nieuwe schets', vlak.w / 2, vlak.h - 26);
    ctx.restore();
  }

  function teken(ctx, o, vlak, info) {
    const fam = lettertype(), k = vlak.kleur;
    info = info || { sinds: 0 };
    if (o.geenData) {
      ctx.save(); ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillStyle = k.tekstZacht; ctx.font = '600 16px ' + fam;
      ctx.fillText('Ontwerpschets heeft nog geen schetsen geladen', vlak.w / 2, vlak.h / 2 - 12);
      ctx.font = '500 13px ' + fam; ctx.fillText('(OpenSketchData ontbreekt)', vlak.w / 2, vlak.h / 2 + 12);
      ctx.restore();
      return;
    }
    if (o.klaar && st) { eindscherm(ctx, o, vlak, fam); return; }
    const lay = o.lay;
    ctx.save();
    ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    // vorige stappen: vaag het origineel, daarover je eigen streken
    if (st) {
      ctx.globalAlpha = 0.22; ctx.strokeStyle = k.hulpZacht; ctx.lineWidth = 1.4;
      st.stappen.forEach((s, i) => { if (i < o.stap) s.lijnen.forEach((l) => polylijn(ctx, naarPx(lay, l.punten))); });
      eigenWerk(ctx, vlak, lay, o.stap, false);
    }
    // huidige doellijnen
    const sinds = info.sinds || 0, niv = o.niveau;
    let a = 1;
    if (niv === 2) a = H.clamp(1 - (sinds - ZIEN[2]) / 500, 0.15, 1);
    else if (niv === 4) a = H.clamp(1 - (sinds - ZIEN[4]) / 400, 0, 1);
    o.doelen.forEach((d) => {
      const p = d.punten, dicht = d.soort === 'ellips';
      if (niv === 3) {   // alleen een vage schaduw van de lijn, zodat je ziet welke stippen bij elkaar horen
        ctx.globalAlpha = 0.16; ctx.strokeStyle = k.hulp; ctx.lineWidth = 1.5;
        polylijn(ctx, p);
      } else if (a > 0) {
        ctx.globalAlpha = 0.85 * a; ctx.strokeStyle = k.accent; ctx.lineWidth = o.fase === 'opzet' ? 1.8 : 2.4;
        ctx.setLineDash(o.fase === 'opzet' ? [4, 6] : [8, 7]);
        polylijn(ctx, p); ctx.setLineDash([]);
      }
      // stippen: niveau 1-2 begin, niveau 3 begin en eind (ellips: 4 raakpunten), niveau 4 alleen zolang zichtbaar
      const sa = niv === 4 ? a : 1;
      if (sa <= 0) return;
      ctx.globalAlpha = sa;
      if (dicht && niv >= 3) raakpunten(p).forEach((q) => stip(ctx, q.x, q.y, 4, k.accent));
      else {
        stip(ctx, p[0].x, p[0].y, 5, k.goed);
        if (niv >= 3 && !dicht) { const e = p[p.length - 1]; ctx.strokeStyle = k.accent; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(e.x, e.y, 5, 0, Math.PI * 2); ctx.stroke(); }
      }
    });
    ctx.restore();
    hud(ctx, o, vlak, fam);
  }

  function tekenUitslag(ctx, o, streken, uitslag, vlak) {
    if (o.klaar || !o.doelen || !o.doelen.length) return;
    ctx.save();
    ctx.globalAlpha = 0.55; ctx.strokeStyle = vlak.kleur.accent; ctx.lineWidth = 1.5; ctx.setLineDash([3, 5]); ctx.lineCap = 'round';
    o.doelen.forEach((d) => polylijn(ctx, d.punten));
    ctx.restore();
  }

  function scorePlek(o, vlak) {
    const m = 24, pts = o && o.alle ? o.alle : [];
    let beste = { x: vlak.w / 2, y: vlak.h / 2 }, bd = -1;
    for (let i = 0; i < 7; i++) {
      for (let j = 0; j < 5; j++) {
        const x = m + (vlak.w - 2 * m) * (i + 0.5) / 7, y = TOP + (vlak.h - TOP - ONDER) * (j + 0.5) / 5;
        let dm = Infinity;
        for (const q of pts) { const d = Math.hypot(q.x - x, q.y - y); if (d < dm) dm = d; }
        if (dm > bd) { bd = dm; beste = { x, y }; }
      }
    }
    return beste;
  }

  // na de laatste stap wacht de motor op een tik; het eindscherm wordt dan door teken() getoond
  function naUitslag(o) {
    if (o.klaar) return 'stop';
    if (o.laatste && st && st.eind) { o.klaar = true; return 'stop'; }
    return undefined;
  }

  Tekentrainer.registreer({
    id: 'ontwerpschets',
    naam: 'Ontwerpschets',
    uitleg: 'Zware Krabbelkunst: teken een echte ontwerpersschets na, eerst de opzet, dan de vorm. Teken alle lijnen van een stap, elk in één streek; daarna wordt vanzelf nagekeken (of tik op Klaar).',
    fundament: 'Perspectief, opzet en vaste lijnen, zoals een ontwerper',
    meerdereStreken: true,
    toonUitslag: 1100,
    nieuweOpgave, teken, isKlaar, nakijken, tekenUitslag, scorePlek, naUitslag,
  });
})();
