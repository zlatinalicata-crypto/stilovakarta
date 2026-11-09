/* Scoring that runs in the browser: season from answers or photo, line and archetype ranking. */
var Scoring = (function (D) {
  /* ---------- scoring ---------- */
  function seasonFromScores(u, d, c) {
    var s;
    if (u < 0) s = (d + c) >= 0 ? 'winter' : 'summer';
    else if (u > 0) s = (c - 0.7 * d) >= 0 ? 'spring' : 'autumn';
    else s = d > 0 ? (c >= 0 ? 'winter' : 'autumn') : (c >= 0 ? 'spring' : 'summer');
    var axes = { winter: [['cool', -u], ['deep', d], ['bright', c]], summer: [['cool', -u], ['light', -d], ['soft', -c]], spring: [['warm', u], ['light', -d], ['bright', c]], autumn: [['warm', u], ['deep', d], ['soft', -c]] }[s];
    axes.sort(function (a, b) { return b[1] - a[1]; });
    return { season: s, sub: axes[0][0], u: u, d: d, c: c };
  }
  function quizScores(ans, only) {
    var u = 0, d = 0, c = 0;
    ans.forEach(function (a, i) { if (a == null || (only && only.indexOf(i) < 0)) return; var e = D.SEASON_Q[i].a[a][1]; u += e.u || 0; d += e.d || 0; c += e.c || 0; });
    return { u: u, d: d, c: c };
  }
  function seasonFromQuiz(ans) { var q = quizScores(ans); return seasonFromScores(q.u, q.d, q.c); }

  /* ---------- on-device photo: samples are linear RGB [r,g,b] 0..1 ---------- */
  function labLin(r) {
    var x = (r[0] * 0.4124 + r[1] * 0.3576 + r[2] * 0.1805) / 0.95047, y = r[0] * 0.2126 + r[1] * 0.7152 + r[2] * 0.0722, z = (r[0] * 0.0193 + r[1] * 0.1192 + r[2] * 0.9505) / 1.08883;
    function f(t) { return t > 0.008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116; }
    var L = 116 * f(y) - 16, a = 500 * (f(x) - f(y)), b = 200 * (f(y) - f(z));
    return { L: L, a: a, b: b, C: Math.sqrt(a * a + b * b), h: (Math.atan2(b, a) * 180 / Math.PI + 360) % 360, Y: y };
  }
  function linToHex(r) {
    return '#' + r.map(function (v) { v = Math.max(0, Math.min(1, v)); v = v <= 0.0031308 ? 12.92 * v : 1.055 * Math.pow(v, 1 / 2.4) - 0.055; return ('0' + Math.round(v * 255).toString(16)).slice(-2); }).join('');
  }
  function clamp(x, a, b) { return Math.max(a, Math.min(b, x)); }
  /* ph: {skin,eye,hair,white?} linear RGB; returns corrected colours and scores */
  function photoScores(ph) {
    var wb = null;
    if (ph.white) {
      var w = ph.white, m = (w[0] + w[1] + w[2]) / 3, Yw = labLin(w).Y;
      if (Yw > 0.05) wb = [m / w[0], m / w[1], m / w[2]].map(function (k) { return k * 0.9 / Yw; });
    }
    function fix(r) { return wb ? [r[0] * wb[0], r[1] * wb[1], r[2] * wb[2]] : r; }
    var sk = labLin(fix(ph.skin)), ey = labLin(fix(ph.eye)), ha = labLin(fix(ph.hair));
    var u = clamp((sk.h - 56) / 10, -1, 1) * (wb ? 1 : 0.5);
    var depth = 0.5 * ha.L + 0.3 * ey.L + 0.2 * sk.L;
    var d = clamp((52 - depth) / 14, -1.5, 1.5);
    var K = Math.max(Math.abs(sk.L - ha.L), Math.abs(sk.L - ey.L) * 0.8);
    var c = clamp((K - 30) / 15, -1.5, 1.5) + clamp((ey.C - 14) / 12, -0.6, 0.6);
    return { u: u, d: d, c: c, contrast: K, wb: !!wb,
      hex: { skin: linToHex(fix(ph.skin)), eye: linToHex(fix(ph.eye)), hair: linToHex(fix(ph.hair)) } };
  }

  function lineRank(ans) {
    var v = [0, 0, 0, 0, 0], n = 0, h = null;
    ans.forEach(function (a, i) {
      if (a == null) return;
      if (D.LINE_Q[i].height) { h = a; return; }
      v[a] += 1; n++;
    });
    if (!n) return [];
    var norm = Math.sqrt(v.reduce(function (s, x) { return s + x * x; }, 0));
    return D.LINE_KEYS.map(function (k) {
      var p = D.LINE_PROTO[k], pn = Math.sqrt(p.reduce(function (s, x) { return s + x * x; }, 0));
      var sim = v.reduce(function (s, x, i) { return s + x * p[i]; }, 0) / (norm * pn);
      var fam = D.LINES[k].fam;
      if (h === 0 && (fam === 'Гамин' || fam === 'Романтик')) sim *= 0.85;
      if (h === 3 && (fam === 'Драматик' || k === 'fn' || k === 'n')) sim *= 0.85;
      if (h === 3 && k === 'dc') sim *= 0.92;
      return { k: k, s: sim };
    }).sort(function (a, b) { return b.s - a.s; });
  }
  function archRank(ans) {
    var s = {};
    D.ARCH_KEYS.forEach(function (k) { s[k] = 0; });
    ans.forEach(function (k, i) { if (k) s[k] += D.ARCH_Q[i].w; });
    var last = ans[ans.length - 1];
    var total = D.ARCH_Q.reduce(function (t, q) { return t + q.w; }, 0);
    var order = D.ARCH_KEYS.slice().sort(function (a, b) { return (s[b] - s[a]) || ((b === last) - (a === last)) || (D.ARCH_KEYS.indexOf(a) - D.ARCH_KEYS.indexOf(b)); });
    return { order: order, scores: s, total: total };
  }

  return { seasonFromScores: seasonFromScores, quizScores: quizScores, seasonFromQuiz: seasonFromQuiz, photoScores: photoScores, lineRank: lineRank, archRank: archRank };
})(typeof DATA !== 'undefined' ? DATA : require('./data.js'));
if (typeof module !== 'undefined') module.exports = Scoring;
