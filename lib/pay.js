/* Payment with Stripe Checkout. A paid session unlocks only the inputs it was bought for. */
const crypto = require('crypto');

function hash(s) { return crypto.createHash('sha256').update(String(s)).digest('hex').slice(0, 40); }
function sha(s) { return crypto.createHash('sha256').update(String(s)).digest('hex'); }
function mock() { return process.env.MOCK_STRIPE === '1'; }
/* Test mode ("Тестов режим" button, test cards unlock) exists only on the local dev server with MOCK_STRIPE=1, never on the live site. */
function testMode() { return mock() && process.env.TEST_MODE === '1'; }
function client() {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) return null;
  const Stripe = require('stripe');
  return (Stripe.default || Stripe)(key);
}

/* Codes typed on the site before payment. Kept as SHA-256 of the lower-case code, so the public repository does not show them.
   pct: discount in percent. free: unlocks the full result without payment.
   New code: node -e "console.log(require('crypto').createHash('sha256').update('kod').digest('hex'))" and add the line here. */
const CODES = {
  '7a05b89e669e7bbad6c42211ab7d1d73c7246422858b5931ca8291685e948612': { pct: 15 },
  '52f4133003f0b16081102a9b2daf3a1c4d5755895e56a5d6c41c181b58f73129': { free: true }
};
function findCode(raw) {
  const c = String(raw || '').trim().toLowerCase().replace(/\s+/g, '');
  if (!c || c.length > 40) return null;
  const hit = CODES[sha(c)];
  return hit ? Object.assign({ code: c }, hit) : null;
}

/* Introductory price until PROMO_UNTIL (inclusive), then the regular price. Keep in step with CONFIG in the page. */
function priceCents(code) {
  const promoOn = new Date().toISOString().slice(0, 10) <= (process.env.PROMO_UNTIL || '2027-02-28');
  const cents = parseInt(promoOn ? (process.env.PROMO_CENTS || '499') : (process.env.PRICE_CENTS || '1999'), 10);
  if (code && code.free) return 0;
  if (code && code.pct) return Math.max(50, Math.round(cents * (100 - code.pct) / 100));
  return cents;
}
function codeInfo(code) { return code.free ? { free: true } : { pct: code.pct, cents: priceCents(code) }; }

/* A free code gives a token tied to the inputs, signed with a server secret. */
function freeKey() {
  const s = process.env.CODE_SECRET || process.env.STRIPE_SECRET_KEY || (mock() ? 'dev' : '');
  return s ? crypto.createHash('sha256').update('stilovakarta-free:' + s).digest() : null;
}
function freeSession(h) {
  const k = freeKey();
  if (!k) { const e = new Error('No secret for free codes'); e.code = 'not_configured'; throw e; }
  return 'free_' + crypto.createHmac('sha256', k).update(String(h)).digest('hex').slice(0, 32);
}

async function createCheckout(h, origin, lang, code) {
  if (mock()) return { url: origin + '/?session_id=mock_paid_' + h };
  const stripe = client();
  if (!stripe) { const e = new Error('Stripe key missing'); e.code = 'not_configured'; throw e; }
  const meta = { h: h };
  if (code) meta.code = code.code;
  const session = await stripe.checkout.sessions.create({
    mode: 'payment',
    line_items: [{ quantity: 1, price_data: { currency: 'eur', unit_amount: priceCents(code), product_data: { name: lang === 'en' ? 'Stilova Karta: full style analysis' : 'Стилова карта: пълен резултат' } } }],
    success_url: origin + '/?session_id={CHECKOUT_SESSION_ID}',
    cancel_url: origin + '/?cancelled=1',
    metadata: meta,
    locale: lang === 'en' ? 'en' : 'bg'
  });
  return { url: session.url };
}

/* Gift cards. A paid gift order carries an 8-character code in the metadata of its payment (gift) and of its Checkout session.
   The code unlocks one full result: the first inputs it is used with are written back to the payment (gift_h),
   and afterwards the code opens only those inputs. A refunded gift payment no longer unlocks anything.
   Lookups use the Stripe search API, so a code bought a minute ago may need a moment before it is found. */
