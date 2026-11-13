var I18N = typeof I18N !== 'undefined' ? I18N : require('./i18n.js'); var T = I18N.T;
/* Calculation engine: Western + Vedic chart, Ba Zi, Gua, Human Design.
   Needs the astronomy-engine global `Astronomy` (browser) or require (node). */
var Engine = (function () {
  var A = (typeof Astronomy !== 'undefined') ? Astronomy : (typeof require !== 'undefined' ? require('astronomy-engine') : null);
  var D2R = Math.PI / 180, R2D = 180 / Math.PI;
  function norm(x) { return ((x % 360) + 360) % 360; }

  /* ---------- time ---------- */
  function tzOffsetMinutes(utcMs, tz) {
    var dtf = new Intl.DateTimeFormat('en-US', { timeZone: tz, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit' });
    var p = {};
    dtf.formatToParts(new Date(utcMs)).forEach(function (x) { p[x.type] = x.value; });
    var h = +p.hour === 24 ? 0 : +p.hour;
    var asUTC = Date.UTC(+p.year, +p.month - 1, +p.day, h, +p.minute, +p.second);
    return Math.round((asUTC - utcMs) / 60000);
  }
  /* tz: IANA name or a number of hours (manual UTC offset) */
  function localToUTC(y, m, d, h, mi, tz) {
    var guess = Date.UTC(y, m - 1, d, h, mi);
    if (typeof tz === 'number') return { utc: new Date(guess - tz * 3600000), offset: tz * 60 };
    var off = tzOffsetMinutes(guess, tz);
    var utc = guess - off * 60000;
    var off2 = tzOffsetMinutes(utc, tz);
    if (off2 !== off) utc = guess - off2 * 60000;
    return { utc: new Date(utc), offset: off2 };
  }

  /* ---------- positions (tropical, true ecliptic of date) ---------- */
  function lonOf(body, time) {
    if (body === 'Sun') return A.SunPosition(time).elon;
    if (body === 'Moon') return A.EclipticGeoMoon(time).lon;
    var v = A.GeoVector(body, time, true);
    var e = A.RotateVector(A.Rotation_EQJ_ECT(time), v);
    return A.SphereFromVector(e).lon;
  }
  /* true (osculating) lunar node */
  function trueNode(time) {
    var rot = A.Rotation_EQJ_ECT(time);
    var s = A.GeoMoonState(time);
    var r = A.RotateVector(rot, new A.Vector(s.x, s.y, s.z, time));
    var v = A.RotateVector(rot, new A.Vector(s.vx, s.vy, s.vz, time));
    var hx = r.y * v.z - r.z * v.y, hy = r.z * v.x - r.x * v.z;
    return norm(Math.atan2(hx, -hy) * R2D);
  }
  function angles(time, lat, lon) {
    var gast = A.SiderealTime(time);
    var ramc = norm(gast * 15 + lon);
    var eps = A.e_tilt(time).tobl;
    var r = ramc * D2R, e = eps * D2R, f = lat * D2R;
    var mc = norm(Math.atan2(Math.sin(r), Math.cos(r) * Math.cos(e)) * R2D);
    var asc = norm(Math.atan2(Math.cos(r), -(Math.sin(r) * Math.cos(e) + Math.tan(f) * Math.sin(e))) * R2D);
    return { asc: asc, mc: mc };
  }
  function lahiri(time) {
    var T = time.tt / 36525;
    return 23.857092 + (5028.796195 * T + 1.1054348 * T * T) / 3600;
  }

  var SIGNS = I18N.wrap(['Овен', 'Телец', 'Близнаци', 'Рак', 'Лъв', 'Дева', 'Везни', 'Скорпион', 'Стрелец', 'Козирог', 'Водолей', 'Риби']);
  function sign(lon) { var i = Math.floor(norm(lon) / 30); return { i: i, name: SIGNS[i], deg: norm(lon) - i * 30 }; }

  /* ---------- Vedic ---------- */
  var NAK = I18N.wrap(['Ашвини', 'Бхарани', 'Критика', 'Рохини', 'Мригашира', 'Ардра', 'Пунарвасу', 'Пушя', 'Ашлеша', 'Мага', 'Пурва Пхалгуни', 'Уттара Пхалгуни', 'Хаста', 'Читра', 'Свати', 'Вишакха', 'Анурадха', 'Джиещха', 'Мула', 'Пурва Ашадха', 'Уттара Ашадха', 'Шравана', 'Дханишта', 'Шатабхиша', 'Пурва Бхадрапада', 'Уттара Бхадрапада', 'Ревати']);
  var DASHA = [['ketu', 7], ['venus', 20], ['sun', 6], ['moon', 10], ['mars', 7], ['rahu', 18], ['jupiter', 16], ['saturn', 19], ['mercury', 17]];
  var YEAR_MS = 365.25 * 86400000;
  function dashas(moonSid, birthMs) {
    var span = 360 / 27, n = Math.floor(moonSid / span), frac = (moonSid - n * span) / span;
    var start = n % 9;
    var list = [], t = birthMs - frac * DASHA[start][1] * YEAR_MS;
    for (var k = 0; k < 10; k++) {
      var d = DASHA[(start + k) % 9], end = t + d[1] * YEAR_MS;
      var subs = [], st = t;
      for (var j = 0; j < 9; j++) {
        var s = DASHA[((start + k) % 9 + j) % 9], len = d[1] * s[1] / 120 * YEAR_MS;
        subs.push({ lord: s[0], start: st, end: st + len });
        st += len;
      }
      list.push({ lord: d[0], start: t, end: end, subs: subs });
      t = end;
    }
    return { nakshatra: NAK[n], nakIndex: n, list: list };
  }
  function currentDasha(ds, nowMs) {
    for (var i = 0; i < ds.list.length; i++) {
      var m = ds.list[i];
      if (nowMs >= m.start && nowMs < m.end) {
        for (var j = 0; j < m.subs.length; j++) if (nowMs >= m.subs[j].start && nowMs < m.subs[j].end) return { maha: m, antar: m.subs[j] };
      }
    }
    return null;
  }
  /* Sade Sati: Saturn (sidereal) in 12th, 1st or 2nd sign from natal Moon */
  function sadeSati(moonSignIdx, nowMs) {
    function phaseAt(ms) {
      var t = A.MakeTime(new Date(ms));
      var s = Math.floor(norm(lonOf('Saturn', t) - lahiri(t)) / 30);
      var rel = (s - moonSignIdx + 12) % 12;
      return rel === 11 ? 1 : rel === 0 ? 2 : rel === 1 ? 3 : 0;
    }
    var ph = phaseAt(nowMs);
    if (!ph) {
      var next = null;
      for (var k = 1; k <= 30 * 12; k++) { var ms = nowMs + k * 30 * 86400000; if (phaseAt(ms)) { next = ms; break; } }
      return { phase: 0, next: next };
    }
    var day = 86400000, a = nowMs, b = nowMs;
    while (phaseAt(a - 10 * day) === ph) a -= 10 * day;
    while (phaseAt(b + 10 * day) === ph) b += 10 * day;
    var whole0 = nowMs, whole1 = nowMs;
    while (phaseAt(whole0 - 10 * day)) whole0 -= 10 * day;
    while (phaseAt(whole1 + 10 * day)) whole1 += 10 * day;
    return { phase: ph, start: a, end: b, sadeStart: whole0, sadeEnd: whole1 };
  }

  /* ---------- Ba Zi ---------- */
  var STEMS = ['甲', '乙', '丙', '丁', '戊', '己', '庚', '辛', '壬', '癸'];
  var STEM_BG = I18N.wrap(['Дзя', 'И', 'Бин', 'Дин', 'У', 'Дзи', 'Гън', 'Син', 'Жън', 'Гуей']);
  var BRANCHES = ['子', '丑', '寅', '卯', '辰', '巳', '午', '未', '申', '酉', '戌', '亥'];
  var ANIMALS = I18N.wrap(['Плъх', 'Бик', 'Тигър', 'Заек', 'Дракон', 'Змия', 'Кон', 'Коза', 'Маймуна', 'Петел', 'Куче', 'Прасе']);
  var EL = ['wood', 'fire', 'earth', 'metal', 'water'];
  function stemEl(i) { return EL[Math.floor(i / 2)]; }
  var BRANCH_EL = ['water', 'earth', 'wood', 'wood', 'earth', 'fire', 'fire', 'earth', 'metal', 'metal', 'earth', 'water'];
  var HIDDEN = [[9], [5, 9, 7], [0, 2, 4], [1], [4, 1, 9], [2, 6, 4], [3, 5], [5, 3, 1], [6, 8, 4], [7], [4, 7, 3], [8, 0]];
  var HW = { 1: [1], 2: [0.7, 0.3], 3: [0.6, 0.3, 0.1] };
  function jdn(y, m, d) {
    var a = Math.floor((14 - m) / 12), yy = y + 4800 - a, mm = m + 12 * a - 3;
    return d + Math.floor((153 * mm + 2) / 5) + 365 * yy + Math.floor(yy / 4) - Math.floor(yy / 100) + Math.floor(yy / 400) - 32045;
  }
  function baziYear(sunLon, utcDate) {
    var y = utcDate.getUTCFullYear(), m = utcDate.getUTCMonth();
    /* before Lichun (Sun 315°) in Jan/Feb -> previous year */
    if (m <= 1 && (sunLon < 315 && sunLon >= 270)) y -= 1;
    return y;
  }
  /* produce/control cycles */
  function produces(e) { return EL[(EL.indexOf(e) + 1) % 5]; }
  function producedBy(e) { return EL[(EL.indexOf(e) + 4) % 5]; }
  function controls(e) { return EL[(EL.indexOf(e) + 2) % 5]; }
  function controlledBy(e) { return EL[(EL.indexOf(e) + 3) % 5]; }

  function bazi(utc, lonDeg, sunLon, hasTime) {
    var year = baziYear(sunLon, utc);
    var ys = ((year - 4) % 10 + 10) % 10, yb = ((year - 4) % 12 + 12) % 12;
    var mIdx = Math.floor(norm(sunLon - 315) / 30); /* 0 = 寅 */
    var mb = (mIdx + 2) % 12, ms = (((ys % 5) * 2 + 2) + mIdx) % 10;
    /* local mean solar time */
    var lmt = new Date(utc.getTime() + lonDeg * 4 * 60000);
    var hh = lmt.getUTCHours() + lmt.getUTCMinutes() / 60;
    var dDate = new Date(Date.UTC(lmt.getUTCFullYear(), lmt.getUTCMonth(), lmt.getUTCDate()));
    if (hasTime && hh >= 23) dDate = new Date(dDate.getTime() + 86400000);
    var j = jdn(dDate.getUTCFullYear(), dDate.getUTCMonth() + 1, dDate.getUTCDate());
    var di = ((j + 49) % 60 + 60) % 60, ds = di % 10, db = di % 12;
    var pillars = [{ k: 'year', s: ys, b: yb }, { k: 'month', s: ms, b: mb }, { k: 'day', s: ds, b: db }];
    if (hasTime) {
      var hb = Math.floor((hh + 1) / 2) % 12, hs = ((ds % 5) * 2 + hb) % 10;
      pillars.push({ k: 'hour', s: hs, b: hb });
    }
    /* element weights */
    var w = { wood: 0, fire: 0, earth: 0, metal: 0, water: 0 };
    pillars.forEach(function (p) {
      if (p.k !== 'day') w[stemEl(p.s)] += 1;
      var hid = HIDDEN[p.b], ws = HW[hid.length], mult = p.k === 'month' ? 2 : (p.k === 'day' ? 1.2 : 1);
      hid.forEach(function (st, i) { w[stemEl(st)] += ws[i] * mult; });
    });
    var dm = stemEl(ds);
    var res = producedBy(dm), out = produces(dm), wealth = controls(dm), officer = controlledBy(dm);
    var support = w[dm] + w[res], drain = w[out] + w[wealth] + w[officer];
    /* seasonal state of the day master */
    var monthEl = BRANCH_EL[mb];
    var season = monthEl === dm ? 1.5 : monthEl === res ? 1 : -0.75;
    var ratio = (support + season) / (support + drain + season);
    var strong = ratio >= 0.5;
    var fav = strong ? [out, wealth, officer] : [res, dm];
    if (strong) { fav.sort(function (a, b) { return w[a] - w[b]; }); }
    var unfav = EL.filter(function (e) { return fav.indexOf(e) < 0; });
    unfav.sort(function (a, b) { return w[a] - w[b]; });
    return {
      year: year, pillars: pillars, dm: dm, dmStem: ds, weights: w, ratio: ratio, strong: strong,
      fav: fav, light: unfav[0], avoid: unfav.slice(1), lmt: lmt
    };
  }

  /* ---------- Gua (Kua) ---------- */
  function reduce(n) { while (n > 9) n = String(n).split('').reduce(function (a, c) { return a + +c; }, 0); return n; }
  function gua(year, sex) {
    var s = reduce(year % 100), g;
    if (sex === 'f') g = reduce(s + (year >= 2000 ? 6 : 5));
    else { g = year >= 2000 ? 9 - s : 10 - s; if (g === 0) g = 9; g = reduce(g); }
    if (g === 5) g = sex === 'f' ? 8 : 2;
    return g;
  }
  var GUA_DIRS = I18N.wrap({ 1: ['югоизток', 'изток', 'юг', 'север'], 2: ['североизток', 'запад', 'северозапад', 'югозапад'], 3: ['юг', 'север', 'югоизток', 'изток'], 4: ['север', 'юг', 'изток', 'югоизток'], 6: ['запад', 'североизток', 'югозапад', 'северозапад'], 7: ['северозапад', 'югозапад', 'североизток', 'запад'], 8: ['югозапад', 'северозапад', 'запад', 'североизток'], 9: ['изток', 'югоизток', 'север', 'юг'] });
  var GUA_EL = { 1: 'water', 2: 'earth', 3: 'wood', 4: 'wood', 6: 'metal', 7: 'metal', 8: 'earth', 9: 'fire' };

  /* ---------- Human Design ---------- */
  var GATES = [41, 19, 13, 49, 30, 55, 37, 63, 22, 36, 25, 17, 21, 51, 42, 3, 27, 24, 2, 23, 8, 20, 16, 35, 45, 12, 15, 52, 39, 53, 62, 56, 31, 33, 7, 4, 29, 59, 40, 64, 47, 6, 46, 18, 48, 57, 32, 50, 28, 44, 1, 43, 14, 34, 9, 5, 26, 11, 10, 58, 38, 54, 61, 60];
  function gateLine(lon) {
    var x = norm(lon - 302), i = Math.floor(x / 5.625);
    return { gate: GATES[i], line: Math.floor((x - i * 5.625) / 0.9375) + 1 };
  }
  var CENTER_GATES = {
    head: [64, 61, 63], ajna: [47, 24, 4, 17, 43, 11], throat: [62, 23, 56, 35, 12, 45, 33, 8, 31, 20, 16],
    g: [1, 13, 25, 46, 2, 15, 10, 7], ego: [21, 40, 26, 51], sacral: [5, 14, 29, 59, 9, 3, 42, 27, 34],
    solar: [6, 37, 22, 36, 30, 55, 49], spleen: [48, 57, 44, 50, 32, 28, 18], root: [53, 60, 52, 19, 39, 41, 58, 38, 54]
  };
  var GATE_CENTER = {};
  Object.keys(CENTER_GATES).forEach(function (c) { CENTER_GATES[c].forEach(function (g) { GATE_CENTER[g] = c; }); });
  var CHANNELS = [[1, 8], [2, 14], [3, 60], [4, 63], [5, 15], [6, 59], [7, 31], [9, 52], [10, 20], [10, 34], [10, 57], [11, 56], [12, 22], [13, 33], [16, 48], [17, 62], [18, 58], [19, 49], [20, 34], [20, 57], [21, 45], [23, 43], [24, 61], [25, 51], [26, 44], [27, 50], [28, 38], [29, 46], [30, 41], [32, 54], [34, 57], [35, 36], [37, 40], [39, 55], [42, 53], [47, 64]];
  var HD_BODIES = ['Sun', 'Earth', 'Moon', 'NNode', 'SNode', 'Mercury', 'Venus', 'Mars', 'Jupiter', 'Saturn', 'Uranus', 'Neptune', 'Pluto'];
  function hdPositions(time) {
    var sun = lonOf('Sun', time), node = trueNode(time), out = {};
    HD_BODIES.forEach(function (b) {
      var l = b === 'Sun' ? sun : b === 'Earth' ? norm(sun + 180) : b === 'NNode' ? node : b === 'SNode' ? norm(node + 180) : lonOf(b, time);
      out[b] = gateLine(l);
    });
    return out;
  }
  function humanDesign(utc) {
    var t = A.MakeTime(utc);
    var sun = lonOf('Sun', t);
    var dt = A.SearchSunLongitude(norm(sun - 88), t.AddDays(-96), 16);
    var pers = hdPositions(t), des = hdPositions(dt);
    var gates = {};
    HD_BODIES.forEach(function (b) { gates[pers[b].gate] = 1; gates[des[b].gate] = 1; });
    var chans = CHANNELS.filter(function (c) { return gates[c[0]] && gates[c[1]]; });
    var defined = {}, adj = {};
    chans.forEach(function (c) {
      var a = GATE_CENTER[c[0]], b = GATE_CENTER[c[1]];
      defined[a] = defined[b] = 1;
      (adj[a] = adj[a] || {})[b] = 1; (adj[b] = adj[b] || {})[a] = 1;
    });
    function connected(x, y) {
      if (!defined[x] || !defined[y]) return false;
      var seen = {}, st = [x];
      while (st.length) { var c = st.pop(); if (c === y) return true; if (seen[c]) continue; seen[c] = 1; Object.keys(adj[c] || {}).forEach(function (n) { st.push(n); }); }
      return false;
    }
    var motorToThroat = ['sacral', 'solar', 'ego', 'root'].some(function (m) { return connected(m, 'throat'); });
    var type;
    if (!Object.keys(defined).length) type = 'reflector';
    else if (defined.sacral) type = motorToThroat ? 'mg' : 'generator';
    else type = motorToThroat ? 'manifestor' : 'projector';
    var auth;
    if (type === 'reflector') auth = 'lunar';
    else if (defined.solar) auth = 'emotional';
    else if (defined.sacral) auth = 'sacral';
    else if (defined.spleen) auth = 'splenic';
    else if (defined.ego) auth = 'ego';
    else if (defined.g && connected('g', 'throat')) auth = 'self';
    else auth = 'mental';
    return {
      type: type, authority: auth, profile: pers.Sun.line + '/' + des.Sun.line,
      defined: Object.keys(CENTER_GATES).filter(function (c) { return defined[c]; }),
      open: Object.keys(CENTER_GATES).filter(function (c) { return !defined[c]; }),
      channels: chans, sunGate: pers.Sun.gate, designDate: dt.date
    };
  }

  /* ---------- main ---------- */
  function compute(inp) {
    /* inp: {y,m,d,h,mi,hasTime,lat,lon,tz,sex,now} */
    var hasTime = !!inp.hasTime;
    var lt = localToUTC(inp.y, inp.m, inp.d, hasTime ? inp.h : 12, hasTime ? inp.mi : 0, inp.tz);
    var utc = lt.utc, t = A.MakeTime(utc), nowMs = inp.now || Date.now();
    var sunLon = lonOf('Sun', t), moonLon = lonOf('Moon', t), venusLon = lonOf('Venus', t);
    var west = { sun: sign(sunLon), moon: sign(moonLon), venus: sign(venusLon) };
    var ay = lahiri(t), moonSid = norm(moonLon - ay);
    var vedic = { moon: sign(moonSid), ayanamsa: ay };
    if (hasTime) {
      var an = angles(t, inp.lat, inp.lon);
      west.asc = sign(an.asc); west.mc = sign(an.mc);
      vedic.lagna = sign(an.asc - ay);
    }
    var ds = dashas(moonSid, utc.getTime());
    vedic.nakshatra = ds.nakshatra;
    vedic.dashaList = ds.list;
    vedic.current = currentDasha(ds, nowMs);
    vedic.sadeSati = sadeSati(vedic.moon.i, nowMs);
    var bz = bazi(utc, inp.lon, sunLon, hasTime);
    var g = inp.sex ? gua(bz.year, inp.sex) : null;
    var hd = humanDesign(utc);
    return {
      utc: utc, offset: lt.offset, hasTime: hasTime, west: west, vedic: vedic, bazi: bz,
      gua: g ? { n: g, dirs: GUA_DIRS[g], el: GUA_EL[g], group: [1, 3, 4, 9].indexOf(g) >= 0 ? 'east' : 'west' } : null,
      hd: hd
    };
  }

  return {
    compute: compute, STEMS: STEMS, STEM_BG: STEM_BG, BRANCHES: BRANCHES, ANIMALS: ANIMALS, stemEl: stemEl,
    BRANCH_EL: BRANCH_EL, SIGNS: SIGNS, norm: norm, tzOffsetMinutes: tzOffsetMinutes, localToUTC: localToUTC
  };
})();
if (typeof module !== 'undefined') module.exports = Engine;
