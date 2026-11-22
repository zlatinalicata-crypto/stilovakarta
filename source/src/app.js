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
  function priceNow() { return T(promoOn() ? CONFIG.promo : CONFIG.regular); }
  function promoDate() { return CONFIG.promoUntil.split('-').reverse().join('.'); }
  function priceTag() { return promoOn() ? T(CONFIG.promo) + ' <s>' + T(CONFIG.regular) + '</s>' : T(CONFIG.regular); }
  function promoLine() { return promoOn() ? T('Въвеждаща цена до ') + promoDate() + T('. След това цената е ') + T(CONFIG.regular) + '.' : ''; }
  function gx(v) { return Array.isArray(v) ? (st.sex === 'm' ? v[1] : v[0]) : v; }
  function gf(f, m) { return st.sex === 'm' ? m : f; }
  function arch(k) { var a = D.ARCH[k]; if (!a) return null; return st.sex === 'm' && a.m ? Object.assign({}, a, a.m) : a; }
  var installEvt = null;
  function standalone() { try { return matchMedia('(display-mode: standalone)').matches || navigator.standalone === true; } catch (e) { return false; } }
  function isIOS() { return /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1); }
  function installCard() {
    if (!IS_PWA || standalone() || mem.installed) return '';
    var body = installEvt ? T('<div class="row"><button class="btn" data-act="install">Инсталирай на устройството</button></div>')
      : isIOS() ? T('<p class="small">В Safari натисни бутона „Сподели“, после „Добави към началния екран“.</p>')
      : T('<p class="small">В менюто на браузъра избери „Инсталирай приложението“ или „Добави към началния екран“.</p>');
    return T('<div class="card"><p class="eyebrow">Инсталирай</p><p>След инсталиране приложението се отваря от началния екран и работи без интернет.</p>') + body + '</div>';
  }

  function fresh() {
    return {
      view: 'intro', sex: null, qv: 2, lang: null,
      birth: { date: '', time: '', noTime: false, place: null, manual: false, mlat: '', mlon: '', mtz: 'Europe/Sofia', sex: 'f', skip: false },
      season: { tab: 'photo', value: null, sub: null, src: null, ai: null, quiz: [], photo: {} },
      line: { answers: [], i: 0, value: null, pick: false, done: false },
      arch: { answers: [], i: 0, primary: null, secondary: null, pick: false, done: false },
      session: null,
      gift: { to: '', from: '', msg: '' }, giftSession: null, pendingCode: null
    };
  }
  var st = fresh();
  var mem = { blob: null, work: null, marks: {}, target: 'skin', aiAvail: false, busy: false, status: '', err: '', toast: '', cacheKey: null, cache: null };
  function save() { try { localStorage.setItem(KEY, JSON.stringify(st)); } catch (e) { } }
  function load() { try { var s = JSON.parse(localStorage.getItem(KEY) || 'null'); if (s && s.birth && s.season) { var f = fresh(); ['birth', 'season', 'line', 'arch'].forEach(function (k) { f[k] = Object.assign(f[k], s[k] || {}); }); f.view = s.view || 'intro'; f.sex = s.sex || (s.birth && s.birth.sex) || null; f.session = s.session || null; if (s.gift) f.gift = Object.assign(f.gift, s.gift); f.giftSession = s.giftSession || null; f.pendingCode = s.pendingCode || null; f.lang = s.lang === 'en' || s.lang === 'bg' ? s.lang : null; if (s.qv !== 2) { f.season.quiz = []; if (f.season.src === 'quiz') { f.season.value = null; f.season.sub = null; f.season.src = null; if (f.view !== 'intro') f.view = 'season'; } } return f; } } catch (e) { } return null; }

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
      return '<li><button data-act="go" data-v="' + v + '"' + cls + (i === cur ? ' aria-current="step"' : '') + (canGo(v) ? '' : ' disabled') + T(' aria-label="Стъпка ') + (i + 1) + '">' + (i + 1) + '</button></li>';
    }).join('');
    return T('<div class="top"><button class="brand" data-act="go" data-v="intro">Стилова карта</button>') + '<div class="top-r"><ol class="steps">' + steps + '</ol>' + langBtn() + '</div></div>';
  }
  function langBtn() {
    return '<button class="langbtn" data-act="lang" lang="' + (I18N.lang === 'en' ? 'bg' : 'en') + '" aria-label="' + (I18N.lang === 'en' ? 'Български' : 'English') + '">' + (I18N.lang === 'en' ? 'BG' : 'EN') + '</button>';
  }
  function head(n, title, note) {
    return T('<header class="sec-head"><p class="eyebrow">Стъпка ') + n + T(' от 4</p><h1 class="h-l">') + title + '</h1>' + (note ? '<p class="note">' + note + '</p>' : '') + '</header>';
  }
  function v(sign) { return /^[ВФвф]/.test(sign) ? T('във ') + sign : T('в ') + sign; }
  function seasonStrip(k, n) { if (D.SEASONS[k].strip) return D.SEASONS[k].strip.slice(0, n || 6).map(function (h) { return '<i style="background:' + h + '"></i>'; }).join(''); var cs = D.SEASONS[k].colors.filter(function (c) { return c[3] !== 'test'; }); var pick = [0, 2, 8, 10, 16, 19, 20].slice(0, n || 6).map(function (i) { return cs[i % cs.length]; }); return pick.map(function (c) { return '<i style="background:' + c[1] + '"></i>'; }).join(''); }

  /* ---------- intro ---------- */
  function viewIntro() {
    var has = canGo('result');
    var fade = ['winter', 'summer', 'spring', 'autumn'].map(function (k, i) { return '<div class="fs fs' + i + '">' + seasonStrip(k, 6) + '</div>'; }).join('');
    var qs = [
      [T('Кои от твоите цветове подхранват <em>енергията ти</em>?'), T('В картата: цветовете, които те подсилват според Ба Дзъ, и кои да носиш по малко.')],
      [T('Кой цвят за кой ден: <em>изява, работа, ежедневие</em>?'), T('В картата: твоите цветове, подредени по повод.')],
      [T('Какво <em>излъчваш</em> и как да го подсилиш или намалиш?'), T('В картата: твоят архетип и с какво да го усилиш или смекчиш.')],
      [T('Какво да носиш <em>до лицето си</em> и какво надолу по тялото?'), T('В картата: кои цветове стоят близо до лицето и кои по-ниско.')]
    ];
    var why = [
      [T('Без излишни покупки'), T('Знаеш какво търсиш, преди да влезеш в магазина, и подминаваш останалото.')],
      [T('По-бързи сутрини'), T('Цветовите двойки и трите нарисувани визии ти дават готови комбинации, от които да тръгнеш.')],
      [T('Яснота за важния ден'), T('За среща, изява или празник вече знаеш кой цвят да избереш и къде да го носиш.')]
    ];
    var incl = [
      [T('Цветови сезон'), T('Нюансите, които стоят добре до лицето ти.')],
      [T('Линия на тялото'), T('Силуетите, материите и шарките за твоята линия.')],
      [T('Стилов архетип'), T('Какво излъчваш и как да го изразиш с дрехи.')],
      [T('Ба Дзъ'), T('Кои елементи и цветове те подкрепят според рождената ти дата.')],
      [T('Западна и ведическа астрология'), T('Слънце, Луна и Асцендент, преведени в цветове от твоята палитра.')],
      [T('Хюман дизайн'), T('Как да носиш палитрата и как да пазаруваш според типа си.')],
      [T('Число Гуа'), T('Личният ти елемент по традицията на фън шуй.')]
    ];
    var gets = [T('Лична палитра с имена и кодове на цветовете'), T('Цветове по Ба Дзъ: кои те подсилват и кои по малко'), T('Кой цвят за кой повод и къде по тялото'),
      T('Три нарисувани визии в твоите цветове и твоята линия'), T('Да и не за силуети и шарки, двойки цветове'), T('Твоят метал и замени за дрехите, които вече имаш')];
    var locked = [T('Цветове, които те подсилват'), T('Цветове по повод'), T('До лицето и надолу по тялото'), T('Три нарисувани визии'), T('Твоят метал')];
    var cta = '<button class="btn primary" data-act="tostart">' + T('Към теста') + '</button>';
    return '<div class="screen intro-screen">' +
      '<header class="hero"><div class="hero-top"><p class="brandmark">' + T('Стилова карта') + '</p>' + langBtn() + '</div>' +
      (st.pendingCode ? '<p class="gift-note" role="status"><i class="gc-dot" aria-hidden="true"></i><span>' + T('Имаш подаръчна карта. Направи безплатния тест, а кодът ще те чака на резултата.') + '</span></p>' : '') +
      '<p class="eyebrow">' + T('Личен стилов анализ · седем системи') + '</p>' +
      '<h1 class="h-xxl">' + T('Облечи <em>душата си</em>') + '</h1>' +
      '<p class="lede">' + T('Цветът ти харесва. Модерен е. Но твой ли е? С този анализ влизаш в дебрите на душата си и откриваш цветовете на своята енергия. Цветовият сезон, линията и архетипът се срещат с рождената ти карта и се превръщат в ясни указания какво да носиш, кога и къде по тялото.') + '</p>' +
      '<div class="row"><button class="btn light" data-act="tostart" id="cta1">' + T('Към теста') + '</button>' + (has ? '<button class="btn ghost" data-act="go" data-v="result">' + T('Виж резултата си') + '</button>' : '') + '</div>' +
      '<p class="meta">' + T('Безплатен тест · около 10 минути') + '</p>' +
      '<div class="fade" aria-hidden="true">' + fade + '</div></header>' +

      '<section class="sec"><div class="sec-head"><p class="eyebrow">' + T('Знаеш ли') + '</p><h2 class="h-xl">' + T('Палитрата вече я имаш. Знаеш ли останалото?') + '</h2></div><ol class="qs">' +
      qs.map(function (x, i) { return '<li class="q"><span class="q-n" aria-hidden="true">' + (i + 1) + '</span><div><p class="q-t">' + x[0] + '</p><p class="q-a">' + x[1] + '</p></div></li>'; }).join('') + '</ol></section>' +

      '<section class="sec"><div class="sec-head"><p class="eyebrow">' + T('Какво е това') + '</p><h2 class="h-xl">' + T('Седем гледни точки, събрани в една карта') + '</h2>' +
      '<p class="lede">' + T('Стилова карта е личен онлайн анализ на стила. Тя съчетава цветовия ти сезон, линията на тялото и стиловия ти архетип с Ба Дзъ, западна и ведическа астрология, Хюман дизайн и число Гуа. Резултатът е ръководство само за теб: какво да носиш, кога и защо.') + '</p></div>' +
      '<div class="mock"><div class="mock-card"><p class="mock-h"><span>' + T('Стилова карта') + '</span><span>' + T('Примерна карта') + '</span></p>' +
      '<div class="mock-row"><span>' + T('Цветови сезон') + '</span><b>' + D.SEASONS.winter.name + '</b></div><div class="mock-sw">' + seasonStrip('winter', 6) + '</div>' +
      '<div class="mock-row"><span>' + T('Линия') + '</span><b>' + D.LINES.dc.name + '</b></div>' +
      '<p class="mock-cut"><span>' + T('Дотук е откъсът · надолу е пълната карта') + '</span></p>' +
      locked.map(function (x, i) { return '<div class="mock-row lock"><span>' + x + '</span><i style="width:' + [78, 52, 66, 44, 58][i] + 'px"></i></div>'; }).join('') +
      '</div><p class="small">' + T('Примерна карта. Твоята се смята от твоите отговори и рождени данни.') + '</p></div>' +
      '<div class="row">' + cta + '</div></section>' +

      '<section class="sec"><div class="sec-head"><p class="eyebrow">' + T('Защо ти е нужна') + '</p><h2 class="h-xl">' + T('Гардеробът е пълен, а нямаш какво да облечеш?') + '</h2>' +
      '<p class="lede">' + T('Идеята не е капсулен гардероб с готов списък дрехи, а филтър по твоята индивидуалност. С него от всичко, което харесваш, избираш онова, което е наистина твое.') + '</p></div><div class="why">' +
      why.map(function (x) { return '<div><b>' + x[0] + '</b><span>' + x[1] + '</span></div>'; }).join('') + '</div></section>' +

      '<section class="sec"><div class="sec-head"><p class="eyebrow">' + T('Седем системи') + '</p><h2 class="h-l">' + T('Какво включва анализът') + '</h2></div><ol class="incl">' +
      incl.map(function (x) { return '<li><div><b>' + x[0] + '</b><span>' + x[1] + '</span></div></li>'; }).join('') + '</ol></section>' +

      '<section class="sec"><div class="sec-head"><p class="eyebrow">' + T('Резултатът') + '</p><h2 class="h-l">' + T('Какво има в пълната карта') + '</h2></div><ul class="gets">' + gets.map(function (x) { return '<li>' + x + '</li>'; }).join('') + '</ul></section>' +

      '<section class="sec giftsec"><div class="sec-head"><p class="eyebrow">' + T('Подарък') + '</p><h2 class="h-l">' + T('Подари стилова карта') + '</h2>' +
      '<p class="lede">' + T('За някого, който заслужава повече от поредния шал. Получаваш красива карта за печат с личен код, а с него пълният резултат се отключва безплатно.') + '</p></div>' +
      '<div class="row"><button class="btn" data-act="go" data-v="gift">' + T('Подари стилова карта') + '</button></div></section>' +

      '<section class="outro" id="outro"><p class="eyebrow">' + T('Следващата страница') + '</p><h2 class="h-xl">' + T('Ако вече те заинтригувах, продължи с теста') + '</h2>' +
      '<ol class="path"><li><b>' + T('Тестът') + '</b><span>' + T('Безплатен, около 10 минути') + '</span></li><li><b>' + T('Откъсът') + '</b><span>' + T('Веднага виждаш част от картата си') + '</span></li><li><b>' + T('Пълната карта') + '</b><span>' + T('Еднократна такса: ') + priceNow() + '</span></li></ol>' +
      '<div class="row">' + cta + '</div><p class="meta">' + T('Плащаш само ако поискаш пълната карта. Без абонамент.') + '</p></section>' +
      '<div class="stick" id="stick"><span>' + T('Безплатен тест · около 10 минути') + '</span><button class="btn primary" data-act="tostart" tabindex="-1">' + T('Към теста') + '</button></div>' +
      '</div>';
  }
  function viewStart() {
    var has = canGo('result');
    return '<div class="screen">' + T('<div class="top"><button class="brand" data-act="go" data-v="intro">Стилова карта</button>') + '<div class="top-r">' + langBtn() + '</div></div>' +
      '<header class="sec-head"><p class="eyebrow">' + T('Преди да започнем') + '</p><h1 class="h-xl">' + T('Четири кратки стъпки до твоята карта') + '</h1></header>' +
      T('<div class="field"><span class="lbl">Ти си</span><div class="chips big" role="group" aria-label="Пол">') +
      '<button type="button" class="chip" data-act="sex" data-v="f" aria-pressed="' + (st.sex === 'f') + T('">Жена</button>') +
      '<button type="button" class="chip" data-act="sex" data-v="m" aria-pressed="' + (st.sex === 'm') + T('">Мъж</button></div>') +
      T('<p class="small">От избора зависят формите в текстовете, архетипите, визиите и числото Гуа.</p></div>') +
      '<section class="sec"><div class="sec-head"><h2 class="h-l">' + T('Как протича') + '</h2></div><ol class="plan">' +
      T('<li><div><b>Данни за раждане</b><span>Дата, час и място. От тях се смятат картите.</span></div></li>') +
      T('<li><div><b>Цветови сезон</b><span>По снимка, с въпроси или директно, ако го знаеш.</span></div></li>') +
      T('<li><div><b>Линия</b><span>Дванадесет въпроса с рисунки за фигурата и лицето.</span></div></li>') +
      T('<li><div><b>Архетип</b><span>Девет въпроса за това какво излъчваш.</span></div></li>') +
      T('</ol><p class="note">Отговорите се пазят само на това устройство. Снимката не се запазва.') + (IS_SITE ? T(' <a href="terms.html">Общи условия</a> · <a href="privacy.html">Поверителност</a>') : '') + '</p></section>' +
      '<section class="sec startbox"><div class="price"><b>' + priceTag() + T('</b><span>Тестовете и кратък преглед на резултата са безплатни. Пълният резултат струва ') + priceNow() + T(', еднократно. ') + promoLine() + '</span></div>' +
      '<div class="row"><button class="btn primary wide" data-act="start"' + (st.sex ? '' : ' disabled') + '>' + (has ? T('Започни отначало') : T('Започни теста')) + '</button>' + (has ? '<button class="btn" data-act="go" data-v="result">' + T('Виж резултата си') + '</button>' : '') + (st.sex ? '' : '<span class="small">' + T('Избери „Жена“ или „Мъж“, за да продължиш.') + '</span>') + '</div></section>' +
      '</div>';
  }
  function stickSetup() {
    var s = document.getElementById('stick'), a = document.getElementById('cta1'), o = document.getElementById('outro');
    if (!s || !a || !o || !('IntersectionObserver' in window)) return;
    var seen = { a: true, o: false };
    var io = new IntersectionObserver(function (es) {
      es.forEach(function (e) { seen[e.target === a ? 'a' : 'o'] = e.isIntersecting; });
      var on = !seen.a && !seen.o; s.classList.toggle('on', on);
      var b = s.querySelector('button'); if (b) b.tabIndex = on ? 0 : -1;
    });
    io.observe(a); io.observe(o);
  }

  /* ---------- birth ---------- */
  function placeLabel(p) { return I18N.city(p[0]) + (p[4] ? ', ' + T(p[4]) : '') + ' · ' + Math.abs(p[1]).toFixed(2) + '° ' + (p[1] >= 0 ? T('с.ш.') : T('ю.ш.')) + ', ' + Math.abs(p[2]).toFixed(2) + '° ' + (p[2] >= 0 ? T('и.д.') : T('з.д.')); }
  function viewBirth() {
    var b = st.birth;
    var tzOpts = D.TZS.map(function (z) { return '<option value="' + z + '"' + (b.mtz === z ? ' selected' : '') + '>' + z + '</option>'; }).join('');
    for (var o = -12; o <= 14; o++) { var val = 'off:' + o; tzOpts += '<option value="' + val + '"' + (b.mtz === val ? ' selected' : '') + '>UTC' + (o >= 0 ? '+' : '') + o + '</option>'; }
    var place = b.manual
      ? T('<div class="grid2"><div class="field"><label for="b-lat">Ширина</label><input class="input" id="b-lat" inputmode="decimal" placeholder="44.12" value="') + esc(b.mlat) + T('"></div><div class="field"><label for="b-lon">Дължина</label><input class="input" id="b-lon" inputmode="decimal" placeholder="27.27" value="') + esc(b.mlon) + '"></div></div>' +
        T('<div class="field"><label for="b-tz">Часова зона</label><select class="input" id="b-tz">') + tzOpts + T('</select><p class="small">Южна ширина и западна дължина се пишат с минус.</p></div>') +
        T('<button type="button" class="link" data-act="manual" data-on="0">Избери от списъка с градове</button>')
      : (b.place
        ? '<div class="picked"><span>' + esc(placeLabel(b.place)) + T('</span><button type="button" class="link" data-act="unplace">Смени</button></div>')
        : T('<input class="input" id="b-place" autocomplete="off" placeholder="Започни да пишеш, напр. Силистра"><div class="sugg" id="sugg" hidden></div>') +
          T('<button type="button" class="link" data-act="manual" data-on="1">Мястото не е в списъка</button>'));
    return '<div class="screen">' + top() +
      head(1, T('Данни за раждане'), T('От тях се смятат Ба Дзъ, западната и ведическата карта, хюман дизайнът и числото Гуа. Ба Дзъ решава кои цветове от сезона те подсилват.')) +
      '<form class="form" id="bform" novalidate>' +
      T('<div class="field"><label for="b-date">Дата</label><input class="input" type="date" id="b-date" min="1900-01-01" max="2030-12-31" value="') + esc(b.date) + '"></div>' +
      T('<div class="field"><label for="b-time">Час</label><input class="input" type="time" id="b-time" value="') + esc(b.time) + '"' + (b.noTime ? ' disabled' : '') + '>' +
      '<label class="check" for="b-notime"><input type="checkbox" id="b-notime"' + (b.noTime ? ' checked' : '') + T('> Не знам часа</label>') +
      (b.noTime ? T('<p class="small">Без час няма Асцендент, MC, Лагна и стълб на часа, а хюман дизайнът се смята за обяд и може да е неточен.</p>') : T('<p class="small">Местно време, както е в акта за раждане. Лятното часово време се отчита само.</p>')) + '</div>' +
      T('<div class="field"><span class="lbl">Място</span>') + place + '</div>' +
      (mem.err ? '<p class="err" role="alert">' + mem.err + '</p>' : '') +
      T('<div class="row"><button class="btn primary" type="submit">Продължи</button><button type="button" class="link" data-act="skipbirth">Продължи без карта</button></div>') +
      '</form></div>';
  }
  function searchPlaces(q) {
    q = lc(q.trim());
    if (!q) return [];
    var a = [], b = [];
    D.CITIES.forEach(function (c) { var n = lc(c[0]), e = lc(I18N.city(c[0])); if (n.indexOf(q) === 0 || e.indexOf(q) === 0) a.push(c); else if (n.indexOf(q) > 0 || e.indexOf(q) > 0) b.push(c); });
    return a.concat(b).slice(0, 6);
  }
  function showSugg(q) {
    var box = document.getElementById('sugg'); if (!box) return;
    var r = searchPlaces(q);
    if (!q.trim()) { box.hidden = true; box.innerHTML = ''; return; }
    box.hidden = false;
    box.innerHTML = r.length ? r.map(function (c) { return '<button type="button" data-act="place" data-n="' + esc(c[0]) + '">' + esc(I18N.city(c[0])) + (c[4] ? '<small>' + T(c[4]) + '</small>' : '') + '</button>'; }).join('')
      : T('<button type="button" data-act="manual" data-on="1">Няма такъв град в списъка. Въведи координати</button>');
  }
  function submitBirth() {
    var b = st.birth;
    b.skip = false;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(b.date)) mem.err = T('Въведи дата на раждане.');
    else if (!b.noTime && !/^\d{2}:\d{2}$/.test(b.time)) mem.err = T('Въведи час или отметни „Не знам часа“.');
    else if (!birthOk()) mem.err = b.manual ? T('Въведи ширина и дължина като числа, напр. 44.12 и 27.27.') : T('Избери място от списъка.');
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
    mem.busy = true; mem.status = T('Анализирам снимката…'); render();
    getSample().then(function (sample) {
      if (!sample) throw { code: 'unavailable' };
      return Promise.resolve(sample.limits ? sample.limits() : { images: true }).then(function (lim) {
        if (lim && lim.images === false) throw { code: 'unavailable' };
        return sample(PROMPT, { images: [mem.blob], modelTier: 'default' });
      });
    }).then(function (r) {
      var t = (r && r.text) || '', a = t.indexOf('{'), z = t.lastIndexOf('}');
      var j = JSON.parse(t.slice(a, z + 1));
      if (j.error) { mem.status = T('На снимката не се вижда ясно лице. Опитай с друга снимка.'); return; }
      if (!D.SEASONS[j.season]) throw { code: 'parse' };
      st.season.ai = j; st.season.value = j.season; st.season.sub = j.subtype || null; st.season.src = 'photo';
      mem.status = ''; mem.cacheKey = null; save();
    }).catch(function (e) {
      var c = e && e.code;
      mem.status = c === 'unavailable' || c === 'not_granted' ? T('Анализът по снимка работи, когато приложението е отворено в Claude и е разрешено да пита Claude. Отговори на въпросите вместо това.')
        : c === 'rate_limited' ? T('Твърде много заявки. Опитай отново след минута.')
        : T('Анализът не успя. Опитай с друга снимка или отговори на въпросите.');
    }).then(function () { mem.busy = false; render(); });
  }
  var TIP = I18N.wrap({
    skin: 'Докосни бузата на място без сянка, руж и отблясък.',
    eye: 'Докосни ириса, цветната част на окото. Ако е малък, снимай по-отблизо.',
    hair: 'Докосни косата близо до корените, където цветът е естествен.',
    white: 'По желание: докосни бял лист или бяла дреха. Така се коригира светлината.'
  });
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
    st.season.value = r.season; st.season.sub = I18N.inBg(function () { return D.SEASONS[r.season].subtypes[r.sub] || null; }); st.season.src = 'photo'; mem.cacheKey = null;
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
    var u = Math.max(cv.width, cv.height) / 100, lab = { skin: T('К'), eye: T('О'), hair: T('Кс'), white: T('Б') };
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
  var LVL = I18N.wrap({ cool: 'студен', warm: 'топъл', neutral: 'неутрален', light: 'светъл', medium: 'среден', deep: 'дълбок', bright: 'ярка', soft: 'мека', high: 'висок', low: 'нисък' });
  function viewSeason() {
    var s = st.season, tab = s.tab;
    var tabs = [['photo', T('По снимка')], ['quiz', T('С въпроси')], ['pick', T('Знам сезона си')]].map(function (t) {
      return '<button role="tab" data-act="stab" data-v="' + t[0] + '" aria-selected="' + (tab === t[0]) + '">' + t[1] + '</button>';
    }).join('');
    var panel = '';
    if (tab === 'photo') {
      var ai = s.ai, ph = s.photo || {}, pr = photoSeason();
      var tg = [['skin', T('Кожа')], ['eye', T('Очи')], ['hair', T('Коса')], ['white', T('Бяло (по желание)')]];
      panel = T('<ul class="tips"><li>Дневна светлина до прозорец, без пряко слънце, без грим и филтър.</li><li>Бял лист или бяла дреха в кадъра помагат: приложението коригира по тях светлината.</li></ul>') +
        '<div class="row"><label class="btn filebtn" for="photo">' + (mem.work ? T('Друга снимка') : T('Избери снимка')) + '<input type="file" id="photo" accept="image/*"></label>' +
        (mem.work && mem.aiAvail ? '<button class="btn" data-act="analyse"' + (mem.busy ? ' disabled' : '') + '>' + (mem.busy ? T('Анализирам…') : T('Провери и с Claude')) + '</button>' : '') + '</div>' +
        (mem.work ? T('<div class="chips" role="group" aria-label="Какво докосваш">') + tg.map(function (t) {
          return '<button class="chip" data-act="ptarget" data-v="' + t[0] + '" aria-pressed="' + (mem.target === t[0]) + '">' + (ph[t[0]] ? '✓ ' : '') + t[1] + '</button>';
        }).join('') + '</div><p class="small" id="ptip">' + TIP[mem.target] + T('</p><canvas id="pcv" class="pcv" aria-label="Снимката. Докосни я, за да измериш цвят."></canvas>') : '') +
        (mem.status ? '<p class="status" role="status">' + esc(mem.status) + '</p>' : '') +
        (ph.skin || ph.eye || ph.hair ? '<div class="dots">' + tg.filter(function (t) { return ph[t[0]]; }).map(function (t) { return '<span><i style="background:' + linHex(ph[t[0]]) + '"></i>' + t[1].replace(T(' (по желание)'), '') + '</span>'; }).join('') + '</div>' : '') +
        '<div class="qlist">' + [0, 1, 5].map(function (i) {
          var q = D.SEASON_Q[i];
          return '<div class="q"><p>' + gx(q.q) + '</p><div class="chips">' + q.a.map(function (a, j) { return '<button class="chip" data-act="sq" data-i="' + i + '" data-j="' + j + '" aria-pressed="' + (s.quiz[i] === j) + '">' + gx(a[0]) + '</button>'; }).join('') + '</div></div>';
        }).join('') + '</div>' +
        (pr ? T('<div class="card"><p class="eyebrow">Измерено на снимката</p><p class="small">Подтон ') + word(pr.u, T('студен'), T('неутрален'), T('топъл')) + T(' · светлота ') + word(pr.p.d, T('светла'), T('средна'), T('дълбока')) + T(' · контраст ') + (pr.p.contrast > 40 ? T('висок') : pr.p.contrast < 22 ? T('нисък') : T('среден')) + T(' · наситеност ') + word(pr.p.c, T('мека'), T('средна'), T('ярка')) + (pr.p.wb ? T(' · светлината е коригирана по бялото') : '') + '</p>' +
          (s.quiz[0] == null && s.quiz[1] == null ? T('<p class="small">Подтонът се чете трудно от снимка. Отговорите на въпросите по-горе го уточняват.</p>') : '') + '</div>' : (mem.work ? '' : T('<p class="status">Избери снимка, после докосни кожата, окото и косата.</p>'))) +
        (ai ? T('<div class="card"><p class="eyebrow">Анализ от Claude</p><p><b>') + esc(ai.subtype || D.SEASONS[ai.season].name) + '</b>' + (ai.second && ai.second !== ai.season && D.SEASONS[ai.second] ? T(' · близо до ') + D.SEASONS[ai.second].the : '') + '</p>' +
          (ai.notes ? '<p>' + esc(ai.notes) + '</p>' : '') + (ai.photoNote ? '<p class="small">' + esc(ai.photoNote) + '</p>' : '') +
          '<button class="link" data-act="spick" data-v="' + ai.season + T('">Избери този сезон</button></div>') : '') +
        T('<p class="note">Снимката остава на устройството ти') + (mem.aiAvail ? T(', освен ако не я пратиш към Claude') : '') + T('. Камерата и светлината менят цветовете, затова резултатът е ориентир.</p>');
    } else if (tab === 'quiz') {
      panel = '<div class="qlist">' + D.SEASON_Q.map(function (q, i) {
        return '<div class="q"><p>' + (i + 1) + '. ' + gx(q.q) + '</p><div class="chips">' + q.a.map(function (a, j) {
          return '<button class="chip" data-act="sq" data-i="' + i + '" data-j="' + j + '" aria-pressed="' + (s.quiz[i] === j) + '">' + gx(a[0]) + '</button>';
        }).join('') + '</div></div>';
      }).join('') + '</div>';
      var n = s.quiz.filter(function (x) { return x != null; }).length;
      if (n < D.SEASON_Q.length) panel += T('<p class="status">Отговорени ') + n + T(' от ') + D.SEASON_Q.length + '.</p>';
    } else {
      panel = '<div class="seasons">' + ['winter', 'summer', 'spring', 'autumn'].map(function (k) {
        var S = D.SEASONS[k];
        return '<button class="sbtn" data-act="spick" data-v="' + k + '" aria-pressed="' + (s.value === k) + '"><span class="bar">' + seasonStrip(k, 6) + '</span><b>' + S.name + '</b><small>' + S.traits + '</small></button>';
      }).join('') + '</div>';
    }
    var res = s.value ? T('<div class="card hl"><p class="eyebrow">Твоят сезон</p><h2 class="h-m">') + esc(T(s.sub) || D.SEASONS[s.value].name) + '</h2><p class="small">' + D.SEASONS[s.value].traits + ' ' + ({ photo: T('Определен по снимка.'), quiz: T('Определен по въпросите.'), pick: T('Избран от теб.') }[s.src] || '') + '</p>' +
      T('<div class="row"><button class="btn primary" data-act="go" data-v="line">Продължи</button>') + (s.src !== 'pick' ? T('<button class="link" data-act="stab" data-v="pick">Избери друг сезон</button>') : '') + '</div></div>' : '';
    return '<div class="screen">' + top() + head(2, T('Цветови сезон'), T('Сезонът описва какво носят лицето, кожата и очите. Той е рамката на палитрата.')) +
      '<div class="panel"><div class="tabs" role="tablist">' + tabs + '</div>' + panel + '</div>' + res + '</div>';
  }

  /* ---------- quizzes ---------- */
  function quizScreen(step, title, kind, i, q, opts, cur) {
    var n = kind === 'line' ? D.LINE_Q.length : D.ARCH_Q.length;
    return '<div class="screen">' + top() + '<div class="quiz">' +
      '<div class="progress" aria-hidden="true"><i style="width:' + (i / n * 100) + '%"></i></div>' +
      '<div class="qtop"><p class="eyebrow">' + title + T(' · въпрос ') + (i + 1) + T(' от ') + n + '</p><button class="link" data-act="qback" data-k="' + kind + T('">Назад</button></div>') +
      '<h1 class="h-l qh" id="qh" tabindex="-1">' + q + '</h1>' +
      '<div class="opts">' + opts.map(function (o) { var ic = kind === 'line' ? Icons.line(i, o[0]) : ''; return '<button class="opt' + (ic ? ' has-ic' : '') + '" data-act="qpick" data-k="' + kind + '" data-v="' + o[0] + '" aria-pressed="' + (cur === o[0]) + '">' + (ic ? '<span class="ic">' + ic + '</span><span>' + o[1] + '</span>' : o[1]) + '</button>'; }).join('') + '</div>' +
      '<button class="link" data-act="qknow" data-k="' + kind + '">' + (kind === 'line' ? T('Знам линията си') : T('Знам архетипа си')) + '</button>' +
      '</div></div>';
  }
  function shuffled(i) { var s = (i + 3) * 7919, a = D.ARCH_KEYS.slice(); for (var j = a.length - 1; j > 0; j--) { s = (s * 9301 + 49297) % 233280; var r = Math.floor(s / 233280 * (j + 1)); var t = a[j]; a[j] = a[r]; a[r] = t; } return a; }
  function viewLine() {
    var L = st.line;
    if (!L.done && !L.pick) {
      var q = D.LINE_Q[L.i];
      return quizScreen(3, T('Линия'), 'line', L.i, gx(q.q), q.a.map(function (a, j) { return [j, gx(a)]; }), L.answers[L.i]);
    }
    var rank = P.lineRank(L.answers), top3 = rank.slice(0, 3);
    var cur = D.LINES[L.value] || null;
    var body = '';
    if (L.pick) {
      body = '<div class="chips">' + D.LINE_KEYS.map(function (k) { return '<button class="chip" data-act="lpick" data-v="' + k + '" aria-pressed="' + (L.value === k) + '">' + D.LINES[k].name + '</button>'; }).join('') + '</div>';
    } else {
      body = T('<div class="sub"><h3>Най-близки линии</h3><div class="chips">') + top3.map(function (r) { return '<button class="chip" data-act="lpick" data-v="' + r.k + '" aria-pressed="' + (L.value === r.k) + '">' + D.LINES[r.k].name + ' · ' + Math.round(r.s * 100) + '%</button>'; }).join('') + '</div></div>';
    }
    return '<div class="screen">' + top() + head(3, T('Линия'), T('Линията казва в каква форма да облечеш цветовете: силует, материи, шарки и аксесоари.')) +
      (cur ? T('<div class="card hl"><p class="eyebrow">Твоята линия</p><h2 class="h-m">') + cur.name + '</h2><p>' + cur.essence + T('</p><div class="row"><button class="btn primary" data-act="go" data-v="arch">Продължи</button></div></div>') : '') +
      body +
      '<div class="row">' + (L.pick ? T('<button class="link" data-act="lredo">Направи теста</button>') : T('<button class="link" data-act="lknow">Избери от всички 13</button><button class="link" data-act="lredo">Направи теста отново</button>')) + '</div>' +
      T('<p class="note">Тестът е ориентир по системата на тринадесетте линии. Най-точна е преценката на живо, от специалист.</p></div>');
  }
  function viewArch() {
    var A = st.arch;
    if (!A.done && !A.pick) {
      var q = D.ARCH_Q[A.i];
      return quizScreen(4, T('Архетип'), 'arch', A.i, gx(q.q), shuffled(A.i).map(function (k) { return [k, gx(q.a[k])]; }), A.answers[A.i]);
    }
    var body;
    if (A.pick) {
      body = T('<div class="sub"><h3>Основен архетип</h3><div class="chips">') + D.ARCH_KEYS.map(function (k) { return '<button class="chip" data-act="apick" data-r="p" data-v="' + k + '" aria-pressed="' + (A.primary === k) + '">' + arch(k).name + '</button>'; }).join('') + '</div></div>' +
        T('<div class="sub"><h3>Втори глас</h3><div class="chips">') + D.ARCH_KEYS.filter(function (k) { return k !== A.primary; }).map(function (k) { return '<button class="chip" data-act="apick" data-r="s" data-v="' + k + '" aria-pressed="' + (A.secondary === k) + '">' + arch(k).name + '</button>'; }).join('') + '</div></div>';
    } else {
      var r = P.archRank(A.answers);
      body = T('<div class="sub"><h3>Как се разпределиха отговорите</h3><div class="dots">') + r.order.filter(function (k) { return r.scores[k] > 0; }).map(function (k) { return '<span>' + arch(k).name + ' ' + Math.round(r.scores[k] / r.total * 100) + '%</span>'; }).join('') + '</div></div>';
    }
    var p = arch(A.primary), s = arch(A.secondary);
    return '<div class="screen">' + top() + head(4, T('Архетип'), gf(T('Архетипът казва какво излъчваш. Той избира материите, детайла и финиша на червилото.'), T('Архетипът казва какво излъчваш. Той избира материите и детайла.'))) +
      (p ? T('<div class="card hl"><p class="eyebrow">Твоят архетип</p><h2 class="h-m">') + p.name + (s ? T(' <span class="small">· втори глас: ') + s.name + '</span>' : '') + '</h2><p>' + p.essence + T('</p><div class="row"><button class="btn primary" data-act="go" data-v="result">Виж резултата</button></div></div>') : '') +
      body +
      '<div class="row">' + (A.pick ? T('<button class="link" data-act="aredo">Направи теста</button>') : '<button class="link" data-act="aknow">' + gf(T('Избери сама'), T('Избери сам')) + T('</button><button class="link" data-act="aredo">Направи теста отново</button>')) + '</div></div>';
  }

  /* ---------- result ---------- */
  function inputOf() {
    return { sex: st.sex, birth: st.birth, season: { value: st.season.value, sub: st.season.sub, src: st.season.src },
      line: { value: st.line.value }, arch: { primary: st.arch.primary, secondary: st.arch.secondary } };
  }
  var localReport = LOCAL ? makeReport(DATA, Pal, Engine, Figure) : null;
  /* Gets the preview, and the full report when it is paid for (or in test mode). */
  function loadReport() {
    var inp = inputOf(), key = JSON.stringify([inp, st.session || null, !!mem.preview, I18N.lang]);
    if (mem.rep && mem.rep.key === key) return mem.rep;
    if (localReport) {
      var ci = localReport.clean(inp);
      mem.rep = { key: key, teaser: localReport.teaser(ci), full: mem.preview ? localReport.full(ci) : null, testMode: true, paid: false };
      return mem.rep;
    }
    mem.rep = { key: key, loading: true };
    fetch('/api/report', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ input: inp, session: st.session || null, preview: !!mem.preview, lang: I18N.lang }) })
      .then(function (r) { return r.json().then(function (j) { return { ok: r.ok, j: j }; }); })
      .then(function (x) {
        if (!mem.rep || mem.rep.key !== key) return;
        mem.rep = x.ok ? Object.assign({ key: key }, x.j) : { key: key, error: x.j.error || T('Нещо се обърка. Опитай отново.') };
        if (st.view === 'result') render();
      })
      .catch(function () {
        if (!mem.rep || mem.rep.key !== key) return;
        mem.rep = { key: key, error: T('Няма връзка със сървъра. Провери интернета и опитай отново.') };
        if (st.view === 'result') render();
      });
    return mem.rep;
  }
  /* Codes: checked on the server, which also gives the new price. */
  function money(cents) { var v = (cents / 100).toFixed(2); return I18N.lang === 'en' ? '€' + v : v.replace('.', ',') + ' €'; }
  function codeBox() {
    if (!CONFIG.checkoutReady) return '';
    var c = mem.code;
    if (!c && !mem.codeOpen && st.pendingCode && st.view === 'result') { mem.codeOpen = true; if (!mem.codeInput) mem.codeInput = st.pendingCode; }
    if (c) return '<p class="small code-ok" role="status">' + (c.gift ? T('Подаръчният код отключва пълния резултат.') : c.free ? T('Кодът отключва пълния резултат безплатно.') : T('Кодът е приложен: −') + c.pct + '%.') + ' <button class="link" data-act="uncode">' + T('Махни кода') + '</button></p>';
    if (!mem.codeOpen) return '<div class="row"><button class="link" data-act="codeopen">' + T('Имам код за отстъпка') + '</button></div>';
    return '<div class="code-row"><input class="input" id="code" type="text" autocomplete="off" autocapitalize="off" autocorrect="off" spellcheck="false" maxlength="40" placeholder="' + T('Код') + '" aria-label="' + T('Код за отстъпка') + '" value="' + esc(mem.codeInput || '') + '">' +
      '<button class="btn" data-act="code"' + (mem.codeBusy ? ' disabled' : '') + '>' + T('Приложи') + '</button></div>' +
      (mem.codeErr ? '<p class="err" role="alert">' + esc(mem.codeErr) + '</p>' : '');
  }
  function applyCode() {
    var v = String(mem.codeInput || '').trim();
    if (!v || mem.codeBusy) return;
    mem.codeBusy = true; mem.codeErr = ''; render();
    fetch('/api/checkout', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ code: v, dry: true, lang: I18N.lang, input: st.view === 'result' ? inputOf() : null, forGift: st.view === 'gift' }) })
      .then(function (r) { return r.json().then(function (j) { return { ok: r.ok, j: j }; }); })
      .then(function (x) {
        mem.codeBusy = false;
        if (x.ok && (x.j.free || x.j.pct)) { mem.code = { code: v, free: !!x.j.free, gift: !!x.j.gift, pct: x.j.pct, cents: x.j.cents }; mem.codeOpen = false; mem.payNote = ''; }
        else mem.codeErr = x.j.error || T('Този код не е валиден. Провери как е изписан.');
        render();
      })
      .catch(function () { mem.codeBusy = false; mem.codeErr = T('Няма връзка със сървъра. Опитай отново.'); render(); });
  }
  function payCard(R) {
    var consent = '', c = mem.code;
    var price = !c ? priceTag() : (c.free ? T('Безплатно') : money(c.cents)) + ' <s>' + priceNow() + '</s>';
    if (CONFIG.checkoutReady) consent = '<label class="check consent" for="consent"><input type="checkbox" id="consent"' + (mem.consent ? ' checked' : '') + '> <span>' +
      (c && c.free ? T('Приемам <a href="terms.html" target="_blank" rel="noopener">Общите условия</a>.</span></label>') :
      gf(T('Съгласна'), T('Съгласен')) + T(' съм резултатът да ми бъде предоставен веднага след плащането и знам, че така губя правото си на отказ от покупката. Приемам <a href="terms.html" target="_blank" rel="noopener">Общите условия</a>.</span></label>'));
    /* Card payments not switched on yet (no live Stripe key): say so; codes still work. */
    var soon = CONFIG.checkoutReady && R.payReady === false && !(c && c.free);
    var info = c && c.free ? '' : soon ? (promoLine() ? '<p class="small">' + promoLine() + '</p>' : '') + '<p class="banner" role="status">' + T('Плащането с карта ще бъде включено съвсем скоро.') + '</p>' :
      '<p class="small">' + promoLine() + T(' Еднократно плащане с карта. Резултатът се отваря веднага след плащането.</p>');
    return T('<div class="card hl pay"><p class="eyebrow">Пълен резултат</p><p class="pay-price">') + price + '</p>' + info +
      codeBox() + (soon ? '' : consent + '<div class="row"><button class="btn primary" data-act="pay"' + (CONFIG.checkoutReady && !mem.consent || mem.paying ? ' disabled' : '') + '>' + (mem.paying ? (c && c.free ? T('Отключвам…') : T('Отварям плащането…')) : (c && c.free ? T('Отключи безплатно') : T('Отключи пълния резултат'))) + '</button></div>') +
      (mem.payNote ? '<p class="small" role="status">' + esc(mem.payNote) + '</p>' : '') +
      (R.testMode ? T('<button class="link" data-act="preview">Тестов режим: виж пълния резултат без плащане</button>') : '') +
      (CONFIG.checkoutReady ? '<div class="row"><button class="link" data-act="go" data-v="gift">' + T('Подари стилова карта на някого') + '</button></div>' : '') + '</div>';
  }
  function viewResult() {
    var R = loadReport(), out = '<div class="screen">' + top();
    if (R.loading) return out + T('<p class="status" role="status">Подготвям резултата…</p></div>');
    if (R.error) return out + '<p class="err" role="alert">' + esc(R.error) + T('</p><div class="row"><button class="btn" data-act="retry">Опитай отново</button><button class="link" data-act="go" data-v="birth">Промени данните</button></div></div>');
    if (R.full) {
      if (!R.paid) out += T('<p class="banner">Тестов режим: така изглежда пълният резултат след плащане. <button class="link" data-act="unpreview">Обратно към прегледа</button></p>');
      return out + '<div class="print-only print-head"><span>' + T('Стилова карта') + '</span><span>' + todayStr() + '</span></div>' + R.full.html +
        '<div class="print-only print-foot"><span>' + T('Стилова карта') + '</span><span>' + T('Личен стилов анализ') + ' · ' + todayStr() + '</span></div>' +
        '<div class="foot"><div class="row"><button class="btn primary" data-act="pdf">' + T('Запази като PDF') + '</button><button class="btn" data-act="copy">' + T('Копирай резултата') + '</button></div>' +
        '<p class="small">' + pdfHint() + '</p>' +
        '<div class="row"><button class="btn ghost" data-act="go" data-v="birth">' + T('Промени данните') + '</button></div>' +
        (mem.toast ? '<p class="toast" role="status">' + mem.toast + '</p>' : '') +
        T('<button class="link" data-act="reset">Изтрий и започни отначало</button></div></div>');
    }
    return out + R.teaser.html + T('<div class="row"><button class="link" data-act="go" data-v="birth">Промени данните</button></div>') +
      (R.note ? '<p class="err" role="alert">' + esc(R.note) + '</p>' : '') + payCard(R) + '</div>';
  }
  /* PDF: the browser's own print engine saves the full result as a PDF (vector text, real colours). All sections are opened first. */
  var UA = navigator.userAgent || '';
  var IN_APP = /Instagram|FBAN|FBAV|FB_IAB|FBIOS|Messenger|TikTok|musical_ly|Bytedance|Line\//i.test(UA);
  var IOS = /iPad|iPhone|iPod/.test(UA) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  function todayStr() { var d = new Date(); return ('0' + d.getDate()).slice(-2) + '.' + ('0' + (d.getMonth() + 1)).slice(-2) + '.' + d.getFullYear(); }
  function pdfHint() {
    if (IN_APP) return T('Вграденият браузър на Instagram и Facebook не запазва PDF. Отвори менюто горе вдясно и избери „Отвори в браузър“, или използвай „Копирай резултата“.');
    if (IOS) return T('Ще се отвори прозорецът за печат. Натисни иконата за споделяне горе и избери „Запази във Файлове“.');
    return T('Ще се отвори прозорецът за печат. За принтер избери „Запази като PDF“.');
  }
  function openAll() { [].forEach.call(document.querySelectorAll('details'), function (d) { d.open = true; }); }
  var oldTitle = null;
  function savePdf() {
    openAll();
    var h = document.querySelector('.res-head h1');
    oldTitle = document.title;
    document.title = T('Стилова карта') + (h ? ' – ' + h.textContent.trim() : '');
    try { window.print(); } catch (e) { mem.toast = T('Браузърът не позволи запазване. Опитай от Chrome или Safari.'); render(); }
  }
  window.addEventListener('beforeprint', openAll);
  window.addEventListener('afterprint', function () { if (oldTitle !== null) { document.title = oldTitle; oldTitle = null; } });
  function startCheckout() {
    if (!CONFIG.checkoutReady) { mem.payNote = T('Плащането ще бъде свързано, когато сайтът тръгне.'); render(); return; }
    if (!mem.consent || mem.paying) return;
    mem.paying = true; mem.payNote = ''; render();
    fetch('/api/checkout', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ input: inputOf(), consent: true, lang: I18N.lang, code: mem.code ? mem.code.code : null }) })
      .then(function (r) { return r.json().then(function (j) { return { ok: r.ok, j: j }; }); })
      .then(function (x) {
        if (x.ok && x.j.url) { save(); location.href = x.j.url; return; }
        if (x.ok && x.j.session) { st.session = x.j.session; st.pendingCode = null; mem.paying = false; mem.code = null; mem.rep = null; save(); render(); try { window.scrollTo(0, 0); } catch (er) { } return; }
        if (x.j.badCode) mem.code = null;
        mem.paying = false; mem.payNote = x.j.error || T('Плащането не можа да започне. Опитай отново.'); render();
      })
      .catch(function () { mem.paying = false; mem.payNote = T('Няма връзка със сървъра. Опитай отново.'); render(); });
  }
  /* ---------- gift card ---------- */
  /* The buyer types names and a wish, pays, and gets a printable card with a code. The code unlocks one full result. */
  function giftTop() { return '<div class="screen">' + T('<div class="top"><button class="brand" data-act="go" data-v="intro">Стилова карта</button>') + '<div class="top-r">' + langBtn() + '</div></div>'; }
  function giftStatus() {
    if (!IS_SITE || mem.giftReady != null || mem.giftReadyBusy) return;
    mem.giftReadyBusy = true;
    fetch('/api/gift', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ lang: I18N.lang }) })
      .then(function (r) { return r.json(); })
      .then(function (j) { mem.giftReadyBusy = false; mem.giftReady = j.payReady !== false; if (st.view === 'gift') render(); })
      .catch(function () { mem.giftReadyBusy = false; mem.giftReady = true; });
  }
  function giftField(id, label, val, area) {
    var lbl = '<label class="lbl" for="g-' + id + '">' + label + ' <small>' + T('(по желание)') + '</small></label>';
    return '<div class="field">' + lbl + (area ? '<textarea class="input" id="g-' + id + '" maxlength="200" rows="3">' + esc(val) + '</textarea>'
      : '<input class="input" id="g-' + id + '" type="text" maxlength="40" autocomplete="off" value="' + esc(val) + '">') + '</div>';
  }
  function viewGift() {
    giftStatus();
    var g = st.gift, c = mem.code && !mem.code.free ? mem.code : null;
    var price = c ? money(c.cents) + ' <s>' + priceNow() + '</s>' : priceTag();
    var soon = CONFIG.checkoutReady && mem.giftReady === false;
    var info = soon ? (promoLine() ? '<p class="small">' + promoLine() + '</p>' : '') + '<p class="banner" role="status">' + T('Плащането с карта ще бъде включено съвсем скоро.') + '</p>'
      : '<p class="small">' + promoLine() + T(' Еднократно плащане с карта. Картата с кода се отваря веднага след плащането.') + '</p>';
    var consent = CONFIG.checkoutReady ? '<label class="check consent" for="gconsent"><input type="checkbox" id="gconsent"' + (mem.giftConsent ? ' checked' : '') + '> <span>' +
      T('Приемам <a href="terms.html" target="_blank" rel="noopener">Общите условия</a>. Неизползван подаръчен код може да бъде върнат до 14 дни след покупката.') + '</span></label>' : '';
    return giftTop() +
      '<header class="sec-head"><p class="eyebrow">' + T('Подаръчна карта') + '</p><h1 class="h-xl">' + T('Подари стилова карта') + '</h1>' +
      '<p class="lede">' + T('Подарък, който не е поредният шал. Получаваш красива карта за печат с личен код, а с него пълният резултат се отключва безплатно.') + '</p></header>' +
      '<ol class="plan">' + T('<li><div><b>Плащаш</b><span>Еднократно, с карта. Цената е като на пълния резултат.</span></div></li>') +
      T('<li><div><b>Получаваш картата</b><span>Отваря се веднага, с името, пожеланието и личния код. Принтираш я или я пращаш като PDF.</span></div></li>') +
      T('<li><div><b>Подаряваш</b><span>Човекът прави безплатния тест и въвежда кода на резултата. Пълната карта се отключва веднага.</span></div></li>') + '</ol>' +
      '<div class="gift-form">' + giftField('to', T('За кого'), g.to) + giftField('from', T('От кого'), g.from) + giftField('msg', T('Пожелание'), g.msg, true) + '</div>' +
      '<div class="card hl pay"><p class="eyebrow">' + T('Подаръчна карта') + '</p><p class="pay-price">' + price + '</p>' + info + codeBox() +
      (soon ? '' : consent + '<div class="row"><button class="btn primary" data-act="giftbuy"' + (CONFIG.checkoutReady && !mem.giftConsent || mem.paying ? ' disabled' : '') + '>' + (mem.paying ? T('Отварям плащането…') : T('Купи подаръчната карта')) + '</button></div>') +
      (mem.giftNote ? '<p class="small" role="status">' + esc(mem.giftNote) + '</p>' : '') + '</div>' +
      '<div class="row"><button class="link" data-act="go" data-v="intro">' + T('Към началото') + '</button></div></div>';
  }
  function startGiftCheckout() {
    if (!CONFIG.checkoutReady) { mem.giftNote = T('Плащането ще бъде свързано, когато сайтът тръгне.'); render(); return; }
    if (!mem.giftConsent || mem.paying) return;
    mem.paying = true; mem.giftNote = ''; render();
    var c = mem.code && !mem.code.free ? mem.code.code : null;
    fetch('/api/checkout', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ gift: st.gift, consent: true, lang: I18N.lang, code: c }) })
      .then(function (r) { return r.json().then(function (j) { return { ok: r.ok, j: j }; }); })
      .then(function (x) {
        if (x.ok && x.j.url) { save(); location.href = x.j.url; return; }
        if (x.j.badCode) mem.code = null;
        mem.paying = false; mem.giftNote = x.j.error || T('Плащането не можа да започне. Опитай отново.'); render();
      })
      .catch(function () { mem.paying = false; mem.giftNote = T('Няма връзка със сървъра. Опитай отново.'); render(); });
  }
  function loadGift() {
    var key = st.giftSession + '|' + I18N.lang;
    if (mem.gc && mem.gc.key === key) return mem.gc;
    mem.gc = { key: key, loading: true };
    fetch('/api/gift', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ session: st.giftSession, lang: I18N.lang }) })
      .then(function (r) { return r.json().then(function (j) { return { ok: r.ok, j: j }; }); })
      .then(function (x) {
        if (!mem.gc || mem.gc.key !== key) return;
        mem.gc = x.ok && x.j.code ? Object.assign({ key: key }, x.j) : { key: key, error: x.j.error || T('Нещо се обърка. Опитай отново.') };
        if (st.view === 'giftcard') render();
      })
      .catch(function () {
        if (!mem.gc || mem.gc.key !== key) return;
        mem.gc = { key: key, error: T('Няма връзка със сървъра. Провери интернета и опитай отново.') };
        if (st.view === 'giftcard') render();
      });
    return mem.gc;
  }
  function viewGiftCard() {
    var G = loadGift(), out = giftTop();
    if (G.loading) return out + '<p class="status" role="status">' + T('Подготвям подаръчната карта…') + '</p></div>';
    if (G.error) return out + '<p class="err" role="alert">' + esc(G.error) + '</p><div class="row"><button class="btn" data-act="giftretry">' + T('Опитай отново') + '</button><button class="link" data-act="go" data-v="intro">' + T('Към началото') + '</button></div></div>';
    var card = '<div class="giftcard" id="giftcard">' +
      '<p class="gc-brand">' + T('Стилова карта') + '</p><p class="gc-eyebrow">' + T('Подаръчна карта') + '</p>' +
      (G.to ? '<p class="gc-to">' + T('За ') + esc(G.to) + '</p>' : '') +
      '<p class="gc-title">' + T('Облечи <em>душата си</em>') + '</p>' +
      (G.msg ? '<p class="gc-msg">' + esc(G.msg) + '</p>' : '') +
      (G.from ? '<p class="gc-from">' + T('от ') + esc(G.from) + '</p>' : '') +
      '<div class="gc-code"><span>' + T('Личен код') + '</span><b>' + esc(G.code) + '</b></div>' +
      '<ol class="gc-how"><li>' + T('Отвори stilovakarta.com и направи безплатния тест.') + '</li><li>' + T('На резултата натисни „Имам код за отстъпка“ и въведи кода.') + '</li><li>' + T('Пълната ти карта се отключва веднага.') + '</li></ol>' +
      '<p class="gc-url"><i class="gc-dot" aria-hidden="true"></i>stilovakarta.com</p></div>';
    return out + '<header class="sec-head no-print"><p class="eyebrow">' + T('Подаръчна карта') + '</p><h1 class="h-xl">' + T('Подаръкът е готов') + '</h1>' +
      '<p class="lede">' + T('Принтирай картата или я запази като PDF и я изпрати. Можеш да пратиш и само линка: той отваря сайта с попълнен код.') + '</p></header>' + card +
      '<div class="foot"><div class="row"><button class="btn primary" data-act="giftpdf">' + T('Запази като PDF') + '</button><button class="btn" data-act="giftcopy">' + T('Копирай кода') + '</button><button class="btn" data-act="giftlink">' + T('Копирай линка за подарък') + '</button></div>' +
      '<p class="small">' + pdfHint() + '</p>' +
      '<p class="small">' + T('Кодът важи за един пълен резултат. Тази страница се отваря отново от същото устройство. Ако загубиш кода, пиши ни на style@stilovakarta.com.') + '</p>' +
      (mem.toast ? '<p class="toast" role="status">' + mem.toast + '</p>' : '') +
      '<div class="row"><button class="btn ghost" data-act="giftmore">' + T('Подари още една') + '</button><button class="link" data-act="go" data-v="intro">' + T('Към началото') + '</button></div></div></div>';
  }
  function giftPdf() {
    oldTitle = document.title;
    document.title = T('Стилова карта') + ' – ' + T('Подаръчна карта');
    try { window.print(); } catch (e) { mem.toast = T('Браузърът не позволи запазване. Опитай от Chrome или Safari.'); render(); }
  }
  function copyText(txt, msg) {
    var fail = function () { mem.toast = T('Браузърът не позволи копиране.'); render(); };
    try { navigator.clipboard.writeText(txt).then(function () { mem.toast = msg; render(); }, fail); } catch (er) { fail(); }
  }
  /* ---------- render ---------- */
  function render() {
    I18N.lang = st.lang === 'en' ? 'en' : 'bg';
    document.documentElement.lang = I18N.lang; app.lang = I18N.lang; document.title = T('Стилова карта');
    var vw = st.view;
    if (vw === 'giftcard' && !st.giftSession) vw = st.view = 'intro';
    if (vw !== 'intro' && vw !== 'start' && vw !== 'gift' && vw !== 'giftcard' && !canGo(vw)) vw = st.view = 'intro';
    app.innerHTML = vw === 'gift' ? viewGift() : vw === 'giftcard' ? viewGiftCard() : vw === 'birth' ? viewBirth() : vw === 'season' ? viewSeason() : vw === 'line' ? viewLine() : vw === 'arch' ? viewArch() : vw === 'result' ? viewResult() : vw === 'start' ? viewStart() : viewIntro();
    if (vw === 'intro') stickSetup();
    var qh = document.getElementById('qh'); if (qh) qh.focus({ preventScroll: true });
    drawPhoto();
  }

  /* ---------- events ---------- */
  var busyPick = false;
  app.addEventListener('click', function (e) {
    if (e.target.id === 'pcv') { tapPhoto(e, e.target); return; }
    var b = e.target.closest('[data-act]'); if (!b || b.disabled) return;
    var a = b.dataset.act, val = b.dataset.v;
    if (a === 'go') { if (val === 'intro' || val === 'start' || val === 'gift' || canGo(val)) { if (val === 'gift' && mem.code && mem.code.free) mem.code = null; mem.toast = ''; go(val); } }
    else if (a === 'giftbuy') startGiftCheckout();
    else if (a === 'giftpdf') giftPdf();
    else if (a === 'giftcopy') { if (mem.gc && mem.gc.code) copyText(mem.gc.code, T('Кодът е копиран.')); }
    else if (a === 'giftlink') { if (mem.gc && mem.gc.code) copyText(location.origin + '/?code=' + encodeURIComponent(mem.gc.code), T('Линкът е копиран. Той отваря сайта с попълнен код.')); }
    else if (a === 'giftretry') { mem.gc = null; render(); }
    else if (a === 'giftmore') { st.gift = fresh().gift; mem.giftConsent = false; mem.giftNote = ''; mem.toast = ''; go('gift'); }
    else if (a === 'start') { if (canGo('result')) { var sx = st.sex, lg = st.lang; st = fresh(); st.sex = sx; st.lang = lg; try { localStorage.removeItem(KEY); } catch (er) { } } mem.cacheKey = null; mem.err = ''; go('birth'); }
    else if (a === 'sex') { st.sex = val; st.birth.sex = val; mem.cacheKey = null; save(); var ys = window.scrollY; render(); try { window.scrollTo(0, ys); } catch (er) { } }
    else if (a === 'manual') { st.birth.manual = b.dataset.on === '1'; if (st.birth.manual) st.birth.place = null; mem.err = ''; save(); render(); }
    else if (a === 'place') { var c = D.CITIES.filter(function (x) { return x[0] === b.dataset.n; })[0]; if (c) { st.birth.place = c; mem.err = ''; save(); render(); } }
    else if (a === 'unplace') { st.birth.place = null; save(); render(); var inp = document.getElementById('b-place'); if (inp) inp.focus(); }
    else if (a === 'skipbirth') { st.birth.skip = true; mem.err = ''; mem.cacheKey = null; go('season'); }
    else if (a === 'stab') { st.season.tab = val; save(); render(); }
    else if (a === 'install' && installEvt) { installEvt.prompt(); installEvt.userChoice.then(function () { installEvt = null; render(); }, function () { }); }
    else if (a === 'pay') startCheckout();
    else if (a === 'codeopen') { mem.codeOpen = true; render(); var ci = document.getElementById('code'); if (ci) ci.focus(); }
    else if (a === 'code') applyCode();
    else if (a === 'uncode') { mem.code = null; mem.codeInput = ''; mem.codeOpen = false; render(); }
    else if (a === 'retry') { mem.rep = null; render(); }
    else if (a === 'preview') { mem.preview = true; render(); try { window.scrollTo(0, 0); } catch (er) { } }
    else if (a === 'unpreview') { mem.preview = false; render(); try { window.scrollTo(0, 0); } catch (er) { } }
    else if (a === 'tostart') go('start');
    else if (a === 'lang') { st.lang = I18N.lang === 'en' ? 'bg' : 'en'; save(); var yl = window.scrollY; render(); try { window.scrollTo(0, yl); } catch (er) { } }
    else if (a === 'analyse') analyse();
    else if (a === 'ptarget') { mem.target = val; var y2 = window.scrollY; render(); try { window.scrollTo(0, y2); } catch (er) { } }
    else if (a === 'sq') {
      st.season.quiz[+b.dataset.i] = +b.dataset.j;
      var all = D.SEASON_Q.every(function (q, i) { return st.season.quiz[i] != null; });
      if (st.season.tab === 'photo') applyPhotoSeason();
      else if (all) { var r = P.seasonFromQuiz(st.season.quiz); st.season.value = r.season; st.season.sub = I18N.inBg(function () { return D.SEASONS[r.season].subtypes[r.sub] || null; }); st.season.src = 'quiz'; mem.cacheKey = null; }
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
    else if (a === 'pdf') savePdf();
    else if (a === 'copy') {
      var txt = mem.rep && mem.rep.full ? mem.rep.full.text : '';
      var ok = function () { mem.toast = T('Копирано. Можеш да го поставиш в бележка или съобщение.'); render(); var d = document.getElementById('data'); if (d) d.scrollIntoView(); };
      try { navigator.clipboard.writeText(txt).then(ok, function () { mem.toast = T('Браузърът не позволи копиране.'); render(); }); } catch (er) { mem.toast = T('Браузърът не позволи копиране.'); render(); }
    }
    else if (a === 'reset') { var lg2 = st.lang; st = fresh(); st.lang = lg2; mem.blob = null; mem.work = null; mem.marks = {}; mem.cacheKey = null; mem.toast = ''; mem.status = ''; try { localStorage.removeItem(KEY); } catch (er) { } go('intro'); }
  });
  app.addEventListener('keydown', function (e) { if (e.target.id === 'code' && e.key === 'Enter') { e.preventDefault(); applyCode(); } });
  app.addEventListener('input', function (e) {
    var t = e.target, b = st.birth;
    if (t.id === 'g-to' || t.id === 'g-from' || t.id === 'g-msg') { st.gift[t.id.slice(2)] = t.value; save(); return; }
    if (t.id === 'code') { mem.codeInput = t.value; if (mem.codeErr) { mem.codeErr = ''; var er = t.parentNode.nextSibling; if (er && er.className === 'err') er.remove(); } return; }
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
    else if (t.id === 'gconsent') { mem.giftConsent = t.checked; var gb = app.querySelector('[data-act="giftbuy"]'); if (gb) gb.disabled = !t.checked || !!mem.paying; }
    else if (t.id === 'consent') { mem.consent = t.checked; var pb = app.querySelector('[data-act="pay"]'); if (pb) pb.disabled = !t.checked; }
    else if (t.id === 'b-date') { b.date = t.value; save(); }
    else if (t.id === 'b-time') { b.time = t.value; save(); }
    else if (t.id === 'photo' && t.files && t.files[0]) {
      mem.status = T('Подготвям снимката…'); render();
      resizePhoto(t.files[0]).then(function (o) {
        mem.blob = o.blob; mem.work = o.canvas; mem.marks = {}; mem.target = 'skin';
        st.season.photo = {}; st.season.ai = null; mem.status = '';
        save(); render();
        getSample().then(function (smp) { mem.aiAvail = !!smp; if (mem.aiAvail) render(); });
      }, function () { mem.status = T('Тази снимка не може да се отвори. Опитай с JPG или PNG.'); render(); });
    }
  });
  app.addEventListener('submit', function (e) { e.preventDefault(); if (e.target.id === 'bform') submitBirth(); });

  window.addEventListener('beforeinstallprompt', function (e) { e.preventDefault(); installEvt = e; if (st.view === 'intro') render(); });
  window.addEventListener('appinstalled', function () { installEvt = null; mem.installed = true; if (st.view === 'intro') render(); });
  if (IS_PWA && 'serviceWorker' in navigator) window.addEventListener('load', function () { navigator.serviceWorker.register('sw.js').catch(function () { }); });

  var saved = load();
  if (saved) st = saved;
  if (!st.lang) st.lang = /^bg/i.test(navigator.language || 'bg') ? 'bg' : 'en';
  try {
    var qs = new URLSearchParams(location.search);
    /* ?code=… comes from a gift link: the code waits on the result. ?gift opens the gift page, ?gift_session the bought card. */
    if (qs.get('code')) { st.pendingCode = qs.get('code').slice(0, 40); save(); }
    if (qs.get('gift_session')) { st.giftSession = qs.get('gift_session'); st.view = 'giftcard'; save(); }
    else if (qs.get('gift')) { st.view = 'gift'; save(); if (qs.get('cancelled')) mem.giftNote = T('Плащането е прекъснато. Можеш да опиташ отново.'); }
    if (qs.get('session_id')) { st.session = qs.get('session_id'); st.view = 'result'; save(); }
    if (qs.get('cancelled') && !qs.get('gift')) { st.view = 'result'; mem.payNote = T('Плащането е прекъснато. Можеш да опиташ отново.'); }
    if (['session_id', 'cancelled', 'gift', 'gift_session', 'code'].some(function (k) { return qs.has(k); })) history.replaceState(null, '', location.pathname);
  } catch (e) { }
  render();
})();
