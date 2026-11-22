/* The three endpoints: /api/report, /api/checkout and /api/gift. */
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
const GIFT_NOTES = I18N.wrap({
  gift_unknown: 'Не намирам този подаръчен код. Провери как е изписан. Ако подаръкът е купен преди минути, опитай отново след малко.',
  gift_used: 'Този подаръчен код вече е използван за друга карта. Ако това е грешка, пиши ни на style@stilovakarta.com.',
  gift_refunded: 'Плащането за този подаръчен код е върнато и кодът вече не важи.',
  unpaid: 'Плащането още не е потвърдено. Опитай отново след минута.',
  unknown: 'Не намирам тази подаръчна карта. Ако плащането е минало, пиши ни на style@stilovakarta.com.',
  test: 'Това плащане е направено с тестова карта и не издава подаръчен код.'
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

/* Names and wish typed for a gift card: plain text, short. */
function cleanGift(g) {
  const s = (v, n) => String(v == null ? '' : v).replace(/[\u0000-\u001f\u007f<>]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, n);
  return { to: s(g.to, 40), from: s(g.from, 40), msg: s(g.msg, 200) };
}
function inputHash(raw) {
  if (!raw) return null;
  const inp = R.clean(raw);
  return R.invalid(inp) ? null : pay.hash(R.key(inp));
}
function siteOrigin(event) {
  return (process.env.SITE_URL || process.env.URL || ('https://' + ((event.headers || {}).host || ''))).replace(/\/$/, '');
}

async function checkout(event) {
  const body = parse(event);
  if (!body) return json(400, { error: 'Невалидна заявка.' });
  I18N.lang = body.lang === 'en' ? 'en' : 'bg';
  const gift = body.gift && typeof body.gift === 'object' ? cleanGift(body.gift) : null;
  const forGift = !!gift || body.forGift === true;
  /* A code is checked first: dry=true only asks what it gives, without starting a payment.
     A code that is not in the list may be a gift card code, which is looked up in Stripe. */
  const code = body.code ? pay.findCode(body.code) : null;
  const giftCode = body.code && !code ? pay.giftNorm(body.code) : null;
  if (body.code && !code && !giftCode) return json(400, { error: T('Този код не е валиден. Провери как е изписан.'), badCode: true });
  if (forGift && (giftCode || (code && code.free))) return json(400, { error: T('Този код не важи за подаръчна карта.'), badCode: true });
  if (body.dry) {
    if (code) return json(200, pay.codeInfo(code));
    if (!giftCode) return json(400, { error: 'Невалидна заявка.' });
    try {
      const r = await pay.giftCheck(giftCode, inputHash(body.input));
      I18N.lang = body.lang === 'en' ? 'en' : 'bg';
      return r.ok ? json(200, { free: true, gift: true }) : json(400, { error: GIFT_NOTES[r.note], badCode: true });
    } catch (e) {
      I18N.lang = body.lang === 'en' ? 'en' : 'bg';
      return json(502, { error: T('Кодът не можа да се провери. Опитай отново след малко.') });
    }
  }
  if (body.consent !== true) return json(400, { error: T('Потвърди съгласието си, за да продължиш.') });
  const origin = siteOrigin(event);
  if (gift) {
    try {
      if (!pay.ready()) return json(503, { error: T('Плащането с карта ще бъде включено съвсем скоро.') });
      return json(200, await pay.createGiftCheckout(origin, body.lang === 'en' ? 'en' : 'bg', code, gift));
    } catch (e) {
      const nc = e.code === 'not_configured';
      return json(nc ? 503 : 502, { error: (I18N.lang = body.lang === 'en' ? 'en' : 'bg', nc) ? T('Плащането още не е настроено.') : T('Плащането не можа да започне. Опитай отново след малко.') });
    }
  }
  const inp = R.clean(body.input);
  const bad = R.invalid(inp);
  if (bad) return json(400, { error: bad });
  const h = pay.hash(R.key(inp));
  try {
    if (giftCode) {
      const r = await pay.redeemGift(giftCode, h);
      I18N.lang = body.lang === 'en' ? 'en' : 'bg';
      return r.session ? json(200, { session: r.session }) : json(400, { error: GIFT_NOTES[r.note], badCode: true });
    }
    if (code && code.free) return json(200, { session: pay.freeSession(h) });
    if (!pay.ready()) return json(503, { error: T('Плащането с карта ще бъде включено съвсем скоро.') });
    return json(200, await pay.createCheckout(h, origin, body.lang === 'en' ? 'en' : 'bg', code));
  } catch (e) {
    const nc = e.code === 'not_configured';
    return json(nc ? 503 : 502, { error: (I18N.lang = body.lang === 'en' ? 'en' : 'bg', nc) ? T('Плащането още не е настроено.') : T('Плащането не можа да започне. Опитай отново след малко.') });
  }
}

/* /api/gift: the buyer's gift card after payment ({ session }), or only whether card payments are open (no session). */
async function gift(event) {
  const body = parse(event);
  if (!body) return json(400, { error: 'Невалидна заявка.' });
  I18N.lang = body.lang === 'en' ? 'en' : 'bg';
  if (!body.session) return json(200, { payReady: pay.ready() });
  const r = await pay.giftCard(body.session);
  I18N.lang = body.lang === 'en' ? 'en' : 'bg';
  if (r.code) return json(200, r);
  return json(r.note === 'unpaid' ? 409 : 404, { error: GIFT_NOTES[r.note] || NOTES.unknown, note: r.note });
}

module.exports = { report, checkout, gift };
