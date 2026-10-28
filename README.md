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
- **Live status** (`/seguimiento`) — after a ride request, order or trip booking the customer
  follows it live: who is coming, the car and plate, and each step (like Uber). Works without an
  account (remembered on the device) and with one (every service in the account).
- **Help, contact, privacy and terms** (`/ayuda`, `/contacto`, `/privacidad`, `/terminos`).
- **Admin** (`/admin`) — dashboard, orders, rides, travel bookings, messages, **employees**
  (permissions per person: rides, deliveries, trips), products, trips, discount codes and
  per-city settings.
- **Employee app** (`/equipo`) — drivers, couriers and trip guides see the jobs they're allowed
  to do, accept them and mark each step. It has no access to the admin.

These are **three installable apps** (client, admin, employees) — see [The three apps](#the-three-apps).

Spanish is the default language; every page has an English toggle.

## Quick start

Requires Node 20.19+ (Node 22 recommended).

```bash
npm ci
npm run demo
```

`npm run demo` runs the whole site with **sample data in your browser** — nothing is sent to
Firebase. Open `/admin` and press **Enter demo** to explore the admin, and `/equipo` and tap a
sample employee to try the employee app. Open the website and `/equipo` in two tabs: a ride you
request appears in the employee app, and accepting it updates the customer's page.

```bash
npm run dev          # real Firebase project (express-corp)
npm run build        # production build → dist/
npm run lint
npm run test:functions
```

## Project layout

```
index.html       client app (website)      → src/main.jsx
admin.html       admin app (/admin)        → src/entries/admin.jsx
equipo.html      employee app (/equipo)    → src/entries/team.jsx
src/
  config/        firebase.js (keys, collections, owner UID) · cities.js (cities + default settings)
  features/
    home/ store/ ride/ travel/ account/ info/ admin/
    team/        employee app
    tracking/    customers' live status (/seguimiento)
  lib/dispatch.js  job steps shared by the three apps
  services/
    firebase/    real backend (Firestore, Auth, Cloud Functions); team.js = employee app
    demo/        same API, stored in the browser (npm run demo)
  i18n/          Spanish + English text
  lib/ styles/ components/ context/
functions/       Cloud Functions (orders, Stripe, discount codes, stock, points, employees, live status)
.github/workflows/deploy-functions.yml   deploys functions/ from GitHub (no terminal needed)
firestore.rules  security rules
public/          images, icons, app manifests, service worker (sw.js), robots.txt, sitemap.xml
```

## Going live

Everything below is done in the browser — no terminal needed.

### 1. Before you start

- **Firebase Authentication** — Firebase console → Authentication → Sign-in method: keep
  **Email/Password** on (employees sign in with it) and turn on **Google**. Settings →
  Authorized domains: add `leamingtonexpress.ca`, `www.leamingtonexpress.ca` and your
  `….netlify.app` address.
- **Remove the old checkout function** — Firebase console → Functions → `createCheckoutSession`
  → ⋮ → Delete (the current website no longer uses it). Keep `stripeWebhook`. The automatic
  deploy below never deletes functions by itself: if the project has functions that aren't in
  this code, it stops and lists them.

### 2. A deploy key for GitHub (once)

1. [Google Cloud console](https://console.cloud.google.com) → project **express-corp** →
   IAM & Admin → **Service accounts** → **Create service account**: name `github-deploy`,
   role **Owner** → Done.
2. Open `github-deploy` → **Keys** → Add key → Create new key → **JSON** (a file downloads).
3. GitHub → this repository → Settings → Secrets and variables → **Actions** →
   **New repository secret**: name `FIREBASE_SERVICE_ACCOUNT`, value = everything inside the
   downloaded file. Then delete the file from your computer.

The key can change anything in the Firebase project — keep it only in GitHub. To revoke it,
delete the key (or the whole `github-deploy` account) in Google Cloud.

### 3. Publish the website and the Cloud Functions

Netlify publishes the website from the branch it follows (today `claude/funny-hawking-g7g3st`).
When code reaches that branch, GitHub → **Actions** → **Deploy Cloud Functions** deploys the
functions by itself (5–10 minutes; a green check means done). To deploy again by hand, open the
latest **Deploy Cloud Functions** run and press **Re-run all jobs**.

- The run that was waiting for the key (red, "Add the FIREBASE_SERVICE_ACCOUNT secret first"):
  after step 2, open it and press **Re-run all jobs**.
- First deploy only: if it fails with an *Eventarc* or *"permission … may take a few minutes"*
  error, wait 5 minutes and press **Re-run all jobs** again.
- New in this version: `saveStaff` / `deleteStaff` (the admin's Employees page) and
  `onRideWritten`, `onOrderWritten`, `onBookingWritten` (customers' live status).
- `stripeWebhook` keeps the same name and URL, and the Stripe secrets `STRIPE_SECRET_KEY` and
  `STRIPE_WEBHOOK_SECRET` from the previous version are reused (Google Cloud console → Secret
  Manager, to change one).
- Stripe dashboard → Webhooks → your endpoint
  (`https://us-central1-express-corp.cloudfunctions.net/stripeWebhook`) → listen to
  `checkout.session.completed`, `checkout.session.expired`,
  `checkout.session.async_payment_succeeded` and `checkout.session.async_payment_failed`.

Netlify needs no settings for Leamington (`netlify.toml` has the build command, and old links
like `/product.html` redirect automatically).

### 4. Security rules

Firebase console → Firestore Database → **Rules** → replace everything with the contents of
`firestore.rules` → **Publish**. Do this only **after** step 3 (green check).

From now on orders can only be created by `createOrder`, and customer data, discount codes and
product costs are no longer public. Employees can only read the jobs they may take and their own,
and only move them forward one step at a time — never prices, customers or admin data.

With a terminal instead: `firebase deploy --only functions` and `firebase deploy --only firestore:rules`.

### 5. First visit to the admin

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

### 6. Employees

**Admin → Employees → Add employee**: name, phone, email and a password (you give it to them),
what they can do (**Rides**, **Deliveries**, **Trips** — any combination), their vehicle and plate.
Then press **Invite on WhatsApp** to send them the link to the employee app. To stop someone from
working without deleting them, turn off **Can sign in and receive jobs** (they are signed out at once).

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

## The three apps

| App | Address | Who | Install |
|---|---|---|---|
| Client | `leamingtonexpress.ca` | customers: shop, rides, trips, live status | optional — the website works the same |
| Admin | `leamingtonexpress.ca/admin` | you (and other admins) | yes, on your phone |
| Employees | `leamingtonexpress.ca/equipo` | drivers, couriers, guides | yes, on their phone |

They are installable web apps (no app store needed): **Android/Chrome** — open the address and
tap **Install** (or menu ⋮ → *Install app*). **iPhone** — open it in **Safari**, tap **Share** →
**Add to Home Screen**. Each one gets its own icon and opens full screen. Updates arrive by
themselves the next time the app is opened.

How a job flows:

| | Customer sees | Employee app | Admin |
|---|---|---|---|
| Ride | Finding a driver → *Carlos M. is on the way* (car + plate) → *has arrived* → *on the way to your destination* → *finished* | Accept → Arrived → Passenger on board → Finish | Assign / change / remove the driver, or change the status |
| Order | We got your order → preparing → on the way → delivered | Accept → Picked up → Delivered (records cash collected) | Assign the courier; card orders appear once paid |
| Trip | Confirmed → your guide → on the trip → completed | Take the departure (all its bookings) → Picked up → Completed | Assign the guide per departure |

The employee app plays a sound, vibrates and shows a notification for new jobs while it is open.
Phones pause web apps that are closed or long in the background, so employees keep it open while
they are **Available**. The admin's dashboard shows who is online and which jobs nobody took.

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
| `express_orders` | orders (`ODR######`), created by `createOrder` (`courierUid`, `courier`) | owner of the order, admins; couriers see open ones and their own |
| `express_dicount_codes` | discount codes (`Code`, `Discount`, `Reusable`, …) | admins (checked by the server) |
| `express_rides` | ride requests (`driverUid`, `driver`, `trackToken`) | anyone can request; admins manage; drivers see open ones and their own |
| `express_travel_bookings` | trip bookings (`guideUid`, `guide`, `tripStage`, `trackToken`) | anyone can book; admins manage; guides see confirmed ones and their own |
| `express_messages` | contact form | anyone can send; admins read |
| `express_trips` | trip catalog per city | everyone / admins |
| `express_settings/{city}` | contact info, payments, delivery, ride and travel settings | everyone / admins |
| `users/{uid}` | customer profile and Express Points | the customer (not their points) / admins |
| `express_admins/{uid}` | extra administrators | owner |
| `express_staff/{uid}` | employees: permissions (`can.rides/deliveries/trips`), vehicle, online | the employee (only online/offline) / admins (via `saveStaff`) |
| `express_tracking/{token}` | each customer's live status (no personal data) | whoever has the link / Cloud Functions only |

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
