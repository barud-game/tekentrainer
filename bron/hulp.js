// Gedeelde rekenhulpjes voor alle oefeningen. Alles werkt met punten {x, y, p, t}
// (x/y in CSS-pixels van het tekenvlak, p = druk 0..1, t = tijd in ms).
window.Hulp = (function () {
  const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

  // 1 bij x <= goed, 0 bij x >= slecht, lineair ertussen (werkt ook als goed > slecht).
  function lin(x, goed, slecht) {
    if (goed === slecht) return x <= goed ? 1 : 0;
    return clamp((slecht - x) / (slecht - goed), 0, 1);
  }

  const afstand = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);

  function lengte(pts) {
    let s = 0;
    for (let i = 1; i < pts.length; i++) s += afstand(pts[i - 1], pts[i]);
    return s;
  }

  // Herbemonster op gelijke afstand 'stap' (px); p en t worden meegeïnterpoleerd.
  function herbemonster(pts, stap) {
    if (pts.length < 2) return pts.slice();
    const uit = [Object.assign({}, pts[0])];
    let rest = 0;
    for (let i = 1; i < pts.length; i++) {
      const a = pts[i - 1], b = pts[i];
      const d = afstand(a, b);
      if (d === 0) continue;
      let pos = stap - rest;
      while (pos <= d) {
        const f = pos / d;
        uit.push({ x: a.x + (b.x - a.x) * f, y: a.y + (b.y - a.y) * f, p: a.p + (b.p - a.p) * f, t: a.t + (b.t - a.t) * f });
        pos += stap;
      }
      rest = d - (pos - stap);
    }
    const last = pts[pts.length - 1];
    if (afstand(uit[uit.length - 1], last) > stap * 0.3) uit.push(Object.assign({}, last));
    return uit;
  }

  // Herbemonster naar precies n punten.
  function herbemonsterN(pts, n) {
    const L = lengte(pts);
    if (L === 0 || n < 2) return pts.slice(0, n);
    const r = herbemonster(pts, L / (n - 1));
    while (r.length > n) r.pop();
    while (r.length < n) r.push(Object.assign({}, pts[pts.length - 1]));
    return r;
  }

  function gemiddelde(arr) { return arr.length ? arr.reduce((s, v) => s + v, 0) / arr.length : 0; }
  function sd(arr) { const m = gemiddelde(arr); return Math.sqrt(gemiddelde(arr.map((v) => (v - m) ** 2))); }
  function mediaan(arr) {
    if (!arr.length) return 0;
    const s = arr.slice().sort((a, b) => a - b), k = s.length >> 1;
    return s.length % 2 ? s[k] : (s[k - 1] + s[k]) / 2;
  }

  // Beste rechte lijn door de punten (PCA). Geeft midden, eenheidsrichting en hoek (rad).
  function lijnFit(pts) {
    const mx = gemiddelde(pts.map((p) => p.x)), my = gemiddelde(pts.map((p) => p.y));
    let sxx = 0, syy = 0, sxy = 0;
    for (const p of pts) { const dx = p.x - mx, dy = p.y - my; sxx += dx * dx; syy += dy * dy; sxy += dx * dy; }
    const hoek = 0.5 * Math.atan2(2 * sxy, sxx - syy);
    return { mx, my, dx: Math.cos(hoek), dy: Math.sin(hoek), hoek };
  }

  // Loodrechte (gesigneerde) afstand van punt tot lijn door a met richting (dx, dy).
  function lijnAfstand(p, a, dx, dy) { return (p.x - a.x) * -dy + (p.y - a.y) * dx; }

  // Afstand van punt tot lijnstuk a-b.
  function segmentAfstand(p, a, b) {
    const vx = b.x - a.x, vy = b.y - a.y, L2 = vx * vx + vy * vy;
    const f = L2 ? clamp(((p.x - a.x) * vx + (p.y - a.y) * vy) / L2, 0, 1) : 0;
    return Math.hypot(p.x - (a.x + vx * f), p.y - (a.y + vy * f));
  }

  // Kleinste afstand van punt tot een polylijn.
  function polyAfstand(p, poly) {
    let m = Infinity;
    for (let i = 1; i < poly.length; i++) m = Math.min(m, segmentAfstand(p, poly[i - 1], poly[i]));
    return m;
  }

  // Snelheden (px/ms) tussen opeenvolgende punten, met tijd > 0.
  function snelheden(pts) {
    const v = [];
    for (let i = 1; i < pts.length; i++) {
      const dt = pts[i].t - pts[i - 1].t;
      if (dt > 0) v.push(afstand(pts[i - 1], pts[i]) / dt);
    }
    return v;
  }

  // Hoekverschil tussen twee richtingen in graden, voor lijnen zonder richting (0..90).
  function lijnHoekVerschil(a, b) {
    let d = Math.abs(a - b) % Math.PI;
    if (d > Math.PI / 2) d = Math.PI - d;
    return d * 180 / Math.PI;
  }

  // Kleine voorspelbare random-generator: rng() -> 0..1. Met rng.tussen(a, b) en rng.kies(lijst).
  function maakRng(seed) {
    let s = (seed >>> 0) || 1;
    const rng = () => { s ^= s << 13; s ^= s >>> 17; s ^= s << 5; return ((s >>> 0) % 1e9) / 1e9; };
    rng.tussen = (a, b) => a + (b - a) * rng();
    rng.kies = (lijst) => lijst[Math.floor(rng() * lijst.length)];
    return rng;
  }

  return { clamp, lin, afstand, lengte, herbemonster, herbemonsterN, gemiddelde, sd, mediaan,
    lijnFit, lijnAfstand, segmentAfstand, polyAfstand, snelheden, lijnHoekVerschil, maakRng };
})();
