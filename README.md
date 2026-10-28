# Leamington Express

Online store, ride requests and travel agency for Leamington, Ontario — built so the
same code can power **Windsor Express**, **London Express** and more later.

- **Store** (`/tienda`) — departments, deals, new arrivals, bilingual typo-tolerant search,
  filters, product pages, cart, checkout (cash, Interac e-Transfer, card via Stripe), order tracking.
- **Ride** (`/ride`) — a step-by-step request: pick-up → destination → when → passengers →
  extras → contact → review → **Request ride**. Price estimates by distance.
- **Travel agency** (`/viajes`) — day trips, weekend packages and tours with itinerary,
  hotels, restaurants, what's included, per-person price breakdown, departures, offers,
  group discount and online booking (deposit collected after confirmation).
- **Account** (`/cuenta`) — sign in (email or Google), order/ride/trip history, saved details, Express Points.
- **Help, contact, privacy and terms** (`/ayuda`, `/contacto`, `/privacidad`, `/terminos`).
- **Admin** (`/admin`) — dashboard, orders, rides, travel bookings, products, trips,
  discount codes, messages and per-city settings.

Spanish is the default language; every page has an English toggle.

## Quick start

Requires Node 20.19+ (Node 22 recommended).

```bash
npm ci
npm run demo
```

`npm run demo` runs the whole site with **sample data in your browser** — nothing is sent to
Firebase. Open `/admin` and press **Enter demo** to explore the admin.

```bash
npm run dev          # real Firebase project (express-corp)
npm run build        # production build → dist/
npm run lint
npm run test:functions
```

## Project layout

```
src/
  config/        firebase.js (keys, collections, owner UID) · cities.js (cities + default settings)
  features/
    home/ store/ ride/ travel/ account/ info/ admin/
  services/
    firebase/    real backend (Firestore, Auth, Cloud Functions)
    demo/        same API, stored in the browser (npm run demo)
  i18n/          Spanish + English text
  lib/ styles/ components/ context/
functions/       Cloud Functions (orders, Stripe, discount codes, stock, points)
firestore.rules  security rules
public/          images, icons, robots.txt, sitemap.xml
```

## Going live

Follow this order so the current website keeps working until the new one is live.

### 1. Cloud Functions

```bash
npm install -g firebase-tools
firebase login
npm ci --prefix functions
npm run test:functions
firebase deploy --only functions
```

