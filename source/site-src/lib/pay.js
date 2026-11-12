/* Payment with Stripe Checkout. A paid session unlocks only the inputs it was bought for. */
const crypto = require('crypto');

function hash(s) { return crypto.createHash('sha256').update(String(s)).digest('hex').slice(0, 40); }
function mock() { return process.env.MOCK_STRIPE === '1'; }
function client() {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) return null;
  const Stripe = require('stripe');
  return (Stripe.default || Stripe)(key);
}

async function createCheckout(h, origin) {
  if (mock()) return { url: origin + '/?session_id=mock_paid_' + h };
  const stripe = client();
  if (!stripe) { const e = new Error('Stripe key missing'); e.code = 'not_configured'; throw e; }
  /* Introductory price until PROMO_UNTIL (inclusive), then the regular price. Keep in step with CONFIG in the page. */
  const promoOn = new Date().toISOString().slice(0, 10) <= (process.env.PROMO_UNTIL || '2027-02-28');
  const cents = parseInt(promoOn ? (process.env.PROMO_CENTS || '499') : (process.env.PRICE_CENTS || '1999'), 10);
  const session = await stripe.checkout.sessions.create({
    mode: 'payment',
    line_items: [{ quantity: 1, price_data: { currency: 'eur', unit_amount: cents, product_data: { name: 'Стилова карта: пълен резултат' } } }],
    success_url: origin + '/?session_id={CHECKOUT_SESSION_ID}',
    cancel_url: origin + '/?cancelled=1',
    metadata: { h: h },
    locale: 'auto',
    allow_promotion_codes: true
  });
  return { url: session.url };
}

/* Returns { paid, note }: note is 'mismatch' (paid for other inputs), 'unpaid' or 'unknown'. */
async function isPaid(id, h) {
  if (typeof id !== 'string' || !id || id.length > 200) return { paid: false, note: 'unknown' };
  if (mock()) {
    if (id === 'mock_paid_' + h) return { paid: true };
    return { paid: false, note: id.indexOf('mock_paid_') === 0 ? 'mismatch' : 'unknown' };
  }
  const stripe = client();
  if (!stripe) return { paid: false, note: 'unknown' };
  try {
    const s = await stripe.checkout.sessions.retrieve(id);
    const ok = s.payment_status === 'paid';
    if (ok && s.metadata && s.metadata.h === h) return { paid: true };
    return { paid: false, note: ok ? 'mismatch' : 'unpaid' };
  } catch (e) {
    return { paid: false, note: 'unknown' };
  }
}

module.exports = { hash, createCheckout, isPaid };
