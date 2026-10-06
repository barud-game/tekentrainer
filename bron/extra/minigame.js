// Krabbelkunst: teken lijn voor lijn een echte Quick, Draw!-krabbel na en eindig met je eigen tekening.
// Alle spelstatus zit in een closure; de motor vraagt na elke geldige uitslag om de volgende stap.
(function () {
  const H = window.Hulp;
  const SOORTEN = { lijn: 'Lijn', hoek: 'Hoek', cirkel: 'Cirkel', ellips: 'Ellips', curve: 'Curve', slinger: 'Slinger', vrij: 'Vrij', arceren: 'Arceren' };
  const TOLFRAC = { 1: 0.05, 2: 0.042, 3: 0.036, 4: 0.03 };
  const SLECHT = 35;            // eronder: één keer opnieuw
  const SLEUTEL = 'tt.minigame', RECENT = 'tt.minigame.recent', GALERIJ = 'tt.minigame.galerij';
  const TOP = 46, ONDER = 40;   // ruimte voor HUD en voor tik-tekst/bronvermelding

  // ---------- opslag ----------
  function lees(k, d) { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : d; } catch (e) { return d; } }
  function schrijf(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); return true; } catch (e) { return false; } }
  const leesStand = () => Object.assign({ niveau: 1, klaar: 0, scores: [], sindsWissel: 0 }, lees(SLEUTEL, {}));

  // ---------- data ----------
  function uitFit(l) {
    const f = l.fit, p = [];
    if (!f) return p;
    if (l.soort === 'cirkel' && isFinite(f.cx) && isFinite(f.r)) {
      for (let i = 0; i <= 48; i++) { const w = i / 48 * Math.PI * 2; p.push([f.cx + f.r * Math.cos(w), f.cy + f.r * Math.sin(w)]); }
    } else if (l.soort === 'ellips' && isFinite(f.cx) && isFinite(f.a) && isFinite(f.b)) {
      const t = f.t || 0, c = Math.cos(t), s = Math.sin(t);
      for (let i = 0; i <= 48; i++) { const w = i / 48 * Math.PI * 2, x = f.a * Math.cos(w), y = f.b * Math.sin(w); p.push([f.cx + x * c - y * s, f.cy + x * s + y * c]); }
    } else if (isFinite(f.x1) && isFinite(f.x2)) p.push([f.x1, f.y1], [f.x2, f.y2]);
    return p;
  }
  function lijnPunten(l) {
    if (!l) return [];
    let p = Array.isArray(l.punten) ? l.punten.filter((q) => Array.isArray(q) && isFinite(q[0]) && isFinite(q[1])) : [];
    if (p.length < 2) p = uitFit(l);
    return p;
  }
  function schaduwOk(s) { return s && isFinite(s.cx) && isFinite(s.cy) && s.a > 0 && s.b > 0; }
  function dataTekeningen() {
    const D = window.QuickDrawData;
    if (!D || !Array.isArray(D.tekeningen)) return [];
    return D.tekeningen.filter((t) => t && Array.isArray(t.lijnen) && t.lijnen.some((l) => lijnPunten(l).length >= 2));
  }
  function bron() { const D = window.QuickDrawData; return D && D.bron ? String(D.bron) : ''; }

  function maakStappen(t) {
    const st = [];
    for (const l of t.lijnen) {
      const p = lijnPunten(l);
      if (p.length < 2) continue;
      st.push({ soort: SOORTEN[l.soort] && l.soort !== 'arceren' ? l.soort : 'vrij', punten: p });
    }
    if (schaduwOk(t.schaduw)) st.push({ soort: 'arceren', schaduw: t.schaduw });
    return st;
  }
  function kader(t) {
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    const voeg = (x, y) => { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; };
    for (const l of t.lijnen) for (const q of lijnPunten(l)) voeg(q[0], q[1]);
    if (schaduwOk(t.schaduw)) { const s = t.schaduw; voeg(s.cx - s.a, s.cy - s.b); voeg(s.cx + s.a, s.cy + s.b); }
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
  let st = null;              // lopende tekening
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
    recent = recent.slice(-Math.min(8, Math.max(1, alle.length - 1)));
    schrijf(RECENT, recent);
    return t;
  }

  function nieuweTekening(niveau, rng) {
    const t = kiesTekening(rng);
    if (!t) return null;
    const stappen = maakStappen(t);
    return { t, stappen, kd: kader(t), idx: 0, gedaan: [], hatch: null, niveau, poging: 0, wacht: false, eind: false, totaal: 0 };
  }

  function maakOpgave(vlak) {
    const lay = indeling(st.kd, vlak);
    const stap = st.stappen[st.idx];
    const laatste = st.idx === st.stappen.length - 1;
    const o = {
      naam: st.t.naam || 'Tekening', stap: st.idx, totaal: st.stappen.length, soort: stap.soort, niveau: st.niveau,
      lay, laatste, klaar: st.eind, toonUitslag: 900, meerdereStreken: stap.soort === 'arceren',
      animeer: st.niveau === 2 || st.niveau === 4,
    };
    if (stap.soort === 'arceren') {
      const s = st.t.schaduw;
      // schaduwvlak minstens ~25% van de breedte en ~10% van de hoogte, binnen beeld
      const a = H.clamp(Math.max(s.a * lay.s, vlak.w * 0.125), 10, vlak.w / 2 - 12);
      const b = Math.max(s.b * lay.s, 18, vlak.h * 0.05);
      const ruimte = vlak.h - TOP - ONDER;
      const bb = Math.min(b, ruimte / 2);
      const cy = H.clamp(lay.oy + s.cy * lay.s, TOP + bb + 4, vlak.h - ONDER - bb - 4);
      o.hatch = { cx: H.clamp(lay.ox + s.cx * lay.s, a + 8, vlak.w - a - 8), cy, a, b: bb };
    } else {
      let d = naarPx(lay, stap.punten);
      if ((stap.soort === 'cirkel' || stap.soort === 'ellips') && H.afstand(d[0], d[d.length - 1]) > 0.5) d.push(Object.assign({}, d[0]));
      o.doel = d;
    }
    // alle doelpunten (ruw bemonsterd) voor scorePlek
    o.alle = [];
    for (const s of st.stappen) {
      if (s.punten) for (const q of s.punten) o.alle.push({ x: lay.ox + q[0] * lay.s, y: lay.oy + q[1] * lay.s });
    }
    if (o.hatch) for (let i = 0; i < 16; i++) { const w = i / 16 * Math.PI * 2; o.alle.push({ x: o.hatch.cx + o.hatch.a * Math.cos(w), y: o.hatch.cy + o.hatch.b * Math.sin(w) }); }
    return o;
  }

  function nieuweOpgave(niveau, rng, vlak) {
    const zelfde = Math.abs(vlak.w - laatsteVlak.w) < 1 && Math.abs(vlak.h - laatsteVlak.h) < 1;
    laatsteVlak = { w: vlak.w, h: vlak.h };
    const stand = leesStand();
    // handmatig niveau (knoppen van de motor): alleen als de motor-waarde veranderd is
    if (laatsteNiv !== null && niveau !== laatsteNiv) { stand.niveau = H.clamp(niveau, 1, 4); stand.sindsWissel = 0; schrijf(SLEUTEL, stand); if (st && !st.eind) st.niveau = stand.niveau; }
    laatsteNiv = niveau;

    if (st && st.eind) { if (zelfde) st = null; }           // tik: nieuwe tekening; resize: eindscherm blijft
    else if (st && st.wacht) { st.idx++; st.poging = 0; st.wacht = false; }
    if (!st) st = nieuweTekening(H.clamp(stand.niveau, 1, 4), rng);
    if (!st) return { geenData: true, soort: 'vrij', niveau: 1, toonUitslag: 900, meerdereStreken: false, alle: [] };
    if (st.idx >= st.stappen.length) st.idx = st.stappen.length - 1;
    return maakOpgave(vlak);
  }

  // ---------- scoren: algemeen ----------
  const draaiing = (p) => {
    let s = 0;
    for (let i = 1; i < p.length - 1; i++) {
      let d = Math.atan2(p[i + 1].y - p[i].y, p[i + 1].x - p[i].x) - Math.atan2(p[i].y - p[i - 1].y, p[i].x - p[i - 1].x);
      while (d > Math.PI) d -= 2 * Math.PI;
      while (d < -Math.PI) d += 2 * Math.PI;
      s += Math.abs(d);
    }
    return s;
  };
  const scherpsteHoek = (p) => {   // grootste richtingsverandering (graden) over een venster van 2 stappen
    let m = 0;
    for (let i = 2; i < p.length - 2; i++) {
      let d = Math.atan2(p[i + 2].y - p[i].y, p[i + 2].x - p[i].x) - Math.atan2(p[i].y - p[i - 2].y, p[i].x - p[i - 2].x);
      while (d > Math.PI) d -= 2 * Math.PI;
      while (d < -Math.PI) d += 2 * Math.PI;
      m = Math.max(m, Math.abs(d) * 180 / Math.PI);
    }
    return m;
  };
  const kaderPx = (pts) => {
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    for (const q of pts) { x0 = Math.min(x0, q.x); x1 = Math.max(x1, q.x); y0 = Math.min(y0, q.y); y1 = Math.max(y1, q.y); }
    return { w: x1 - x0, h: y1 - y0 };
  };
  const rmsRecht = (pts) => {
    const f = H.lijnFit(pts);
    return Math.sqrt(H.gemiddelde(pts.map((q) => H.lijnAfstand(q, { x: f.mx, y: f.my }, f.dx, f.dy) ** 2)));
  };
  const rondheidCv = (pts) => {
    const mx = H.gemiddelde(pts.map((q) => q.x)), my = H.gemiddelde(pts.map((q) => q.y));
    const r = pts.map((q) => Math.hypot(q.x - mx, q.y - my));
    const m = H.gemiddelde(r);
    return m > 0 ? H.sd(r) / m : 1;
  };

  function beoordeelLijn(o, streek, vlak) {
    const S0 = streek.punten, D = o.doel;
    const lenS = H.lengte(S0), L = Math.max(H.lengte(D), 1);
    if (S0.length < 3 || lenS < 8) return { ongeldig: 'Teken de lijn in één doorlopende streek' };
    const kd = kaderPx(D);
    const R = Math.max(Math.hypot(kd.w, kd.h), 40);
    const pxMm = vlak.pxPerMm || 96 / 25.4;
    let tol = Math.max(R * (TOLFRAC[o.niveau] || 0.07), 2.5 * pxMm);
    if (o.soort === 'vrij') tol *= 1.6;
    const stap = Math.max(2, R / 60);
    const S = H.herbemonster(S0, stap), Dd = H.herbemonster(D, stap);
    const dSD = S.map((q) => H.polyAfstand(q, D)), dDS = Dd.map((q) => H.polyAfstand(q, S0));
    const gem = (H.gemiddelde(dSD) + H.gemiddelde(dDS)) / 2 / tol;
    const mx = Math.max(Math.max.apply(null, dSD), Math.max.apply(null, dDS)) / tol;
    const dekking = dDS.filter((d) => d <= 1.8 * tol).length / dDS.length;
    const precisie = dSD.filter((d) => d <= 1.8 * tol).length / dSD.length;
    const pos = 100 * (0.4 * H.lin(gem, 0.25, 1.6) + 0.2 * H.lin(mx, 1, 4.5) + 0.25 * H.lin(1 - dekking, 0.05, 0.5) + 0.15 * H.lin(1 - precisie, 0.05, 0.5));

    // extra's per soort (0..1) met bijpassende tip
    let ex = 1, exTip = '';
    const stap2 = Math.max(4, R / 25), S2 = H.herbemonster(S0, stap2), D2 = H.herbemonster(D, stap2);
    const gap = H.afstand(S0[0], S0[S0.length - 1]);
    const dm = Math.max((kd.w + kd.h) / 2, 1);
    const soort = o.soort;
    if (soort === 'lijn') {
      const dev = Math.max(0, rmsRecht(S) - rmsRecht(Dd)) / Math.max(lenS, 1);
      ex = H.lin(dev, 0.012, 0.06); exTip = 'Trek de lijn in één vlotte, rechte beweging';
    } else if (soort === 'cirkel') {
      const sl = H.lin(gap / dm, 0.06, 0.3), rd = H.lin(Math.max(0, rondheidCv(S) - rondheidCv(Dd)), 0.04, 0.16);
      ex = 0.5 * sl + 0.5 * rd; exTip = sl <= rd ? 'Sluit de cirkel: eindig waar je begon' : 'Maak de cirkel ronder';
    } else if (soort === 'ellips') {
      const sl = H.lin(gap / dm, 0.06, 0.3);
      const gl = H.lin(Math.max(0, draaiing(S2) - draaiing(D2) * 1.15 - 0.3) / (draaiing(D2) + 1), 0.25, 1.2);
      ex = 0.6 * sl + 0.4 * gl; exTip = sl <= gl ? 'Sluit de ellips: eindig waar je begon' : 'Maak de ellips gladder, zonder knikken';
    } else if (soort === 'curve' || soort === 'slinger') {
      const v = H.snelheden(S0), a = Math.floor(v.length * 0.08), vv = v.slice(a, v.length - a);
      const cv = vv.length >= 6 && H.gemiddelde(vv) > 0 ? H.sd(vv) / H.gemiddelde(vv) : 0;
      const sn = H.lin(cv, 0.5, 1.2);
      const gl = H.lin(Math.max(0, draaiing(S2) - draaiing(D2) * 1.15 - 0.3) / (draaiing(D2) + 1), 0.25, 1.2);
      ex = 0.5 * sn + 0.5 * gl; exTip = sn <= gl ? 'Teken in één gelijkmatige beweging, niet stotteren' : 'Maak de bocht vloeiender, zonder wiebels';
    } else if (soort === 'hoek') {
      ex = H.lin(Math.abs(scherpsteHoek(S2) - scherpsteHoek(D2)), 12, 50); exTip = 'Maak de hoek scherper, met een duidelijke punt';
    }
    let score = pos * (0.65 + 0.35 * ex);
    const lenG = H.lengte(S2), teKort = lenG < 0.6 * L, teLang = lenG > 1.8 * L && soort !== 'cirkel' && soort !== 'ellips';
    if (teKort) score = Math.min(score, 55);
    if (teLang) score = Math.min(score, 70);
    score = H.clamp(score, 0, 100);

    let tip;
    if (teKort) tip = 'Je lijn is te kort, trek hem helemaal door';
    else if (teLang) tip = 'Je lijn schiet door, stop op het eindpunt';
    else if (dekking < 0.7) tip = 'Volg de lijn over de hele lengte';
    else if (gem > 1.1 || mx > 3) tip = 'Blijf dichter bij de doellijn';
    else if (ex < 0.6 && exTip) tip = exTip;
    else if (score >= 85) tip = ['Netjes gevolgd', 'Mooie lijn', 'Goed gedaan, door naar de volgende'][Math.floor(score) % 3];
    else tip = 'Nog iets nauwkeuriger langs de lijn';
    return { score, tip, positie: pos, extra: ex * 100, dekking };
  }

  // ---------- scoren: arceren ----------
  function beoordeelArcering(o, streken) {
    const e = o.hatch;
    const lijsten = streken.map((s) => H.herbemonster(s.punten, 4)).filter((p) => p.length >= 2 && H.lengte(p) >= 8);
    if (lijsten.length < 4) return { ongeldig: 'Zet nog wat arceerlijnen en tik op Klaar', behoud: true };
    const hoeken = lijsten.map((p) => H.lijnFit(p).hoek);
    const cs = H.gemiddelde(hoeken.map((a) => Math.cos(2 * a))), sn = H.gemiddelde(hoeken.map((a) => Math.sin(2 * a)));
    const Rr = Math.min(1, Math.hypot(cs, sn));
    const sdHoek = Rr > 0 ? Math.sqrt(-2 * Math.log(Rr)) * 90 / Math.PI : 90;
    const mean = 0.5 * Math.atan2(sn, cs), phi = mean + Math.PI / 2;
    const hw = Math.sqrt((e.a * Math.cos(phi)) ** 2 + (e.b * Math.sin(phi)) ** 2);
    const offs = lijsten.map((p) => {
      const mx = H.gemiddelde(p.map((q) => q.x)), my = H.gemiddelde(p.map((q) => q.y));
      return (mx - e.cx) * Math.cos(phi) + (my - e.cy) * Math.sin(phi);
    }).sort((a, b) => a - b);
    const BAKS = 6, bak = new Set();
    for (const f of offs) if (Math.abs(f) <= hw) bak.add(Math.min(BAKS - 1, Math.floor((f + hw) / (2 * hw) * BAKS)));
    const cov = bak.size / BAKS;
    const gaten = [];
    for (let i = 1; i < offs.length; i++) gaten.push(offs[i] - offs[i - 1]);
    const cv = gaten.length >= 2 && H.gemiddelde(gaten) > 0 ? H.sd(gaten) / H.gemiddelde(gaten) : 1;
    let bin = 0, tot = 0;
    for (const p of lijsten) for (const q of p) { tot++; if (((q.x - e.cx) / (e.a * 1.1)) ** 2 + ((q.y - e.cy) / (e.b * 1.1)) ** 2 <= 1) bin++; }
    const binnen = tot ? bin / tot : 0;
    const dek = H.lin(1 - cov, 0.15, 0.65), par = H.lin(sdHoek, 6, 25), gap = H.lin(cv, 0.3, 1), inn = H.lin(1 - binnen, 0.1, 0.5);
    const score = 100 * (0.3 * dek + 0.25 * par + 0.2 * gap + 0.25 * inn);
    const w = [[dek, 'Vul het hele schaduwvlak met lijntjes'], [par, 'Houd je arceerlijnen evenwijdig'], [gap, 'Zet de lijntjes op gelijke afstand'], [inn, 'Blijf binnen het schaduwvlak']];
    w.sort((a, b) => a[0] - b[0]);
    const tip = w[0][0] < 0.7 ? w[0][1] : 'Mooi gearceerd';
    return { score, tip, dekking: cov * 100, evenwijdig: par * 100, afstand: gap * 100, binnen: binnen * 100 };
  }

  // ---------- nakijken ----------
  function nakijken(o, streken, vlak) {
    if (o.geenData) return { ongeldig: 'Er zijn nog geen krabbels geladen' };
    if (o.klaar) return { score: Math.round(st ? st.totaal : 0), tip: 'Tik voor een nieuwe tekening', geenNiveau: true };
    let u;
    if (o.soort === 'arceren') u = beoordeelArcering(o, streken);
    else {
      let streek = streken[0];
      for (const s of streken) if (H.lengte(s.punten) > H.lengte(streek.punten)) streek = s;
      u = beoordeelLijn(o, streek, vlak);
    }
    if (u.ongeldig) return u;
    if (u.score < SLECHT && st && st.poging < 1 && o.soort !== 'arceren') { st.poging++; return { ongeldig: 'Probeer deze lijn nog eens' }; }
    u.geenNiveau = true;
    if (st && o.stap === st.idx && !st.wacht) {
      const lay = o.lay;
      if (o.soort === 'arceren') {
        st.hatch = { score: u.score, strepen: streken.map((s) => naarData(lay, dunnen(s.punten, 24))) };
      } else {
        const s = streken.reduce((a, b) => (H.lengte(b.punten) > H.lengte(a.punten) ? b : a));
        st.gedaan[o.stap] = { soort: o.soort, score: u.score, punten: naarData(lay, H.herbemonsterN(s.punten, 60)) };
      }
      st.wacht = true;
      if (o.laatste) afronden();
    }
    return u;
  }

  function afronden() {
    const scores = st.gedaan.map((g) => g.score);
    if (st.hatch) scores.push(st.hatch.score);
    st.totaal = scores.length ? H.gemiddelde(scores) : 0;
    st.eind = true;
    const stand = leesStand();
    stand.klaar++; stand.sindsWissel++;
    stand.scores.push(Math.round(st.totaal)); stand.scores = stand.scores.slice(-10);
    const l3 = stand.scores.slice(-3);
    if (stand.sindsWissel >= 2 && stand.niveau < 4 && l3.length >= 2 && H.gemiddelde(l3) >= 70) { stand.niveau++; stand.sindsWissel = 0; }
    else if (stand.sindsWissel >= 2 && stand.niveau > 1 && l3.length >= 3 && H.gemiddelde(l3) < 40) { stand.niveau--; stand.sindsWissel = 0; }
    schrijf(SLEUTEL, stand);
    bewaarGalerij();
  }

  function bewaarGalerij() {
    const rec = {
      id: st.t.id, naam: st.t.naam, datum: new Date().toISOString(), score: Math.round(st.totaal), b: st.kd.w, h: st.kd.h,
      lijnen: st.gedaan.map((g) => ({ s: Math.round(g.score), z: g.soort, p: rond3(dunnen(g.punten, 30)) })),
      arceer: st.hatch ? st.hatch.strepen.map((p) => rond3(dunnen(p, 4))) : [],
    };
    let g = lees(GALERIJ, []);
    if (!Array.isArray(g)) g = [];
    g.push(rec);
    g = g.slice(-20);
    if (!schrijf(GALERIJ, g)) { g = g.slice(-8); schrijf(GALERIJ, g); }
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
  function pictogram(ctx, soort, x, y, k) {   // klein symbool voor de techniek, 14 px breed
    ctx.save();
    ctx.strokeStyle = k; ctx.lineWidth = 1.6; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    ctx.beginPath();
    if (soort === 'lijn') { ctx.moveTo(x, y + 5); ctx.lineTo(x + 14, y - 5); }
    else if (soort === 'hoek') { ctx.moveTo(x, y - 5); ctx.lineTo(x + 3, y + 5); ctx.lineTo(x + 14, y + 1); }
    else if (soort === 'cirkel') ctx.arc(x + 7, y, 6, 0, Math.PI * 2);
    else if (soort === 'ellips') ctx.ellipse(x + 7, y, 7, 4, 0, 0, Math.PI * 2);
    else if (soort === 'curve') { ctx.moveTo(x, y + 5); ctx.quadraticCurveTo(x + 7, y - 10, x + 14, y + 5); }
    else if (soort === 'slinger') { ctx.moveTo(x, y); ctx.bezierCurveTo(x + 2, y - 7, x + 5, y - 7, x + 7, y); ctx.bezierCurveTo(x + 9, y + 7, x + 12, y + 7, x + 14, y); }
    else if (soort === 'arceren') { for (let i = 0; i < 4; i++) { ctx.moveTo(x + i * 4, y + 5); ctx.lineTo(x + i * 4 + 4, y - 5); } }
    else { ctx.moveTo(x, y + 2); ctx.lineTo(x + 5, y - 4); ctx.lineTo(x + 9, y + 4); ctx.lineTo(x + 14, y - 3); }
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
    ctx.fillText(kortTekst(ctx, o.naam, vlak.w - 2 * m - gemB), m, 15);
    ctx.font = '500 12px ' + fam; ctx.fillStyle = k.tekstZacht;
    if (gemTxt) { ctx.textAlign = 'right'; ctx.fillText(gemTxt, vlak.w - m, 15); ctx.textAlign = 'left'; }
    pictogram(ctx, o.soort, m, 33, k.accent);
    ctx.fillStyle = k.tekstZacht;
    ctx.fillText((SOORTEN[o.soort] || '') + '  ·  stap ' + (o.stap + 1) + '/' + o.totaal, m + 20, 33);
    const b = bron();
    if (b) {
      ctx.font = '400 10px ' + fam; ctx.textAlign = 'center'; ctx.fillStyle = k.tekstZacht; ctx.globalAlpha = 0.8;
      ctx.fillText(kortTekst(ctx, b, vlak.w - 2 * m), vlak.w / 2, vlak.h - 9);
    }
    ctx.restore();
  }

  function eindscherm(ctx, o, vlak, fam) {
    const k = vlak.kleur, lay = o.lay;
    ctx.save();
    ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.lineWidth = 3;
    st.gedaan.forEach((g) => {
      if (!g) return;
      ctx.strokeStyle = kleurVoor(vlak, g.score);
      polylijn(ctx, naarPx(lay, g.punten));
    });
    if (st.hatch) {
      ctx.strokeStyle = kleurVoor(vlak, st.hatch.score); ctx.lineWidth = 1.6;
      st.hatch.strepen.forEach((p) => polylijn(ctx, naarPx(lay, p)));
    }
    ctx.textBaseline = 'middle'; ctx.textAlign = 'left';
    const m = Math.min(28, vlak.w * 0.05), tot = Math.round(st.totaal);
    ctx.font = '700 16px ' + fam; ctx.fillStyle = k.tekst;
    ctx.fillText(kortTekst(ctx, o.naam, vlak.w - 2 * m - 90), m, 15);
    ctx.font = '800 22px ' + fam; ctx.fillStyle = kleurVoor(vlak, tot); ctx.textAlign = 'right';
    ctx.fillText(String(tot), vlak.w - m, 16);
    ctx.textAlign = 'left'; ctx.font = '500 11px ' + fam;
    let x = m;
    [['goed', k.goed], ['matig', k.waarschuwing], ['fout', k.fout]].forEach((e) => {
      stip(ctx, x + 4, 34, 4, e[1]); ctx.fillStyle = k.tekstZacht; ctx.fillText(e[0], x + 12, 34);
      x += 14 + ctx.measureText(e[0]).width + 12;
    });
    ctx.textAlign = 'center'; ctx.font = '600 14px ' + fam; ctx.fillStyle = k.tekst;
    ctx.fillText('tik voor een nieuwe tekening', vlak.w / 2, vlak.h - 26);
    ctx.restore();
  }

  function teken(ctx, o, vlak, info) {
    const fam = lettertype(), k = vlak.kleur;
    info = info || { sinds: 0 };
    if (o.geenData) {
      ctx.save(); ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillStyle = k.tekstZacht; ctx.font = '600 16px ' + fam;
      ctx.fillText('Krabbelkunst heeft nog geen krabbels geladen', vlak.w / 2, vlak.h / 2 - 12);
      ctx.font = '500 13px ' + fam; ctx.fillText('(QuickDrawData ontbreekt)', vlak.w / 2, vlak.h / 2 + 12);
      ctx.restore();
      return;
    }
    if (o.klaar && st) { eindscherm(ctx, o, vlak, fam); return; }
    const lay = o.lay;
    ctx.save();
    ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    // vorige stappen: vaag het doel, daarover de eigen streek in inkt
    if (st) {
      st.stappen.forEach((s, i) => {
        if (i >= o.stap || !s.punten) return;
        ctx.globalAlpha = 0.28; ctx.strokeStyle = k.hulpZacht; ctx.lineWidth = 1.5;
        polylijn(ctx, naarPx(lay, s.punten));
      });
      ctx.globalAlpha = 1; ctx.strokeStyle = k.inkt; ctx.lineWidth = 2.6;
      st.gedaan.forEach((g, i) => { if (g && i < o.stap) polylijn(ctx, naarPx(lay, g.punten)); });
    }
    // huidige doel
    const sinds = info.sinds || 0, niv = o.niveau;
    if (o.hatch) {
      const h = o.hatch;
      ctx.globalAlpha = niv === 4 ? H.clamp(1 - (sinds - 2500) / 500, 0.25, 0.8) : 0.8;
      ctx.strokeStyle = k.accent; ctx.lineWidth = 2; ctx.setLineDash([7, 6]);
      ctx.beginPath(); ctx.ellipse(h.cx, h.cy, h.a, h.b, 0, 0, Math.PI * 2); ctx.stroke(); ctx.setLineDash([]);
      ctx.globalAlpha = 1; ctx.fillStyle = k.tekstZacht; ctx.font = '500 12px ' + fam; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText('arceer de schaduw en tik op Klaar', vlak.w / 2, Math.min(vlak.h - ONDER + 8, h.cy + h.b + 18));
    } else if (o.doel) {
      const d = o.doel, dicht = o.soort === 'cirkel' || o.soort === 'ellips';
      let a = 1;
      if (niv === 2) a = H.clamp(1 - (sinds - 1500) / 500, 0.1, 1);
      else if (niv === 4) a = H.clamp(1 - (sinds - 1500) / 500, 0, 1);
      if (niv <= 2) {
        ctx.globalAlpha = 0.85 * a; ctx.strokeStyle = k.accent; ctx.lineWidth = 2.5; ctx.setLineDash([8, 7]);
        polylijn(ctx, d); ctx.setLineDash([]);
      }
      ctx.globalAlpha = a;
      if (niv === 1 || niv === 2 || a > 0) {
        stip(ctx, d[0].x, d[0].y, 6, k.goed);
        if (niv === 1 && d.length > 2) {   // richtingspijltje kort na de start
          let p = 1, acc = 0;
          while (p < d.length - 1 && acc < 30) { acc += H.afstand(d[p - 1], d[p]); p++; }
          const q = d[Math.min(p, d.length - 1)], r = d[Math.max(p - 1, 0)];
          const w = Math.atan2(q.y - r.y, q.x - r.x);
          ctx.strokeStyle = k.accent; ctx.lineWidth = 2.5; ctx.setLineDash([]);
          ctx.beginPath();
          ctx.moveTo(q.x - 9 * Math.cos(w - 0.5), q.y - 9 * Math.sin(w - 0.5)); ctx.lineTo(q.x, q.y); ctx.lineTo(q.x - 9 * Math.cos(w + 0.5), q.y - 9 * Math.sin(w + 0.5));
          ctx.stroke();
        }
        if (!dicht || niv >= 3) {
          const e = d[d.length - 1];
          if (!dicht) { ctx.strokeStyle = k.accent; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(e.x, e.y, 6, 0, Math.PI * 2); ctx.stroke(); }
        }
        if (dicht && niv >= 3) raakpunten(d).forEach((q) => stip(ctx, q.x, q.y, 4.5, k.accent));
      }
    }
    ctx.restore();
    hud(ctx, o, vlak, fam);
  }

  function tekenUitslag(ctx, o, streken, uitslag, vlak) {
    if (o.klaar || !o.doel) return;
    ctx.save();
    ctx.globalAlpha = 0.55; ctx.strokeStyle = vlak.kleur.accent; ctx.lineWidth = 1.5; ctx.setLineDash([3, 5]); ctx.lineCap = 'round';
    polylijn(ctx, o.doel);
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
    id: 'minigame',
    naam: 'Krabbelkunst',
    uitleg: 'Teken lijn voor lijn een echte Quick, Draw!-krabbel na. Elke stap is één lijn: volg de stippellijn, van de groene stip af. Aan het eind arceer je de schaduw en zie je je eigen tekening, met per lijn een kleur voor hoe goed het ging.',
    fundament: 'Alles samen: lijnen, hoeken, curves, cirkels, arceren',
    meerdereStreken: false,
    toonUitslag: 900,
    nieuweOpgave, teken, nakijken, tekenUitslag, scorePlek, naUitslag,
  });
})();
