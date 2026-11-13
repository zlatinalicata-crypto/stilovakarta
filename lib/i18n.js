/* Two languages. Bulgarian is the source text; English comes from the dictionary in en.js.
   T(text) translates a literal; I18N.wrap(table) makes a table of texts translate when read. */
var I18N = (function () {
  var dict = (typeof EN_DICT !== 'undefined') ? EN_DICT : (typeof require !== 'undefined' ? require('./en.js') : {});
  var api = { lang: 'bg' };
  function T(s) { if (api.lang !== 'en' || typeof s !== 'string') return s; var v = dict[s]; return v === undefined ? s : v; }
  var cache = new WeakMap();
  function wrap(o, raw) {
    if (o === null || typeof o !== 'object') return o;
    var p = cache.get(o); if (p) return p;
    p = new Proxy(o, { get: function (t, k, r) {
      var v = Reflect.get(t, k, r), keep = raw && raw.indexOf(k) >= 0;
      if (typeof v === 'string') return keep ? v : T(v);
      if (v && typeof v === 'object' && !keep) return wrap(v, raw);
      return v;
    } });
    cache.set(o, p); return p;
  }
  var TR = { 'а': 'a', 'б': 'b', 'в': 'v', 'г': 'g', 'д': 'd', 'е': 'e', 'ж': 'zh', 'з': 'z', 'и': 'i', 'й': 'y', 'к': 'k', 'л': 'l', 'м': 'm', 'н': 'n', 'о': 'o', 'п': 'p', 'р': 'r', 'с': 's', 'т': 't', 'у': 'u', 'ф': 'f', 'х': 'h', 'ц': 'ts', 'ч': 'ch', 'ш': 'sh', 'щ': 'sht', 'ъ': 'a', 'ь': 'y', 'ю': 'yu', 'я': 'ya' };
  function translit(s) {
    return String(s).replace(/ия(?=$|[\s-])/g, 'ia').replace(/[а-яА-Я]/g, function (c) {
      var l = c.toLowerCase(), t = TR[l] === undefined ? c : TR[l];
      return c === l ? t : t.charAt(0).toUpperCase() + t.slice(1);
    });
  }
  api.T = T; api.wrap = wrap;
  api.city = function (name) { if (api.lang !== 'en') return name; return dict[name] !== undefined ? dict[name] : translit(name); };
  api.inBg = function (fn) { var l = api.lang; api.lang = 'bg'; try { return fn(); } finally { api.lang = l; } };
  api.has = function (s) { return dict[s] !== undefined; };
  return api;
})();
var T = I18N.T;
if (typeof module !== 'undefined') module.exports = I18N;
