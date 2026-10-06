// Eén vloeiende lijn: C-, S- en golfcurves in één streek door stippen en ringen.
(function () {
  const H = window.Hulp;
  const RAD = Math.PI / 180;

  // Per niveau: type, aantal ringen, tolerantie r (fractie van W), gids, oriëntatie, minimumtempo.
  const NIVEAUS = {
    1: { type: 'C', ringen: 1, r: 0.08, gids: 'vol', draai: false },
    2: { type: 'C', ringen: 2, r: 0.07, gids: 'uiteinden', draai: true },
    3: { type: 'S', ringen: 2, r: 0.06, gids: 'geen', draai: true },
    4: { type: 'S2', ringen: 3, r: 0.05, gids: 'geen', draai: true },
    5: { type: 'golf', ringen: 4, r: 0.04, gids: 'geen', draai: true, snel: true },
  };
  const WENDINGEN = { C: 0, S: 1, S2: 1, golf: 2 };
  const HOEK_A = 20;          // graden: minimale koersomkering voor een echte wending (pen-ruis blijft daaronder)
  const TRAAG = 0.12;         // mediane snelheid in W per seconde: daaronder is het "zeer traag"
  const TRAAG_N5 = 0.3;       // idem voor het minimumtempo van niveau 5

  // ---------- opgave ----------
  // Bogen: lijst {R, hoek} (hoek in rad, teken = draairichting). Geeft een dichte polyline in eenheidsruimte.
  function bogen(type, rng) {
    if (type === 'C') return [{ R: 1, hoek: rng.tussen(150, 200) * RAD }];
    if (type === 'S') { const h = rng.tussen(85, 115) * RAD; return [{ R: 1, hoek: h }, { R: 1, hoek: -h }]; }
    if (type === 'S2') {
      const f = rng.kies([rng.tussen(0.5, 0.65), rng.tussen(1.5, 1.9)]);
      return [{ R: 1, hoek: rng.tussen(100, 130) * RAD }, { R: f, hoek: -rng.tussen(90, 120) * RAD }];
    }
    return [
      { R: 1, hoek: rng.tussen(80, 105) * RAD },
      { R: rng.tussen(0.8, 1.2), hoek: -rng.tussen(150, 190) * RAD },
      { R: rng.tussen(0.8, 1.2), hoek: rng.tussen(80, 105) * RAD },
    ];
  }

  function bouwPolyline(segs) {
    const pts = [{ x: 0, y: 0 }];
    let x = 0, y = 0, th = 0;
    const stap = 0.01;
    for (const s of segs) {
      const L = s.R * Math.abs(s.hoek), n = Math.max(2, Math.ceil(L / stap));
      const dth = s.hoek / n, ds = L / n;
      for (let i = 0; i < n; i++) {
        const mid = th + dth / 2;
        x += Math.cos(mid) * ds; y += Math.sin(mid) * ds; th += dth;
        pts.push({ x, y });
      }
    }
    return pts;
  }

  function nieuweOpgave(niveau, rng, vlak) {
    const n = NIVEAUS[niveau];
    const W = Math.min(vlak.w, vlak.h);
    let pts = bouwPolyline(bogen(n.type, rng));
    // Oriëntatie: niveau 1 vast (alleen gespiegeld), daarna willekeurig draaien.
    const spiegel = rng() < 0.5 ? -1 : 1;
    const t = n.draai ? rng.tussen(0, 2 * Math.PI) : 0;
    const c = Math.cos(t), s = Math.sin(t);
    pts = pts.map((p) => { const x = p.x * spiegel; return { x: x * c - p.y * s, y: x * s + p.y * c }; });
    // Passen in het vlak.
    let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
    for (const p of pts) { x0 = Math.min(x0, p.x); x1 = Math.max(x1, p.x); y0 = Math.min(y0, p.y); y1 = Math.max(y1, p.y); }
    const marge = n.r * W + 0.04 * W;
    const k = Math.min((vlak.w - 2 * marge) / (x1 - x0 || 1), (vlak.h - 2 * marge) / (y1 - y0 || 1));
    const ox = vlak.w / 2 - k * (x0 + x1) / 2, oy = vlak.h / 2 - k * (y0 + y1) / 2;
    const ideaal = pts.map((p) => ({ x: ox + k * p.x, y: oy + k * p.y }));
    // Tangent, normaal en gesigneerde kromming (+ = middelpunt aan de kant van de normaal).
    const m = ideaal.length, vk = 3;
    for (let i = 0; i < m; i++) {
      const a = ideaal[Math.max(0, i - 1)], b = ideaal[Math.min(m - 1, i + 1)];
      const l = Math.hypot(b.x - a.x, b.y - a.y) || 1;
      ideaal[i].tx = (b.x - a.x) / l; ideaal[i].ty = (b.y - a.y) / l;
    }
    for (let i = 0; i < m; i++) {
      const a = ideaal[Math.max(0, i - vk)], b = ideaal[Math.min(m - 1, i + vk)];
      let d = Math.atan2(b.ty, b.tx) - Math.atan2(a.ty, a.tx);
      d = Math.atan2(Math.sin(d), Math.cos(d));
      const len = Math.hypot(b.x - a.x, b.y - a.y) || 1;
      ideaal[i].k = d / len;
    }
    let lengte = 0;
    const cum = [0];
    for (let i = 1; i < m; i++) { lengte += H.afstand(ideaal[i - 1], ideaal[i]); cum.push(lengte); }
    const ringen = [];
    for (let j = 1; j <= n.ringen; j++) {
      const doel = lengte * j / (n.ringen + 1);
      let i = 0; while (i < m - 1 && cum[i] < doel) i++;
      ringen.push({ x: ideaal[i].x, y: ideaal[i].y, i });
    }
    const opgave = {
      niveau, type: n.type, wendingen: WENDINGEN[n.type], r: n.r * W, W,
      gids: n.gids, snel: !!n.snel, ideaal, cum, lengte, ringen,
      start: { x: ideaal[0].x, y: ideaal[0].y }, eind: { x: ideaal[m - 1].x, y: ideaal[m - 1].y },
    };
    opgave.plek = legePlek(opgave, vlak);
    return opgave;
  }

  // Punt in het vlak met de grootste afstand tot de curve (voor de score).
  function legePlek(o, vlak) {
    const mx = vlak.w * 0.3, my = Math.min(vlak.h * 0.18, 70);
    let beste = { x: vlak.w / 2, y: vlak.h / 2 }, bd = -1;
    const stap = Math.max(8, o.W / 40);
    for (let y = my; y <= vlak.h - my; y += stap) {
      for (let x = mx; x <= vlak.w - mx; x += stap) {
        const d = H.polyAfstand({ x, y }, o.ideaal);
        if (d > bd) { bd = d; beste = { x, y }; }
      }
    }
    return beste;
  }

  // ---------- tekenen ----------
  function pad(ctx, pts, van, tot) {
    ctx.beginPath();
    ctx.moveTo(pts[van].x, pts[van].y);
    for (let i = van + 1; i <= tot; i++) ctx.lineTo(pts[i].x, pts[i].y);
    ctx.stroke();
  }

  function teken(ctx, o, vlak) {
    const kl = vlak.kleur, m = o.ideaal.length;
    ctx.save();
    if (o.gids !== 'geen') {
      ctx.strokeStyle = kl.hulp; ctx.lineWidth = 2; ctx.setLineDash([4, 9]); ctx.lineCap = 'round';
      if (o.gids === 'vol') pad(ctx, o.ideaal, 0, m - 1);
      else {
        let a = 0; while (a < m - 1 && o.cum[a] < o.lengte * 0.14) a++;
        let b = m - 1; while (b > 0 && o.cum[b] > o.lengte * 0.86) b--;
        pad(ctx, o.ideaal, 0, a); pad(ctx, o.ideaal, b, m - 1);
      }
      ctx.setLineDash([]);
    }
    ctx.strokeStyle = kl.hulp; ctx.lineWidth = 2;
    for (const r of o.ringen) { ctx.beginPath(); ctx.arc(r.x, r.y, o.r, 0, Math.PI * 2); ctx.stroke(); }
    const dot = Math.max(6, o.r * 0.5);
    ctx.fillStyle = kl.accent;
    ctx.beginPath(); ctx.arc(o.start.x, o.start.y, dot, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = kl.accent; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(o.start.x, o.start.y, o.r, 0, Math.PI * 2); ctx.stroke();
    ctx.fillStyle = kl.tekst;
    ctx.beginPath(); ctx.arc(o.eind.x, o.eind.y, dot, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = kl.tekst; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(o.eind.x, o.eind.y, o.r, 0, Math.PI * 2); ctx.stroke();
    ctx.restore();
  }

  // ---------- nakijken ----------
  const wrap = (a) => Math.atan2(Math.sin(a), Math.cos(a));

  // Herbemonsteren op ds en 3-punts gemiddelde (begin/eind blijven staan; tijd blijft behouden).
  function opschonen(ruw, ds) {
    const r = H.herbemonster(ruw, ds);
    const uit = r.map((p, i) => {
      if (i === 0 || i === r.length - 1) return { x: p.x, y: p.y, t: p.t };
      return { x: (r[i - 1].x + p.x + r[i + 1].x) / 3, y: (r[i - 1].y + p.y + r[i + 1].y) / 3, t: p.t };
    });
    return uit;
  }

  function dichtstbij(p, ideaal) {
    let bi = 0, bd = Infinity;
    for (let i = 0; i < ideaal.length; i++) {
      const d = (p.x - ideaal[i].x) ** 2 + (p.y - ideaal[i].y) ** 2;
      if (d < bd) { bd = d; bi = i; }
    }
    return { i: bi, d: Math.sqrt(bd) };
  }

  function nakijken(o, streken) {
    const ruw = streken[streken.length - 1].punten;
    if (ruw.length < 12 || H.lengte(ruw) < 0.5 * o.lengte) return { ongeldig: 'Te kort: teken de hele lijn in één streek.' };
    const W = o.W, ds = 0.02 * W, r = o.r;   // grove stap: pen-ruis van 1-3 px geeft dan geen schijnknikken
    const P = opschonen(ruw, ds);
    const n = P.length;
    if (n < 12) return { ongeldig: 'Te kort: teken de hele lijn in één streek.' };

    // --- Doorgang ---
    const si = (d) => H.clamp(1 - (d - 0.5 * r) / (1.5 * r), 0, 1);
    const dStart = H.afstand(P[0], o.start), dEind = H.afstand(P[n - 1], o.eind);
    const ringD = o.ringen.map((g) => H.polyAfstand(g, P));
    const sRing = ringD.map(si);
    const sStart = dStart <= 1.5 * r ? si(dStart) : 0;
    const sEind = dEind <= 1.5 * r ? si(dEind) : 0;
    const doorgang = 100 * H.gemiddelde([sStart, ...sRing, sEind]);
    const gemist = o.ringen.filter((g, k) => sRing[k] < 0.5);

    // --- Hoeken en kromming ---
    const phi = [];
    for (let j = 0; j < n - 1; j++) phi.push(Math.atan2(P[j + 1].y - P[j].y, P[j + 1].x - P[j].x));
    const theta = [0];                       // theta[j] = draaihoek in vertex j (j=1..n-2), rad
    for (let j = 1; j < n - 1; j++) theta.push(wrap(phi[j] - phi[j - 1]));
    theta.push(0);
    const kappa = theta.map((t) => t / ds);
    const absK = theta.slice(1, n - 1).map((t) => Math.abs(t / ds));
    const medK = H.mediaan(absK);
    const flag = new Array(n).fill(false);
    for (let j = 1; j < n - 1; j++) {
      const t = Math.abs(theta[j]) / RAD;
      const k = Math.abs(kappa[j]);
      if (t > 30 || (k > 3 * medK && t > 20)) flag[j] = true;
      if (j < n - 3) {
        const s3 = Math.abs(theta[j] + theta[j + 1] + theta[j + 2]) / RAD;
        if (s3 > 55) { flag[j] = flag[j + 1] = flag[j + 2] = true; }
      }
    }
    const hoekjes = [];                      // clusters van aaneengesloten (gap ≤ 1) vlaggen
    for (let j = 1; j < n - 1; j++) {
      if (!flag[j]) continue;
      let e = j;
      while (e + 2 < n - 1 && (flag[e + 1] || flag[e + 2])) e++;
      let mx = j; for (let q = j; q <= e; q++) if (Math.abs(theta[q]) > Math.abs(theta[mx])) mx = q;
      hoekjes.push({ x: P[mx].x, y: P[mx].y });
      j = e;
    }

    // --- Tekenwisselingen van de kromming (hysterese op cumulatieve hoek) ---
    const cumA = [];
    { let c = 0; for (let j = 1; j < n - 1; j++) { c += theta[j] / RAD; cumA.push(c); } }
    const glad = cumA.map((_, j) => {            // 7-punts gemiddelde tegen meetruis
      let s = 0, k = 0;
      for (let q = Math.max(0, j - 3); q <= Math.min(cumA.length - 1, j + 3); q++) { s += cumA[q]; k++; }
      return s / k;
    });
    let dir = 0, ext = 0, mn = 0, mxv = 0, wissels = 0;
    for (const cum of glad) {
      if (dir === 0) {
        mn = Math.min(mn, cum); mxv = Math.max(mxv, cum);
        if (cum - mn >= HOEK_A) { dir = 1; ext = cum; } else if (mxv - cum >= HOEK_A) { dir = -1; ext = cum; }
      } else if (dir === 1) {
        ext = Math.max(ext, cum);
        if (ext - cum >= HOEK_A) { dir = -1; ext = cum; wissels++; }
      } else {
        ext = Math.min(ext, cum);
        if (cum - ext >= HOEK_A) { dir = 1; ext = cum; wissels++; }
      }
    }
    const extra = Math.max(0, wissels - o.wendingen);
    const verkeerdeWendingen = wissels !== o.wendingen;

    // --- Ruwheid ---
    const dK = [];
    for (let j = 2; j < n - 1; j++) dK.push(kappa[j] - kappa[j - 1]);
    const gemK = H.gemiddelde(absK);
    const ruwheid = gemK > 0 ? H.sd(dK) / gemK : 0;
    const ruwPen = 20 * H.clamp((ruwheid - 1) / 2, 0, 1);

    let vloeiend = 100 - 10 * hoekjes.length - 3 * Math.min(extra, 4) - ruwPen;
    vloeiend = H.clamp(vloeiend, 0, 100);

    // --- Tempo ---
    // Groepen segmenten van ≥ 6 ms zodat gelijke tijdstempels geen oneindige snelheid geven.
    const groepen = [];
    let gd = 0, gt = 0, g0 = 0, afgelegd = 0;
    const totaal = H.lengte(P) || 1;
    for (let j = 0; j < n - 1; j++) {
      const d = H.afstand(P[j], P[j + 1]);
      const dt = Math.max(0, P[j + 1].t - P[j].t);
      gd += d; gt += dt;
      if (gt >= 6 || j === n - 2) {
        if (gt > 0) groepen.push({ v: gd / gt, dt: gt, f: (afgelegd + gd / 2) / totaal, j0: g0, j1: j });
        afgelegd += gd; gd = 0; gt = 0; g0 = j + 1;
      }
    }
    let tempo = 70, haperingen = [], cv = 0, vMed = 0, traag = false;
    if (groepen.length >= 4) {
      vMed = H.mediaan(groepen.map((g) => g.v));
      const mid = groepen.filter((g) => g.f >= 0.1 && g.f <= 0.9);
      let run = [];
      const sluit = () => {
        if (run.length && H.gemiddelde([run.reduce((s, g) => s + g.dt, 0)]) >= 80) {
          const g = run[Math.floor(run.length / 2)];
          haperingen.push({ x: P[g.j0].x, y: P[g.j0].y });
        }
        run = [];
      };
      for (const g of mid) { if (g.v < 0.2 * vMed) run.push(g); else sluit(); }
      sluit();
      const vs = mid.map((g) => g.v);
      const gv = H.gemiddelde(vs);
      cv = gv > 0 ? H.sd(vs) / gv : 0;
      tempo = 100 - 25 * haperingen.length - 25 * H.clamp((cv - 0.5) / 0.5, 0, 1);
      const grens = (o.snel ? TRAAG_N5 : TRAAG) * W / 1000;
      traag = vMed < grens;
      if (traag) tempo = Math.min(tempo, 60);
      tempo = H.clamp(tempo, 0, 100);
    }

    // --- Bocht afgesneden (afwijking naar de binnenkant van de bocht) ---
    const afgesneden = [];
    let reeks = [];
    const kMin = 0.4 / o.lengte;             // negeer bijna rechte stukken (kromming in 1/px)
    for (let j = 0; j < n; j++) {
      const q = dichtstbij(P[j], o.ideaal), id = o.ideaal[q.i];
      let binnen = 0;
      if (Math.abs(id.k) > kMin) {
        const nx = -id.ty, ny = id.tx, sg = Math.sign(id.k);
        binnen = ((P[j].x - id.x) * nx + (P[j].y - id.y) * ny) * sg;
      }
      if (binnen > 0.5 * r) reeks.push(P[j]);
      else { if (reeks.length >= 3) afgesneden.push(reeks[Math.floor(reeks.length / 2)]); reeks = []; }
    }
    if (reeks.length >= 3) afgesneden.push(reeks[Math.floor(reeks.length / 2)]);

    let score = 0.35 * doorgang + 0.40 * vloeiend + 0.25 * tempo;
    // Geen harde plafond meer: een ontbrekende wending kost 20 punten, elke extra wending 4 (max 16).
    if (wissels < o.wendingen) score -= 20 * (o.wendingen - wissels);
    else score -= 4 * Math.min(extra, 4);
    score = Math.round(H.clamp(score, 0, 100));

    // --- Tip: de oorzaak met de grootste puntenverlies ---
    const nabijRing = (p) => [o.start, o.eind, ...o.ringen].some((g) => H.afstand(p, g) < 2.5 * r);
    const knikRing = hoekjes.filter(nabijRing).length;
    const kandidaten = [];
    const grensV = (o.snel ? TRAAG_N5 : TRAAG) * W / 1000;
    const trillerig = (ruwPen >= 6 || hoekjes.length >= 3) && vMed > 0 && vMed < Math.max(2 * grensV, 0.4 * W / 1000);
    if (hoekjes.length && !trillerig) {
      kandidaten.push(knikRing
        ? [20 * knikRing + 10, 'Je knikt bij de stip. Kijk al naar de volgende stip en haal de lijn in één beweging door.']
        : [20 * hoekjes.length + 10, 'Je lijn heeft een knik. Trek de bocht in één vloeiende beweging.']);
    }
    if (haperingen.length) kandidaten.push([25 * haperingen.length + 5, 'Je stokt halverwege. Trek sneller, vanuit je schouder.']);
    if (trillerig) kandidaten.push([100, 'Trillerige lijn. Teken sneller; een snelle lijn wordt gladder.']);
    if (traag) kandidaten.push([40, 'Je tekent te langzaam. Trek de lijn sneller, vanuit je schouder.']);
    if (afgesneden.length) kandidaten.push([30, 'Je snijdt de bocht af. Maak hem ruimer.']);
    if (dStart > 1.5 * r || dEind > 1.5 * r) kandidaten.push([60, 'Begin op de gekleurde stip en eindig op de laatste stip.']);
    else if (gemist.length) kandidaten.push([(100 - doorgang) * 1.2, 'Je mist een ring. Laat de lijn door het midden van de ringen lopen.']);
    if (verkeerdeWendingen) {
      kandidaten.push([hoekjes.length ? 15 : wissels < o.wendingen ? 45 : 35,
        o.wendingen === 0 ? 'Dit is één C-bocht: wissel niet van richting.'
          : wissels < o.wendingen ? 'Je lijn mist een wending. Buig na het midden de andere kant op.'
            : 'Te veel wendingen. Houd de bochten ruim en rustig.']);
    }
    let tip;
    if (kandidaten.length) { kandidaten.sort((a, b) => b[0] - a[0]); tip = kandidaten[0][1]; }
    else tip = score >= 85 ? 'Mooie, vloeiende lijn.' : 'Trek gelijkmatiger door, vanuit je schouder.';

    return {
      score, tip, hoekjes: hoekjes.length, ruwPen, doorgang, vloeiend, tempo, wissels, ruwheid, cv, vMed,
      markers: { knikken: hoekjes, haperingen, afgesneden, gemist },
    };
  }

  function tekenUitslag(ctx, o, streken, u, vlak) {
    const kl = vlak.kleur;
    ctx.save();
    ctx.setLineDash([10, 8]); ctx.strokeStyle = kl.goed; ctx.lineWidth = 2.5; ctx.lineCap = 'round';
    pad(ctx, o.ideaal, 0, o.ideaal.length - 1);
    ctx.setLineDash([]);
    ctx.strokeStyle = kl.fout; ctx.lineWidth = 2.5;
    for (const g of u.markers.gemist) { ctx.beginPath(); ctx.arc(g.x, g.y, o.r, 0, Math.PI * 2); ctx.stroke(); }
    ctx.fillStyle = kl.fout;
    const m = u.markers;
    for (const p of [...m.knikken, ...m.haperingen, ...m.afgesneden]) {
      ctx.beginPath(); ctx.arc(p.x, p.y, 5, 0, Math.PI * 2); ctx.fill();
    }
    ctx.restore();
  }

  Tekentrainer.registreer({
    id: 'curves',
    naam: 'Eén vloeiende lijn',
    uitleg: 'Teken in één vloeiende streek van de startstip door alle ringen naar de eindstip.',
    fundament: 'Zelfverzekerde C- en S-curves vanuit schouder en elleboog; de basis voor lineart en schetsen.',
    meerdereStreken: false,
    toonUitslag: 1500,
    nieuweOpgave,
    teken,
    nakijken,
    tekenUitslag,
    scorePlek: (o) => o.plek,
  });
})();
