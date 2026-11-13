/* Small drawn references for the line questions: figure, shoulders, hands, face, nose, eyes, lips, height. */
var Icons = (function () {
  var S = 'fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"';
  var F = 'fill="currentColor" fill-opacity=".13" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"';
  function svg(inner) { return '<svg viewBox="0 0 48 60" aria-hidden="true" xmlns="http://www.w3.org/2000/svg">' + inner + '</svg>'; }
  function n(x) { return (+x).toFixed(1); }

  /* sw, ww, hw: half-widths of shoulders, waist, hips; k: height scale; soft: curved outline */
  function body(sw, ww, hw, k, soft) {
    k = k || 1; sw *= Math.sqrt(k); ww *= Math.sqrt(k); hw *= Math.sqrt(k);
    var c = 24, y = function (v) { return n(58 - (58 - v) * k); };
    var L = function (x, v) { return n(c - x) + ',' + y(v); }, R = function (x, v) { return n(c + x) + ',' + y(v); };
    var d = soft
      ? 'M' + L(sw, 16) + ' C' + L(sw, 23) + ' ' + L(ww, 25) + ' ' + L(ww, 30) + ' C' + L(ww, 34) + ' ' + L(hw, 34) + ' ' + L(hw, 39) + ' L' + L(hw * 0.5, 58) + ' L' + R(hw * 0.5, 58) + ' L' + R(hw, 39) + ' C' + R(hw, 34) + ' ' + R(ww, 34) + ' ' + R(ww, 30) + ' C' + R(ww, 25) + ' ' + R(sw, 23) + ' ' + R(sw, 16) + ' Z'
      : 'M' + L(sw, 16) + ' L' + L(ww, 30) + ' L' + L(hw, 39) + ' L' + L(hw * 0.5, 58) + ' L' + R(hw * 0.5, 58) + ' L' + R(hw, 39) + ' L' + R(ww, 30) + ' L' + R(sw, 16) + ' Z';
    return svg('<circle cx="24" cy="' + y(8.6) + '" r="' + n(4.3 * Math.sqrt(k)) + '" ' + F + '/><path d="' + d + '" ' + F + '/>');
  }
  /* w: half-width, drop: slope of the shoulder line */
  function shoulders(w, drop, round) {
    var c = 24, yn = 30, l = c - w, r = c + w, ys = yn + drop;
    var d = 'M' + n(l + 1.5) + ',57 L' + l + ',' + n(ys + (round ? 8 : 0));
    d += round ? ' Q' + n(l + 0.5) + ',' + n(yn + drop * 0.25) + ' ' + (c - 4) + ',' + yn : ' L' + l + ',' + n(ys) + ' L' + (c - 4) + ',' + yn;
    d += ' L' + (c - 4) + ',25 M' + (c + 4) + ',25 L' + (c + 4) + ',' + yn;
    d += round ? ' Q' + n(r - 0.5) + ',' + n(yn + drop * 0.25) + ' ' + r + ',' + n(ys + 8) : ' L' + r + ',' + n(ys);
    d += ' L' + n(r - 1.5) + ',57';
    return svg('<circle cx="24" cy="15" r="8.5" ' + F + '/><path d="' + d + '" ' + S + '/>');
  }
  function hand(pw, ph, fl, soft) {
    var x0 = 25 - pw / 2, yT = 55 - ph, fw = pw / 4, s = '', hs = [0.84, 1, 0.94, 0.72];
    for (var i = 0; i < 4; i++) { var h = fl * hs[i]; s += '<rect x="' + n(x0 + i * fw + 0.5) + '" y="' + n(yT - h) + '" width="' + n(fw - 1) + '" height="' + n(h + 3) + '" rx="' + n((fw - 1) / 2) + '" ' + F + '/>'; }
    s += '<rect x="' + n(x0) + '" y="' + n(yT) + '" width="' + n(pw) + '" height="' + n(ph) + '" rx="' + (soft ? 5 : 2.5) + '" ' + F + '/>';
    s += '<rect x="' + n(x0 - fw * 0.9) + '" y="' + n(yT + 1) + '" width="' + n(fw) + '" height="' + n(ph * 0.75) + '" rx="' + n(fw / 2) + '" transform="rotate(-24 ' + n(x0) + ' ' + n(yT + ph * 0.7) + ')" ' + F + '/>';
    return svg(s);
  }
  var FACE = [
    '<path d="M15,9 L33,9 L37,25 L31,43 L24,51 L17,43 L11,25 Z" ' + F + '/>',
    '<rect x="9" y="10" width="30" height="39" rx="8" ' + F + '/>',
    '<ellipse cx="24" cy="30" rx="12.5" ry="20" ' + F + '/>',
    '<path d="M24,46 L15,33 Q12,17 24,17 Q36,17 33,33 Z" ' + F + '/>',
    '<circle cx="24" cy="30" r="17" ' + F + '/>'
  ];
  var NOSE = [
    'M19,8 L23,23 Q27.5,25 26.5,31 L31,45 L20,48',
    'M19,10 L30,40 Q31.5,46 26,46.5 L15,46.5',
    'M20,12 L28,38 Q28.5,43.5 20,43.5',
    'M21,19 Q22,31 29.5,32.5 Q30.5,39 21,40',
    'M21,18 L24,30 A5,5 0 1 1 22,40'
  ];
  function eye(w, h, h2, t, ir, lash) {
    var d = 'M' + (24 - w) + ',' + (30 + t) + ' Q24,' + (30 - h) + ' ' + (24 + w) + ',' + (30 - t) + ' Q24,' + (30 + h2) + ' ' + (24 - w) + ',' + (30 + t) + ' Z';
    var s = '<path d="' + d + '" ' + F + '/><circle cx="24" cy="' + n(30 - (h - h2) / 4) + '" r="' + ir + '" fill="currentColor" fill-opacity=".55"/>';
    if (lash) s += '<path d="M14,22 L12,18 M20,19 L19,14.5 M28,19 L29,14.5 M34,22 L36,18" ' + S + '/>';
    return svg(s);
  }
  function lips(w, u, l) {
    var a = 24 - w, b = 24 + w;
    return svg('<path d="M' + a + ',30 Q' + n(24 - w / 2) + ',' + n(30 - u * 1.5) + ' 24,' + n(30 - u * 0.6) + ' Q' + n(24 + w / 2) + ',' + n(30 - u * 1.5) + ' ' + b + ',30 Q24,' + n(30 + l * 2) + ' ' + a + ',30 Z" ' + F + '/><path d="M' + a + ',30 Q24,32 ' + b + ',30" ' + S + '/>');
  }
  var SET = {
    0: function (o) { return [body(8, 5.5, 7, 1), body(13, 10.5, 11.5, 0.97), body(10.5, 7.5, 10, 0.9, 1), body(9.5, 7, 9, 0.7, 1), body(10.5, 6, 12.5, 0.82, 1)][o]; },
    1: function (o) { return [shoulders(14, 1.5), shoulders(20, 0.5), shoulders(16.5, 2.5), shoulders(11.5, 3.5), shoulders(15.5, 6, 1)][o]; },
    2: function (o) { return [hand(13, 16, 23), hand(21, 18, 18), hand(16, 15, 17), hand(11.5, 11, 13), hand(15, 12, 11, 1)][o]; },
    3: function (o) { return [body(8.5, 7.5, 8.5), body(13, 12, 13), body(10.5, 7.5, 10.5, 1, 1), body(9.5, 7, 9.5, 0.72, 1), body(11.5, 5.5, 13, 1, 1)][o]; },
    4: function (o) { return [body(8, 6.5, 7.5), body(13.5, 12, 13), body(11.5, 9.5, 11.5, 1, 1), body(10.5, 8.5, 10.5, 0.72, 1), body(12.5, 7, 14.5, 1, 1)][o]; },
    5: function (o) { return svg(FACE[o]); },
    6: function (o) { return svg('<path d="' + NOSE[o] + '" ' + S + '/>'); },
    7: function (o) { return [eye(17, 9, 5, 3, 3.6), eye(14, 9, 6, 0, 4.4), eye(14, 12, 10, 0, 4.8), eye(15, 16, 12, -1, 6, 1), eye(15, 18, 16, 0, 7)][o]; },
    8: function (o) { return [lips(16, 3, 2.5), lips(19, 4, 4), lips(14, 6, 6), lips(10, 7, 6), lips(15, 10, 11)][o]; },
    11: function (o) { return [body(9.5, 7, 9, 1, 1), body(9.5, 7, 9, 0.9, 1), body(9.5, 7, 9, 0.8, 1), body(9.5, 7, 9, 0.7, 1)][o]; }
  };
  return { line: function (q, o) { return SET[q] ? SET[q](o) || '' : ''; } };
})();
if (typeof module !== 'undefined') module.exports = Icons;