- The CLI will say the old **createCheckoutSession** function isn't in the code and ask to delete it.
  Answer **No** for now — the current website still uses it (it's removed in step 5).
- `stripeWebhook` keeps the same name and URL. The Stripe secrets `STRIPE_SECRET_KEY` and
  `STRIPE_WEBHOOK_SECRET` from the previous version are reused
  (`firebase functions:secrets:set STRIPE_SECRET_KEY` to change one).
- Stripe dashboard → Webhooks → your endpoint
  (`https://us-central1-express-corp.cloudfunctions.net/stripeWebhook`) → listen to
  `checkout.session.completed`, `checkout.session.expired`,
  `checkout.session.async_payment_succeeded` and `checkout.session.async_payment_failed`.

### 2. Website on Netlify

Connect this repository in Netlify (or update the existing site): build command `npm run build`,
publish directory `dist` (both already set in `netlify.toml`). No environment variables are
needed for Leamington. Old links (`/product.html`, `/inventory.html`, …) redirect automatically.

### 3. Firebase Authentication

Firebase console → Authentication → Sign-in method: keep **Email/Password** and enable **Google**.
Settings → Authorized domains: add `leamingtonexpress.ca` (and your Netlify preview domain to test there).

### 4. Security rules

```bash
firebase deploy --only firestore:rules
```

From now on orders can only be created by `createOrder`, and customer data, discount codes and
product costs are no longer public.

### 5. Remove the old checkout function

```bash
firebase functions:delete createCheckoutSession --region us-central1
```

### 6. First visit to the admin

Sign in at `/admin` with the owner account. Then:

1. **Products → Move private data** — moves cost, profit and supplier links out of the public
   product documents into `express_products_private`.
2. **Settings** — phone, WhatsApp, email, e-Transfer email, delivery fee, free-delivery amount,
   ride rates, deposit and group discount. Turn on **Card (Stripe)** only after a test payment works.
3. **Trips → Publish trips** — copies the 18 built-in trips into Firestore so you can edit prices,
   dates, hotels, restaurants and photos (until then the website shows the built-in catalog).
4. **Discount codes** — existing codes keep working; codes can now be single-use, have a minimum
   purchase or an end date.

To give someone else admin access, create the document `express_admins/{their uid}` in Firestore
(the uid is in Authentication → Users).

### Optional: photo uploads in the admin

Create an **unsigned upload preset** in Cloudinary (Settings → Upload) and add it to Netlify's
environment variables as `VITE_CLOUDINARY_PRESET`. Without it you can still paste image links.

### Photos

Trips and the home, ride and travel pages use real photos from [Unsplash](https://unsplash.com)
(free to use, also commercially), loaded from Unsplash's image service in the size each screen
needs. Trip photos are listed with each trip in `src/features/travel/data/trips.js`; the others
are in `src/lib/photos.js`. A few trip photos show a similar place rather than the exact one
(for example a Lake Huron beach for Grand Bend) — replace any of them with your own in
**Admin → Trips → Image** (paste a link or upload; add the photographer for the small credit).

## Adding a city (Windsor, London, …)

1. In `src/config/cities.js` set the city's `active: true`, check its `serviceArea`, and add
   `rideDestinations` (copy the Leamington list as a starting point).
2. Create a new Netlify site from this same repository with the environment variable
   `VITE_CITY=windsor` and connect the domain (`windsorexpress.ca`).
3. In the admin, switch the **City** selector to Windsor: save its Settings, publish its trips,
   and choose which products are sold there (products with no city selected are sold everywhere).
4. Orders, rides, bookings and messages are stored with their `city`, so each city's admin
   view only shows its own records.
5. Regenerate the sitemap for that domain: `SITE_URL=https://windsorexpress.ca npm run sitemap`.

## Data (Firestore collections)

| Collection | What | Who can read / write |
|---|---|---|
| `express_products` | catalog (same fields as the previous admin) | everyone / admins |
| `express_products_private` | cost, supplier, stock location | admins |
| `express_orders` | orders (`ODR######`), created by `createOrder` | owner of the order, admins |
| `express_dicount_codes` | discount codes (`Code`, `Discount`, `Reusable`, …) | admins (checked by the server) |
| `express_rides` | ride requests | anyone can request; admins manage |
| `express_travel_bookings` | trip bookings | anyone can book; admins manage |
| `express_messages` | contact form | anyone can send; admins read |
| `express_trips` | trip catalog per city | everyone / admins |
| `express_settings/{city}` | contact info, payments, delivery, ride and travel settings | everyone / admins |
| `users/{uid}` | customer profile and Express Points | the customer (not their points) / admins |
| `express_admins/{uid}` | extra administrators | owner |

Collections used by other apps in this Firebase project (for example `express_counters`) keep the
access they had before, so those apps keep working. Secure them when those apps add sign-in.

## How orders work

`createOrder` re-reads every product inside a transaction, so prices, stock, options and discount
codes can't be changed from the browser. Card orders open a Stripe Checkout page with those
server prices; if the customer leaves, the page expires after ~30 minutes and the stock is
released automatically. When an order is cancelled in the admin its items go back into stock,
and when an order is delivered and paid the customer receives its Express Points.

## Testing

- `npm run lint` — website; `npm --prefix functions run lint` — functions (also runs on deploy).
- `npm run test:functions` — order, stock, discount and delivery-fee rules.
- Full local test with the Firebase emulators (needs Java):
  `firebase emulators:start --project demo-express` and point the site at them with
  `VITE_USE_EMULATORS=true npm run dev`.

## Before launch, please review

- `/privacidad` and `/terminos` (text in `src/i18n/messages/info.js`) — a solid starting point,
  not legal advice.
- Trip prices, schedules, restaurants and hotels (Admin → Trips), and claims such as
  "Spanish-speaking guide/drivers".
- Ride rates and the group discount (Admin → Settings).
