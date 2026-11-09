/* Result: the free preview and the full report, as HTML. Runs on the server for the site, in the browser for the demo. */
var makeReport = function (D, P, E) {
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
  function v(sign) { return /^[ВФвф]/.test(sign) ? 'във ' + sign : 'в ' + sign; }
  function deg(x) { return Math.floor(x) + '°'; }
  function fmtDate(ms) { var d = new Date(ms); return ('0' + d.getUTCDate()).slice(-2) + '.' + ('0' + (d.getUTCMonth() + 1)).slice(-2) + '.' + d.getUTCFullYear(); }
  function placeLabel(p) { return p[0] + (p[4] ? ', ' + p[4] : '') + ' · ' + Math.abs(p[1]).toFixed(2) + '° ' + (p[1] >= 0 ? 'с.ш.' : 'ю.ш.') + ', ' + Math.abs(p[2]).toFixed(2) + '° ' + (p[2] >= 0 ? 'и.д.' : 'з.д.'); }
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
    if (Array.isArray(b.place)) city = D.CITIES.filter(function (c) { return c[0] === b.place[0]; })[0] || null;
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
    if (!inp.season.value) return 'Липсва цветовият сезон.';
    if (!inp.line.value) return 'Липсва линията.';
    if (!inp.arch.primary) return 'Липсва архетипът.';
    return null;
  }
  /* Fingerprint of the inputs that shape the result: a payment unlocks only these. */
  function key(inp) {
    var b = inp.birth;
    return JSON.stringify([inp.sex, b.skip ? null : [b.date, b.noTime ? null : b.time, b.manual ? [b.mlat, b.mlon, b.mtz] : (b.place && b.place[0])],
      inp.season.value, inp.line.value, inp.arch.primary, inp.arch.secondary]);
  }

  function sec(id, title, sub, body) { return '<section class="sec" id="' + id + '"><div class="sec-head"><h2 class="h-l">' + title + '</h2>' + (sub ? '<p class="note">' + sub + '</p>' : '') + '</div>' + body + '</section>'; }
  function grid(list) { return '<div class="sw-grid">' + list.map(function (c) { return swatch(c); }).join('') + '</div>'; }
  function fbar(f) {
    return '<div class="formula"><h3 class="h-m" style="font-size:1.05rem">' + f.title + '</h3><div class="fbar">' + f.parts.map(function (p) { return '<i style="flex:' + p[1] + ';background:' + p[0].hex + '"></i>'; }).join('') + '</div>' +
      '<p class="flegend">' + f.parts.map(function (p) { return esc(p[0].name) + ' ' + p[1] + '%'; }).join(' · ') + '</p></div>';
  }
  var LOCK = '<svg width="14" height="14" viewBox="0 0 14 14" aria-hidden="true"><rect x="2.5" y="6" width="9" height="6.5" rx="1" fill="none" stroke="currentColor" stroke-width="1.3"/><path d="M4.5 6V4.3a2.5 2.5 0 0 1 5 0V6" fill="none" stroke="currentColor" stroke-width="1.3"/></svg>';
  function firstSentence(t) { var m = String(t).match(/^[^.!?]*[.!?]/); return m ? m[0] : String(t); }
  function teaser(st) {
    cur = st;
    var R = computeAll(st), ch = R.chart, p = R.pal, S = p.S, bz = ch && ch.bazi, hd = ch && ch.hd;
    var L = D.LINES[st.line.value], A1 = arch(st.arch.primary), A2 = arch(st.arch.secondary);
    var rows = [];
    rows.push(['Цветови сезон', esc(st.season.sub || S.name), S.traits]);
    rows.push(['Линия', L.name, firstSentence(L.essence)]);
    rows.push(['Архетип', A1.name + (A2 ? ' <span class="small">· втори глас: ' + A2.name + '</span>' : ''), firstSentence(A1.essence)]);
    var strip = [p.base[0], p.base[1], p.face[0], p.face[1], p.accent[0], p.accent[1], p.accent[2]].filter(Boolean);
    rows.push(['Палитра', '<span class="tstrip" role="img" aria-label="Част от палитрата">' + strip.map(function (c) { return '<i style="background:' + c.hex + '"></i>'; }).join('') + '</span>',
      bz ? 'Претеглена по Ба Дзъ: подсилват ' + bz.fav.map(function (e) { return lc(ELN[e]); }).join(' и ') + '.' : 'Подредена по сезона.']);
    if (hd) rows.push(['Хюман дизайн', D.HD_TYPE[hd.type].name + ', профил ' + hd.profile, D.HD_AUTH[hd.authority].name + ' авторитет.']);
    if (bz) rows.push(['Ба Дзъ', 'Господар на деня ' + E.STEMS[bz.dmStem] + ', ' + (bz.dmStem % 2 ? 'Ин' : 'Ян') + ' ' + ELN[bz.dm], bz.strong ? 'Силен господар.' : 'Слаб господар.']);
    if (ch) rows.push(['Рождена карта', 'Слънце ' + v(ch.west.sun.name) + (ch.west.asc ? ' · Асцендент ' + v(ch.west.asc.name) : ''), 'Луна ' + v(ch.west.moon.name) + '.']);
    if (ch && ch.gua) rows.push(['Число Гуа', String(ch.gua.n), ELN[ch.gua.el] + ', ' + (ch.gua.group === 'east' ? 'източна група' : 'западна група') + '.']);
    var locked = ['Всички цветове с имена и кодове: основа, до лицето, акценти, бижута и камъни', 'Как да ги носиш според линията ' + L.name, 'Готови формули за изява и всекидневие',
      'Цветовете по западната и ведическата карта', 'Ба Дзъ, хюман дизайн и Гуа подробно', 'Замени за дрехите, които вече имаш'];
    if (st.sex !== 'm') locked.push('Червила в твоите цветове');
    locked.push('Целият резултат като текст за запазване');
    return { html: '<header class="res-head"><p class="eyebrow">Безплатен преглед</p><h1 class="h-xl">' + esc(st.season.sub || S.name) + ' · ' + L.name + '</h1><p class="lede">Ето накратко какво показват тестовете и картата ти.</p></header>' +
      '<dl class="teaser">' + rows.map(function (r) { return '<div><dt>' + r[0] + '</dt><dd><b>' + r[1] + '</b><span>' + esc(r[2]) + '</span></dd></div>'; }).join('') + '</dl>' +
      '<section class="sec"><div class="sec-head"><h2 class="h-l">В пълния резултат</h2></div><ul class="locked">' + locked.map(function (x) { return '<li>' + LOCK + '<span>' + x + '</span></li>'; }).join('') + '</ul></section>' };
  }
  function full(st) {
    cur = st;
    var R = computeAll(st), ch = R.chart, p = R.pal, S = p.S, bz = ch && ch.bazi, hd = ch && ch.hd;
    var L = D.LINES[st.line.value], A1 = arch(st.arch.primary), A2 = arch(st.arch.secondary);
    var seasonName = st.season.sub || S.name;
    var out = '';

    /* head */
    var elPills = '';
    if (bz) {
      var tiers = ['wood', 'fire', 'earth', 'metal', 'water'].map(function (e) { return [e, P.tierOf(e, bz)]; });
      var order = { fav1: 0, fav: 1, light: 2, avoid: 3 };
      tiers.sort(function (a, b) { return order[a[1]] - order[b[1]]; });
      elPills = '<div class="elrow">' + tiers.map(function (t) {
        var lab = t[1] === 'fav1' ? 'подсилва, най-важен' : t[1] === 'fav' ? 'подсилва' : t[1] === 'light' ? 'малко' : 'избягвай';
        return '<span class="pill ' + (t[1] === 'fav1' || t[1] === 'fav' ? 'fav' : t[1] === 'avoid' ? 'avoid' : '') + '">' + ELN[t[0]] + ': ' + lab + '</span>';
      }).join('') + '</div>';
    }
    var b1 = p.sig.b1, f1 = p.sig.f1, a1 = p.accent.filter(P.good)[0] || p.accent[0];
    out += '<header class="res-head"><p class="eyebrow">Твоята стилова карта</p><h1 class="h-xl">' + esc(seasonName) + ' · ' + L.name + '</h1>' +
      '<p class="lede">Архетип: ' + A1.name + (A2 ? ' и ' + A2.name : '') + '</p>' +
      '<p class="sig">' + esc(p.signature) + '</p>' +
      '<div class="pbar" role="img" aria-label="Пропорция 70, 20, 10"><i style="flex:70;background:' + b1.hex + '"></i><i style="flex:20;background:' + f1.hex + '"></i><i style="flex:10;background:' + a1.hex + '"></i></div>' +
      '<p class="plegend"><span>Основа около 70%</span><span>До лицето около 20%</span><span>Акценти около 10%</span></p>' +
      (p.removed.length >= 2 && bz ? '<p>Това е ' + S.richer + ' от обичайната: картата маха ' + p.removed.map(lc).join(', ').replace(/, ([^,]*)$/, ' и $1') + ', затова основата е цветна.</p>' : '') +
      elPills + (!ch ? '<p class="note">Без данни за раждане палитрата е само по сезона.</p>' : '') + '</header>';

    /* toc */
    var toc = [['colors', 'Цветове'], ['wear', 'Носене'], ['arch', 'Архетип'], ['formulas', 'Формули']];
    if (ch) toc.push(['chart', 'Карта'], ['bazi', 'Ба Дзъ'], ['hd', 'Хюман дизайн']);
    if (ch && ch.gua) toc.push(['gua', 'Гуа']);
    toc.push(['swap', 'Замени']); if (st.sex !== 'm') toc.push(['lips', 'Червило']); toc.push(['data', 'Данни']);
    out += '<nav class="toc chips" aria-label="Раздели">' + toc.map(function (t) { return '<button class="chip" data-act="goto" data-id="' + t[0] + '">' + t[1] + '</button>'; }).join('') + '</nav>';

    /* colours */
    var metalLine = p.metalTier === 'avoid' ? 'Всеки метал е Метал, а картата не го обича. Затова водят камъкът и дървото, а металът е само тънък обков.'
      : p.metalTier === 'light' ? 'Металът е в малки дози: камъкът води, металът е фин обков.'
      : p.metalTier === 'season' ? '' : 'Металът е благоприятен: бижутата могат да водят.';
    out += sec('colors', 'Цветовете', bz ? 'Претеглени по Ба Дзъ. „Подсилва“ е за благоприятните елементи, „малко“ е за малки площи.' : S.traits,
      '<div class="sub"><h3>Основа · около 70%</h3><p class="small">' + gf('Панталони, поли, сака, палта, обувки, чанти.', 'Панталони, сака, палта, обувки, чанти.') + '</p>' + grid(p.base) + '</div>' +
      '<div class="sub"><h3>До лицето · около 20%</h3><p class="small">' + gf('Блузи, шалове, яки. Тук е светлината.', 'Ризи, пуловери, шалове. Тук е светлината.') + '</p>' + grid(p.face) + '</div>' +
      '<div class="sub"><h3>Акценти · около 10%</h3><p class="small">По един на визия, в плътен блок.</p>' + grid(p.accent) + '</div>' +
      '<div class="sub"><h3>Бижута и камъни</h3><p class="small">' + esc([metalLine, (p.metalTier === 'light' || p.metalTier === 'avoid' ? 'Когато все пак е метал, нека е ' + S.metal + '.' : ''), S.goldNote].filter(Boolean).join(' ')) + '</p>' + grid(p.stones.concat([p.metal])) + '</div>');

    /* wear */
    out += sec('wear', 'Как ги носиш', L.name + ': ' + L.essence,
      '<div class="cols2"><div class="plus"><h3 class="h-m" style="font-size:1rem;margin-bottom:8px">Подсилва те</h3><ul>' + L.plus.map(function (x) { return '<li>' + gx(x) + '</li>'; }).join('') + '</ul></div>' +
      '<div class="minus"><h3 class="h-m" style="font-size:1rem;margin-bottom:8px">Размива те</h3><ul>' + L.minus.map(function (x) { return '<li>' + x + '</li>'; }).join('') + '</ul></div></div>' +
      '<dl class="kv"><dt>Материи</dt><dd>' + L.fabric + '</dd><dt>Шарки</dt><dd>' + L.pattern + '</dd><dt>Аксесоари</dt><dd>' + L.acc + '</dd></dl>' +
      '<ul class="ul"><li>' + S.rule + '</li><li>' + esc(p.sig.f1.name) + ' и другите светли тонове стоят над кръста, срещу основата.</li><li>Един акцент на визия: ' + p.accent.filter(P.good).slice(0, 4).map(function (c) { return lc(c.name); }).join(', ') + '.</li><li>Материята мени цвета: в сатен цветът изглежда по-светъл и по-ярък, в матова кожа и вълна по-дълбок. За сатен избирай по-дълбокия тон.</li></ul>');

    /* archetype */
    out += sec('arch', 'Архетип', 'Архетипът казва какво излъчваш, линията казва в каква форма да го облечеш.',
      '<div class="cards">' + [A1, A2].filter(Boolean).map(function (a, i) {
        return '<div class="card pc"><p class="role">' + (i ? 'Втори глас' : 'Основен') + '</p><h3 class="h-m">' + a.name + '</h3><p class="small">' + a.traits.join(' · ') + '</p><p>' + a.essence + '</p><dl class="kv"><dt>Материи</dt><dd>' + a.mat + '</dd><dt>Детайл</dt><dd>' + a.det + '</dd>' + (st.sex === 'm' ? '' : '<dt>Червило</dt><dd>' + a.finish + '</dd>') + '</dl></div>';
      }).join('') + '</div>' +
      (A2 ? '<p class="note">От втория глас вземай материя или аксесоар, а силуетът нека идва от линията ' + L.name + '.</p>' : ''));

    /* formulas */
    var fs = P.formulas(p, bz, hd);
    out += sec('formulas', 'Формули', hd ? D.HD_TYPE[hd.type].name + ': ' + D.HD_TYPE[hd.type].expo + '.' : 'Готови пропорции за визия.',
      fs.map(fbar).join(''));

    if (ch) {
      /* chart */
      var w = ch.west, cards = '';
      D.WEST_ROLES.forEach(function (r) {
        var s = w[r[0]]; if (!s) return;
        var info = D.SIGN_INFO[s.i], cols = P.famColors(info.fam, p);
        cards += '<div class="card pc"><p class="role">' + r[2] + '</p><h3>' + r[1] + ' ' + v(s.name) + ' ' + deg(s.deg) + '</h3><p class="small">' + info.kw + '</p>' + (cols.length ? dots(cols) : '<p class="small">Традиционните цветове на знака не са в палитрата ти.</p>') + '</div>';
      });
      var ved = ch.vedic, vc = '';
      if (ved.lagna) { var lord = D.PLANETS[D.SIGN_LORD[ved.lagna.i]]; vc += '<div class="card pc"><p class="role">тяло и излъчване</p><h3>Лагна ' + v(ved.lagna.name) + ' ' + deg(ved.lagna.deg) + '</h3><p class="small">Владетел ' + lord.name + ': ' + lord.kw + '.</p>' + dots(P.famColors(lord.fam, p)) + '</div>'; }
      vc += '<div class="card pc"><p class="role">ум и чувства</p><h3>Луна ' + v(ved.moon.name) + ' ' + deg(ved.moon.deg) + '</h3><p class="small">Накшатра ' + ved.nakshatra + '.</p></div>';
      if (ved.current) {
        var md = D.PLANETS[ved.current.maha.lord], ad = D.PLANETS[ved.current.antar.lord];
        vc += '<div class="card pc"><p class="role">голям период</p><h3>Махадаша ' + md.name + ' · ' + new Date(ved.current.maha.start).getFullYear() + '–' + new Date(ved.current.maha.end).getFullYear() + '</h3><p class="small">' + cap(md.kw) + '.</p>' + dots(P.famColors(md.fam, p)) + '</div>';
        vc += '<div class="card pc"><p class="role">сегашният период</p><h3>Антардаша ' + md.name + '–' + ad.name + '</h3><p class="small">' + fmtDate(ved.current.antar.start) + '–' + fmtDate(ved.current.antar.end) + '. ' + cap(ad.kw) + '.</p>' + dots(P.famColors(ad.fam, p)) + '</div>';
      }
      var ss = ved.sadeSati;
      if (ss.phase) vc += '<div class="card pc"><p class="role">натиск и изграждане</p><h3>Sade Sati, ' + ['', 'първа', 'втора', 'трета'][ss.phase] + ' фаза</h3><p class="small">' + new Date(ss.start).getFullYear() + '–' + new Date(ss.end).getFullYear() + '. В гардероба: по-малко и по-качествено, капсула от основата, без случайни покупки.</p></div>';
      out += sec('chart', 'По картата', 'Цветовите съответствия в астрологията са традиционни асоциации. Тук те подреждат палитрата, без да я заменят.',
        '<div class="sub"><h3>Западна астрология</h3><div class="cards">' + cards + '</div></div>' +
        '<div class="sub"><h3>Ведическа астрология (Лахири)</h3><div class="cards">' + vc + '</div></div>' +
        (!ch.hasTime ? '<p class="note">Без час на раждане Асцендентът, MC и Лагна не се смятат.</p>' : ''));

      /* bazi */
      var pil = bz.pillars, names = { year: 'Година', month: 'Месец', day: 'Ден', hour: 'Час' };
      var pillHTML = '<div class="pillars" style="grid-template-columns:repeat(' + pil.length + ',minmax(0,1fr))">' + pil.map(function (x) {
        return '<div class="' + (x.k === 'day' ? 'day' : '') + '"><small>' + names[x.k] + '</small><span class="han">' + E.STEMS[x.s] + '</span><small>' + ELN[E.stemEl(x.s)] + '</small><span class="han">' + E.BRANCHES[x.b] + '</span><small>' + E.ANIMALS[x.b] + '</small></div>';
      }).join('') + '</div>';
      var dm = bz.dm, yy = bz.dmStem % 2 ? 'Ин' : 'Ян';
      var why = bz.strong ? 'Господарят е силен: има нужда да се изрази и да бъде обуздан. Затова палитрата се гради на ' + bz.fav.map(function (e) { return ELN[e]; }).join(', ').replace(/, ([^,]*)$/, ' и $1') + '.'
        : 'Господарят е слаб: ' + ELN[bz.fav[0]] + ' го храни, а ' + ELN[bz.fav[1]] + ' го подкрепя.';
      var counts = {}; p.all.concat(p.stones).forEach(function (c) { counts[c.el] = (counts[c.el] || 0) + 1; });
      out += sec('bazi', 'Ба Дзъ и петте елемента', 'Господар на деня: ' + E.STEMS[bz.dmStem] + ' ' + E.STEM_BG[bz.dmStem] + ', ' + yy + ' ' + ELN[dm] + '.',
        pillHTML + '<p>' + why + ' ' + (bz.light ? ELN[bz.light] + ' е в малки дози, а ' + bz.avoid.map(function (e) { return ELN[e]; }).join(' и ') + ' остават извън палитрата.' : '') + '</p>' +
        '<p class="small">В палитрата: ' + ['wood', 'fire', 'earth', 'metal', 'water'].map(function (e) { return ELN[e] + ' ' + (counts[e] || 0); }).join(' · ') + '. Стълбът на деня и часът са по местно слънчево време.</p>' +
        '<p class="note">Оценката на силата е опростена. Майстор по Ба Дзъ гледа и специалните структури и сблъсъците между клоните.</p>');

      /* human design */
      var T = D.HD_TYPE[hd.type], Au = D.HD_AUTH[hd.authority], lines = hd.profile.split('/');
      out += sec('hd', 'Хюман дизайн', 'Хюман дизайнът не дава цветове за облекло. Тук той казва как и кога да ползваш палитрата.',
        '<dl class="kv"><dt>Тип</dt><dd>' + T.name + ', ' + T.strat + '</dd><dt>Авторитет</dt><dd>' + Au.name + '</dd><dt>Профил</dt><dd>' + hd.profile + '</dd><dt>Дефинирани</dt><dd>' + (hd.defined.map(function (c) { return D.HD_CENTERS[c]; }).join(', ') || 'няма') + '</dd><dt>Отворени</dt><dd>' + hd.open.map(function (c) { return D.HD_CENTERS[c]; }).join(', ') + '</dd></dl>' +
        '<ul class="ul"><li>' + gx(T.wear) + '</li><li>' + Au.rule + '</li>' + lines.filter(function (x, i) { return lines.indexOf(x) === i; }).map(function (l) { return '<li>' + D.HD_LINE[l] + '</li>'; }).join('') + '</ul>' +
        (lines.indexOf('3') >= 0 && p.test.length ? '<div class="sub"><h3>Тестови цветове</h3><p class="small">По един на сезон, само от благоприятните елементи.</p>' + grid(p.test) + '</div>' : '') +
        (!ch.hasTime ? '<p class="note">Без час на раждане хюман дизайнът е сметнат за обяд и може да е различен.</p>' : ''));

      /* gua */
      if (ch.gua) {
        var g = ch.gua, gs = D.STONES.filter(function (s) { return s[2] === g.el; }).slice(0, 3).map(function (s) { return s[0]; });
        out += sec('gua', 'Число Гуа', null,
          '<dl class="kv"><dt>Число</dt><dd>' + g.n + ' · ' + ELN[g.el] + ' · ' + (g.group === 'east' ? 'източна група' : 'западна група') + '</dd><dt>Благоприятни посоки</dt><dd>' + g.dirs.join(', ') + '</dd><dt>Камъни на елемента</dt><dd>' + gs.join(', ') + '</dd></dl>' +
          (bz && P.tierOf(g.el, bz) === 'avoid' ? '<p class="note">Елементът на Гуа е неблагоприятен по Ба Дзъ, затова камъните му не влизат в палитрата.</p>' : ''));
      }
    }

    /* swap */
    var reps = P.replacements(p);
    out += sec('swap', 'Замени', 'Нещата, които вече имаш в тези цветове, носи далеч от лицето и в малки площи, докато не ги смениш.',
      reps.length ? '<div class="rep">' + reps.map(function (r) { return '<div><i style="background:' + r.hex + '"></i><span>Вместо ' + lc(r.item) + ': <b>' + r.to.map(function (c) { return lc(c.name); }).join(' или ') + '</b></span></div>'; }).join('') + '</div>' : '<p>Обичайните неутрални цветове са в палитрата ти.</p>');

    /* lips */
    var lips = S.lips.map(function (l) { return { name: l[0], hex: l[1], el: l[2], tier: P.tierOf(l[2], bz) }; });
    lips.sort(function (a, b) { return (P.good(b) ? 1 : 0) - (P.good(a) ? 1 : 0); });
    if (st.sex !== 'm') out += sec('lips', 'Червило', 'Червилото е акцентът до лицето: едно наситено червило на визия.',
      grid(lips) + '<p><b>Финишът:</b> ' + A1.name + ' носи ' + A1.finish + (A2 ? ', ' + A2.name + ' носи ' + A2.finish : '') + '. В сатен цветът изглежда по-светъл, затова за сатен избирай по-дълбокия тон.</p>' +
      '<p class="small">Остават извън палитрата: ' + S.lipsAvoid + '. Пробвай на дневна светлина: правилното червило избелва зъбите, а кожата не посивява и не пожълтява до него.</p>');

    /* data */
    var b = st.birth, dl = '';
    if (ch) {
      var pl = b.manual ? (b.mlat + ', ' + b.mlon + ' · ' + b.mtz.replace('off:', 'UTC')) : placeLabel(b.place);
      var off = ch.offset / 60;
      dl += '<dt>Раждане</dt><dd>' + b.date.split('-').reverse().join('.') + (ch.hasTime ? ', ' + b.time + ' (UTC' + (off >= 0 ? '+' : '') + off + ')' : ', без час') + '</dd><dt>Място</dt><dd>' + esc(pl) + '</dd>';
    }
    dl += '<dt>Сезон</dt><dd>' + esc(seasonName) + ({ photo: ', по снимка', quiz: ', по въпросите', pick: ', избран' }[st.season.src] || '') + '</dd><dt>Линия</dt><dd>' + L.name + '</dd><dt>Архетип</dt><dd>' + A1.name + (A2 ? ' / ' + A2.name : '') + '</dd>';
    out += sec('data', 'Изходни данни', null, '<dl class="kv">' + dl + '</dl>');
    return { html: out, text: resultText(st) };
  }
  function resultText(st) {
    cur = st;
    var R = computeAll(st), p = R.pal, ch = R.chart, L = D.LINES[st.line.value], A1 = arch(st.arch.primary), A2 = arch(st.arch.secondary);
    var t = [];
    t.push('СТИЛОВА КАРТА: ' + (st.season.sub || p.S.name) + ' · ' + L.name + ' · ' + A1.name + (A2 ? '/' + A2.name : ''));
    t.push(p.signature);
    if (ch) t.push('Ба Дзъ: подсилва ' + ch.bazi.fav.map(function (e) { return ELN[e]; }).join(', ') + (ch.bazi.light ? '; малко ' + ELN[ch.bazi.light] : '') + '; избягвай ' + ch.bazi.avoid.map(function (e) { return ELN[e]; }).join(', '));
    [['Основа', p.base], ['До лицето', p.face], ['Акценти', p.accent], ['Камъни', p.stones]].forEach(function (x) { t.push(x[0] + ': ' + x[1].filter(function (c) { return c.tier !== 'avoid'; }).map(function (c) { return c.name + ' ' + c.hex; }).join(', ')); });
    P.formulas(p, ch && ch.bazi, ch && ch.hd).forEach(function (f) { t.push(f.title + ': ' + f.parts.map(function (x) { return x[0].name + ' ' + x[1] + '%'; }).join(' · ')); });
    if (ch) {
      var w = ch.west;
      t.push('Западна: Слънце ' + v(w.sun.name) + ', Луна ' + v(w.moon.name) + (w.asc ? ', Асцендент ' + v(w.asc.name) : '') + ', Венера ' + v(w.venus.name));
      t.push('Хюман дизайн: ' + D.HD_TYPE[ch.hd.type].name + ', ' + D.HD_AUTH[ch.hd.authority].name + ' авторитет, профил ' + ch.hd.profile + (ch.gua ? ' · Гуа ' + ch.gua.n : ''));
    }
    t.push('Линия ' + L.name + ': ' + L.plus.map(gx).join('; '));
    return t.join('\n');
  }


  return { clean: clean, invalid: invalid, key: key, teaser: teaser, full: full, text: resultText };
};
if (typeof module !== 'undefined') module.exports = makeReport;
