/* Palette logic: colour math, weighting by Ba Zi, formulas, scoring. */
var Pal = (function (D) {
  /* ---------- colour math ---------- */
  function hexToRgb(h) { var n = parseInt(h.slice(1), 16); return [n >> 16, (n >> 8) & 255, n & 255]; }
  function lin(c) { c /= 255; return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4); }
  function lab(hex) {
    var r = hexToRgb(hex).map(lin);
    var x = (r[0] * 0.4124 + r[1] * 0.3576 + r[2] * 0.1805) / 0.95047;
    var y = (r[0] * 0.2126 + r[1] * 0.7152 + r[2] * 0.0722);
    var z = (r[0] * 0.0193 + r[1] * 0.1192 + r[2] * 0.9505) / 1.08883;
    function f(t) { return t > 0.008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116; }
    var L = 116 * f(y) - 16, a = 500 * (f(x) - f(y)), b = 200 * (f(y) - f(z));
    return { L: L, a: a, b: b, C: Math.sqrt(a * a + b * b) };
  }
  function dE(h1, h2) { var p = lab(h1), q = lab(h2); return Math.sqrt(Math.pow(p.L - q.L, 2) + Math.pow(p.a - q.a, 2) + Math.pow(p.b - q.b, 2)); }
  function isLight(hex) { return lab(hex).L > 62; }

  /* ---------- tiers ---------- */
  function tierOf(el, bz) {
    if (!bz) return 'season';
    if (bz.fav[0] === el) return 'fav1';
    if (bz.fav.indexOf(el) >= 0) return 'fav';
    if (bz.light === el) return 'light';
    return 'avoid';
  }
  var TIER = { fav1: 'подсилва', fav: 'подсилва', light: 'малко', avoid: 'избягвай', dose: 'дозирано', season: 'сезонен' };
  function good(c) { return c.tier === 'fav1' || c.tier === 'fav' || c.tier === 'season'; }

  /* ---------- palette ---------- */
  function build(seasonKey, bz) {
    var S = D.SEASONS[seasonKey];
    var cols = S.colors.map(function (c, i) { return { name: c[0], hex: c[1], el: c[2], role: c[3], fam: c[4], i: i, tier: tierOf(c[2], bz) }; });
    function rank(c) { return bz ? bz.fav.indexOf(c.el) : 0; }
    var leftovers = [];
    function pick(role, max, min, oneLight) {
      var all = cols.filter(function (c) { return c.role === role; });
      if (!bz) return all.slice(0, max);
      var ok = all.filter(good).sort(function (a, b) { return rank(a) - rank(b) || a.i - b.i; });
      var chosen = ok.slice(0, max);
      leftovers = leftovers.concat(ok.slice(max));
      var lights = all.filter(function (c) { return c.tier === 'light'; }).sort(function (a, b) { return lab(b.hex).L - lab(a.hex).L; });
      if (oneLight && lights.length) chosen.push(lights.shift());
      while (chosen.length < min && lights.length) chosen.push(lights.shift());
      var av = all.filter(function (c) { return c.tier === 'avoid'; }).sort(function (a, b) { return bz.weights[a.el] - bz.weights[b.el]; });
      while (chosen.length < min && av.length) { var x = Object.assign({}, av.shift(), { tier: 'dose' }); chosen.push(x); }
      return chosen.sort(function (a, b) { return a.i - b.i; });
    }
    var base = pick('base', 5, 3, false);
    var face = pick('face', 5, 3, true);
    var accent = pick('accent', 6, 4, false);
    var test = leftovers.filter(function (c) { return c.role === 'accent'; })
      .concat(cols.filter(function (c) { return c.role === 'test' && good(c); })).slice(0, 4);
    var chosen = base.concat(face, accent);
    var allowed = chosen.filter(function (c) { return c.tier !== 'avoid'; });

    /* stones and metal */
    var temp = S.cool ? 'cool' : 'warm';
    var stones = D.STONES.map(function (s) { return { name: s[0], hex: s[1], el: s[2], temp: s[3], tier: tierOf(s[2], bz) }; })
      .filter(function (s) { return (s.temp === 'both' || s.temp === temp) && good(s); })
      .sort(function (a, b) { return (bz ? bz.fav.indexOf(a.el) - bz.fav.indexOf(b.el) : 0); });
    var seen = {}, st = [];
    stones.forEach(function (s) { if (st.length < 4 && (!seen[s.el] || seen[s.el] < 2)) { st.push(s); seen[s.el] = (seen[s.el] || 0) + 1; } });
    var metalTier = tierOf('metal', bz);
    var metal = { name: S.metal.charAt(0).toUpperCase() + S.metal.slice(1), hex: S.metalHex, el: 'metal', tier: metalTier };

    /* signature */
    function firstOf(list, el) { for (var i = 0; i < list.length; i++) if (list[i].el === el && good(list[i])) return list[i]; return null; }
    var b1 = bz ? (firstOf(base, bz.fav[0]) || base[0]) : base[0];
    var b2 = bz && bz.fav[1] ? firstOf(base, bz.fav[1]) : base[1];
    if (b2 === b1) b2 = null;
    var f1 = face.filter(good)[0] || face[0];
    var lc = function (s) { return s.toLowerCase(); };
    var jewel = (metalTier === 'light' || metalTier === 'avoid') && st[0] ? lc(st[0].name) + ' вместо метал' : lc(S.metal) + (st[0] ? ' и ' + lc(st[0].name) : '');
    var dark = seasonKey === 'winter' || seasonKey === 'autumn';
    var signature = (dark ? 'Тъмна основа' : 'Основа') + ' в цвят ' + lc(b1.name) + (b2 ? ' или ' + lc(b2.name) : '') + ', ' + lc(f1.name) + ' до лицето, ' + jewel + '.';

    var removed = S.classic.filter(function (n) { return !allowed.some(function (c) { return c.name === n; }); });

    return { season: seasonKey, S: S, base: base, face: face, accent: accent, test: test, stones: st, metal: metal, metalTier: metalTier,
      signature: signature, removed: removed, all: allowed, sig: { b1: b1, b2: b2, f1: f1 } };
  }

  /* ---------- formulas ---------- */
  function formulas(p, bz, hd) {
    var bases = p.base.filter(good), faces = p.face.filter(good), accs = p.accent.filter(good);
    if (!bases.length) bases = p.base; if (!faces.length) faces = p.face; if (!accs.length) accs = p.accent;
    var fireOk = !bz || bz.fav.indexOf('fire') >= 0;
    var eb = (fireOk && bases.filter(function (c) { return c.el === 'fire'; })[0]) || bases[0];
    var ef = faces[0];
    var ea = accs.filter(function (c) { return c.el !== eb.el; })[0] || accs[0];
    var db = bases.filter(function (c) { return c !== eb && (!bz || c.el === bz.fav[0]); })[0] || bases.filter(function (c) { return c !== eb; })[0] || eb;
    var df = faces.filter(function (c) { return c.el === db.el && c !== ef; })[0] || faces[1] || ef;
    var out = [
      { k: 'expo', title: 'Изява', parts: [[eb, 60], [ef, 30], [ea, 10]] },
      { k: 'daily', title: 'Работа и всекидневие', parts: [[db, 55], [df, 35], [ef, 10]] }
    ];
    if (hd && hd.authority === 'emotional') {
      var used = [eb, db];
      var hb = bases.filter(function (c) { return used.indexOf(c) < 0; }).sort(function (a, b) { return lab(a.hex).C - lab(b.hex).C; })[0] || db;
      var hf = faces.filter(function (c) { return c !== ef && c !== df; }).sort(function (a, b) { return lab(a.hex).C - lab(b.hex).C; })[0] || df;
      var ha = accs.filter(function (c) { return !bz || c.el === bz.fav[0]; })[0] || accs[0];
      var lb = bases.slice().sort(function (a, b) { return lab(b.hex).a - lab(a.hex).a; })[0];
      var lf = faces.slice().sort(function (a, b) { return lab(b.hex).a - lab(a.hex).a; })[0];
      var la = accs.slice().sort(function (a, b) { return (lab(b.hex).a + lab(b.hex).b * 0.5) - (lab(a.hex).a + lab(a.hex).b * 0.5); })[0];
      out.push({ k: 'high', title: 'Висока вълна: заземи', parts: [[hb, 60], [hf, 30], [ha, 10]] });
      out.push({ k: 'low', title: 'Ниска вълна: стопли', parts: [[lb, 50], [lf, 35], [la, 15]] });
    }
    return out;
  }

  /* ---------- replacements ---------- */
  function replacements(p) {
    var res = [];
    D.ITEMS.forEach(function (it) {
      var inPal = p.all.some(function (c) { return dE(c.hex, it[1]) < 14; });
      if (inPal) return;
      var pool = p.all.filter(function (c) { return c.role === it[2] && c.tier !== 'dose'; });
      if (!pool.length) pool = p.all;
      var best = pool.slice().sort(function (a, b) { return dE(a.hex, it[1]) - dE(b.hex, it[1]); }).slice(0, 2);
      res.push({ item: it[0], hex: it[1], to: best });
    });
    return res;
  }

  /* ---------- chart colours ---------- */
  function famColors(fams, p, n) {
    var out = [];
    fams.forEach(function (f) {
      p.all.forEach(function (c) { if (out.length < (n || 3) && c.fam.indexOf(f) >= 0 && out.indexOf(c) < 0 && c.tier !== 'dose') out.push(c); });
    });
    return out;
  }

  return { lab: lab, dE: dE, isLight: isLight, tierOf: tierOf, TIER: TIER, good: good, build: build, formulas: formulas,
    replacements: replacements, famColors: famColors };
})(typeof DATA !== 'undefined' ? DATA : require('./data.js'));
if (typeof module !== 'undefined') module.exports = Pal;
