/* UI */
(function () {
  var D = DATA, P = Scoring;
  var KEY = 'stilova-karta-v1';
  var app = document.getElementById('app');
  var esc = function (s) { return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); };
  var lc = function (s) { return String(s).toLowerCase(); };
  var cap = function (s) { s = String(s); return s.charAt(0).toUpperCase() + s.slice(1); };
  var ELN = D.EL_NAME;
  var IS_PWA = window.__PWA__ === true;
  /* Price and checkout. checkoutReady stays false until payments are connected: then the full result needs a paid order. */
  var IS_SITE = window.__SITE__ === true;
  var LOCAL = typeof makeReport !== 'undefined' && typeof Pal !== 'undefined';
  /* Introductory price until promoUntil (inclusive), then the regular price. Keep in step with lib/pay.js. */
  var CONFIG = { promo: '4,99 €', regular: '19,99 €', promoUntil: '2027-02-28', checkoutReady: IS_SITE };
  function promoOn() { return new Date().toISOString().slice(0, 10) <= CONFIG.promoUntil; }
  function priceNow() { return promoOn() ? CONFIG.promo : CONFIG.regular; }
  function promoDate() { return CONFIG.promoUntil.split('-').reverse().join('.'); }
  function priceTag() { return promoOn() ? CONFIG.promo + ' <s>' + CONFIG.regular + '</s>' : CONFIG.regular; }
  function promoLine() { return promoOn() ? 'Въвеждаща цена до ' + promoDate() + '. След това цената е ' + CONFIG.regular + '.' : ''; }
  function gx(v) { return Array.isArray(v) ? (st.sex === 'm' ? v[1] : v[0]) : v; }
  function gf(f, m) { return st.sex === 'm' ? m : f; }
  function arch(k) { var a = D.ARCH[k]; if (!a) return null; return st.sex === 'm' && a.m ? Object.assign({}, a, a.m) : a; }
  var installEvt = null;
  function standalone() { try { return matchMedia('(display-mode: standalone)').matches || navigator.standalone === true; } catch (e) { return false; } }
  function isIOS() { return /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1); }
  function installCard() {
    if (!IS_PWA || standalone() || mem.installed) return '';
    var body = installEvt ? '<div class="row"><button class="btn" data-act="install">Инсталирай на устройството</button></div>'
      : isIOS() ? '<p class="small">В Safari натисни бутона „Сподели“, после „Добави към началния екран“.</p>'
      : '<p class="small">В менюто на браузъра избери „Инсталирай приложението“ или „Добави към началния екран“.</p>';
    return '<div class="card"><p class="eyebrow">Инсталирай</p><p>След инсталиране приложението се отваря от началния екран и работи без интернет.</p>' + body + '</div>';
  }

  function fresh() {
    return {
      view: 'intro', sex: null, qv: 2,
      birth: { date: '', time: '', noTime: false, place: null, manual: false, mlat: '', mlon: '', mtz: 'Europe/Sofia', sex: 'f', skip: false },
      season: { tab: 'photo', value: null, sub: null, src: null, ai: null, quiz: [], photo: {} },
      line: { answers: [], i: 0, value: null, pick: false, done: false },
      arch: { answers: [], i: 0, primary: null, secondary: null, pick: false, done: false },
      session: null
    };
  }
  var st = fresh();
  var mem = { blob: null, work: null, marks: {}, target: 'skin', aiAvail: false, busy: false, status: '', err: '', toast: '', cacheKey: null, cache: null };
  function save() { try { localStorage.setItem(KEY, JSON.stringify(st)); } catch (e) { } }
  function load() { try { var s = JSON.parse(localStorage.getItem(KEY) || 'null'); if (s && s.birth && s.season) { var f = fresh(); ['birth', 'season', 'line', 'arch'].forEach(function (k) { f[k] = Object.assign(f[k], s[k] || {}); }); f.view = s.view || 'intro'; f.sex = s.sex || (s.birth && s.birth.sex) || null; f.session = s.session || null; if (s.qv !== 2) { f.season.quiz = []; if (f.season.src === 'quiz') { f.season.value = null; f.season.sub = null; f.season.src = null; if (f.view !== 'intro') f.view = 'season'; } } return f; } } catch (e) { } return null; }

  /* ---------- completeness ---------- */
  function birthOk() {
    var b = st.birth;
    if (b.skip) return true;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(b.date)) return false;
    if (!b.noTime && !/^\d{2}:\d{2}$/.test(b.time)) return false;
    if (b.manual) return isFinite(parseFloat(b.mlat)) && isFinite(parseFloat(b.mlon)) && Math.abs(parseFloat(b.mlat)) <= 90 && Math.abs(parseFloat(b.mlon)) <= 180;
    return !!b.place;
  }
  var done = {
    birth: birthOk,
    season: function () { return !!st.season.value; },
    line: function () { return !!st.line.value; },
    arch: function () { return !!st.arch.primary; }
  };
  var ORDER = ['birth', 'season', 'line', 'arch'];
  function canGo(v) { if (!st.sex) return false; var i = ORDER.indexOf(v); if (v === 'result') i = 4; for (var k = 0; k < i; k++) if (!done[ORDER[k]]()) return false; return true; }
  function go(v) { st.view = v; save(); render(); try { window.scrollTo(0, 0); } catch (e) { } }

  /* ---------- shared bits ---------- */
  function top() {
    var cur = ORDER.indexOf(st.view);
    var steps = ORDER.map(function (v, i) {
      var cls = done[v]() ? ' class="done"' : '';
      return '<li><button data-act="go" data-v="' + v + '"' + cls + (i === cur ? ' aria-current="step"' : '') + (canGo(v) ? '' : ' disabled') + ' aria-label="Стъпка ' + (i + 1) + '">' + (i + 1) + '</button></li>';
    }).join('');
    return '<div class="top"><button class="brand" data-act="go" data-v="intro">Стилова карта</button><ol class="steps">' + steps + '</ol></div>';
  }
  function head(n, title, note) {
    return '<header class="sec-head"><p class="eyebrow">Стъпка ' + n + ' от 4</p><h1 class="h-l">' + title + '</h1>' + (note ? '<p class="note">' + note + '</p>' : '') + '</header>';
  }
  function v(sign) { return /^[ВФвф]/.test(sign) ? 'във ' + sign : 'в ' + sign; }
  function seasonStrip(k, n) { if (D.SEASONS[k].strip) return D.SEASONS[k].strip.slice(0, n || 6).map(function (h) { return '<i style="background:' + h + '"></i>'; }).join(''); var cs = D.SEASONS[k].colors.filter(function (c) { return c[3] !== 'test'; }); var pick = [0, 2, 8, 10, 16, 19, 20].slice(0, n || 6).map(function (i) { return cs[i % cs.length]; }); return pick.map(function (c) { return '<i style="background:' + c[1] + '"></i>'; }).join(''); }

  /* ---------- intro ---------- */
  function viewIntro() {
    var has = canGo('result');
    var strips = ['winter', 'summer', 'spring', 'autumn'].map(function (k) {
      return '<div class="strip"><div class="cols">' + seasonStrip(k, 6) + '</div><span>' + D.SEASONS[k].name + '</span></div>';
    }).join('');
    var incl = [
      ['Цветови сезон', 'Кои цветове носят лицето, кожата и очите ти. Определя се по снимка или с няколко въпроса.'],
      ['Линия на тялото', 'Един от 13 типа, от Драматик до Романтик. Казва кои силуети, материи и шарки ти стоят.'],
      ['Стилов архетип', 'Какво излъчваш: един от седем архетипа, от ' + gf('Кралицата до Мистичката', 'Краля до Мистика') + '. Избира материите и детайла.'],
      ['Ба Дзъ', 'Китайската карта на петте елемента. Подрежда цветовете ти: кои те подсилват и кои да носиш малко.'],
      ['Западна и ведическа астрология', 'Слънце, Луна, Асцендент и сегашният ти период, преведени в цветове от твоята палитра.'],
      ['Хюман дизайн', 'Как да носиш палитрата и как да пазаруваш според типа и авторитета си.'],
      ['Число Гуа', 'Личният ти елемент от фън шуй, с благоприятните посоки и камъните към него.']
    ];
    var gets = ['Лична палитра с имена и кодове на цветовете', 'Три нарисувани визии в твоите цветове и твоята линия', 'Двойки цветове, които се носят заедно',
      'Да и не за силуети и шарки', 'Кой метал озарява лицето ти и кои цветове те уморяват', 'Замени за дрехите, които вече имаш'];
    return '<div class="screen intro-screen">' +
      '<header class="hero"><p class="brandmark">Стилова карта</p>' +
      '<p class="eyebrow">Личен стилов анализ</p><h1 class="h-xxl">Твоят стил, разчетен по седем системи</h1>' +
      '<p class="lede">Повечето стилови тестове спират до цветовия тип и формата на тялото. Този анализ добавя архетипа ти и рождената ти карта и ги свежда до една лична палитра с ясни правила за обличане.</p>' +
      '<div class="row"><button class="btn primary" data-act="tostart">Започни анализа</button>' + (has ? '<button class="btn ghost" data-act="go" data-v="result">Виж резултата си</button>' : '') + '<span class="meta">4 стъпки · около 10 минути</span></div>' +
      '<div class="strips" aria-hidden="true">' + strips + '</div></header>' +
      '<section class="sec"><div class="sec-head"><p class="eyebrow">Седем системи</p><h2 class="h-l">Какво включва анализът</h2></div><ol class="incl">' +
      incl.map(function (x) { return '<li><div><b>' + x[0] + '</b><span>' + x[1] + '</span></div></li>'; }).join('') + '</ol></section>' +
      '<section class="sec"><div class="sec-head"><p class="eyebrow">Резултатът</p><h2 class="h-l">Какво получаваш</h2></div><ul class="gets">' + gets.map(function (x) { return '<li>' + x + '</li>'; }).join('') + '</ul></section>' +
      '<section class="sec"><div class="sec-head"><p class="eyebrow">Четири стъпки</p><h2 class="h-l">Как протича</h2></div><ol class="plan">' +
      '<li><div><b>Данни за раждане</b><span>Дата, час и място. От тях се смятат картите.</span></div></li>' +
      '<li><div><b>Цветови сезон</b><span>По снимка, с въпроси или директно, ако го знаеш.</span></div></li>' +
      '<li><div><b>Линия</b><span>Дванадесет въпроса с рисунки за фигурата и лицето.</span></div></li>' +
      '<li><div><b>Архетип</b><span>Девет въпроса за това какво излъчваш.</span></div></li>' +
      '</ol><p class="note">Отговорите се пазят само на това устройство. Снимката не се запазва.' + (IS_SITE ? ' <a href="terms.html">Общи условия</a> · <a href="privacy.html">Поверителност</a>' : '') + '</p></section>' +
      '<section class="sec startbox" id="start"><div class="sec-head"><h2 class="h-l">Започни</h2></div>' +
      '<div class="field"><span class="lbl">Ти си</span><div class="chips" role="group" aria-label="Пол">' +
      '<button type="button" class="chip" data-act="sex" data-v="f" aria-pressed="' + (st.sex === 'f') + '">Жена</button>' +
      '<button type="button" class="chip" data-act="sex" data-v="m" aria-pressed="' + (st.sex === 'm') + '">Мъж</button></div>' +
      '<p class="small">От избора зависят формите в текстовете, архетипите, визиите и числото Гуа.</p></div>' +
      '<div class="price"><b>' + priceTag() + '</b><span>Тестовете и кратък преглед на резултата са безплатни. Пълният резултат струва ' + priceNow() + ', еднократно. ' + promoLine() + '</span></div>' +
      '<div class="row"><button class="btn primary" data-act="start"' + (st.sex ? '' : ' disabled') + '>' + (has ? 'Започни отначало' : 'Започни') + '</button>' + (st.sex ? '' : '<span class="small">Избери „Жена“ или „Мъж“, за да започнеш.</span>') + '</div></section>' +
      '</div>';
  }

  /* ---------- birth ---------- */
  function placeLabel(p) { return p[0] + (p[4] ? ', ' + p[4] : '') + ' · ' + Math.abs(p[1]).toFixed(2) + '° ' + (p[1] >= 0 ? 'с.ш.' : 'ю.ш.') + ', ' + Math.abs(p[2]).toFixed(2) + '° ' + (p[2] >= 0 ? 'и.д.' : 'з.д.'); }
  function viewBirth() {
    var b = st.birth;
    var tzOpts = D.TZS.map(function (z) { return '<option value="' + z + '"' + (b.mtz === z ? ' selected' : '') + '>' + z + '</option>'; }).join('');
    for (var o = -12; o <= 14; o++) { var val = 'off:' + o; tzOpts += '<option value="' + val + '"' + (b.mtz === val ? ' selected' : '') + '>UTC' + (o >= 0 ? '+' : '') + o + '</option>'; }
    var place = b.manual
      ? '<div class="grid2"><div class="field"><label for="b-lat">Ширина</label><input class="input" id="b-lat" inputmode="decimal" placeholder="44.12" value="' + esc(b.mlat) + '"></div><div class="field"><label for="b-lon">Дължина</label><input class="input" id="b-lon" inputmode="decimal" placeholder="27.27" value="' + esc(b.mlon) + '"></div></div>' +
        '<div class="field"><label for="b-tz">Часова зона</label><select class="input" id="b-tz">' + tzOpts + '</select><p class="small">Южна ширина и западна дължина се пишат с минус.</p></div>' +
        '<button type="button" class="link" data-act="manual" data-on="0">Избери от списъка с градове</button>'
      : (b.place
        ? '<div class="picked"><span>' + esc(placeLabel(b.place)) + '</span><button type="button" class="link" data-act="unplace">Смени</button></div>'
        : '<input class="input" id="b-place" autocomplete="off" placeholder="Започни да пишеш, напр. Силистра"><div class="sugg" id="sugg" hidden></div>' +
          '<button type="button" class="link" data-act="manual" data-on="1">Мястото не е в списъка</button>');
    return '<div class="screen">' + top() +
      head(1, 'Данни за раждане', 'От тях се смятат Ба Дзъ, западната и ведическата карта, хюман дизайнът и числото Гуа. Ба Дзъ решава кои цветове от сезона те подсилват.') +
      '<form class="form" id="bform" novalidate>' +
      '<div class="field"><label for="b-date">Дата</label><input class="input" type="date" id="b-date" min="1900-01-01" max="2030-12-31" value="' + esc(b.date) + '"></div>' +
      '<div class="field"><label for="b-time">Час</label><input class="input" type="time" id="b-time" value="' + esc(b.time) + '"' + (b.noTime ? ' disabled' : '') + '>' +
      '<label class="check" for="b-notime"><input type="checkbox" id="b-notime"' + (b.noTime ? ' checked' : '') + '> Не знам часа</label>' +
      (b.noTime ? '<p class="small">Без час няма Асцендент, MC, Лагна и стълб на часа, а хюман дизайнът се смята за обяд и може да е неточен.</p>' : '<p class="small">Местно време, както е в акта за раждане. Лятното часово време се отчита само.</p>') + '</div>' +
      '<div class="field"><span class="lbl">Място</span>' + place + '</div>' +
      (mem.err ? '<p class="err" role="alert">' + mem.err + '</p>' : '') +
      '<div class="row"><button class="btn primary" type="submit">Продължи</button><button type="button" class="link" data-act="skipbirth">Продължи без карта</button></div>' +
      '</form></div>';
  }
  function searchPlaces(q) {
    q = lc(q.trim());
    if (!q) return [];
    var a = [], b = [];
    D.CITIES.forEach(function (c) { var n = lc(c[0]); if (n.indexOf(q) === 0) a.push(c); else if (n.indexOf(q) > 0) b.push(c); });
    return a.concat(b).slice(0, 6);
  }
  function showSugg(q) {
    var box = document.getElementById('sugg'); if (!box) return;
    var r = searchPlaces(q);
    if (!q.trim()) { box.hidden = true; box.innerHTML = ''; return; }
    box.hidden = false;
    box.innerHTML = r.length ? r.map(function (c) { return '<button type="button" data-act="place" data-n="' + esc(c[0]) + '">' + esc(c[0]) + (c[4] ? '<small>' + c[4] + '</small>' : '') + '</button>'; }).join('')
      : '<button type="button" data-act="manual" data-on="1">Няма такъв град в списъка. Въведи координати</button>';
  }
  function submitBirth() {
    var b = st.birth;
    b.skip = false;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(b.date)) mem.err = 'Въведи дата на раждане.';
    else if (!b.noTime && !/^\d{2}:\d{2}$/.test(b.time)) mem.err = 'Въведи час или отметни „Не знам часа“.';
    else if (!birthOk()) mem.err = b.manual ? 'Въведи ширина и дължина като числа, напр. 44.12 и 27.27.' : 'Избери място от списъка.';
    else mem.err = '';
    if (mem.err) { render(); return; }
    mem.cacheKey = null;
    go('season');
  }

  /* ---------- season ---------- */
  var PROMPT = 'Ти си опитен консултант по цветови анализ по системата на четирите сезона с по три подтипа. На снимката е лице. Прецени:\n' +
    '- подтон на кожата: студен, топъл или неутрален;\n- светлота на цялостния облик: светла, средна или дълбока;\n- наситеност: ярка и чиста или мека и приглушена;\n- контраст между коса, кожа и очи: висок, среден или нисък.\n' +
    'Осветлението, балансът на бялото, гримът, филтрите и боядисаната коса изкривяват цветовете. Ако снимката е неподходяща, кажи го в photoNote и намали confidence.\n' +
    'Отговори САМО с JSON, без друг текст:\n' +
    '{"season":"winter|summer|spring|autumn","subtype":"подтип на български, напр. Ярка Зима","undertone":"cool|warm|neutral","value":"light|medium|deep","chroma":"bright|soft","contrast":"high|medium|low","confidence":0.0,"second":"winter|summer|spring|autumn","notes":"2–3 кратки изречения на български за кожата, очите и косата","photoNote":"празно или кратко предупреждение на български за снимката"}\n' +
    'Ако на снимката няма ясно човешко лице, отговори {"error":"no_face"}.';
  var samplePromise = null;
  function getSample() {
    if (!samplePromise) samplePromise = (window.claude && window.claude.use) ? window.claude.use('sample').catch(function () { return null; }) : Promise.resolve(null);
    return samplePromise;
  }
  function resizePhoto(file) {
    return new Promise(function (res, rej) {
      var img = new Image(), url = URL.createObjectURL(file);
      img.onload = function () {
        var m = 1024, w = img.naturalWidth, h = img.naturalHeight, k = Math.min(1, m / Math.max(w, h));
        var cv = document.createElement('canvas'); cv.width = Math.round(w * k); cv.height = Math.round(h * k);
        cv.getContext('2d').drawImage(img, 0, 0, cv.width, cv.height);
        URL.revokeObjectURL(url);
        cv.toBlob(function (b) { b ? res({ blob: b, canvas: cv }) : rej(new Error('blob')); }, 'image/jpeg', 0.86);
      };
      img.onerror = function () { URL.revokeObjectURL(url); rej(new Error('image')); };
      img.src = url;
    });
  }
  function analyse() {
    if (!mem.blob || mem.busy) return;
    mem.busy = true; mem.status = 'Анализирам снимката…'; render();
    getSample().then(function (sample) {
      if (!sample) throw { code: 'unavailable' };
      return Promise.resolve(sample.limits ? sample.limits() : { images: true }).then(function (lim) {
        if (lim && lim.images === false) throw { code: 'unavailable' };
        return sample(PROMPT, { images: [mem.blob], modelTier: 'default' });
      });
    }).then(function (r) {
      var t = (r && r.text) || '', a = t.indexOf('{'), z = t.lastIndexOf('}');
      var j = JSON.parse(t.slice(a, z + 1));
      if (j.error) { mem.status = 'На снимката не се вижда ясно лице. Опитай с друга снимка.'; return; }
      if (!D.SEASONS[j.season]) throw { code: 'parse' };
      st.season.ai = j; st.season.value = j.season; st.season.sub = j.subtype || null; st.season.src = 'photo';
      mem.status = ''; mem.cacheKey = null; save();
    }).catch(function (e) {
      var c = e && e.code;
      mem.status = c === 'unavailable' || c === 'not_granted' ? 'Анализът по снимка работи, когато приложението е отворено в Claude и е разрешено да пита Claude. Отговори на въпросите вместо това.'
        : c === 'rate_limited' ? 'Твърде много заявки. Опитай отново след минута.'
        : 'Анализът не успя. Опитай с друга снимка или отговори на въпросите.';
    }).then(function () { mem.busy = false; render(); });
  }
  var TIP = {
    skin: 'Докосни бузата на място без сянка, руж и отблясък.',
    eye: 'Докосни ириса, цветната част на окото. Ако е малък, снимай по-отблизо.',
    hair: 'Докосни косата близо до корените, където цветът е естествен.',
    white: 'По желание: докосни бял лист или бяла дреха. Така се коригира светлината.'
  };
  function word(x, lo, mid, hi) { return x < -0.3 ? lo : x > 0.3 ? hi : mid; }
  function linHex(r) { return '#' + r.map(function (v) { v = Math.max(0, Math.min(1, v)); v = v <= 0.0031308 ? 12.92 * v : 1.055 * Math.pow(v, 1 / 2.4) - 0.055; return ('0' + Math.round(v * 255).toString(16)).slice(-2); }).join(''); }
  function photoSeason() {
    var ph = st.season.photo;
    if (!ph || !ph.skin || !ph.eye || !ph.hair) return null;
    var p = P.photoScores(ph), q = P.quizScores(st.season.quiz, [0, 1, 5]);
    var r = P.seasonFromScores(p.u + q.u, p.d + q.d, p.c + q.c); r.p = p; return r;
  }
  function applyPhotoSeason() {
    var r = photoSeason(); if (!r) return;
    st.season.value = r.season; st.season.sub = D.SEASONS[r.season].subtypes[r.sub] || null; st.season.src = 'photo'; mem.cacheKey = null;
  }
  function toLin(c) { c /= 255; return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4); }
  function samplePatch(x, y, r) {
    var w = mem.work, ctx = w.getContext('2d');
    var x0 = Math.max(0, x - r), y0 = Math.max(0, y - r), x1 = Math.min(w.width - 1, x + r), y1 = Math.min(w.height - 1, y + r);
    var d = ctx.getImageData(x0, y0, x1 - x0 + 1, y1 - y0 + 1).data, px = [];
    for (var j = y0; j <= y1; j++) for (var i = x0; i <= x1; i++) {
      if ((i - x) * (i - x) + (j - y) * (j - y) > r * r) continue;
      var k = ((j - y0) * (x1 - x0 + 1) + (i - x0)) * 4, R = toLin(d[k]), G = toLin(d[k + 1]), B = toLin(d[k + 2]);
      px.push([R, G, B, 0.2126 * R + 0.7152 * G + 0.0722 * B]);
    }
    if (!px.length) return null;
    px.sort(function (a, b) { return a[3] - b[3]; });
    var lo = Math.floor(px.length * 0.2), hi = Math.max(lo + 1, Math.ceil(px.length * 0.8)), m = [0, 0, 0];
    for (var n = lo; n < hi; n++) { m[0] += px[n][0]; m[1] += px[n][1]; m[2] += px[n][2]; }
    return m.map(function (v) { return v / (hi - lo); });
  }
  function drawPhoto() {
    var cv = document.getElementById('pcv'); if (!cv || !mem.work) return;
    cv.width = mem.work.width; cv.height = mem.work.height;
    var ctx = cv.getContext('2d'); ctx.drawImage(mem.work, 0, 0);
    var u = Math.max(cv.width, cv.height) / 100, lab = { skin: 'К', eye: 'О', hair: 'Кс', white: 'Б' };
    Object.keys(mem.marks).forEach(function (k) {
      var m = mem.marks[k], r = Math.max(6, m[2]);
      ctx.lineWidth = Math.max(2, u * 0.45); ctx.strokeStyle = '#fff'; ctx.beginPath(); ctx.arc(m[0], m[1], r + ctx.lineWidth, 0, 7); ctx.stroke();
      ctx.strokeStyle = '#1C1A20'; ctx.beginPath(); ctx.arc(m[0], m[1], r, 0, 7); ctx.stroke();
      ctx.font = '600 ' + Math.round(u * 3.2) + 'px system-ui,sans-serif'; ctx.fillStyle = '#fff'; ctx.strokeStyle = '#1C1A20'; ctx.lineWidth = Math.max(2, u * 0.5);
      ctx.strokeText(lab[k], m[0] + r + u, m[1] - r); ctx.fillText(lab[k], m[0] + r + u, m[1] - r);
    });
  }
  function tapPhoto(e, cv) {
    var rc = cv.getBoundingClientRect(), x = Math.round((e.clientX - rc.left) * cv.width / rc.width), y = Math.round((e.clientY - rc.top) * cv.height / rc.height);
    var mn = Math.min(cv.width, cv.height), t = mem.target;
    var r = Math.max(2, Math.round(mn * (t === 'eye' ? 0.006 : t === 'white' ? 0.02 : 0.016)));
    var v = samplePatch(x, y, r); if (!v) return;
    st.season.photo = st.season.photo || {};
    st.season.photo[t] = v.map(function (z) { return Math.round(z * 10000) / 10000; });
    mem.marks[t] = [x, y, r];
    var next = ['skin', 'eye', 'hair'].filter(function (k) { return !st.season.photo[k]; })[0];
    mem.target = next || t; mem.status = '';
    applyPhotoSeason(); save(); var yy = window.scrollY; render(); try { window.scrollTo(0, yy); } catch (er) { }
  }
  var LVL = { cool: 'студен', warm: 'топъл', neutral: 'неутрален', light: 'светъл', medium: 'среден', deep: 'дълбок', bright: 'ярка', soft: 'мека', high: 'висок', low: 'нисък' };
  function viewSeason() {
    var s = st.season, tab = s.tab;
    var tabs = [['photo', 'По снимка'], ['quiz', 'С въпроси'], ['pick', 'Знам сезона си']].map(function (t) {
      return '<button role="tab" data-act="stab" data-v="' + t[0] + '" aria-selected="' + (tab === t[0]) + '">' + t[1] + '</button>';
    }).join('');
    var panel = '';
    if (tab === 'photo') {
      var ai = s.ai, ph = s.photo || {}, pr = photoSeason();
      var tg = [['skin', 'Кожа'], ['eye', 'Очи'], ['hair', 'Коса'], ['white', 'Бяло (по желание)']];
      panel = '<ul class="tips"><li>Дневна светлина до прозорец, без пряко слънце, без грим и филтър.</li><li>Бял лист или бяла дреха в кадъра помагат: приложението коригира по тях светлината.</li></ul>' +
        '<div class="row"><label class="btn filebtn" for="photo">' + (mem.work ? 'Друга снимка' : 'Избери снимка') + '<input type="file" id="photo" accept="image/*"></label>' +
        (mem.work && mem.aiAvail ? '<button class="btn" data-act="analyse"' + (mem.busy ? ' disabled' : '') + '>' + (mem.busy ? 'Анализирам…' : 'Провери и с Claude') + '</button>' : '') + '</div>' +
        (mem.work ? '<div class="chips" role="group" aria-label="Какво докосваш">' + tg.map(function (t) {
          return '<button class="chip" data-act="ptarget" data-v="' + t[0] + '" aria-pressed="' + (mem.target === t[0]) + '">' + (ph[t[0]] ? '✓ ' : '') + t[1] + '</button>';
        }).join('') + '</div><p class="small" id="ptip">' + TIP[mem.target] + '</p><canvas id="pcv" class="pcv" aria-label="Снимката. Докосни я, за да измериш цвят."></canvas>' : '') +
        (mem.status ? '<p class="status" role="status">' + esc(mem.status) + '</p>' : '') +
        (ph.skin || ph.eye || ph.hair ? '<div class="dots">' + tg.filter(function (t) { return ph[t[0]]; }).map(function (t) { return '<span><i style="background:' + linHex(ph[t[0]]) + '"></i>' + t[1].replace(' (по желание)', '') + '</span>'; }).join('') + '</div>' : '') +
        '<div class="qlist">' + [0, 1, 5].map(function (i) {
          var q = D.SEASON_Q[i];
          return '<div class="q"><p>' + gx(q.q) + '</p><div class="chips">' + q.a.map(function (a, j) { return '<button class="chip" data-act="sq" data-i="' + i + '" data-j="' + j + '" aria-pressed="' + (s.quiz[i] === j) + '">' + gx(a[0]) + '</button>'; }).join('') + '</div></div>';
        }).join('') + '</div>' +
        (pr ? '<div class="card"><p class="eyebrow">Измерено на снимката</p><p class="small">Подтон ' + word(pr.u, 'студен', 'неутрален', 'топъл') + ' · светлота ' + word(pr.p.d, 'светла', 'средна', 'дълбока') + ' · контраст ' + (pr.p.contrast > 40 ? 'висок' : pr.p.contrast < 22 ? 'нисък' : 'среден') + ' · наситеност ' + word(pr.p.c, 'мека', 'средна', 'ярка') + (pr.p.wb ? ' · светлината е коригирана по бялото' : '') + '</p>' +
          (s.quiz[0] == null && s.quiz[1] == null ? '<p class="small">Подтонът се чете трудно от снимка. Отговорите на въпросите по-горе го уточняват.</p>' : '') + '</div>' : (mem.work ? '' : '<p class="status">Избери снимка, после докосни кожата, окото и косата.</p>')) +
        (ai ? '<div class="card"><p class="eyebrow">Анализ от Claude</p><p><b>' + esc(ai.subtype || D.SEASONS[ai.season].name) + '</b>' + (ai.second && ai.second !== ai.season && D.SEASONS[ai.second] ? ' · близо до ' + D.SEASONS[ai.second].the : '') + '</p>' +
          (ai.notes ? '<p>' + esc(ai.notes) + '</p>' : '') + (ai.photoNote ? '<p class="small">' + esc(ai.photoNote) + '</p>' : '') +
          '<button class="link" data-act="spick" data-v="' + ai.season + '">Избери този сезон</button></div>' : '') +
        '<p class="note">Снимката остава на устройството ти' + (mem.aiAvail ? ', освен ако не я пратиш към Claude' : '') + '. Камерата и светлината менят цветовете, затова резултатът е ориентир.</p>';
    } else if (tab === 'quiz') {
      panel = '<div class="qlist">' + D.SEASON_Q.map(function (q, i) {
        return '<div class="q"><p>' + (i + 1) + '. ' + gx(q.q) + '</p><div class="chips">' + q.a.map(function (a, j) {
          return '<button class="chip" data-act="sq" data-i="' + i + '" data-j="' + j + '" aria-pressed="' + (s.quiz[i] === j) + '">' + gx(a[0]) + '</button>';
        }).join('') + '</div></div>';
      }).join('') + '</div>';
      var n = s.quiz.filter(function (x) { return x != null; }).length;
      if (n < D.SEASON_Q.length) panel += '<p class="status">Отговорени ' + n + ' от ' + D.SEASON_Q.length + '.</p>';
    } else {
      panel = '<div class="seasons">' + ['winter', 'summer', 'spring', 'autumn'].map(function (k) {
        var S = D.SEASONS[k];
        return '<button class="sbtn" data-act="spick" data-v="' + k + '" aria-pressed="' + (s.value === k) + '"><span class="bar">' + seasonStrip(k, 6) + '</span><b>' + S.name + '</b><small>' + S.traits + '</small></button>';
      }).join('') + '</div>';
    }
    var res = s.value ? '<div class="card hl"><p class="eyebrow">Твоят сезон</p><h2 class="h-m">' + esc(s.sub || D.SEASONS[s.value].name) + '</h2><p class="small">' + D.SEASONS[s.value].traits + ' ' + ({ photo: 'Определен по снимка.', quiz: 'Определен по въпросите.', pick: 'Избран от теб.' }[s.src] || '') + '</p>' +
      '<div class="row"><button class="btn primary" data-act="go" data-v="line">Продължи</button>' + (s.src !== 'pick' ? '<button class="link" data-act="stab" data-v="pick">Избери друг сезон</button>' : '') + '</div></div>' : '';
    return '<div class="screen">' + top() + head(2, 'Цветови сезон', 'Сезонът описва какво носят лицето, кожата и очите. Той е рамката на палитрата.') +
      '<div class="panel"><div class="tabs" role="tablist">' + tabs + '</div>' + panel + '</div>' + res + '</div>';
  }

  /* ---------- quizzes ---------- */
  function quizScreen(step, title, kind, i, q, opts, cur) {
    var n = kind === 'line' ? D.LINE_Q.length : D.ARCH_Q.length;
    return '<div class="screen">' + top() + '<div class="quiz">' +
      '<div class="progress" aria-hidden="true"><i style="width:' + (i / n * 100) + '%"></i></div>' +
      '<div class="qtop"><p class="eyebrow">' + title + ' · въпрос ' + (i + 1) + ' от ' + n + '</p><button class="link" data-act="qback" data-k="' + kind + '">Назад</button></div>' +
      '<h1 class="h-l qh" id="qh" tabindex="-1">' + q + '</h1>' +
      '<div class="opts">' + opts.map(function (o) { var ic = kind === 'line' ? Icons.line(i, o[0]) : ''; return '<button class="opt' + (ic ? ' has-ic' : '') + '" data-act="qpick" data-k="' + kind + '" data-v="' + o[0] + '" aria-pressed="' + (cur === o[0]) + '">' + (ic ? '<span class="ic">' + ic + '</span><span>' + o[1] + '</span>' : o[1]) + '</button>'; }).join('') + '</div>' +
      '<button class="link" data-act="qknow" data-k="' + kind + '">' + (kind === 'line' ? 'Знам линията си' : 'Знам архетипа си') + '</button>' +
      '</div></div>';
  }
  function shuffled(i) { var s = (i + 3) * 7919, a = D.ARCH_KEYS.slice(); for (var j = a.length - 1; j > 0; j--) { s = (s * 9301 + 49297) % 233280; var r = Math.floor(s / 233280 * (j + 1)); var t = a[j]; a[j] = a[r]; a[r] = t; } return a; }
  function viewLine() {
    var L = st.line;
    if (!L.done && !L.pick) {
      var q = D.LINE_Q[L.i];
      return quizScreen(3, 'Линия', 'line', L.i, gx(q.q), q.a.map(function (a, j) { return [j, gx(a)]; }), L.answers[L.i]);
    }
    var rank = P.lineRank(L.answers), top3 = rank.slice(0, 3);
    var cur = D.LINES[L.value] || null;
    var body = '';
    if (L.pick) {
      body = '<div class="chips">' + D.LINE_KEYS.map(function (k) { return '<button class="chip" data-act="lpick" data-v="' + k + '" aria-pressed="' + (L.value === k) + '">' + D.LINES[k].name + '</button>'; }).join('') + '</div>';
    } else {
      body = '<div class="sub"><h3>Най-близки линии</h3><div class="chips">' + top3.map(function (r) { return '<button class="chip" data-act="lpick" data-v="' + r.k + '" aria-pressed="' + (L.value === r.k) + '">' + D.LINES[r.k].name + ' · ' + Math.round(r.s * 100) + '%</button>'; }).join('') + '</div></div>';
    }
    return '<div class="screen">' + top() + head(3, 'Линия', 'Линията казва в каква форма да облечеш цветовете: силует, материи, шарки и аксесоари.') +
      (cur ? '<div class="card hl"><p class="eyebrow">Твоята линия</p><h2 class="h-m">' + cur.name + '</h2><p>' + cur.essence + '</p><div class="row"><button class="btn primary" data-act="go" data-v="arch">Продължи</button></div></div>' : '') +
      body +
      '<div class="row">' + (L.pick ? '<button class="link" data-act="lredo">Направи теста</button>' : '<button class="link" data-act="lknow">Избери от всички 13</button><button class="link" data-act="lredo">Направи теста отново</button>') + '</div>' +
      '<p class="note">Тестът е ориентир по системата на тринадесетте линии. Най-точна е преценката на живо, от специалист.</p></div>';
  }
  function viewArch() {
    var A = st.arch;
    if (!A.done && !A.pick) {
      var q = D.ARCH_Q[A.i];
      return quizScreen(4, 'Архетип', 'arch', A.i, gx(q.q), shuffled(A.i).map(function (k) { return [k, gx(q.a[k])]; }), A.answers[A.i]);
    }
    var body;
    if (A.pick) {
      body = '<div class="sub"><h3>Основен архетип</h3><div class="chips">' + D.ARCH_KEYS.map(function (k) { return '<button class="chip" data-act="apick" data-r="p" data-v="' + k + '" aria-pressed="' + (A.primary === k) + '">' + arch(k).name + '</button>'; }).join('') + '</div></div>' +
        '<div class="sub"><h3>Втори глас</h3><div class="chips">' + D.ARCH_KEYS.filter(function (k) { return k !== A.primary; }).map(function (k) { return '<button class="chip" data-act="apick" data-r="s" data-v="' + k + '" aria-pressed="' + (A.secondary === k) + '">' + arch(k).name + '</button>'; }).join('') + '</div></div>';
    } else {
      var r = P.archRank(A.answers);
      body = '<div class="sub"><h3>Как се разпределиха отговорите</h3><div class="dots">' + r.order.filter(function (k) { return r.scores[k] > 0; }).map(function (k) { return '<span>' + arch(k).name + ' ' + Math.round(r.scores[k] / r.total * 100) + '%</span>'; }).join('') + '</div></div>';
    }
    var p = arch(A.primary), s = arch(A.secondary);
    return '<div class="screen">' + top() + head(4, 'Архетип', gf('Архетипът казва какво излъчваш. Той избира материите, детайла и финиша на червилото.', 'Архетипът казва какво излъчваш. Той избира материите и детайла.')) +
      (p ? '<div class="card hl"><p class="eyebrow">Твоят архетип</p><h2 class="h-m">' + p.name + (s ? ' <span class="small">· втори глас: ' + s.name + '</span>' : '') + '</h2><p>' + p.essence + '</p><div class="row"><button class="btn primary" data-act="go" data-v="result">Виж резултата</button></div></div>' : '') +
      body +
      '<div class="row">' + (A.pick ? '<button class="link" data-act="aredo">Направи теста</button>' : '<button class="link" data-act="aknow">' + gf('Избери сама', 'Избери сам') + '</button><button class="link" data-act="aredo">Направи теста отново</button>') + '</div></div>';
  }

  /* ---------- result ---------- */
  function inputOf() {
    return { sex: st.sex, birth: st.birth, season: { value: st.season.value, sub: st.season.sub, src: st.season.src },
      line: { value: st.line.value }, arch: { primary: st.arch.primary, secondary: st.arch.secondary } };
  }
  var localReport = LOCAL ? makeReport(DATA, Pal, Engine, Figure) : null;
  /* Gets the preview, and the full report when it is paid for (or in test mode). */
  function loadReport() {
    var inp = inputOf(), key = JSON.stringify([inp, st.session || null, !!mem.preview]);
    if (mem.rep && mem.rep.key === key) return mem.rep;
    if (localReport) {
      var ci = localReport.clean(inp);
      mem.rep = { key: key, teaser: localReport.teaser(ci), full: mem.preview ? localReport.full(ci) : null, testMode: true, paid: false };
      return mem.rep;
    }
    mem.rep = { key: key, loading: true };
    fetch('/api/report', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ input: inp, session: st.session || null, preview: !!mem.preview }) })
      .then(function (r) { return r.json().then(function (j) { return { ok: r.ok, j: j }; }); })
      .then(function (x) {
        if (!mem.rep || mem.rep.key !== key) return;
        mem.rep = x.ok ? Object.assign({ key: key }, x.j) : { key: key, error: x.j.error || 'Нещо се обърка. Опитай отново.' };
        if (st.view === 'result') render();
      })
      .catch(function () {
        if (!mem.rep || mem.rep.key !== key) return;
        mem.rep = { key: key, error: 'Няма връзка със сървъра. Провери интернета и опитай отново.' };
        if (st.view === 'result') render();
      });
    return mem.rep;
  }
  function payCard(R) {
    var consent = '';
    if (CONFIG.checkoutReady) consent = '<label class="check consent" for="consent"><input type="checkbox" id="consent"' + (mem.consent ? ' checked' : '') + '> <span>' +
      gf('Съгласна', 'Съгласен') + ' съм резултатът да ми бъде предоставен веднага след плащането и знам, че така губя правото си на отказ от покупката. Приемам <a href="terms.html" target="_blank" rel="noopener">Общите условия</a>.</span></label>';
    return '<div class="card hl pay"><p class="eyebrow">Пълен резултат</p><p class="pay-price">' + priceTag() + '</p><p class="small">' + promoLine() + ' Еднократно плащане с карта. Резултатът се отваря веднага след плащането.</p>' +
      consent + '<div class="row"><button class="btn primary" data-act="pay"' + (CONFIG.checkoutReady && !mem.consent || mem.paying ? ' disabled' : '') + '>' + (mem.paying ? 'Отварям плащането…' : 'Отключи пълния резултат') + '</button></div>' +
      (mem.payNote ? '<p class="small" role="status">' + esc(mem.payNote) + '</p>' : '') +
      (R.testMode ? '<button class="link" data-act="preview">Тестов режим: виж пълния резултат без плащане</button>' : '') + '</div>';
  }
  function viewResult() {
    var R = loadReport(), out = '<div class="screen">' + top();
    if (R.loading) return out + '<p class="status" role="status">Подготвям резултата…</p></div>';
    if (R.error) return out + '<p class="err" role="alert">' + esc(R.error) + '</p><div class="row"><button class="btn" data-act="retry">Опитай отново</button><button class="link" data-act="go" data-v="birth">Промени данните</button></div></div>';
    if (R.full) {
      if (!R.paid) out += '<p class="banner">Тестов режим: така изглежда пълният резултат след плащане. <button class="link" data-act="unpreview">Обратно към прегледа</button></p>';
      return out + R.full.html +
        '<div class="foot"><div class="row"><button class="btn primary" data-act="copy">Копирай резултата</button><button class="btn" data-act="go" data-v="birth">Промени данните</button></div>' +
        (mem.toast ? '<p class="toast" role="status">' + mem.toast + '</p>' : '') +
        '<button class="link" data-act="reset">Изтрий и започни отначало</button></div></div>';
    }
    return out + R.teaser.html + '<div class="row"><button class="link" data-act="go" data-v="birth">Промени данните</button></div>' +
      (R.note ? '<p class="err" role="alert">' + esc(R.note) + '</p>' : '') + payCard(R) + '</div>';
  }
  function startCheckout() {
    if (!CONFIG.checkoutReady) { mem.payNote = 'Плащането ще бъде свързано, когато сайтът тръгне.'; render(); return; }
    if (!mem.consent || mem.paying) return;
    mem.paying = true; mem.payNote = ''; render();
    fetch('/api/checkout', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ input: inputOf(), consent: true }) })
      .then(function (r) { return r.json().then(function (j) { return { ok: r.ok, j: j }; }); })
      .then(function (x) {
        if (x.ok && x.j.url) { save(); location.href = x.j.url; return; }
        mem.paying = false; mem.payNote = x.j.error || 'Плащането не можа да започне. Опитай отново.'; render();
      })
      .catch(function () { mem.paying = false; mem.payNote = 'Няма връзка със сървъра. Опитай отново.'; render(); });
  }
  /* ---------- render ---------- */
  function render() {
    var vw = st.view;
    if (vw !== 'intro' && !canGo(vw)) vw = st.view = 'intro';
    app.innerHTML = vw === 'birth' ? viewBirth() : vw === 'season' ? viewSeason() : vw === 'line' ? viewLine() : vw === 'arch' ? viewArch() : vw === 'result' ? viewResult() : viewIntro();
    var qh = document.getElementById('qh'); if (qh) qh.focus({ preventScroll: true });
    drawPhoto();
  }

  /* ---------- events ---------- */
  var busyPick = false;
  app.addEventListener('click', function (e) {
    if (e.target.id === 'pcv') { tapPhoto(e, e.target); return; }
    var b = e.target.closest('[data-act]'); if (!b || b.disabled) return;
    var a = b.dataset.act, val = b.dataset.v;
    if (a === 'go') { if (val === 'intro' || canGo(val)) go(val); }
    else if (a === 'start') { if (canGo('result')) { var sx = st.sex; st = fresh(); st.sex = sx; try { localStorage.removeItem(KEY); } catch (er) { } } mem.cacheKey = null; mem.err = ''; go('birth'); }
    else if (a === 'sex') { st.sex = val; st.birth.sex = val; mem.cacheKey = null; save(); var ys = window.scrollY; render(); try { window.scrollTo(0, ys); } catch (er) { } }
    else if (a === 'manual') { st.birth.manual = b.dataset.on === '1'; if (st.birth.manual) st.birth.place = null; mem.err = ''; save(); render(); }
    else if (a === 'place') { var c = D.CITIES.filter(function (x) { return x[0] === b.dataset.n; })[0]; if (c) { st.birth.place = c; mem.err = ''; save(); render(); } }
    else if (a === 'unplace') { st.birth.place = null; save(); render(); var inp = document.getElementById('b-place'); if (inp) inp.focus(); }
    else if (a === 'skipbirth') { st.birth.skip = true; mem.err = ''; mem.cacheKey = null; go('season'); }
    else if (a === 'stab') { st.season.tab = val; save(); render(); }
    else if (a === 'install' && installEvt) { installEvt.prompt(); installEvt.userChoice.then(function () { installEvt = null; render(); }, function () { }); }
    else if (a === 'pay') startCheckout();
    else if (a === 'retry') { mem.rep = null; render(); }
    else if (a === 'preview') { mem.preview = true; render(); try { window.scrollTo(0, 0); } catch (er) { } }
    else if (a === 'unpreview') { mem.preview = false; render(); try { window.scrollTo(0, 0); } catch (er) { } }
    else if (a === 'tostart') { var sb = document.getElementById('start'); if (sb) sb.scrollIntoView({ behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'start' }); }
    else if (a === 'analyse') analyse();
    else if (a === 'ptarget') { mem.target = val; var y2 = window.scrollY; render(); try { window.scrollTo(0, y2); } catch (er) { } }
    else if (a === 'sq') {
      st.season.quiz[+b.dataset.i] = +b.dataset.j;
      var all = D.SEASON_Q.every(function (q, i) { return st.season.quiz[i] != null; });
      if (st.season.tab === 'photo') applyPhotoSeason();
      else if (all) { var r = P.seasonFromQuiz(st.season.quiz); st.season.value = r.season; st.season.sub = D.SEASONS[r.season].subtypes[r.sub] || null; st.season.src = 'quiz'; mem.cacheKey = null; }
      save(); var y = window.scrollY; render(); try { window.scrollTo(0, y); } catch (er) { }
    }
    else if (a === 'spick') { st.season.value = val; st.season.sub = null; st.season.src = 'pick'; mem.cacheKey = null; save(); render(); }
    else if (a === 'qpick') {
      if (busyPick) return; busyPick = true;
      var k = b.dataset.k, S = st[k], n = (k === 'line' ? D.LINE_Q : D.ARCH_Q).length;
      S.answers[S.i] = k === 'line' ? +val : val;
      app.querySelectorAll('.opt').forEach(function (o) { o.setAttribute('aria-pressed', o === b); });
      setTimeout(function () {
        busyPick = false;
        if (S.i < n - 1) S.i++;
        else {
          S.done = true;
          if (k === 'line') S.value = P.lineRank(S.answers)[0].k;
          else { var r = P.archRank(S.answers); S.primary = r.order[0]; S.secondary = r.scores[r.order[1]] > 0 ? r.order[1] : null; }
        }
        save(); render(); try { window.scrollTo(0, 0); } catch (er) { }
      }, 160);
    }
    else if (a === 'qback') { var S2 = st[b.dataset.k]; if (S2.i > 0) { S2.i--; save(); render(); } else go(b.dataset.k === 'line' ? 'season' : 'line'); }
    else if (a === 'qknow') { var S3 = st[b.dataset.k]; S3.pick = true; save(); render(); }
    else if (a === 'lpick') { st.line.value = val; save(); render(); }
    else if (a === 'lknow') { st.line.pick = true; save(); render(); }
    else if (a === 'lredo') { st.line = fresh().line; save(); render(); }
    else if (a === 'apick') {
      if (b.dataset.r === 'p') { st.arch.primary = val; if (st.arch.secondary === val) st.arch.secondary = null; }
      else st.arch.secondary = st.arch.secondary === val ? null : val;
      save(); render();
    }
    else if (a === 'aknow') { st.arch.pick = true; save(); render(); }
    else if (a === 'aredo') { st.arch = fresh().arch; save(); render(); }
    else if (a === 'goto') { var el = document.getElementById(b.dataset.id); if (el && el.tagName === 'DETAILS') el.open = true; if (el) el.scrollIntoView({ behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'start' }); }
    else if (a === 'copy') {
      var txt = mem.rep && mem.rep.full ? mem.rep.full.text : '';
      var ok = function () { mem.toast = 'Копирано. Можеш да го поставиш в бележка или съобщение.'; render(); var d = document.getElementById('data'); if (d) d.scrollIntoView(); };
      try { navigator.clipboard.writeText(txt).then(ok, function () { mem.toast = 'Браузърът не позволи копиране.'; render(); }); } catch (er) { mem.toast = 'Браузърът не позволи копиране.'; render(); }
    }
    else if (a === 'reset') { st = fresh(); mem.blob = null; mem.work = null; mem.marks = {}; mem.cacheKey = null; mem.toast = ''; mem.status = ''; try { localStorage.removeItem(KEY); } catch (er) { } go('intro'); }
  });
  app.addEventListener('input', function (e) {
    var t = e.target, b = st.birth;
    if (t.id === 'b-date') b.date = t.value;
    else if (t.id === 'b-time') b.time = t.value;
    else if (t.id === 'b-lat') b.mlat = t.value.replace(',', '.');
    else if (t.id === 'b-lon') b.mlon = t.value.replace(',', '.');
    else if (t.id === 'b-place') { showSugg(t.value); return; }
    else return;
    mem.cacheKey = null; save();
  });
  app.addEventListener('change', function (e) {
    var t = e.target, b = st.birth;
    if (t.id === 'b-notime') { b.noTime = t.checked; mem.cacheKey = null; save(); render(); }
    else if (t.id === 'b-tz') { b.mtz = t.value; mem.cacheKey = null; save(); }
    else if (t.id === 'consent') { mem.consent = t.checked; var pb = app.querySelector('[data-act="pay"]'); if (pb) pb.disabled = !t.checked; }
    else if (t.id === 'b-date') { b.date = t.value; save(); }
    else if (t.id === 'b-time') { b.time = t.value; save(); }
    else if (t.id === 'photo' && t.files && t.files[0]) {
      mem.status = 'Подготвям снимката…'; render();
      resizePhoto(t.files[0]).then(function (o) {
        mem.blob = o.blob; mem.work = o.canvas; mem.marks = {}; mem.target = 'skin';
        st.season.photo = {}; st.season.ai = null; mem.status = '';
        save(); render();
        getSample().then(function (smp) { mem.aiAvail = !!smp; if (mem.aiAvail) render(); });
      }, function () { mem.status = 'Тази снимка не може да се отвори. Опитай с JPG или PNG.'; render(); });
    }
  });
  app.addEventListener('submit', function (e) { e.preventDefault(); if (e.target.id === 'bform') submitBirth(); });

  window.addEventListener('beforeinstallprompt', function (e) { e.preventDefault(); installEvt = e; if (st.view === 'intro') render(); });
  window.addEventListener('appinstalled', function () { installEvt = null; mem.installed = true; if (st.view === 'intro') render(); });
  if (IS_PWA && 'serviceWorker' in navigator) window.addEventListener('load', function () { navigator.serviceWorker.register('sw.js').catch(function () { }); });

  var saved = load();
  if (saved) st = saved;
  try {
    var qs = new URLSearchParams(location.search);
    if (qs.get('session_id')) { st.session = qs.get('session_id'); st.view = 'result'; save(); }
    if (qs.get('cancelled')) { st.view = 'result'; mem.payNote = 'Плащането е прекъснато. Можеш да опиташ отново.'; }
    if (qs.get('session_id') || qs.get('cancelled')) history.replaceState(null, '', location.pathname);
  } catch (e) { }
  render();
})();
