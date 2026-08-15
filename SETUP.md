# Vero Goods — setup and operations

`README.md` is the product specification. This file covers running, configuring
and deploying the application.

## Requirements

- Node.js 20+
- A MongoDB database (local or Atlas)

## First run

```bash
npm install
cp .env.example .env

# Generates ADMIN_PASSWORD_HASH and SESSION_SECRET — paste both into .env
node scripts/hash-password.mjs "a long admin password"

npm run dev
```

The catalogue seeds itself with demo products the first time it talks to an
empty database. Indexes are created automatically on first query.

### Upgrading an existing database

If your database predates the current schema (products with a top-level `price`,
orders with `totalAmount`), run the migration once:

```bash
npm run migrate           # dry run — prints what would change
npm run migrate -- --apply
```

It converts prices to integer paise, creates a `Default` variant per product,
backfills order totals and tax lines, and deletes legacy OTP records. Migrated
variants start at zero stock with backorder enabled, so set real stock levels in
the admin afterwards.

## Environment variables

Every variable is documented in `.env.example`. Three are required:

| Variable         | Notes                                                                 |
| ---------------- | --------------------------------------------------------------------- |
| `MONGODB_URI`    | Connection string.                                                     |
| `SESSION_SECRET` | ≥32 characters. Signs session cookies. No fallback — sessions fail without it. |
| `ADMIN_PASSWORD_HASH` | scrypt hash from `npm run hash-password`. `ADMIN_PASSWORD` (plaintext) works for local dev. There is no default password. |

## Payments

Local development works with no Razorpay account: leave the keys blank and keep
`RAZORPAY_SANDBOX_SIMULATION=true`. Checkout then shows a simulated payment
dialog. Simulation is refused in production and ignored whenever real keys exist.

For real payments, set `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET`, and — this part
is not optional in production — `RAZORPAY_WEBHOOK_SECRET`:

```
URL:    <NEXT_PUBLIC_APP_URL>/api/payments/razorpay/webhook
Events: payment.captured, payment.failed, refund.processed
```

The webhook is the authoritative payment path. Without it, a customer who pays
and closes the tab before the redirect leaves an order stuck in `PENDING` with
their money taken.

## Email

Set `SMTP_EMAIL_ADDRESS` and `SMTP_APP_PASSWORD` (Gmail app password) to send
OTP codes, receipts and status updates. Without them, messages are printed to
the server console and the app keeps working — useful locally, not acceptable in
production.

## Customer accounts

Customers sign in with an email address **or** a mobile number, both verified by
a 6-digit one-time code. There are no passwords anywhere in the customer flow.

- **Email codes** ride on the SMTP settings above.
- **SMS codes** need `SMS_PROVIDER=twilio` or `SMS_PROVIDER=msg91` plus that
  provider's credentials. Leave it blank in development and the code is printed
  to the terminal. In India, MSG91 also needs a registered DLT template.
- **Google Sign-In** appears only when `NEXT_PUBLIC_GOOGLE_CLIENT_ID` and
  `GOOGLE_CLIENT_ID` are set to the same OAuth web client id. Add your origin to
  the client's "Authorised JavaScript origins".

Signed-in customers get `/account` — profile, address book with a default
delivery address, and order history. Changing an email or mobile requires a code
sent to the **new** value.

### Duplicate identifiers on an existing database

Email, phone and Google id must each resolve to one account. Older data can
violate that (checkout used to copy an unverified phone number onto the user
record). The app builds those indexes as unique when it can, logs a warning and
falls back to non-unique when it cannot. To inspect and fix:

```bash
node --env-file=.env scripts/dedupe-user-identifiers.mjs --field=phone
node --env-file=.env scripts/dedupe-user-identifiers.mjs --field=phone --fix
```

The fix keeps the identifier on the strongest claim (verified, then most orders,
then oldest) and clears it from the others. No account or order is deleted.

## Out-of-stock products

An out-of-stock product stays fully browsable: media, description, variants and
specifications all render, with an "Out of stock" banner at the top. The primary
call to action becomes **Get it for me**, which records the customer's interest
(name, mobile, optional email and note). Those land in **Admin → Sourcing
requests**, and a copy is emailed to `SUPPORT_EMAIL`.

## Product videos

Products accept video URLs alongside images (Admin → product → Product media).
YouTube and Vimeo links render as privacy-mode embeds; direct `.mp4`/`.webm`
links play inline. Any other URL is ignored rather than framed.

## Commercial rules

Shipping, the COD handling fee and the COD ceiling are environment variables in
integer paise, so they can change without a deploy. Defaults:

| Variable                        | Default | Meaning                        |
| ------------------------------- | ------- | ------------------------------ |
| `SHIPPING_FLAT_MINOR`           | 9900    | ₹99 flat shipping              |
| `FREE_SHIPPING_THRESHOLD_MINOR` | 200000  | Free above ₹2,000              |
| `COD_FEE_MINOR`                 | 4900    | ₹49 COD handling fee           |
| `COD_MAX_ORDER_MINOR`           | 2000000 | COD refused above ₹20,000      |

