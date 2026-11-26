var I18N = typeof I18N !== 'undefined' ? I18N : require('./i18n.js'); var T = I18N.T;
/* Result: the free preview and the full report, as HTML. Runs on the server for the site, in the browser for the demo. */
var makeReport = function (D, P, E, F) {
  var ELN = D.EL_NAME, cur = null;
  var esc = function (s) { return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); };
  var lc = function (s) { return String(s).toLowerCase(); };
  var cap = function (s) { s = String(s); return s.charAt(0).toUpperCase() + s.slice(1); };
  function gx(v) { return Array.isArray(v) ? (cur.sex === 'm' ? v[1] : v[0]) : v; }
  function gf(f, m) { return cur.sex === 'm' ? m : f; }
  function arch(k) { var a = D.ARCH[k]; if (!a) return null; return cur.sex === 'm' && a.m ? Object.assign({}, a, a.m) : a; }
  function tierChip(t) { return t && t !== 'season' ? '<em class="tier ' + t + '">' + P.TIER[t] + '</em>' : ''; }
  function swatch(c) {
    return '<div class="sw' + (c.tier === 'avoid' ? ' avoid' : '') + '"><i style="background:' + c.hex + '"></i><div><b>' + esc(c.name) + '</b><span>' + c.hex + (c.el ? ' · ' + ELN[c.el] : '') + '</span>' + tierChip(c.tier) + '</div></div>';
  }
  function dots(list) { return '<div class="dots">' + list.map(function (c) { return '<span><i style="background:' + c.hex + '"></i>' + esc(c.name) + '</span>'; }).join('') + '</div>'; }
  function v(sign) { return /^[ВФвф]/.test(sign) ? T('във ') + sign : T('в ') + sign; }
  function deg(x) { return Math.floor(x) + '°'; }
  function fmtDate(ms) { var d = new Date(ms); return ('0' + d.getUTCDate()).slice(-2) + '.' + ('0' + (d.getUTCMonth() + 1)).slice(-2) + '.' + d.getUTCFullYear(); }
  var regionNames = {};
  function countryName(cc) {
    var l = I18N.lang === 'en' ? 'en' : 'bg';
    try { if (!regionNames[l]) regionNames[l] = new Intl.DisplayNames([l], { type: 'region' }); return regionNames[l].of(cc) || cc; } catch (e) { return cc; }
  }
  /* hand list [name, lat, lon, tz, 'България'|''] or GeoNames [name, lat, lon, tz, region, id, country code] */
  function placeSub(p) {
    if (!p[5]) return p[4] ? T(p[4]) : '';
    var reg = p[4] ? I18N.city(p[4]) : '';
    if (reg && p[6] === 'BG') reg = I18N.lang === 'en' ? reg + T(' (област)') : (/-град$/.test(reg) ? reg : T('обл. ') + reg);
    return (reg ? reg + ', ' : '') + countryName(p[6]);
  }
  /* a GeoNames place comes from the page: keep it only if every part looks right */
  function placeOk(p) {
    var lat = +p[1], lon = +p[2], txt = function (x) { return String(x == null ? '' : x).replace(/[<>"&]/g, '').slice(0, 80); };
    if (!/^(g|bg|md|ua)\d{1,9}$/.test(String(p[5])) || !/^[A-Z]{2}$/.test(String(p[6])) || !txt(p[0])) return null;
    if (!isFinite(lat) || !isFinite(lon) || Math.abs(lat) > 90 || Math.abs(lon) > 180 || D.TZS.indexOf(p[3]) < 0) return null;
    return [txt(p[0]), lat, lon, p[3], txt(p[4]), String(p[5]), String(p[6])];
  }
  function placeLabel(p) { var sub = placeSub(p); return I18N.city(p[0]) + (sub ? ', ' + sub : '') + ' · ' + Math.abs(p[1]).toFixed(2) + '° ' + (p[1] >= 0 ? T('с.ш.') : T('ю.ш.')) + ', ' + Math.abs(p[2]).toFixed(2) + '° ' + (p[2] >= 0 ? T('и.д.') : T('з.д.')); }
  function hasBirth(b) {
    if (!b || b.skip || !/^\d{4}-\d{2}-\d{2}$/.test(b.date || '')) return false;
    if (!b.noTime && !/^\d{2}:\d{2}$/.test(b.time || '')) return false;
    if (b.manual) return isFinite(parseFloat(b.mlat)) && isFinite(parseFloat(b.mlon)) && Math.abs(parseFloat(b.mlat)) <= 90 && Math.abs(parseFloat(b.mlon)) <= 180;
    return !!b.place;
  }
  function computeAll(st) {
    var b = st.birth, chart = null, err = null;
    if (hasBirth(b)) {
      try {
        var d = b.date.split('-').map(Number), t = b.noTime ? [12, 0] : b.time.split(':').map(Number);
        var lat, lon, tz;
        if (b.manual) { lat = parseFloat(b.mlat); lon = parseFloat(b.mlon); tz = /^off:/.test(b.mtz) ? +b.mtz.slice(4) : b.mtz; }
        else { lat = b.place[1]; lon = b.place[2]; tz = b.place[3]; }
        chart = E.compute({ y: d[0], m: d[1], d: d[2], h: t[0], mi: t[1], hasTime: !b.noTime, lat: lat, lon: lon, tz: tz, sex: st.sex || 'f' });
      } catch (e) { err = e; chart = null; }
    }
    return { chart: chart, pal: P.build(st.season.value, chart ? chart.bazi : null), err: err };
  }

  /* Accepts only known values: the server calls this on every request. */
  function clean(x) {
    x = x || {};
    var b = x.birth || {}, s = x.season || {}, l = x.line || {}, a = x.arch || {};
    var city = null;
    if (Array.isArray(b.place)) city = b.place[5] ? placeOk(b.place) : D.CITIES.filter(function (c) { return c[0] === b.place[0]; })[0] || null;
    var inp = {
      sex: x.sex === 'm' ? 'm' : 'f',
      birth: {
        skip: !!b.skip, date: String(b.date || '').slice(0, 10), time: String(b.time || '').slice(0, 5), noTime: !!b.noTime,
        manual: !!b.manual, place: city, mlat: String(b.mlat || '').slice(0, 12), mlon: String(b.mlon || '').slice(0, 12),
        mtz: (D.TZS.indexOf(b.mtz) >= 0 || /^off:-?\d{1,2}$/.test(b.mtz || '')) ? b.mtz : 'Europe/Sofia'
      },
      season: { value: D.SEASONS[s.value] ? s.value : null, sub: s.sub ? String(s.sub).slice(0, 40) : null, src: ['photo', 'quiz', 'pick'].indexOf(s.src) >= 0 ? s.src : null },
      line: { value: D.LINES[l.value] ? l.value : null },
      arch: { primary: D.ARCH[a.primary] ? a.primary : null, secondary: D.ARCH[a.secondary] && a.secondary !== a.primary ? a.secondary : null }
    };
    if (!hasBirth(inp.birth)) inp.birth.skip = true;
    return inp;
  }
  function invalid(inp) {
    if (!inp.season.value) return T('Липсва цветовият сезон.');
    if (!inp.line.value) return T('Липсва линията.');
    if (!inp.arch.primary) return T('Липсва архетипът.');
    return null;
  }
  /* Fingerprint of the inputs that shape the result: a payment unlocks only these. */
  function key(inp) {
    var b = inp.birth;
    return JSON.stringify([inp.sex, b.skip ? null : [b.date, b.noTime ? null : b.time, b.manual ? [b.mlat, b.mlon, b.mtz] : (b.place && (b.place[5] || b.place[0]))],
      inp.season.value, inp.line.value, inp.arch.primary, inp.arch.secondary]);
  }

  function sec(id, title, sub, body) { return '<details class="sec fold" id="' + id + '"><summary><h2 class="h-m">' + title + '</h2></summary><div class="fold-body">' + (sub ? '<p class="note">' + sub + '</p>' : '') + body + '</div></details>'; }
  function open(id, title, sub, body) { return '<section class="sec" id="' + id + '"><div class="sec-head"><h2 class="h-l">' + title + '</h2>' + (sub ? '<p class="note">' + sub + '</p>' : '') + '</div>' + body + '</section>'; }

  /* ---------- visual guide: looks, colour pairs, yes and no ---------- */
  var NAMES = I18N.wrap({
    crew: 'Плетиво с обло деколте', turtle: 'Поло', vneck: 'Плетиво с V-деколте', wrap: 'Горнище с прехлупване', shirt: 'Риза', cami: 'Топ с презрамки',
    wide: 'Широк панталон', straight: 'Прав панталон', slim: 'Тесен панталон', pencil: 'Права пола', midi: 'Миди пола', pleat: 'Плисирана пола',
    blazer: 'Сако', coat: 'Дълго палто', duster: 'Дълъг шлифер', cardigan: 'Удължена жилетка', moto: 'Късо яке',
    sheath: 'Рокля-калъф', aline: 'Рокля в А-линия', column: 'Дълга рокля', shirtdress: 'Рокля-риза',
    structured: 'Чанта с дръжка', tote: 'Голяма чанта', clutch: 'Клъч', cross: 'Чанта през рамо', scarf: 'Шал',
    pump: 'Обувки на ток', flat: 'Ниски обувки', ankle: 'Боти', knee: 'Ботуши'
  });
  /* colour roles: D1 daily base, D2 daily face, E1 expo base, E2 expo face, A accent */
  var LOOKS = {
    f: {
      'Драматик': [
        { top: ['turtle', 'long', 'D2'], bottom: ['wide', 'D1'], shoes: ['flat', 'D1'], neck: 'long' },
        { top: ['turtle', 'long', 'E2'], bottom: ['straight', 'D1'], outer: ['coat', 'E1'], shoes: ['ankle', 'D1'], bag: ['structured', 'A'] },
        { dress: ['vneck', 'column', 'long', 'E1'], shoes: ['pump', 'E1'], ear: 'drop', bag: ['clutch', 'A'] }],
      'Натурал': [
        { top: ['crew', 'three', 'D2'], bottom: ['wide', 'D1'], shoes: ['flat', 'D1'], neck: 'pendant' },
        { top: ['crew', 'long', 'E2'], bottom: ['straight', 'D1'], outer: ['cardigan', 'E1'], shoes: ['flat', 'D1'], bag: ['tote', 'A'] },
        { dress: ['shirt', 'shirtdress', 'three', 'E1'], belt: 'A', shoes: ['flat', 'D1'], ear: 'stud' }],
      'Класик': [
        { top: ['crew', 'three', 'D2'], bottom: ['straight', 'D1'], belt: 'D1', shoes: ['flat', 'D1'], ear: 'stud' },
        { top: ['turtle', 'long', 'E2'], bottom: ['wide', 'E1'], outer: ['blazer', 'E1'], shoes: ['pump', 'E1'], bag: ['structured', 'A'] },
        { dress: ['vneck', 'sheath', 'three', 'E1'], shoes: ['pump', 'E1'], ear: 'drop', bag: ['clutch', 'A'] }],
      'Гамин': [
        { top: ['crew', 'short', 'D2'], bottom: ['slim', 'D1'], shoes: ['flat', 'D1'], ear: 'stud' },
        { top: ['crew', null, 'E2'], bottom: ['slim', 'D1'], outer: ['moto', 'E1'], shoes: ['ankle', 'D1'], bag: ['cross', 'A'] },
        { top: ['cami', null, 'E2'], bottom: ['pencil', 'E1'], outer: ['blazer', 'E1'], shoes: ['pump', 'E1'], ear: 'drop', bag: ['clutch', 'A'] }],
      'Романтик': [
        { top: ['wrap', 'three', 'D2'], bottom: ['midi', 'D1'], shoes: ['flat', 'D1'], neck: 'pendant' },
        { top: ['vneck', 'long', 'E2'], bottom: ['pencil', 'D1'], belt: 'A', shoes: ['pump', 'D1'], ear: 'drop', bag: ['structured', 'A'] },
        { dress: ['cami', 'column', null, 'E1'], sheen: true, shoes: ['pump', 'E1'], ear: 'drop', bag: ['clutch', 'A'] }]
    },
    m: {
      'Драматик': [
        { top: ['turtle', 'long', 'D2'], bottom: ['slim', 'D1'], shoes: ['flat', 'D1'] },
        { top: ['turtle', 'long', 'E2'], bottom: ['straight', 'D1'], outer: ['coat', 'E1'], shoes: ['ankle', 'D1'], scarf: 'A' },
        { top: ['turtle', 'long', 'E2'], bottom: ['straight', 'E1'], outer: ['blazer', 'E1'], shoes: ['flat', 'E1'] }],
      'Натурал': [
        { top: ['crew', 'long', 'D2'], bottom: ['straight', 'D1'], shoes: ['flat', 'D1'] },
        { top: ['crew', 'long', 'E2'], bottom: ['straight', 'D1'], outer: ['cardigan', 'E1'], shoes: ['ankle', 'D1'], scarf: 'A' },
        { top: ['crew', 'long', 'E2'], bottom: ['straight', 'D1'], outer: ['blazer', 'E1'], shoes: ['flat', 'D1'] }],
      'Класик': [
        { top: ['shirt', 'long', 'D2'], bottom: ['straight', 'D1'], belt: 'D1', shoes: ['flat', 'D1'] },
        { top: ['crew', 'long', 'E2'], bottom: ['straight', 'D1'], outer: ['coat', 'E1'], shoes: ['flat', 'D1'], scarf: 'A' },
        { top: ['shirt', 'long', 'E2'], bottom: ['straight', 'E1'], outer: ['blazer', 'E1'], shoes: ['flat', 'E1'] }],
      'Гамин': [
        { top: ['crew', 'short', 'D2'], bottom: ['slim', 'D1'], shoes: ['flat', 'D1'] },
        { top: ['crew', null, 'E2'], bottom: ['slim', 'D1'], outer: ['moto', 'E1'], shoes: ['ankle', 'D1'], scarf: 'A' },
        { top: ['shirt', 'long', 'E2'], bottom: ['slim', 'D1'], outer: ['blazer', 'E1'], shoes: ['flat', 'D1'] }],
      'Романтик': [
        { top: ['vneck', 'long', 'D2'], bottom: ['straight', 'D1'], shoes: ['flat', 'D1'] },
        { top: ['shirt', 'long', 'E2'], bottom: ['straight', 'D1'], outer: ['cardigan', 'E1'], shoes: ['flat', 'D1'], scarf: 'A' },
        { top: ['turtle', 'long', 'E2'], bottom: ['straight', 'D1'], outer: ['blazer', 'E1'], shoes: ['flat', 'D1'] }]
    }
  };
  var LOOK_TWEAK = {
    sd: { 0: { top: ['wrap', 'three', 'D2'] } }, fn: { 1: { outer: ['duster', 'E1'] } }, sn: { 2: { dress: ['vneck', 'aline', 'three', 'E1'], belt: null } },
    sc: { 0: { top: ['vneck', 'three', 'D2'], bottom: ['midi', 'D1'] } }, sg: { 2: { dress: ['vneck', 'aline', 'three', 'E1'], top: null, bottom: null, outer: null } }
  };
  var NO_LOOK = {
    f: { 'Драматик': { top: ['crew', 'short', 'X1'], bottom: ['pleat', 'X2'], shoes: ['flat', 'X2'] }, 'Натурал': { dress: ['vneck', 'sheath', 'three', 'X1'], shoes: ['pump', 'X2'] },
      'Класик': { top: ['crew', 'long', 'X2'], bottom: ['wide', 'X1'], outer: ['cardigan', 'X2'], shoes: ['flat', 'X1'] }, 'Гамин': { top: ['turtle', 'long', 'X1'], bottom: ['wide', 'X1'], outer: ['duster', 'X2'], shoes: ['flat', 'X1'] },
      'Романтик': { top: ['turtle', 'long', 'X2'], bottom: ['straight', 'X1'], outer: ['blazer', 'X1'], shoes: ['flat', 'X1'] } },
    m: { 'Драматик': { top: ['crew', 'long', 'X2'], bottom: ['wide', 'X1'], outer: ['cardigan', 'X2'], shoes: ['flat', 'X1'] }, 'Натурал': { top: ['crew', 'short', 'X2'], bottom: ['slim', 'X1'], shoes: ['flat', 'X1'] },
      'Класик': { top: ['crew', 'long', 'X2'], bottom: ['wide', 'X1'], outer: ['cardigan', 'X2'], shoes: ['flat', 'X1'] }, 'Гамин': { top: ['turtle', 'long', 'X1'], bottom: ['wide', 'X1'], outer: ['coat', 'X2'], shoes: ['flat', 'X1'] },
      'Романтик': { top: ['turtle', 'long', 'X2'], bottom: ['straight', 'X1'], outer: ['blazer', 'X1'], shoes: ['flat', 'X1'] } }
  };
  var PATTERNS = I18N.wrap({ geo: 'Едра геометрия', stripe: 'Широко райе', fine: 'Фино райе', check: 'Каре', polka: 'Точки', floral: 'Дребни цветя', blobs: 'Акварелни петна' });
  /* where a print sits best, by sex: [women, men] */
  var PAT_TIP = I18N.wrap({
    geo: ['На рокля, блуза или шал. Колкото по-ясни и едри са формите, толкова по-добре.', 'На риза, пуловер или шал. Колкото по-ясни и едри са формите, толкова по-добре.'],
    stripe: ['Вертикалното райе издължава: на панталон, рокля или риза. По едно райе на визия.', 'Вертикалното райе издължава: на риза или панталон. По едно райе на визия.'],
    fine: ['Тънкото райе дава структура, без да шуми: на костюм, сако или риза.', 'Тънкото райе дава структура, без да шуми: на костюм, сако или риза.'],
    check: ['Карето стои най-добре на сако, палто или пола, в два-три цвята от палитрата.', 'Карето стои най-добре на сако, палто или риза, в два-три цвята от палитрата.'],
    polka: ['Точките са подредени и весели: на блуза, рокля или шал.', 'Точките са подредени и весели: на риза, кърпичка или вратовръзка.'],
    floral: ['Дребните цветя са меки и романтични: на блуза или рокля, с изчистени аксесоари.', 'Дребните цветя са меки и игриви: на риза или кърпичка, с изчистен силует.'],
    blobs: ['Акварелът е мек и без ръбове: на копринена блуза, шал или рокля.', 'Акварелът е мек и без ръбове: на риза или шал.']
  });
  /* which part of a look carries the print, by kind: [women, men] */
  var PAT_SLOT = { geo: ['dress', 'top'], stripe: ['bottom', 'top'], fine: ['outer', 'outer'], check: ['outer', 'outer'], polka: ['top', 'top'], floral: ['top', 'top'], blobs: ['dress', 'top'] };
  /* prints with a light ground read better on a light colour */
  var PAT_LIGHT = { floral: 1, blobs: 1, polka: 1 };
  var PAT = { 'Драматик': [['geo', 'stripe'], ['floral', 'polka']], 'Натурал': [['blobs', 'check'], ['polka', 'geo']], 'Класик': [['fine', 'check'], ['geo', 'blobs']],
    'Гамин': [['polka', 'check'], ['blobs', 'stripe']], 'Романтик': [['floral', 'blobs'], ['geo', 'check']], dc: [['geo', 'stripe'], ['floral', 'blobs']], fg: [['geo', 'check'], ['blobs', 'floral']] };
  var HAIR = { queen: 'bun', lover: 'waves', mother: 'side', sage: 'bob', maiden: 'long', huntress: 'pony', mystic: 'verylong' };
  var BODY = { winter: ['#E9CFC2', '#2B2326'], summer: ['#EBD4CA', '#8C7A6C'], spring: ['#F0D3BA', '#B08752'], autumn: ['#E3C0A2', '#6B4329'] };
  var CTX = I18N.wrap(['Работа и всекидневие', 'В града', 'Изява']);

  function visuals(st, p, L, bz, hd, lineKey) {
    var sexK = st.sex === 'm' ? 'm' : 'f', fam = L.fam, fs = P.formulas(p, bz, hd);
    var ex = fs[0].parts, da = fs[1].parts, col = { E1: ex[0][0], E2: ex[1][0], A: ex[2][0], D1: da[0][0], D2: da[1][0] };
    if (col.D2 === col.E2 && p.face.filter(P.good).length > 1) col.D2 = p.face.filter(P.good).filter(function (c) { return c !== col.E2; })[0];
    /* a top in a skin-like colour reads as bare skin in a drawing: pick the next face colour */
    var skinHex = BODY[p.season][0], faces = p.face.filter(P.good);
    ['E2', 'D2'].forEach(function (r) {
      if (P.dE(col[r].hex, skinHex) >= 16) return;
      var other = r === 'E2' ? col.D2 : col.E2;
      var alt = faces.filter(function (c) { return c !== other && P.dE(c.hex, skinHex) >= 16; })[0] || faces.filter(function (c) { return P.dE(c.hex, skinHex) >= 16; })[0];
      if (alt) col[r] = alt;
    });
    var jewelC = (p.metalTier === 'light' || p.metalTier === 'avoid') && p.stones[0] ? p.stones[0] : p.metal;
    var body = BODY[p.season], opt = { male: sexK === 'm', skin: body[0], hair: body[1], hairStyle: HAIR[st.arch.primary], jewel: jewelC.hex };
    var curPrint = null;
    function hex(r) { return r === 'P' ? curPrint : r === 'X1' ? '#A9A4AE' : r === 'X2' ? '#CFCBD3' : col[r].hex; }
    function build(spec) {
      var o = {}, pieces = [];
      function add(key, colr) { pieces.push([NAMES[key], colr]); }
      if (spec.dress) { o.dress = { n: spec.dress[0], s: spec.dress[1], sl: spec.dress[2], c: hex(spec.dress[3]), sheen: spec.sheen }; add(spec.dress[1], spec.dress[3]); }
      else {
        if (spec.outer) { o.outer = { t: spec.outer[0], c: hex(spec.outer[1]) }; add(spec.outer[0], spec.outer[1]); }
        o.top = { n: spec.top[0], sl: spec.top[1], c: hex(spec.top[2]) }; add(spec.top[0], spec.top[2]);
        o.bottom = { t: spec.bottom[0], c: hex(spec.bottom[1]) }; add(spec.bottom[0], spec.bottom[1]);
      }
      if (spec.belt) { o.belt = { c: hex(spec.belt), thin: true }; if (spec.belt === 'A') pieces.push([T('Колан'), 'A']); }
      o.shoes = { t: spec.shoes[0], c: hex(spec.shoes[1]) }; add(spec.shoes[0], spec.shoes[1]);
      if (spec.bag) { o.bag = { t: spec.bag[0], c: hex(spec.bag[1]) }; add(spec.bag[0], spec.bag[1]); }
      if (spec.scarf) { o.scarf = hex(spec.scarf); add('scarf', spec.scarf); }
      if (spec.neck) o.neck = { t: spec.neck };
      if (spec.ear) o.ear = spec.ear;
      if (spec.neck || spec.ear) pieces.push([spec.neck ? T('Висулка') : T('Обеци'), 'J']);
      return { o: o, pieces: pieces };
    }
    var specs = LOOKS[sexK][fam].map(function (sp, i) { var t = (LOOK_TWEAK[lineKey] || {})[i]; return sexK === 'f' && t ? Object.assign({}, sp, t) : sp; });
    var looks = specs.map(function (sp, i) {
      var b = build(sp);
      return '<article class="look"><div class="stage">' + F.figure(b.o, Object.assign({ label: CTX[i] + ': ' + b.pieces.map(function (x) { return x[0]; }).join(', ') }, opt)) + '</div><div class="look-text"><h3>' + CTX[i] + '</h3><ul class="pieces">' +
        b.pieces.map(function (x) { var c = x[1] === 'J' ? jewelC : col[x[1]]; return '<li><i style="background:' + c.hex + '"></i><span>' + x[0] + '<small>' + esc(lc(c.name)) + '</small></span></li>'; }).join('') + '</ul></div></article>';
    }).join('');

    /* pairs */
    var prs = [[col.D1, col.D2, T('Всеки ден')], [col.E1, col.E2, T('Контраст до лицето')], [col.E1, col.A, T('Акцент за изява')]];
    var accs = p.accent.filter(P.good);
    var a2 = accs.filter(function (c) { return c !== col.A && c.el !== col.D1.el; })[0] || accs.filter(function (c) { return c !== col.A; })[0];
    if (a2) prs.push([col.D1, a2, T('Акцент за всеки ден')]);
    var tonal = p.face.filter(function (c) { return P.good(c) && c.el === col.E1.el; })[0];
    if (tonal && tonal !== col.E2) prs.push([col.E1, tonal, T('Тон в тон')]);
    var seen = {}, pairs = prs.filter(function (x) { var k = x[0].name + '|' + x[1].name; if (seen[k] || x[0] === x[1]) return false; seen[k] = 1; return true; }).map(function (x) {
      return '<div class="pairc"><div class="pairsw"><i style="background:' + x[0].hex + '"></i><i style="background:' + x[1].hex + '"></i></div><b>' + x[2] + '</b><span>' + esc(x[0].name) + ' + ' + esc(lc(x[1].name)) + '</span></div>';
    }).join('');

    /* yes and no */
    var yes = build(specs[1]), no = build(NO_LOOK[sexK][fam]);
    var pat = PAT[lineKey] || PAT[fam];
    var si = sexK === 'm' ? 1 : 0;
    function printCols(kind) { return PAT_LIGHT[kind] ? [col.E2.hex, col.E1.hex, col.A.hex] : [col.E1.hex, col.E2.hex, col.A.hex]; }
    /* one of the three looks, with the print on the part that suits it */
    function printLook(kind) {
      var slot = PAT_SLOT[kind][si], base = slot === 'outer' ? (si ? 2 : 1) : slot === 'dress' ? 2 : 0;
      var sp = JSON.parse(JSON.stringify(specs[base]));
      if (slot === 'dress' && !sp.dress) slot = 'bottom';
      if (slot === 'outer' && !sp.outer) slot = 'top';
      if (slot === 'dress') sp.dress[3] = 'P';
      else if (slot === 'outer') sp.outer[1] = 'P';
      else if (slot === 'bottom' && sp.bottom) sp.bottom[1] = 'P';
      else if (sp.top) sp.top[2] = 'P';
      var pr = F.print(kind, printCols(kind), 0.3);
      curPrint = pr.c; var b = build(sp); curPrint = null;
      return F.figure(b.o, Object.assign({}, opt, { label: PATTERNS[kind], defs: pr.defs }));
    }
    var patYes = pat[0].map(function (k) {
      return '<article class="patc"><div class="patsw">' + F.fabric(k, printCols(k)) + '</div><div class="stage">' + printLook(k) + '</div>' +
        '<div class="pat-t"><h4>' + PATTERNS[k] + '</h4><p>' + gx(PAT_TIP[k]) + '</p></div></article>';
    }).join('');
    var patNo = pat[1].map(function (k) {
      return '<figure class="ptile">' + F.fabric(k, ['#D9D5DC', '#A9A4AE', '#8E8994']) + '<figcaption>' + PATTERNS[k] + '</figcaption></figure>';
    }).join('');
    var dd = T('<div class="yn"><div class="ync yes"><p class="ynh">Да</p><div class="stage">') + F.figure(yes.o, Object.assign({ label: T('Силует, който подсилва') }, opt)) + '</div><ul>' + L.plus.slice(0, 3).map(function (x) { return '<li>' + gx(x) + '</li>'; }).join('') + '</ul></div>' +
      T('<div class="ync no"><p class="ynh">Не</p><div class="stage">') + F.figure(no.o, Object.assign({ label: T('Силует, който размива') }, opt, { jewel: '#CFCBD3' })) + '</div><ul>' + L.minus.slice(0, 3).map(function (x) { return '<li>' + gx(x) + '</li>'; }).join('') + '</ul></div></div>' +
      T('<div class="sub pat"><h3>Шарки</h3><p>Шарката е като глас: мащабът ѝ трябва да отговаря на мащаба на чертите ти. За линията ') + L.name + T(' шарките са ') + L.pattern + T('. Ето две, които ти стоят, в твоите цветове.</p>') +
      '<div class="pats">' + patYes + '</div>' +
      '<div class="pat-no">' + T('<p class="ynh">Не</p><p class="small">Тези шарки спорят с линията ти, дори да са в твоите цветове.</p>') + '<div class="ptiles off">' + patNo + '</div></div></div>';

    /* in short */
    function d3(list) { return dots(list.filter(P.good).slice(0, 3)); }
    var reps = P.replacements(p).slice(0, 4).map(function (r) { return lc(r.item); });
    var brief = '<dl class="brief">' +
      T('<div><dt>Основа</dt><dd>') + d3(p.base) + '</dd></div>' +
      T('<div><dt>До лицето</dt><dd>') + d3(p.face) + '</dd></div>' +
      T('<div><dt>Акцент</dt><dd>') + d3(p.accent) + T('<small>по един на визия</small></dd></div>') +
      T('<div><dt>Силует</dt><dd>') + L.plus.slice(0, 2).map(gx).join('. ') + '.</dd></div>' +
      T('<div><dt>Бижута</dt><dd>') + dots([jewelC]) + '</dd></div>' +
      T('<div><dt>Метал</dt><dd>') + cap(p.S.metal) + T(' озарява лицето ти') + (p.metalTier === 'light' || p.metalTier === 'avoid' ? T(', но по картата го носи само като тънък обков') : '') + '.</dd></div>' +
      T('<div><dt>Твоето бяло</dt><dd>') + cap(p.S.white) + '.</dd></div>' +
      T('<div><dt>Уморяват те</dt><dd>') + cap(p.S.tired) + '.</dd></div>' +
      (reps.length ? T('<div><dt>Остави</dt><dd>') + cap(reps.join(', ')) + '.</dd></div>' : '') + '</dl>';

    return open('brief', T('Накратко'), null, brief) +
      open('looks', T('Три готови визии'), T('В твоите цветове и в линията ') + L.name + T('. Смени дрехата със сходна, пази цвета и силуета.'), '<div class="looks">' + looks + '</div>') +
      open('pairs', T('Цветове, които се носят заедно'), T('Първият цвят е голямата площ: палто, панталон, рокля. Вторият е до лицето или в акцента.'), '<div class="pairs">' + pairs + '</div>') +
      open('yesno', T('Да и не за линията'), null, dd);
  }
  function grid(list) { return '<div class="sw-grid">' + list.map(function (c) { return swatch(c); }).join('') + '</div>'; }
  /* when the season and the line pull in different directions, say how to hold both */
  function mixNote(season, line) {
    if ((season === 'winter' || season === 'spring') && (line === 'sc' || line === 'c'))
      return T('<li>Сезонът ти иска контраст, а линията ти обича тонални комбинации. Затова контрастът стои между основата и цвета до лицето, а всичко останало е тон в тон.</li>');
    if ((season === 'summer' || season === 'autumn') && (line === 'fg' || line === 'g' || line === 'sg'))
      return T('<li>Сезонът ти обича тонални комбинации, а линията ти иска контраст. Направи контраста с формата и детайла: къса дреха срещу по-дълга, копчета, кант. Цветовете дръж близки по светлота.</li>');
    return '';
  }
  var FORMULA_USE = I18N.wrap({
    expo: 'За дните, в които искаш да те забележат: среща, представяне, празник.',
    daily: 'Тихата версия за работа и делник: подредено, без да привлича всички погледи.',
    high: 'За дните, в които емоциите са високо: по-спокоен тон те заземява.',
    low: 'За дните, в които енергията е ниско: повече топлина до лицето те стопля.'
  });
  function fbar(f) {
    return '<div class="formula"><h3 class="h-m" style="font-size:1.05rem">' + f.title + '</h3>' + (FORMULA_USE[f.k] ? '<p class="small">' + FORMULA_USE[f.k] + '</p>' : '') + '<div class="fbar">' + f.parts.map(function (p) { return '<i style="flex:' + p[1] + ';background:' + p[0].hex + '"></i>'; }).join('') + '</div>' +
      '<p class="flegend">' + f.parts.map(function (p) { return esc(p[0].name) + ' ' + p[1] + '%'; }).join(' · ') + '</p></div>';
  }
  var LOCK = '<svg width="14" height="14" viewBox="0 0 14 14" aria-hidden="true"><rect x="2.5" y="6" width="9" height="6.5" rx="1" fill="none" stroke="currentColor" stroke-width="1.3"/><path d="M4.5 6V4.3a2.5 2.5 0 0 1 5 0V6" fill="none" stroke="currentColor" stroke-width="1.3"/></svg>';
  function firstSentence(t) { var m = String(t).match(/^[^.!?]*[.!?]/); return m ? m[0] : String(t); }
  function teaser(st) {
    cur = st;
    var R = computeAll(st), ch = R.chart, p = R.pal, S = p.S, bz = ch && ch.bazi, hd = ch && ch.hd;
    var L = D.LINES[st.line.value], A1 = arch(st.arch.primary), A2 = arch(st.arch.secondary);
    var rows = [];
    rows.push([T('Цветови сезон'), esc(T(st.season.sub) || S.name), S.traits]);
    rows.push([T('Линия'), L.name, firstSentence(L.essence)]);
    rows.push([T('Архетип'), A1.name + (A2 ? T(' <span class="small">· втори глас: ') + A2.name + '</span>' : ''), firstSentence(A1.essence)]);
    var strip = [p.base[0], p.base[1], p.face[0], p.face[1], p.accent[0], p.accent[1], p.accent[2]].filter(Boolean);
    rows.push([T('Палитра'), T('<span class="tstrip" role="img" aria-label="Част от палитрата">') + strip.map(function (c) { return '<i style="background:' + c.hex + '"></i>'; }).join('') + '</span>',
      bz ? T('Претеглена по Ба Дзъ: подсилват ') + bz.fav.map(function (e) { return lc(ELN[e]); }).join(T(' и ')) + '.' : T('Подредена по сезона.')]);
    if (bz) rows.push([T('Ба Дзъ'), T('Господар на деня ') + E.STEMS[bz.dmStem] + ', ' + (bz.dmStem % 2 ? T('Ин') : T('Ян')) + ' ' + ELN[bz.dm], bz.strong ? T('Силен господар.') : T('Слаб господар.')]);
    if (ch && ch.gua) rows.push([T('Число Гуа'), String(ch.gua.n), ELN[ch.gua.el] + ', ' + (ch.gua.group === 'east' ? T('източна група') : T('западна група')) + '.']);
    if (ch) rows.push([T('Рождена карта'), T('Слънце ') + v(ch.west.sun.name) + (ch.west.asc ? T(' · Асцендент ') + v(ch.west.asc.name) : ''), T('Луна ') + v(ch.west.moon.name) + '.']);
    if (hd) rows.push([T('Хюман дизайн'), D.HD_TYPE[hd.type].name + T(', профил ') + hd.profile, D.HD_AUTH[hd.authority].name + T(' авторитет.')]);
    var locked = [T('Твоят портрет: сезон, линия и архетип, описани с думи'), T('Три нарисувани визии в твоите цветове и двойки цветове за носене'), T('Всички цветове с имена и кодове: основа, до лицето, акценти, бижута и камъни'), T('Как да ги носиш според линията ') + L.name, T('Готови формули за изява и всекидневие'),
      T('Цветовете по западната и ведическата карта'), T('Ба Дзъ, хюман дизайн и Гуа подробно'), T('Кой метал и кои камъни озаряват лицето ти и кои цветове те уморяват'), T('Замени за дрехите, които вече имаш')];
    locked.push(T('Пазаруване по линията: какво да търсиш и какво да подминеш, с думи за търсене'));
    locked.push(st.sex !== 'm' ? T('Грим, коса и червила в твоите цветове') : T('Коса и рамки на очила'));
    locked.push(T('Първи стъпки: откъде да започнеш с гардероба, който вече имаш'));
    locked.push(T('Целият резултат като текст за запазване'));
    return { html: T('<header class="res-head"><p class="eyebrow">Безплатен преглед</p><h1 class="h-xl">') + esc(T(st.season.sub) || S.name) + ' · ' + L.name + T('</h1><p class="lede">Ето накратко какво показват тестовете и картата ти.</p></header>') +
      '<dl class="teaser">' + rows.map(function (r) { return '<div><dt>' + r[0] + '</dt><dd><b>' + r[1] + '</b><span>' + esc(r[2]) + '</span></dd></div>'; }).join('') + '</dl>' +
      T('<section class="sec"><div class="sec-head"><h2 class="h-l">В пълния резултат</h2></div><ul class="locked">') + locked.map(function (x) { return '<li>' + LOCK + '<span>' + x + '</span></li>'; }).join('') + '</ul></section>' };
  }
  function full(st) {
    cur = st;
    var R = computeAll(st), ch = R.chart, p = R.pal, S = p.S, bz = ch && ch.bazi, hd = ch && ch.hd;
    var L = D.LINES[st.line.value], A1 = arch(st.arch.primary), A2 = arch(st.arch.secondary);
    var seasonName = T(st.season.sub) || S.name;
    var out = '';

    /* head */
    var elPills = '';
    if (bz) {
      var tiers = ['wood', 'fire', 'earth', 'metal', 'water'].map(function (e) { return [e, P.tierOf(e, bz)]; });
      var order = { fav1: 0, fav: 1, light: 2, avoid: 3 };
      tiers.sort(function (a, b) { return order[a[1]] - order[b[1]]; });
      elPills = '<div class="elrow">' + tiers.map(function (t) {
        var lab = t[1] === 'fav1' ? T('подсилва, най-важен') : t[1] === 'fav' ? T('подсилва') : t[1] === 'light' ? T('малко') : T('избягвай');
        return '<span class="pill ' + (t[1] === 'fav1' || t[1] === 'fav' ? 'fav' : t[1] === 'avoid' ? 'avoid' : '') + '">' + ELN[t[0]] + ': ' + lab + '</span>';
      }).join('') + '</div>';
    }
    var b1 = p.sig.b1, f1 = p.sig.f1, a1 = p.accent.filter(P.good)[0] || p.accent[0];
    out += T('<header class="res-head"><p class="eyebrow">Твоята стилова карта</p><h1 class="h-xl">') + esc(seasonName) + ' · ' + L.name + '</h1>' +
      T('<p class="lede">Архетип: ') + A1.name + (A2 ? T(' и ') + A2.name : '') + '</p>' +
      '<p class="sig">' + esc(p.signature) + '</p>' +
      T('<div class="pbar" role="img" aria-label="Пропорция 70, 20, 10"><i style="flex:70;background:') + b1.hex + '"></i><i style="flex:20;background:' + f1.hex + '"></i><i style="flex:10;background:' + a1.hex + '"></i></div>' +
      T('<p class="plegend"><span>Основа около 70%</span><span>До лицето около 20%</span><span>Акценти около 10%</span></p>') +
      (p.removed.length >= 2 && bz ? T('<p>Това е ') + S.richer + T(' от обичайната: картата маха ') + p.removed.map(lc).join(', ').replace(/, ([^,]*)$/, T(' и $1')) + T(', затова основата е цветна.</p>') : '') +
      elPills + (!ch ? T('<p class="note">Без данни за раждане палитрата е само по сезона.</p>') : '') + '</header>';

    /* toc */
    var toc = [['portrait', T('Портрет')], ['looks', T('Визии')], ['pairs', T('Двойки')], ['yesno', T('Да и не')], ['colors', T('Цветове')], ['wear', T('Носене')], ['shop', T('Пазаруване')], ['arch', T('Архетип')], ['formulas', T('Формули')]];
    if (ch) toc.push(['chart', T('Карта')], ['bazi', T('Ба Дзъ')]);
    if (ch && ch.gua) toc.push(['gua', T('Гуа')]);
    if (ch) toc.push(['hd', T('Хюман дизайн')]);
    toc.push(['swap', T('Замени')]); toc.push(st.sex !== 'm' ? ['lips', T('Грим')] : ['beauty', T('Коса')]); toc.push(['steps', T('Първи стъпки')], ['data', T('Данни')]);
    out += T('<nav class="toc chips" aria-label="Раздели">') + toc.map(function (t) { return '<button class="chip" data-act="goto" data-id="' + t[0] + '">' + t[1] + '</button>'; }).join('') + '</nav>';

    /* portrait: season, line, archetype and chart as a few paragraphs */
    var story = '<p><b>' + T('Цветовете.') + '</b> ' + S.about + '</p>' +
      '<p><b>' + T('Формата.') + '</b> ' + gx(L.about) + '</p>' +
      '<p><b>' + T('Излъчването.') + '</b> ' + gx(A1.about) + (A2 ? T(' Вторият ти глас е ') + A2.name + ': ' + lc(firstSentence(A2.essence)) : '') + '</p>';
    if (bz) story += '<p><b>' + T('Картата.') + '</b> ' + T('По Ба Дзъ елементът ти е ') + ELN[bz.dm] + '. ' + D.EL_ABOUT[bz.dm] + ' ' +
      T('Палитрата ти е претеглена към ') + bz.fav.map(function (e) { return lc(ELN[e]); }).join(', ').replace(/, ([^,]*)$/, T(' и $1')) + T(': от тях картата ти има нужда.') + '</p>';
    story += '<p>' + T('Цветовете казват кои тонове да са до лицето ти, линията казва каква форма да имат дрехите, а архетипът казва какво искаш хората да усетят. Когато трите говорят едно и също, хората виждат теб, а не дрехите.') + '</p>';
    out += open('portrait', T('Твоят портрет'), null, '<div class="story">' + story + '</div>');

    out += visuals(st, p, L, bz, hd, st.line.value);
    out += T('<h2 class="h-l more-h">Подробно</h2>');

    /* colours */
    var metalLine = p.metalTier === 'avoid' ? T('Всеки метал е Метал, а картата не го обича. Затова водят камъкът и дървото, а металът е само тънък обков.')
      : p.metalTier === 'light' ? T('Металът е в малки дози: камъкът води, металът е фин обков.')
      : p.metalTier === 'season' ? '' : T('Металът е благоприятен: бижутата могат да водят.');
    out += sec('colors', T('Цветовете'), bz ? T('Претеглени по Ба Дзъ. „Подсилва“ е за благоприятните елементи, „малко“ е за малки площи.') : S.traits,
      T('<p>Палитрата е разделена по роли. Основата е голямата площ, която носи визията, затова е спокойна. Цветовете до лицето са светлината: те стоят най-близо до очите и кожата и правят лицето свежо. Акцентът е подписът: една чанта, един шал или едно червило на визия.</p>') +
      T('<div class="sub"><h3>Основа · около 70%</h3><p class="small">') + gf(T('Панталони, поли, сака, палта, обувки, чанти.'), T('Панталони, сака, палта, обувки, чанти.')) + '</p>' + grid(p.base) + '</div>' +
      T('<div class="sub"><h3>До лицето · около 20%</h3><p class="small">') + gf(T('Блузи, шалове, яки. Тук е светлината.'), T('Ризи, пуловери, шалове. Тук е светлината.')) + '</p>' + grid(p.face) + '</div>' +
      T('<div class="sub"><h3>Акценти · около 10%</h3><p class="small">По един на визия, в плътен блок.</p>') + grid(p.accent) + '</div>' +
      T('<div class="sub"><h3>Бижута и камъни</h3><p class="small">') + esc([bz ? T('Камъните са подбрани по благоприятните ти елементи и по подтона на сезона.') : T('Камъните са подбрани по подтона на сезона.'), metalLine, (p.metalTier === 'light' || p.metalTier === 'avoid' ? T('Когато все пак е метал, нека е ') + S.metal + '.' : ''), S.goldNote].filter(Boolean).join(' ')) + '</p>' + grid(p.stones.concat([p.metal])) + '</div>');

    /* wear */
    out += sec('wear', T('Как ги носиш'), L.name + ': ' + L.essence,
      T('<div class="cols2"><div class="plus"><h3 class="h-m" style="font-size:1rem;margin-bottom:8px">Подсилва те</h3><ul>') + L.plus.map(function (x) { return '<li>' + gx(x) + '</li>'; }).join('') + '</ul></div>' +
      T('<div class="minus"><h3 class="h-m" style="font-size:1rem;margin-bottom:8px">Размива те</h3><ul>') + L.minus.map(function (x) { return '<li>' + x + '</li>'; }).join('') + '</ul></div></div>' +
      T('<dl class="kv"><dt>Материи</dt><dd>') + L.fabric + T('</dd><dt>Шарки</dt><dd>') + L.pattern + T('</dd><dt>Аксесоари</dt><dd>') + L.acc + '</dd></dl>' +
      '<ul class="ul"><li>' + S.rule + '</li>' + mixNote(st.season.value, st.line.value) + '<li>' + esc(p.sig.f1.name) + T(' и другите светли тонове стоят над кръста, срещу основата.</li><li>Един акцент на визия: ') + p.accent.filter(P.good).slice(0, 4).map(function (c) { return lc(c.name); }).join(', ') + T('.</li><li>Материята мени цвета: в сатен цветът изглежда по-светъл и по-ярък, в матова кожа и вълна по-дълбок. За сатен избирай по-дълбокия тон.</li></ul>'));

    /* shopping by line, and words to search for */
    var sx = st.sex === 'm' ? 'm' : 'f', SH = D.SHOP[sx], shBase = SH.base[L.fam], shLine = SH.line[st.line.value] || {};
    var shopRows = SH.cats.map(function (c) {
      var v = shLine[c[0]] || shBase[c[0]];
      return '<div class="shrow"><h4>' + c[1] + '</h4><p class="y">' + v[0] + '</p><p class="n">' + v[1] + '</p></div>';
    }).join('');
    function kw(list) { return '<ul class="kw">' + list.map(function (x) { return '<li>' + (I18N.lang === 'en' ? x[1] : x[0] + ' <small>' + x[1] + '</small>') + '</li>'; }).join('') + '</ul>'; }
    function enName(n) { var l = I18N.lang; I18N.lang = 'en'; var r = T(n); I18N.lang = l; return r; }
    var colWords = [p.base.filter(P.good).slice(0, 2), p.face.filter(P.good).slice(0, 2), p.accent.filter(P.good).slice(0, 2)].reduce(function (a, b) { return a.concat(b); }, [])
      .map(function (c) { return [lc(c.name), lc(enName(c.name))]; });
    out += sec('shop', T('Пазарувай по линията'), T('Какво да търсиш в магазина и какво да подминеш, за линията ') + L.name + T('. Цветовете вземи от палитрата.'),
      '<div class="shop">' + shopRows + '</div>' +
      T('<div class="sub"><h3>Думи за търсене</h3><p class="small">Напиши ги в търсачката на онлайн магазина. Английските думи работят и в международните магазини.</p></div>') +
      T('<p class="lbl">По линията</p>') + kw(sx === 'm' ? D.SEARCH.m[L.fam] : D.SEARCH.f[st.line.value]) +
      T('<p class="lbl">По архетипа</p>') + kw(D.SEARCH.arch[st.arch.primary]) +
      T('<p class="lbl">Цветовете</p>') + kw(colWords));

    /* archetype */
    out += sec('arch', T('Архетип'), T('Архетипът казва какво излъчваш, линията казва в каква форма да го облечеш.'),
      '<div class="cards">' + [A1, A2].filter(Boolean).map(function (a, i) {
        return '<div class="card pc"><p class="role">' + (i ? T('Втори глас') : T('Основен')) + '</p><h3 class="h-m">' + a.name + '</h3><p class="small">' + a.traits.join(' · ') + '</p><p>' + a.essence + T('</p><dl class="kv"><dt>Материи</dt><dd>') + a.mat + T('</dd><dt>Детайл</dt><dd>') + a.det + '</dd>' + (st.sex === 'm' ? '' : T('<dt>Червило</dt><dd>') + a.finish + '</dd>') + '</dl></div>';
      }).join('') + '</div>' +
      (A2 ? T('<p class="note">От втория глас вземай материя или аксесоар, а силуетът нека идва от линията ') + L.name + '.</p>' : ''));

    /* formulas */
    var fs = P.formulas(p, bz, hd);
    out += sec('formulas', T('Формули'), hd ? D.HD_TYPE[hd.type].name + ': ' + D.HD_TYPE[hd.type].expo + '.' : T('Готови пропорции за визия.'),
      T('<p>Процентите са площ, а не брой дрехи. Най-широката част е голямата площ: палто, рокля, панталон. Средната е до лицето, а тясната е акцентът.</p>') + fs.map(fbar).join(''));

    if (ch) {
      /* chart */
      var w = ch.west, cards = '', bySign = [];
      D.WEST_ROLES.forEach(function (r) {
        var s = w[r[0]]; if (!s) return;
        var g = bySign.filter(function (x) { return x.s.i === s.i; })[0];
        if (g) g.r.push([r, w[r[0]]]); else bySign.push({ s: s, r: [[r, s]] });
      });
      bySign.forEach(function (g) {
        var info = D.SIGN_INFO[g.s.i], cols = P.famColors(info.fam, p);
        var head = g.r.map(function (x) { return x[0][1]; }).join(T(' и ')) + ' ' + v(g.s.name) + (g.r.length === 1 ? ' ' + deg(g.s.deg) : '');
        cards += '<div class="card pc"><p class="role">' + g.r.map(function (x) { return x[0][2]; }).join(' · ') + '</p><h3>' + head + '</h3>' + (g.r.length > 1 ? '<p class="small">' + g.r.map(function (x) { return x[0][1] + ' ' + deg(x[1].deg); }).join(', ') + '</p>' : '') + '<p class="small">' + info.kw + '</p>' + (cols.length ? dots(cols) : T('<p class="small">Традиционните цветове на знака не са в палитрата ти.</p>')) + '</div>';
      });
      var ved = ch.vedic, vc = '';
      if (ved.lagna) { var lord = D.PLANETS[D.SIGN_LORD[ved.lagna.i]]; vc += T('<div class="card pc"><p class="role">тяло и излъчване</p><h3>Лагна ') + v(ved.lagna.name) + ' ' + deg(ved.lagna.deg) + T('</h3><p class="small">Владетел ') + lord.name + ': ' + lord.kw + '.</p>' + dots(P.famColors(lord.fam, p)) + '</div>'; }
      vc += T('<div class="card pc"><p class="role">ум и чувства</p><h3>Луна ') + v(ved.moon.name) + ' ' + deg(ved.moon.deg) + T('</h3><p class="small">Накшатра ') + ved.nakshatra + '.</p></div>';
      if (ved.current) {
        var md = D.PLANETS[ved.current.maha.lord], ad = D.PLANETS[ved.current.antar.lord];
        vc += T('<div class="card pc"><p class="role">голям период</p><h3>Махадаша ') + md.name + ' · ' + new Date(ved.current.maha.start).getFullYear() + '–' + new Date(ved.current.maha.end).getFullYear() + '</h3><p class="small">' + cap(md.kw) + '.</p>' + dots(P.famColors(md.fam, p)) + '</div>';
        vc += T('<div class="card pc"><p class="role">сегашният период</p><h3>Антардаша ') + md.name + '–' + ad.name + '</h3><p class="small">' + fmtDate(ved.current.antar.start) + '–' + fmtDate(ved.current.antar.end) + '. ' + cap(ad.kw) + '.</p>' + dots(P.famColors(ad.fam, p)) + '</div>';
      }
      var ss = ved.sadeSati;
      if (ss.phase) vc += T('<div class="card pc"><p class="role">натиск и изграждане</p><h3>Sade Sati, ') + ['', T('първа'), T('втора'), T('трета')][ss.phase] + T(' фаза</h3><p class="small">') + new Date(ss.start).getFullYear() + '–' + new Date(ss.end).getFullYear() + T('. В гардероба: по-малко и по-качествено, капсула от основата, без случайни покупки.</p></div>');
      out += sec('chart', T('По картата'), T('Цветовите съответствия в астрологията са традиционни асоциации. Тук те подреждат палитрата, без да я заменят.'),
        T('<p>Асцендентът е първото впечатление, Слънцето е същността ти, Луната е това, което ти носи комфорт, Венера е вкусът ти, а MC е образът ти в работата. Под всяка позиция са цветовете от палитрата ти, които ѝ съответстват. Така знаеш кой цвят за какво да носиш: за първа среща, за себе си, за уют или за работа.</p>') +
        T('<div class="sub"><h3>Западна астрология</h3><div class="cards">') + cards + '</div></div>' +
        T('<div class="sub"><h3>Ведическа астрология (Лахири)</h3><p class="small">Лагна показва тялото и излъчването, а периодите (даши) показват темата на годините, в които си сега. Цветовете на владетеля на периода са добър избор за важни начала.</p><div class="cards">') + vc + '</div></div>' +
        (!ch.hasTime ? T('<p class="note">Без час на раждане Асцендентът, MC и Лагна не се смятат.</p>') : ''));

      /* bazi */
      var pil = bz.pillars, names = { year: T('Година'), month: T('Месец'), day: T('Ден'), hour: T('Час') };
      var pillHTML = '<div class="pillars" style="grid-template-columns:repeat(' + pil.length + ',minmax(0,1fr))">' + pil.map(function (x) {
        return '<div class="' + (x.k === 'day' ? 'day' : '') + '"><small>' + names[x.k] + '</small><span class="han">' + E.STEMS[x.s] + '</span><small>' + ELN[E.stemEl(x.s)] + '</small><span class="han">' + E.BRANCHES[x.b] + '</span><small>' + E.ANIMALS[x.b] + '</small></div>';
      }).join('') + '</div>';
      var dm = bz.dm, yy = bz.dmStem % 2 ? T('Ин') : T('Ян');
      var why = bz.strong ? T('Господарят е силен: има нужда да се изрази и да бъде обуздан. Затова палитрата се гради на ') + bz.fav.map(function (e) { return ELN[e]; }).join(', ').replace(/, ([^,]*)$/, T(' и $1')) + '.'
        : T('Господарят е слаб: ') + ELN[bz.fav[0]] + T(' го храни, а ') + ELN[bz.fav[1]] + T(' го подкрепя.');
      var counts = {}; p.all.concat(p.stones).forEach(function (c) { counts[c.el] = (counts[c.el] || 0) + 1; });
      out += sec('bazi', T('Ба Дзъ и петте елемента'), T('Господар на деня: ') + E.STEMS[bz.dmStem] + ' ' + E.STEM_BG[bz.dmStem] + ', ' + yy + ' ' + ELN[dm] + '.',
        T('<p>Ба Дзъ е китайската карта на четирите стълба: годината, месецът, денят и часът на раждане, всеки записан с елемент. Стълбът на деня показва теб, а другите показват средата, в която живее твоят елемент.</p>') +
        pillHTML + '<p>' + why + ' ' + (bz.light ? ELN[bz.light] + T(' е в малки дози, а ') + bz.avoid.map(function (e) { return ELN[e]; }).join(T(' и ')) + (bz.avoid.length > 1 ? T(' остават извън палитрата.') : T(' остава извън палитрата.')) : '') + '</p>' +
        T('<p class="small">В палитрата: ') + ['wood', 'fire', 'earth', 'metal', 'water'].map(function (e) { return ELN[e] + ' ' + (counts[e] || 0); }).join(' · ') + T('. Стълбът на деня и часът са по местно слънчево време.</p>') +
        T('<p class="note">Оценката на силата е опростена. Майстор по Ба Дзъ гледа и специалните структури и сблъсъците между клоните.</p>'));

      /* gua */
      if (ch.gua) {
        var g = ch.gua, gs = D.STONES.filter(function (s) { return s[2] === g.el; }).slice(0, 3).map(function (s) { return s[0]; });
        out += sec('gua', T('Число Гуа'), T('Числото Гуа идва от фън шуй и се смята от годината на раждане. Показва посоките, които те подкрепят: седни с лице към една от тях, когато работиш или водиш важен разговор, и спи с глава към някоя от тях.'),
          T('<dl class="kv"><dt>Число</dt><dd>') + g.n + ' · ' + ELN[g.el] + ' · ' + (g.group === 'east' ? T('източна група') : T('западна група')) + T('</dd><dt>Благоприятни посоки</dt><dd>') + g.dirs.join(', ') + T('</dd><dt>Камъни на елемента</dt><dd>') + gs.join(', ') + '</dd></dl>' +
          (bz && P.tierOf(g.el, bz) === 'avoid' ? T('<p class="note">Елементът на Гуа е неблагоприятен по Ба Дзъ, затова камъните му не влизат в палитрата.</p>') : ''));
      }

      /* human design */
      var HT = D.HD_TYPE[hd.type], Au = D.HD_AUTH[hd.authority], lines = hd.profile.split('/');
      out += sec('hd', T('Хюман дизайн'), T('Хюман дизайнът не дава цветове за облекло. Тук той казва как и кога да ползваш палитрата.'),
        '<p>' + gx(HT.about) + '</p>' + T('<dl class="kv"><dt>Тип</dt><dd>') + HT.name + ', ' + HT.strat + T('</dd><dt>Авторитет</dt><dd>') + Au.name + T('</dd><dt>Профил</dt><dd>') + hd.profile + T('</dd><dt>Дефинирани</dt><dd>') + (hd.defined.map(function (c) { return D.HD_CENTERS[c]; }).join(', ') || T('няма')) + T('</dd><dt>Отворени</dt><dd>') + hd.open.map(function (c) { return D.HD_CENTERS[c]; }).join(', ') + '</dd></dl>' +
        '<ul class="ul"><li>' + gx(HT.wear) + '</li><li>' + Au.rule + '</li>' + lines.filter(function (x, i) { return lines.indexOf(x) === i; }).map(function (l) { return '<li>' + D.HD_LINE[l] + '</li>'; }).join('') + (hd.defined.indexOf('g') >= 0 ? '<li>' + D.HD_G_DEFINED + '</li>' : '') + '</ul>' +
        (hd.open.length ? T('<div class="sub"><h3>Отворени центрове</h3><p class="small">В отворените центрове поемаш влияние отвън. Там са и капаните при пазаруване.</p></div>') +
          '<ul class="ul">' + hd.open.map(function (c) { return '<li><b>' + D.HD_CENTERS[c] + '.</b> ' + gx(D.HD_OPEN[c]) + '</li>'; }).join('') + '</ul>' : '') +
        (lines.indexOf('3') >= 0 && p.test.length ? T('<div class="sub"><h3>Тестови цветове</h3><p class="small">По един на сезон, само от благоприятните елементи.</p>') + grid(p.test) + '</div>' : '') +
        (!ch.hasTime ? T('<p class="note">Без час на раждане хюман дизайнът е сметнат за обяд и може да е различен.</p>') : ''));
    }

    /* swap */
    var reps = P.replacements(p);
    out += sec('swap', T('Замени'), T('Не сменяш гардероба наведнъж. Нещата, които вече имаш в тези цветове, носи далеч от лицето и в малки площи, а до лицето сложи шал, блуза или яка в твой цвят. Когато дойде време за нова дреха, избери някой от предложените цветове.'),
      reps.length ? '<div class="rep">' + reps.map(function (r) { return '<div><i style="background:' + r.hex + T('"></i><span>Вместо ') + lc(r.item) + ': <b>' + r.to.map(function (c) { return lc(c.name); }).join(T(' или ')) + '</b></span></div>'; }).join('') + '</div>' : T('<p>Обичайните неутрални цветове са в палитрата ти.</p>'));

    /* lips */
    var lips = S.lips.map(function (l) { return { name: l[0], hex: l[1], el: l[2], tier: P.tierOf(l[2], bz) }; });
    lips.sort(function (a, b) { return (P.good(b) ? 1 : 0) - (P.good(a) ? 1 : 0); });
    if (st.sex === 'm') out += sec('beauty', T('Коса и очила'), null, '<p>' + gx(S.beauty) + '</p>');
    if (st.sex !== 'm') out += sec('lips', T('Грим, коса и червило'), null,
      '<p>' + gx(S.beauty) + '</p>' + T('<div class="sub"><h3>Червило</h3><p class="small">Червилото е акцентът до лицето: едно наситено червило на визия.</p></div>') + grid(lips) + T('<p><b>Финишът:</b> ') + A1.name + T(' носи ') + A1.finish + (A2 ? ', ' + A2.name + T(' носи ') + A2.finish : '') + T('. В сатен цветът изглежда по-светъл, затова за сатен избирай по-дълбокия тон.</p>') +
      T('<p class="small">Остават извън палитрата: ') + S.lipsAvoid + T('. Пробвай на дневна светлина: правилното червило избелва зъбите, а кожата не посивява и не пожълтява до него.</p>'));

    /* first steps */
    var goodFace = p.face.filter(P.good), goodAcc = p.accent.filter(P.good);
    var jewelS = (p.metalTier === 'light' || p.metalTier === 'avoid') && p.stones[0] ? p.stones[0] : p.metal;
    var f1n = lc(p.sig.f1.name), Au0 = hd ? D.HD_AUTH[hd.authority] : null;
    var steps = [
      '<b>' + T('Прегледай гардероба на дневна светлина.') + '</b> ' + T('Слагай дрехите до лицето една по една. Тези в цветовете за лицето (') + f1n + (goodFace[1] ? ', ' + lc(goodFace[1].name) : '') + T(') остават горе, до лицето. Тези, които те уморяват, слизат долу: панталон, пола, обувки.'),
      '<b>' + T('Най-бързата промяна.') + '</b> ' + gx([T('Шал, блуза или яка в '), T('Шал, риза или пуловер в ')]) + f1n + T(' до лицето, върху нещо, което не е в твоите цветове. Виж разликата в огледалото.'),
      '<b>' + T('Подменяй постепенно.') + '</b> ' + T('Когато нещо се износи, замени го с цвят от палитрата. Първо това, което носиш най-често до лицето: ') + gx([T('блузи, ризи, шалове'), T('ризи, тениски, шалове')]) + T('. После голямата площ: палто или сако в ') + lc(p.sig.b1.name) + T('. Накрая акцентите: чанта в ') + lc((goodAcc[0] || p.accent[0]).name) + T(' и бижу от ') + lc(jewelS.name) + '.',
      '<b>' + T('Преди да купиш, питай три неща.') + '</b> ' + T('В моите цветове ли е? Повтаря ли линията ми? Чувствам ли се като ') + A1.name + '?' + (Au0 ? ' ' + Au0.rule : '')
    ];
    out += open('steps', T('Първи стъпки'), T('Откъде да започнеш, без да сменяш целия гардероб.'), '<ol class="steps">' + steps.map(function (x) { return '<li>' + x + '</li>'; }).join('') + '</ol>');

    /* data */
    var b = st.birth, dl = '';
    if (ch) {
      var pl = b.manual ? (b.mlat + ', ' + b.mlon + ' · ' + b.mtz.replace('off:', 'UTC')) : placeLabel(b.place);
      var off = ch.offset / 60;
      dl += T('<dt>Раждане</dt><dd>') + b.date.split('-').reverse().join('.') + (ch.hasTime ? ', ' + b.time + ' (UTC' + (off >= 0 ? '+' : '') + off + ')' : T(', без час')) + T('</dd><dt>Място</dt><dd>') + esc(pl) + '</dd>';
    }
    dl += T('<dt>Сезон</dt><dd>') + esc(seasonName) + ({ photo: T(', по снимка'), quiz: T(', по въпросите'), pick: T(', избран') }[st.season.src] || '') + T('</dd><dt>Линия</dt><dd>') + L.name + T('</dd><dt>Архетип</dt><dd>') + A1.name + (A2 ? ' / ' + A2.name : '') + '</dd>';
    out += sec('data', T('Изходни данни'), null, '<dl class="kv">' + dl + '</dl>');
    return { html: out, text: resultText(st) };
  }
  function resultText(st) {
    cur = st;
    var R = computeAll(st), p = R.pal, ch = R.chart, L = D.LINES[st.line.value], A1 = arch(st.arch.primary), A2 = arch(st.arch.secondary);
    var t = [];
    t.push(T('СТИЛОВА КАРТА: ') + (T(st.season.sub) || p.S.name) + ' · ' + L.name + ' · ' + A1.name + (A2 ? '/' + A2.name : ''));
    t.push(p.signature);
    if (ch) t.push(T('Ба Дзъ: подсилва ') + ch.bazi.fav.map(function (e) { return ELN[e]; }).join(', ') + (ch.bazi.light ? T('; малко ') + ELN[ch.bazi.light] : '') + T('; избягвай ') + ch.bazi.avoid.map(function (e) { return ELN[e]; }).join(', '));
    [[T('Основа'), p.base], [T('До лицето'), p.face], [T('Акценти'), p.accent], [T('Камъни'), p.stones]].forEach(function (x) { t.push(x[0] + ': ' + x[1].filter(function (c) { return c.tier !== 'avoid'; }).map(function (c) { return c.name + ' ' + c.hex; }).join(', ')); });
    P.formulas(p, ch && ch.bazi, ch && ch.hd).forEach(function (f) { t.push(f.title + ': ' + f.parts.map(function (x) { return x[0].name + ' ' + x[1] + '%'; }).join(' · ')); });
    if (ch) {
      var w = ch.west;
      t.push(T('Западна: Слънце ') + v(w.sun.name) + T(', Луна ') + v(w.moon.name) + (w.asc ? T(', Асцендент ') + v(w.asc.name) : '') + T(', Венера ') + v(w.venus.name));
      t.push(T('Хюман дизайн: ') + D.HD_TYPE[ch.hd.type].name + ', ' + D.HD_AUTH[ch.hd.authority].name + T(' авторитет, профил ') + ch.hd.profile + (ch.gua ? T(' · Гуа ') + ch.gua.n : ''));
    }
    t.push(T('Линия ') + L.name + ': ' + L.plus.map(gx).join('; '));
    return t.join('\n');
  }


  return { clean: clean, invalid: invalid, key: key, teaser: teaser, full: full, text: resultText };
};
if (typeof module !== 'undefined') module.exports = makeReport;