const GIFT_ABC = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
const mockGifts = new Map();
function newGiftCode() { let s = ''; for (let i = 0; i < 8; i++) s += GIFT_ABC[crypto.randomInt(GIFT_ABC.length)]; return s; }
function giftNorm(raw) {
  const c = String(raw || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
  if (c.length !== 8) return null;
  for (const ch of c) if (GIFT_ABC.indexOf(ch) < 0) return null;
  return c;
}
function giftShow(c) { return c.slice(0, 4) + '-' + c.slice(4); }

async function createGiftCheckout(origin, lang, code, g) {
  const gc = newGiftCode();
  if (mock()) { mockGifts.set(gc, { h: '', to: g.to, from: g.from, msg: g.msg }); return { url: origin + '/?gift_session=mock_gift_' + gc }; }
  const stripe = client();
  if (!stripe) { const e = new Error('Stripe key missing'); e.code = 'not_configured'; throw e; }
  const meta = { kind: 'gift', gift: gc };
  ['to', 'from', 'msg'].forEach((k) => { if (g[k]) meta[k] = g[k]; });
  if (code) meta.code = code.code;
  const session = await stripe.checkout.sessions.create({
    mode: 'payment',
    line_items: [{ quantity: 1, price_data: { currency: 'eur', unit_amount: priceCents(code), product_data: { name: lang === 'en' ? 'Stilova Karta: gift card' : 'Стилова карта: подаръчна карта' } } }],
    payment_intent_data: { metadata: { kind: 'gift', gift: gc }, description: 'Подаръчна стилова карта · ' + giftShow(gc) },
    success_url: origin + '/?gift_session={CHECKOUT_SESSION_ID}',
    cancel_url: origin + '/?gift=1&cancelled=1',
    metadata: meta,
    locale: lang === 'en' ? 'en' : 'bg'
  });
  return { url: session.url };
}

/* The buyer's gift card: { code, to, from, msg } for a paid gift session, otherwise { note }. */
async function giftCard(id) {
  if (typeof id !== 'string' || !id || id.length > 200) return { note: 'unknown' };
  if (mock()) {
    const g = id.indexOf('mock_gift_') === 0 ? mockGifts.get(id.slice(10)) : null;
    return g ? { code: giftShow(id.slice(10)), to: g.to, from: g.from, msg: g.msg } : { note: 'unknown' };
  }
  const stripe = client();
  if (!stripe) return { note: 'unknown' };
  try {
    const s = await stripe.checkout.sessions.retrieve(id);
    const m = s.metadata || {};
    if (m.kind !== 'gift' || !giftNorm(m.gift)) return { note: 'unknown' };
    if (s.payment_status !== 'paid') return { note: 'unpaid' };
    if (!s.livemode && !testMode()) return { note: 'test' };
    return { code: giftShow(giftNorm(m.gift)), to: m.to || '', from: m.from || '', msg: m.msg || '' };
  } catch (e) {
    return { note: 'unknown' };
  }
}

/* { ok, used, ref } for a paid, not refunded gift code, otherwise { note }. Throws when Stripe cannot be reached. */
async function lookupGift(gc) {
  if (mock()) { const g = mockGifts.get(gc); return g ? { ok: true, used: g.h, ref: gc } : { note: 'gift_unknown' }; }
  const stripe = client();
  if (!stripe) return { note: 'gift_unknown' };
  const found = await stripe.paymentIntents.search({ query: "status:'succeeded' AND metadata['gift']:'" + gc + "'", limit: 1 });
  const hit = found.data[0];
  if (!hit || (!hit.livemode && !testMode())) return { note: 'gift_unknown' };
  const pi = await stripe.paymentIntents.retrieve(hit.id, { expand: ['latest_charge'] });
  if (pi.latest_charge && pi.latest_charge.refunded) return { note: 'gift_refunded' };
  return { ok: true, used: (pi.metadata && pi.metadata.gift_h) || '', ref: pi.id };
}
/* Checks a gift code, and with inputs (h) also that it is free for them: { ok } or { note }. */
async function giftCheck(gc, h) {
  const g = await lookupGift(gc);
  if (!g.ok) return g;
  if (g.used && h && g.used !== h) return { note: 'gift_used' };
  return g;
}
/* Uses a gift code for the inputs h: binds it on first use and returns { session } (a free token for h), or { note }. */
async function redeemGift(gc, h) {
  const g = await giftCheck(gc, h);
  if (!g.ok) return g;
  if (!g.used) {
    if (mock()) mockGifts.get(gc).h = h;
    else await client().paymentIntents.update(g.ref, { metadata: { gift_h: h, gift_used_at: new Date().toISOString() } });
  }
  return { session: freeSession(h) };
}

/* Returns { paid, note }: note is 'mismatch' (paid for other inputs), 'unpaid', 'test' (test-card payment) or 'unknown'.
   Test payments (card 4242…) never unlock on the live site. */
async function isPaid(id, h) {
  if (typeof id !== 'string' || !id || id.length > 200) return { paid: false, note: 'unknown' };
  if (id.indexOf('free_') === 0) {
    let want = null;
    try { want = freeSession(h); } catch (e) { return { paid: false, note: 'unknown' }; }
    const ok = want.length === id.length && crypto.timingSafeEqual(Buffer.from(want), Buffer.from(id));
    return ok ? { paid: true } : { paid: false, note: 'mismatch' };
  }
  if (mock()) {
    if (id === 'mock_paid_' + h) return { paid: true };
    return { paid: false, note: id.indexOf('mock_paid_') === 0 ? 'mismatch' : 'unknown' };
  }
  const stripe = client();
  if (!stripe) return { paid: false, note: 'unknown' };
  try {
    const s = await stripe.checkout.sessions.retrieve(id);
    const ok = s.payment_status === 'paid';
    if (ok && !s.livemode && !testMode()) return { paid: false, note: 'test' };
    if (ok && s.metadata && s.metadata.h === h) return { paid: true };
    return { paid: false, note: ok ? 'mismatch' : 'unpaid' };
  } catch (e) {
    return { paid: false, note: 'unknown' };
  }
}

/* Card payments are open only with a live Stripe key. Otherwise the page says payment comes soon. */
function ready() {
  if (mock()) return true;
  const key = process.env.STRIPE_SECRET_KEY || '';
  return key.indexOf('sk_live_') === 0 || key.indexOf('rk_live_') === 0;
}

module.exports = { hash, findCode, codeInfo, freeSession, createCheckout, isPaid, ready, testMode, giftNorm, createGiftCheckout, giftCard, giftCheck, redeemGift };