Retail prices are **GST-inclusive**, following Indian retail convention. The
displayed price is what the customer pays; GST is broken out on the invoice
rather than added on top. Each product carries its own `gstRatePercent` and
`hsnCode`.

## Images

`next/image` only loads remote hosts listed in `next.config.ts` under
`images.remotePatterns`. Add your CDN there before using its URLs in a product.

## Checks

```bash
npm run typecheck
npm run lint
npm run build
```

## Architecture

The codebase is organised by **feature**, not by file type. A feature owns its
types, schemas, server code and components; `shared/` holds only things with no
single owner.

```
src/
  app/                     routes only — thin shells over feature components
    (store)/  admin/  api/
  features/
    catalog/    types.ts schemas.ts server/products.repo.ts components/
    cart/       store/cart.store.ts components/{CartDrawer,CartEffects}.tsx
    checkout/   schemas.ts server/pricing.ts components/CheckoutView.tsx
    orders/     types.ts schemas.ts server/orders.repo.ts components/
    payments/   schemas.ts server/razorpay.ts
    auth/       types.ts schemas.ts server/{auth,session,users.repo}.ts
    admin/      components/ server/product-input.ts
    storefront/ components/{Header,Footer,FeaturedProduct}.tsx
  shared/
    ui/         design-system primitives (button, card, table, dialog…)
    lib/        money, config, tokens, rate-limit, utils
    db/         mongodb client, collections, seed, infrastructure types
    email/      Resend transport + templates
    styles/     globals.css — the design tokens live here
```

Import rule: everything resolves through `@/…` (mapped to `src/`). A feature may
import from `@/shared/*` and from another feature's public modules; nothing
imports upward into `@/app`.

Conventions worth keeping:

- **Money** is always an integer count of paise, suffixed `Minor`.
  `shared/lib/money.ts` holds the only formatter. Never a float rupee value.
- **Data access** is per-document Mongo operations in a feature's `server/*.repo.ts`.
  There is no read-whole-database helper.
- **Stock** is reserved with a guarded `$inc` at order creation, so two shoppers
  cannot both buy the last unit. Cancelling or returning releases it.
- **Order and invoice numbers** come from an atomic counter collection.
- **Sessions** are HMAC-signed with `SESSION_SECRET` and verified in both the
  edge proxy and Node route handlers via Web Crypto.
- **Catalogue reads** are cached with `unstable_cache` under the `products` tag;
  admin writes call `revalidateTag`.

## Theme

The palette is **Graphite + Signal Orange**, defined once as CSS custom
properties in `src/shared/styles/globals.css` and exposed to Tailwind through
`@theme inline`.

| Token group | Purpose |
| ----------- | ------- |
| `surface`, `surface-raised`, `surface-sunken`, `surface-inverse` | backgrounds, back to front |
| `ink`, `ink-muted`, `ink-subtle`, `ink-inverse` | text, strongest to weakest |
| `line`, `line-strong` | borders |
| `accent`, `accent-hover`, `accent-soft`, `accent-border`, `accent-ink`, `on-accent` | the single brand colour |
| `success`, `warning`, `danger` (+ `-soft`, `-border`) | status |

Three rules keep it coherent:

1. **Never write a raw palette class** (`bg-zinc-100`, `text-rose-600`) in a
   component. Use the semantic token. That is what makes the whole theme
   swappable from one file.
2. **Orange means money or action.** Prices, discounts, add-to-cart, pay. If
   everything is accented, nothing is.
3. **Graphite is chrome, light is content.** The storefront has exactly two
   dark surfaces — the utility strip above the header and the footer band. They
   bookend the page. Nothing dark ever appears between them, so an inverted
   background always signals "this is frame, not merchandise" instead of being
   decoration. Hierarchy inside the content area comes from type size,
   whitespace and the accent, never from flipping the background.

There is a type scale (`text-3xs` … `text-3xl`) and a vertical rhythm
(`--spacing-section`) defined alongside the colours. No component should reach
for an arbitrary value like `text-[0.6875rem]`; if a size is missing, add it to
the scale.

The homepage has no hero. It opens on a compact title row and goes straight to
a four-up product grid, the way a category page does — a returning customer
should not have to scroll past a slogan to reach what they came to buy.

Dark mode is driven by `prefers-color-scheme` and every token has a dark value;
the accent is lifted to `#fb7534` there because `#ea580c` loses contrast against
a near-black surface. The admin shell stays graphite in both schemes so it is
never mistaken for the storefront.

## Known gaps

- No automated tests, CI, or error monitoring (Sentry or equivalent).
- No analytics or conversion tracking — a dropshipping storefront running paid
  ads needs GA4/Meta pixel events before it can measure ROAS.
- No abandoned-cart capture.
- Suppliers are embedded per variant rather than being their own managed entity;
  a supplier CRUD screen is the natural next step.
- GST is computed as a single rate per product with no CGST/SGST/IGST split by
  place of supply, and no PDF invoice is generated.
