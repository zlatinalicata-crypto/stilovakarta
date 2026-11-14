/* Payment with Stripe Checkout. A paid session unlocks only the inputs it was bought for. */
const crypto = require('crypto');

function hash(s) { return crypto.createHash('sha256').update(String(s)).digest('hex').slice(0, 40); }
function sha(s) { return crypto.createHash('sha256').update(String(s)).digest('hex'); }
function mock() { return process.env.MOCK_STRIPE === '1'; }
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

/* Returns { paid, note }: note is 'mismatch' (paid for other inputs), 'unpaid', 'test' (test-card payment) or 'unknown'.
   Test payments (card 4242…) unlock only while TEST_MODE=1. */
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
    if (ok && !s.livemode && process.env.TEST_MODE !== '1') return { paid: false, note: 'test' };
    if (ok && s.metadata && s.metadata.h === h) return { paid: true };
    return { paid: false, note: ok ? 'mismatch' : 'unpaid' };
  } catch (e) {
    return { paid: false, note: 'unknown' };
  }
}

module.exports = { hash, findCode, codeInfo, freeSession, createCheckout, isPaid };
