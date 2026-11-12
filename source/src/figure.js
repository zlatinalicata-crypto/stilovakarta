/* Drawn fashion figures and pattern tiles, as inline SVG. Runs where the report runs. */
var Figure = (function () {
  var INK = 'rgba(40,34,44,.55)', FLOOR = 'rgba(40,34,44,.12)';
  var male = false;
  /* the male figure is the same drawing with wider shoulders and a straighter waist */
  function k(y) { return y <= 70 ? 1.2 : y <= 105 ? 1.2 - (y - 70) / 35 * 0.04 : y <= 135 ? 1.16 - (y - 105) / 30 * 0.14 : 1.02; }
  function T(p) { return male ? [+(60 - (60 - p[0]) * k(p[1])).toFixed(2), p[1]] : p; }
  var X = function (x) { return +(120 - x).toFixed(2); };
  var pt = function (p) { p = T(p); return p[0] + ',' + p[1]; };
  var poly = function (a) { return 'M' + a.map(pt).join(' L') + ' Z'; };
  var mir = function (a) { return a.map(function (p) { return [X(p[0]), p[1]]; }); };
  var sym = function (a) { return poly(a.concat(mir(a).reverse())); };
  var pl = function (a) { return 'M' + a.map(pt).join(' L'); };
  var shp = function (d, c) { return '<path d="' + d + '" fill="' + c + '" stroke="' + INK + '" stroke-width=".5" stroke-linejoin="round"/>'; };
  var pair = function (a, c) { return shp(poly(a), c) + shp(poly(mir(a)), c); };
  var det = function (d, c, w) { return '<path d="' + d + '" fill="none" stroke="' + (c || INK) + '" stroke-width="' + (w || 0.5) + '" stroke-linecap="round" stroke-linejoin="round"/>'; };
  var limb = function (a, w, c) { return '<path d="' + pl(a) + '" fill="none" stroke="' + INK + '" stroke-linecap="round" stroke-linejoin="round" stroke-width="' + (w + 1.2).toFixed(1) + '"/><path d="' + pl(a) + '" fill="none" stroke-linecap="round" stroke-linejoin="round" stroke="' + c + '" stroke-width="' + w + '"/>'; };
  var limbs = function (a, w, c) { return limb(a, w, c) + limb(mir(a), w, c); };
  function shade(h, f) { var n = parseInt(h.slice(1), 16), r = n >> 16, g = (n >> 8) & 255, b = n & 255, t = f < 0 ? 0 : 255, p = Math.abs(f); r = Math.round(r + (t - r) * p); g = Math.round(g + (t - g) * p); b = Math.round(b + (t - b) * p); return '#' + ((1 << 24) | (r << 16) | (g << 8) | b).toString(16).slice(1); }
  function lum(h) { var n = parseInt(h.slice(1), 16); return (0.299 * (n >> 16) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255)) / 255; }
  var lapel = function (c) { return lum(c) < 0.2 ? shade(c, 0.12) : shade(c, -0.12); };

  var LEG = [[46, 130], [47.5, 160], [48.8, 198], [48.5, 222], [51.8, 256], [56.6, 256], [57.6, 222], [57.6, 198], [59.4, 160], [59.8, 140], [59, 130]];
  var ARM = [[47, 53], [41, 100], [38.6, 139]];
  var HAND = [[36.4, 139], [40.6, 139], [40.8, 146], [39.2, 151.6], [37, 151.2], [35.9, 146]];
  var TORSO = [[60, 44], [55.5, 44], [43.5, 49], [46, 63], [45.5, 74], [50, 101], [46, 128], [60, 130]];
  var NECKP = [[56, 30], [64, 30], [64.4, 47], [55.6, 47]];
  var SHOES = {
    pump: [[51.6, 254], [57, 254], [57.2, 262], [55, 269], [52.2, 274.2], [50.8, 268.6], [51.2, 261]],
    flat: [[51.6, 255], [57, 255], [57.2, 263], [55.4, 269.6], [52.6, 273.2], [51, 268.8], [51.2, 262]],
    ankle: [[50.9, 236], [57.8, 236], [57.4, 262], [55, 269], [52.2, 274.2], [50.8, 268.6], [50.8, 254]],
    knee: [[48.4, 195], [57.9, 195], [57.6, 222], [57.2, 262], [55, 269], [52.2, 274.2], [50.8, 268.6], [51.4, 256], [48.2, 222]]
  };
  var NECKS = {
    crew: [[60, 47.6], [55.2, 44.6], [43.5, 49]],
    turtle: [[60, 37.6], [55, 37.4], [55.2, 44.6], [43.5, 49]],
    vneck: [[60, 68], [54.6, 44.8], [43.5, 49]],
    wrap: [[60, 77], [54.6, 44.8], [43.5, 49]],
    shirt: [[60, 63], [55.4, 44.8], [43.5, 49]],
    boat: [[60, 46.2], [51.5, 44.8], [43.5, 49]],
    cami: [[60, 73], [52.6, 61], [52.4, 47.4], [51, 47.4], [50.6, 61], [47, 62.4]]
  };
  function bodice(n) { var a = NECKS[n].slice(); if (n !== 'cami') a.push([46, 63]); a.push([45.5, 74], [50, 101]); return a; }
  var SLV = { long: [[46, 55], [40.8, 100], [38.5, 137.5]], three: [[46, 55], [40.8, 100], [39.7, 118]], short: [[46, 55], [44.5, 69]] };
  var OSL = { long: [[45.4, 56], [40.4, 100], [38.2, 137.5]], three: [[45.4, 56], [40.4, 100], [39.4, 121]] };
  var SKIRT = {
    sheath: [[45.4, 128], [45, 136], [47.6, 206], [60, 206.5]],
    aline: [[46.2, 122], [38.6, 232], [60, 234]],
    column: [[45, 130], [45.3, 200], [46, 263], [60, 263]],
    shirtdress: [[45.4, 128], [43.6, 218], [60, 219]]
  };
  var BOT = {
    wide: [[60, 99.5], [50, 99.5], [45, 130], [40.8, 263], [57.6, 263], [60, 147]],
    straight: [[60, 99.5], [50, 99.5], [45, 130], [45.4, 263], [57.6, 263], [60, 147]],
    slim: [[60, 99.5], [50, 99.5], [45, 130], [47.6, 164], [48.4, 198], [48.2, 222], [51.2, 258], [57, 258], [57.9, 222], [57.8, 198], [59.4, 162], [60, 147]],
    pencil: [[60, 99.5], [50, 99.5], [45.2, 128], [45, 136], [47.6, 206], [60, 206.5]],
    midi: [[60, 99.5], [50, 99.5], [45.2, 128], [44.2, 236], [60, 237]],
    pleat: [[60, 99.5], [50, 99.5], [42.6, 140], [37.6, 233], [60, 235]]
  };
  var OUT = {
    blazer: [[55.5, 44.4], [41.4, 48.2], [44.6, 62.5], [44.4, 80], [47.2, 102], [43.8, 140], [60.6, 141], [60.6, 100], [57.2, 98], [56.9, 52]],
    coat: [[55.5, 44.4], [41.8, 48.4], [44.8, 62.5], [44.4, 80], [46.4, 102], [43, 140], [41.6, 213], [54, 214], [55.2, 140], [55.6, 98], [56.9, 52]],
    duster: [[55.5, 44.4], [43.2, 49], [45.2, 63], [44.8, 100], [42.4, 150], [40.6, 229], [53.2, 230], [54.2, 150], [55.2, 98], [56.9, 52]],
    cardigan: [[55.5, 44.4], [43.4, 49], [45.4, 63], [45, 100], [44, 132], [43.6, 166], [54.2, 166.6], [55.2, 132], [55.4, 98], [56.9, 52]],
    moto: [[55.5, 44.4], [42, 48.6], [44.8, 62.5], [45, 82], [48.4, 103], [48.6, 113], [61, 113.5], [61.2, 60], [56.9, 52]]
  };
  var LAP = {
    blazer: [[55.5, 44.4], [49.4, 53], [51.4, 58.2], [49.8, 61.6], [57.2, 98], [56.9, 52]],
    coat: [[55.5, 44.4], [49, 53.4], [51, 58.6], [49.4, 62], [55.6, 98], [56.9, 52]],
    duster: [[55.5, 44.4], [51.6, 50.5], [51.4, 80], [53.4, 124], [54.6, 124], [55.2, 98], [56.9, 52]],
    moto: [[55.5, 44.4], [46.6, 55], [53, 64.5], [57.6, 58]]
  };
  var CAP = 'M50.4,25.6 C49.6,4 70.4,4 69.6,25.6 C68.2,17.6 63.6,15.2 58.8,16 C54.8,16.8 52,20.6 50.4,25.6 Z';
  var CAP_M = 'M50.6,22 C49.8,5 70.2,5 69.4,22 C67.6,15.4 63,13.6 58.6,14.2 C54.6,14.8 52,17.6 50.6,22 Z';
  var STRANDS = {
    long: [[51.4, 19], [49.1, 30], [48.4, 52], [49.2, 77], [53.4, 75.5], [52.6, 52], [52.5, 32], [54.2, 21]],
    waves: [[51.4, 19], [48.8, 31], [50, 42], [47.8, 54], [49.6, 66], [48.4, 79], [53.2, 77], [53.8, 66], [52.4, 54], [53.8, 42], [52.6, 31], [54.2, 21]],
    verylong: [[51.4, 19], [49, 30], [48.2, 60], [48.6, 96], [53, 94], [52.4, 60], [52.5, 32], [54.2, 21]],
    bob: [[51, 19], [49.4, 29], [49.2, 37.5], [53.6, 38.2], [52.6, 29], [54, 21]]
  };
  var SIDE = [[51.4, 19], [49.2, 30], [49.8, 40], [47.6, 58], [49.4, 84], [53.6, 82], [52.4, 60], [54.4, 40], [54.2, 24]];

  function rawPoly(a) { return 'M' + a.map(function (p) { return p[0] + ',' + p[1]; }).join(' L') + ' Z'; }
  function rawPair(a, c) { return shp(rawPoly(a), c) + shp(rawPoly(mir(a)), c); }
  function hairBack(h, c) {
    if (h === 'bun') return '<circle cx="69.4" cy="29.6" r="4.4" fill="' + c + '" stroke="' + INK + '" stroke-width=".5"/>';
    if (h === 'pony') return shp('M66.4,12.6 C75.6,13.6 77.4,24 74.8,36 C73.8,41.6 71.6,45.2 69.6,46.8 C71.2,38 70.4,26 66,19 Z', c);
    return '';
  }
  function hairFront(h, c) {
    var s = '';
    if (h === 'short') return shp(CAP_M, c);
    if (STRANDS[h]) s += rawPair(STRANDS[h], c);
    if (h === 'side') s += shp(rawPoly(SIDE), c);
    return s + shp(CAP, c);
  }
  function sleeves(sl, c) { return !sl || sl === 'none' ? '' : limbs(SLV[sl], sl === 'short' ? 9 : 8.2, c); }
  function neckDet(n, c) {
    if (n === 'turtle') return det('M55.1,41.4 Q60,42.4 64.9,41.4');
    if (n === 'wrap') return det('M65.4,45 Q60.5,80 50.6,102.5');
    if (n === 'shirt') {
      var col = [[55.4, 44.2], [50.6, 47.2], [55.2, 57.6], [58.4, 53.6]];
      return pair(col, shade(c, -0.06)) + det('M60,63 L60,104') + [71, 82, 93].map(function (y) { return '<circle cx="60" cy="' + y + '" r=".7" fill="' + INK + '"/>'; }).join('');
    }
    return '';
  }
  function top(t) {
    var pts = bodice(t.n).concat(t.out ? [[46.6, 118], [47, 121.5], [60, 121.5]] : [[50, 105], [60, 105]]);
    return sleeves(t.sl, t.c) + shp(sym(pts), t.c) + neckDet(t.n, t.c);
  }
  function bottom(b) {
    var s = shp(sym(BOT[b.t]), b.c) + det('M50.1,103.4 L69.9,103.4');
    if (b.t === 'wide') s += det('M52.6,106 L49.2,261') + det('M67.4,106 L70.8,261');
    if (b.t === 'straight') s += det('M52.6,106 L51.6,261') + det('M67.4,106 L68.4,261');
    if (b.t === 'pencil') s += det('M60,206 L60,193');
    if (b.t === 'midi') s += det('M53.5,106 Q51.6,170 51.2,234', 'rgba(255,255,255,.32)', 1.3);
    if (b.t === 'pleat') s += ['M55.2,104 L50.6,233', 'M51.6,110 L44,232', 'M64.8,104 L69.4,233', 'M68.4,110 L76,232'].map(function (d) { return det(d); }).join('');
    return s;
  }
  function dress(d) {
    var s = sleeves(d.sl, d.c) + shp(sym(bodice(d.n).concat(SKIRT[d.s])), d.c) + neckDet(d.n, d.c);
    if (d.s === 'shirtdress') s += det('M60,104 L60,218');
    if (d.s === 'sheath' || (d.s === 'column' && d.n !== 'cami')) s += det('M50.3,101.4 Q60,102.4 69.7,101.4');
    if (d.s === 'aline') s += det('M50.3,101.4 L69.7,101.4') + det('M54.6,104 L49.4,231') + det('M65.4,104 L70.6,231');
    if (d.sheen) s += det('M53.4,106 Q51.6,180 52.4,259', 'rgba(255,255,255,.28)', 1.4) + det('M66.6,106 Q68.4,180 67.6,259', 'rgba(255,255,255,.16)', 1);
    return s;
  }
  function belt(b, wide, jewel) {
    var x1 = wide ? 46.6 : 49.6, h = b.thin ? 2.4 : 4.6, y = wide ? 99.4 : 99;
    return shp(poly([[x1, y], [X(x1), y], [X(x1), y + h], [x1, y + h]]), b.c) + '<rect x="57.8" y="' + (y - 0.4).toFixed(1) + '" width="4.4" height="' + (h + 0.8).toFixed(1) + '" fill="none" stroke="' + jewel + '" stroke-width=".7"/>';
  }
  function outer(o, jewel) {
    var s = limbs(o.sl === 'three' ? OSL.three : OSL.long, 9.4, o.c);
    s += pair(OUT[o.t], o.c);
    if (LAP[o.t]) s += pair(LAP[o.t], lapel(o.c));
    if (o.t === 'blazer') s += '<circle cx="60" cy="104" r="1.2" fill="' + shade(o.c, -0.35) + '"/>' + det('M47.4,121 L54.4,121') + det('M65.6,121 L72.6,121');
    if (o.t === 'coat') s += det('M45.2,152 L52.4,152') + det('M67.6,152 L74.8,152');
    if (o.t === 'moto') s += det('M66.6,53 L61.6,72 L60.8,112.6', '#D9D2C6', 0.8) + det('M48.6,108.6 L71.4,108.6');
    if (o.t === 'cardigan') s += det('M55.4,54 L54.1,98 L52.9,165') + det('M64.6,54 L65.9,98 L67.1,165');
    return s;
  }
  function necklace(n, g) {
    if (n.t === 'pendant') return det('M55.8,45.6 Q60,68.4 64.2,45.6', g, 0.6) + '<circle cx="60" cy="58.2" r="1.5" fill="' + g + '" stroke="' + INK + '" stroke-width=".3"/>';
    if (n.t === 'long') return det('M55.4,45.4 Q60,142 64.6,45.4', g, 0.6) + '<path d="M60,93 L62.2,96.6 L60,100.2 L57.8,96.6 Z" fill="' + g + '" stroke="' + INK + '" stroke-width=".3"/>';
    return '';
  }
  function ears(t, g) {
    return [51.1, 68.9].map(function (x) {
      if (t === 'stud') return '<circle cx="' + x + '" cy="27" r="1.1" fill="' + g + '"/>';
      return det('M' + x + ',26.6 L' + x + ',31', g, 0.5) + '<path d="M' + x + ',31 L' + (x + 1.4).toFixed(1) + ',33.4 L' + x + ',35.8 L' + (x - 1.4).toFixed(1) + ',33.4 Z" fill="' + g + '"/>';
    }).join('');
  }
  function bag(b) {
    var c = b.c;
    if (b.t === 'structured') return det('M76.6,151 Q81.8,138.5 87,151', c, 1.5) + shp(rawPoly([[72.6, 151], [91, 151], [92.6, 171.5], [71, 171.5]]), c) + det('M72.4,156.4 L91.3,156.4');
    if (b.t === 'tote') return det('M74.4,149 Q82,134 89.6,149', c, 1.4) + shp(rawPoly([[70, 149], [94, 149], [95.4, 179], [68.6, 179]]), c);
    if (b.t === 'clutch') return shp(rawPoly([[74, 141], [90.4, 141], [90.4, 150.6], [74, 150.6]]), c) + det('M74,141 L82.2,146.6 L90.4,141');
    if (b.t === 'cross') return det('M72,50.5 L49.6,121.5', c, 1) + shp(rawPoly([[41, 120.6], [53.6, 120.6], [54.2, 132.6], [40.4, 132.6]]), c) + det('M41,124.6 L53.8,124.6');
    return '';
  }
  function scarf(c) { return shp(rawPoly([[54.6, 38], [65.4, 38], [66.2, 46.5], [53.8, 46.5]]), c) + shp(rawPoly([[61, 45.5], [66, 45.5], [66.6, 78], [62, 78]]), c) + det('M62.4,74 L66.2,74'); }

  var esc = function (s) { return String(s).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;'); };
  /* o: outfit {top,bottom,dress,outer,belt,shoes,neck,ear,bag,scarf}; opt: {male,skin,hair,hairStyle,jewel,label} */
  function figure(o, opt) {
    male = !!opt.male;
    var skin = opt.skin || '#E5C8B3', hair = opt.hair || '#3A2924', g = opt.jewel || '#B7BBC4', hs = male ? 'short' : (opt.hairStyle || 'bob');
    var s = '<ellipse cx="60" cy="274.4" rx="17" ry="2.2" fill="' + FLOOR + '"/>';
    s += hairBack(hs, hair);
    s += pair(LEG, skin) + pair(SHOES[o.shoes.t], o.shoes.c);
    s += limbs(ARM, male ? 7 : 6.2, skin) + pair(HAND, skin);
    s += shp(sym(TORSO), skin) + shp(rawPoly(NECKP), skin) + '<ellipse cx="60" cy="23" rx="9" ry="12.4" fill="' + skin + '" stroke="' + INK + '" stroke-width=".5"/>';
    if (o.dress) s += dress(o.dress);
    else { var t = top(o.top), b = bottom(o.bottom); s += o.top.out ? b + t : t + b; }
    if (o.belt) s += belt(o.belt, false, g);
    if (o.neck) s += necklace(o.neck, g);
    if (o.outer) s += outer(o.outer, g);
    if (o.scarf) s += scarf(o.scarf);
    s += hairFront(hs, hair);
    if (o.ear) s += ears(o.ear, g);
    if (o.bag) s += bag(o.bag);
    male = false;
    return '<svg viewBox="24 2 72 276" role="img" aria-label="' + esc(opt.label || '') + '" xmlns="http://www.w3.org/2000/svg">' + s + '</svg>';
  }

  /* pattern tile, 60x60, in two colours */
  function tile(kind, a, b) {
    var s = '<rect width="60" height="60" fill="' + a + '"/>', i, j;
    if (kind === 'geo') s += '<path d="M0,0 L34,0 L0,34 Z M60,14 L60,60 L14,60 Z" fill="' + b + '"/><path d="M38,0 L60,0 L60,10 Z" fill="' + shade(a, lum(a) < 0.4 ? 0.25 : -0.25) + '"/>';
    else if (kind === 'stripe') { for (i = 6; i < 60; i += 24) s += '<rect x="' + i + '" width="11" height="60" fill="' + b + '"/>'; }
    else if (kind === 'fine') { for (i = 3; i < 60; i += 7) s += '<rect x="' + i + '" width="1.6" height="60" fill="' + b + '"/>'; }
    else if (kind === 'check') { for (i = 0; i < 60; i += 20) s += '<rect x="' + (i + 6) + '" width="7" height="60" fill="' + b + '" opacity=".6"/><rect y="' + (i + 6) + '" width="60" height="7" fill="' + b + '" opacity=".6"/>'; }
    else if (kind === 'polka') { for (i = 0; i < 4; i++) for (j = 0; j < 4; j++) s += '<circle cx="' + (8 + i * 15 + (j % 2 ? 7.5 : 0)) + '" cy="' + (8 + j * 15) + '" r="3.4" fill="' + b + '"/>'; }
    else if (kind === 'floral') {
      [[10, 11], [33, 7], [52, 18], [20, 30], [44, 36], [8, 48], [30, 52], [53, 53]].forEach(function (p) {
        for (i = 0; i < 5; i++) { var an = i * 1.2566; s += '<circle cx="' + (p[0] + Math.cos(an) * 2.6).toFixed(1) + '" cy="' + (p[1] + Math.sin(an) * 2.6).toFixed(1) + '" r="1.7" fill="' + b + '"/>'; }
        s += '<circle cx="' + p[0] + '" cy="' + p[1] + '" r="1.1" fill="' + a + '"/>';
      });
    }
    else if (kind === 'blobs') [[14, 16, 13], [42, 12, 10], [50, 40, 14], [20, 46, 12], [32, 30, 8]].forEach(function (p) { s += '<circle cx="' + p[0] + '" cy="' + p[1] + '" r="' + p[2] + '" fill="' + b + '" opacity=".45"/>'; });
    return '<svg viewBox="0 0 60 60" aria-hidden="true" xmlns="http://www.w3.org/2000/svg">' + s + '</svg>';
  }
  return { figure: figure, tile: tile, shade: shade };
})();
if (typeof module !== 'undefined') module.exports = Figure;
