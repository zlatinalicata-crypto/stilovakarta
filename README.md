# Стилова карта

Сайтът stilovakarta.bg. Тестовете и прегледът са безплатни, пълният резултат се отключва с плащане от 4,99 € през Stripe.

## Как е устроен

- `public/`: страниците, които вижда посетителят. Там няма палитри и формули.
- `lib/`: изчисленията и пълният резултат. Работят само на сървъра.
- `netlify/functions/`: `/api/report` дава прегледа, а пълния резултат само за платена поръчка, и то за данните, с които е платена. `/api/checkout` отваря плащането в Stripe.

## Пускане в Netlify

1. В Netlify: **Add new site → Import an existing project → GitHub → stilovakarta**. Настройките идват от `netlify.toml`, не пипай нищо.
2. **Site configuration → Environment variables** добави:
   - `STRIPE_SECRET_KEY`: тестовият ключ от Stripe (започва със `sk_test_`), от Developers → API keys.
   - `TEST_MODE` = `1`: показва бутона „Тестов режим“. **Махни го преди истинското пускане.**
3. **Deploys → Trigger deploy**.

## Тест на плащането

Плати с тестова карта `4242 4242 4242 4242`, произволна бъдеща дата и произволен CVC. След плащането пълният резултат трябва да се отвори сам.

## Домейн

**Domain management → Add a domain → stilovakarta.bg**, после следвай указанията за DNS в register.bg.

## Истинско пускане

1. Попълни маркираните полета в `public/terms.html` и `public/privacy.html`.
2. Смени `STRIPE_SECRET_KEY` с live ключа (`sk_live_`) и изтрий `TEST_MODE`.
3. Направи нов deploy и плати веднъж с истинска карта, за да провериш.

## Промоционални кодове

В Stripe → Product catalog → Coupons създаваш код, например за приятелки. Полето за код вече е в плащането.
