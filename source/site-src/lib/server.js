/* The two endpoints: /api/report and /api/checkout. */
const I18N = require('./i18n.js');
const T = I18N.T;
const DATA = require('./data.js');
global.DATA = DATA;
const Engine = require('./engine.js');
const Pal = require('./palette.js');
const makeReport = require('./report.js');
const pay = require('./pay.js');

const Figure = require('./figure.js');
const R = makeReport(DATA, Pal, Engine, Figure);
const NOTES = I18N.wrap({
  mismatch: 'Плащането е за други данни. Върни данните, с които плати, или отключи този резултат отделно.',
  unpaid: 'Плащането още не е потвърдено. Опитай отново след минута.',
  unknown: 'Не намирам това плащане. Ако плащането е минало, пиши ни и ще помогнем.',
  test: 'Това плащане е направено с тестова карта и не отключва резултата.'
});

function json(code, obj) {
  return { statusCode: code, headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' }, body: JSON.stringify(obj) };
}
function parse(event) {
  if (event.httpMethod !== 'POST') return null;
  try {
    const raw = event.isBase64Encoded ? Buffer.from(event.body || '', 'base64').toString('utf8') : (event.body || '{}');
    if (raw.length > 20000) return null;
    return JSON.parse(raw);
  } catch (e) { return null; }
}

async function report(event) {
  const body = parse(event);
  if (!body) return json(400, { error: 'Невалидна заявка.' });
  I18N.lang = body.lang === 'en' ? 'en' : 'bg';
  const inp = R.clean(body.input);
  const bad = R.invalid(inp);
  if (bad) return json(400, { error: bad });
  const h = pay.hash(R.key(inp));
  const testMode = pay.testMode();
  let paid = false, note = null;
  if (body.session) {
    const r = await pay.isPaid(body.session, h);
    paid = r.paid;
    I18N.lang = body.lang === 'en' ? 'en' : 'bg';
    note = r.note ? NOTES[r.note] : null;
  }
  I18N.lang = body.lang === 'en' ? 'en' : 'bg';
  const out = { teaser: R.teaser(inp), full: null, paid, testMode, note, payReady: pay.ready() };
  if (paid || (testMode && body.preview)) out.full = R.full(inp);
  return json(200, out);
}

async function checkout(event) {
  const body = parse(event);
  if (!body) return json(400, { error: 'Невалидна заявка.' });
  I18N.lang = body.lang === 'en' ? 'en' : 'bg';
  /* A code is checked first: dry=true only asks what it gives, without starting a payment. */
  const code = body.code ? pay.findCode(body.code) : null;
  if (body.code && !code) return json(400, { error: T('Този код не е валиден. Провери как е изписан.'), badCode: true });
  if (body.dry) return code ? json(200, pay.codeInfo(code)) : json(400, { error: 'Невалидна заявка.' });
  if (body.consent !== true) return json(400, { error: T('Потвърди съгласието си, за да продължиш.') });
  const inp = R.clean(body.input);
  const bad = R.invalid(inp);
  if (bad) return json(400, { error: bad });
  const h = pay.hash(R.key(inp));
  const origin = (process.env.SITE_URL || process.env.URL || ('https://' + ((event.headers || {}).host || ''))).replace(/\/$/, '');
  try {
    if (code && code.free) return json(200, { session: pay.freeSession(h) });
    if (!pay.ready()) return json(503, { error: T('Плащането с карта ще бъде включено съвсем скоро.') });
    return json(200, await pay.createCheckout(h, origin, body.lang === 'en' ? 'en' : 'bg', code));
  } catch (e) {
    const nc = e.code === 'not_configured';
    return json(nc ? 503 : 502, { error: (I18N.lang = body.lang === 'en' ? 'en' : 'bg', nc) ? T('Плащането още не е настроено.') : T('Плащането не можа да започне. Опитай отново след малко.') });
  }
}

module.exports = { report, checkout };
