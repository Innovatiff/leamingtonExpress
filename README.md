# Leamington Express

Online store, ride requests and travel agency for Leamington, Ontario — built so the
same code can power **Windsor Express**, **London Express** and more later.

- **Store** (`/tienda`) — departments, deals, new arrivals, bilingual typo-tolerant search,
  filters, product pages, cart, checkout (cash on delivery, Interac e-Transfer, card via Stripe), order tracking.
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
- **Remove the old checkout function** (optional clean-up) — the website no longer uses
  `createCheckoutSession`. Delete it in Google Cloud console → Cloud Run functions
  (`console.cloud.google.com/functions/list`) → tick it → Delete. The automatic deploy below
  only deploys the functions in this code and never deletes anything.
- **Stripe secrets** — the functions need `STRIPE_SECRET_KEY` and `STRIPE_WEBHOOK_SECRET` in
  Google Cloud console → Secret Manager. Until card payments are set up, a placeholder value
  (`not-set-yet`) is fine; keep **Card (Stripe)** off in Admin → Settings.

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

When code reaches the branch `claude/funny-hawking-g7g3st`, GitHub → **Actions** publishes it by
itself (a green check means done):

- **Deploy website** — the store, admin and employee apps on **Firebase Hosting**:
  `https://express-corp.web.app`, and your domain once it points there (below). No limit on how
  often; a few minutes each time.
- **Deploy Cloud Functions** — the server (5–10 minutes).

To publish again by hand, open the latest run and press **Re-run all jobs** (or **Run workflow**).
Netlify (which published the website before) also publishes from that branch until your domain
moves to Firebase; its free plan allows about 20 publishes a month.

- The run that was waiting for the key (red, "Add the FIREBASE_SERVICE_ACCOUNT secret first"):
  after step 2, open it and press **Re-run all jobs**.
- First deploy only: if it fails with an *Eventarc* or *"permission … may take a few minutes"*
  error, wait 5 minutes and press **Re-run all jobs** again.
- New in this version: `saveStaff` / `deleteStaff` (the admin's Employees page),
  `onRideWritten`, `onOrderWritten`, `onBookingWritten` (customers' live status) and
  `refreshCatalog` / `publishCatalog` (the store's compact catalog, see "Products and prices"),
  `walmart` (Admin → Products → **Add from Walmart.ca**) and `copyPhotos` (product photos, see
  "Product photos" below). `refreshCatalog` runs every 5 minutes with Cloud Scheduler, which the
  first deploy turns on by itself (if that deploy fails with a Cloud Scheduler error, wait 5
  minutes and re-run it).
- `stripeWebhook` keeps the same name and URL, and the Stripe secrets `STRIPE_SECRET_KEY` and
  `STRIPE_WEBHOOK_SECRET` from the previous version are reused (Google Cloud console → Secret
  Manager, to change one).
- Stripe dashboard → Webhooks → your endpoint
  (`https://us-central1-express-corp.cloudfunctions.net/stripeWebhook`) → listen to
  `checkout.session.completed`, `checkout.session.expired`,
  `checkout.session.async_payment_succeeded` and `checkout.session.async_payment_failed`.

Netlify needs no settings for Leamington (`netlify.toml` has the build command, and old links
like `/product.html` redirect automatically).

### Your domain on Firebase Hosting (once)

1. Open `https://express-corp.web.app` and check the store, `/admin` and `/equipo` work.
2. Firebase console → **Hosting** → **Add custom domain** → `leamingtonexpress.ca` (then again
   for `www.leamingtonexpress.ca`, redirecting to the first one).
3. Firebase shows the DNS records to add. Add them where your domain's DNS is managed (the
   company where you bought the domain, or Netlify → Domains if the domain uses Netlify's name
   servers), replacing the old records that point to Netlify.
4. Wait for **Connected** in Firebase (minutes to a few hours, HTTPS included). Then remove the
   domain from the Netlify site and stop its builds (Site configuration → Build & deploy).

**Photo uploads in the admin:** copy the value of `VITE_CLOUDINARY_PRESET` from Netlify (Site
configuration → Environment variables) to GitHub → Settings → Secrets and variables →
**Actions → Variables** → New repository variable with the same name, then re-run **Deploy
website**. Without it, the admin asks for image links instead of uploads.

### 4. Security rules

Firebase console → Firestore Database → **Rules** → replace everything with the contents of
`firestore.rules` → **Publish**. Do this only **after** step 3 (green check), and again every
time `firestore.rules` changes (the live map, for example, needs its new rules).

From now on orders can only be created by `createOrder`, and customer data, discount codes and
product costs are no longer public. Employees can only read the jobs they may take and their own,
and only move them forward one step at a time — never prices, customers or admin data.

With a terminal instead: `firebase deploy --only functions` and `firebase deploy --only firestore:rules`.

### Product photos: turn on Storage (once)

Photos of imported products are copied to the project's own **Firebase Storage**, so customers
never see links like `walmartimages.ca`. Turn it on once: Firebase console → **Storage** → **Get
started** → keep a US location (`us-central1` is in the no-cost tier) → **production mode** →
done. Nothing else to set: the Cloud Functions save the photos, and the store shows them through
their links. Until it's on, the admin's Products page says so when you press **Copy photos now**.

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

Create an **unsigned upload preset** in Cloudinary (Settings → Upload) and add it to GitHub's
Actions variables (and Netlify's environment variables, while Netlify publishes) as
`VITE_CLOUDINARY_PRESET`. Without it you can still paste image links.

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
| Order | (e-Transfer or card: confirming your payment →) we got your order → preparing at the Express warehouse (some items: "arrives in 1–2 days") → on the way → delivered | Accept → Picked up at the Express warehouse → Delivered (records cash collected) | Mark e-Transfers as paid, buy the items (Orders → **To buy**), press **Ready at the warehouse**, then assign the courier (or let one take it) |
| Trip | Confirmed → your guide → on the trip → completed | Take the departure (all its bookings) → Picked up → Completed | Assign the guide per departure |

The employee app plays a sound, vibrates and shows a notification for new jobs while it is open.
Phones pause web apps that are closed or long in the background, so employees keep it open while
they are **Available**. The admin's dashboard shows who is online and which jobs nobody took.

**Live map.** While a driver or courier is on the way, the customer sees them coming on a map,
with the pick-up point (or their door) and an approximate arrival time; the admin sees the same
map in the ride or order. It starts when a driver accepts a ride (for a scheduled ride, one hour
before the pick-up time) and when a courier picks up an order, and ends at the drop-off or
delivery, when the position is deleted.

- The employee app sends the phone's GPS position every few seconds, so it must stay **open on
  screen** while driving (it keeps the screen on by itself). The first time, the phone asks to
  allow location: tap **Allow**. If location is blocked, the app shows how to turn it on.
- Maps come from [OpenFreeMap](https://openfreemap.org) (OpenStreetMap data — free, no account
  or key). A typed address is placed on the map by the Cloud Functions using OpenStreetMap's
  Nominatim; GPS pick-ups ("use my location") are used as they are.
- The arrival time is an estimate from the straight-line distance, not a route.

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
| `express_products_private` | cost, supplier (`supplier`, `supplierPrice`, `supplierRegular`, link, Walmart aisle `supplierAisle`), automatic price, stock location | admins |
| `express_integrations/bluecart` | BlueCart API key and Walmart store number | admins (used by the Cloud Functions) |
| `express_pricing/default` | margins, minimum profit, tax the supplier charges | admins |
| `express_catalog` | compact copy of the products for sale, for the store | everyone / Cloud Functions only |
| `express_orders` | orders (`ODR######`), created by `createOrder` (`courierUid`, `courier`, `addressGeo`) | owner of the order, admins; couriers see open ones and their own |
| `express_dicount_codes` | discount codes (`Code`, `Discount`, `Reusable`, …) | admins (checked by the server) |
| `express_rides` | ride requests (`driverUid`, `driver`, `trackToken`, `pickupGeo`) | anyone can request; admins manage; drivers see open ones and their own |
| `express_travel_bookings` | trip bookings (`guideUid`, `guide`, `tripStage`, `trackToken`) | anyone can book; admins manage; guides see confirmed ones and their own |
| `express_messages` | contact form | anyone can send; admins read |
| `express_trips` | trip catalog per city | everyone / admins |
| `express_settings/{city}` | contact info, payments, delivery, ride and travel settings | everyone / admins |
| `users/{uid}` | customer profile and Express Points | the customer (not their points) / admins |
| `express_admins/{uid}` | extra administrators | owner |
| `express_staff/{uid}` | employees: permissions (`can.rides/deliveries/trips`), vehicle, online | the employee (only online/offline) / admins (via `saveStaff`) |
| `express_tracking/{token}` | each customer's live status (no personal data) | whoever has the link / Cloud Functions only |
| `express_tracking/{token}/live/position` | the employee's location while on the way (deleted at the end) | whoever has the link / only the employee doing that job, while on the way |

Collections used by other apps in this Firebase project (for example `express_counters`) keep the
access they had before, so those apps keep working. Secure them when those apps add sign-in.

## Products and prices

**Where products come from.** Each product has a supplier (admin → product → *Supplier*):
**Walmart** — an employee buys it at the local store, delivered in **2 hours**; **Amazon** —
Amazon Prime, **1–2 days**; or **Other**. Choosing one sets the delivery time customers see
("Recíbelo en 2 horas", the fast-delivery filter). The supplier, its link and its price are
private (admins only).

**Automatic prices** (Admin → Settings → **Prices**, for all cities):

- cost = the supplier's price + the tax they charge you (13% HST by default; 0 if you claim it back);
- price = cost + your margin for that supplier (Walmart 20%, Amazon 15%, other 20% to start),
  rounded to the **nearest** price ending in **2.99, 4.99, 7.99 or 9.99**, but never leaving less
  than the **minimum profit** per item ($1 to start). The card shows examples as you type.
- **Offers end in .00**: when the supplier has it on sale (fill in *their regular price*), our
  regular price follows their regular price and their sale becomes our offer; or set *Our offer
  (% off)* on the product.
- After changing the margins: **Update product prices…** shows how many products change and
  applies it. Products with *Automatic price* off keep the price you typed (the editor suggests
  the nearest allowed ending).

**Adding many products** — Admin → Products → **Import**: a CSV (any spreadsheet saved as CSV)
or the CSV/JSON export of a product-data service, one product per row. The columns are matched
by themselves (you can change them); walmart.ca and amazon.ca links set the supplier; new
products can arrive hidden for review; out-of-stock items can be skipped. Importing the same
file again updates those products (price, stock) instead of duplicating them, so a fresh export
from the supplier data is also how prices get refreshed until the daily check exists.

Files from product-data services work as they come: a **BlueCart API** collection
(Walmart.ca) downloaded as CSV, or a **Keepa** Product Finder / Product Viewer export
(Amazon.ca). Their columns are recognized, and the import remembers the columns you chose for
each kind of file. A supplier's "list price" isn't used as a regular price unless you pick it.

**From Walmart.ca, only what your store has** — Admin → Products → **Add from Walmart.ca**:

1. Create an account at [BlueCart API](https://trajectdata.com/ecommerce/blue-cart-api/) (100 free
   requests) and copy your **API key**. Then **Find your store in BlueCart's list** (city or
   postal code — BlueCart has its own store numbers, which can differ from Walmart's), pick it and
   **Save** (only admins and the Cloud Functions can read them).
2. **Search** (each page of results = 1 request), tick the products you want (**Select all new**
   skips the ones you already sell) — or **paste walmart.ca product links** (free) — and press
   **Check store stock & import** (1 request per product). Only products **in stock at your store**
   are imported, with automatic prices and the aisle (shown to you in the order, under **To buy**);
   the others are listed with the reason, and with what BlueCart answered when it can't be read.
3. Products marked **Walmart brand** (Great Value, Mainstays, onn., Equate, Hyper Tough…) are
   Walmart's own: their photos belong to Walmart, so it's better to take your own photos of those.

BlueCart's store list covers only part of Canada, and walmart.ca doesn't accept a postal code
instead of a store. If your store isn't in the list, ask BlueCart's support to add it (their
error message says so too); until then the stock check can't confirm your store's shelves.

100 free requests are about 90 products. For thousands, a paid BlueCart plan (10,000 requests
for about US$66), or a BlueCart **collection** downloaded as CSV and brought in with **Import**.

**Orders: payment, then the Express warehouse.** Customers pay **cash on delivery** (the
courier collects it at the door; turn it off in Settings → Payment methods), by **e-Transfer**
(you mark it **Paid** in the order when it arrives) or by **card** (paid automatically).
e-Transfer and card orders wait for the payment before anything is bought; cash orders can be
bought right away. Customers and employees only ever see **Express** — the supplier, its link
and the aisle are in the admin only. An order with Walmart or Amazon items waits under Orders →
**To buy**: buy them (each item has its link and Walmart aisle; for Amazon press **I ordered it
on Amazon**), then press **Ready at the warehouse**. Until then couriers don't see the order;
from then on an employee takes it in the app (*Pick the order up at the Express warehouse*), or
you deliver it yourself. Customers with Amazon items see "arrives in 1–2 days" meanwhile.

**Product photos.** Photos that live on other websites (`walmartimages.ca`,
`m.media-amazon.com`, …) are copied to Express's own Storage (see "Product photos: turn on
Storage"), shrunk to at most 1000 px, saved as WebP without the original file's details, and
named so the link doesn't say where they came from. It happens right after an import, when a
product with such a photo is saved, and by itself every few minutes for anything left (the
Products page shows how many are left, with **Copy photos now**). A photo that no longer exists
is removed; one that can't be downloaded right now is tried again later. This changes the link,
not who owns the photo: manufacturers' photos are generally used by every store that sells
their products, but for store brands and anything you're unsure about, use your own photos.

**Thousands of products.** The store doesn't download every product: the Cloud Functions keep a
compact copy of the catalog (`express_catalog`, a few documents) that the website reads, and the
product page loads its full product. It updates by itself within 5 minutes of any change (right
away after an import). Until the first copy exists, the website reads the products directly.

## How orders work

`createOrder` re-reads every product inside a transaction, so prices, stock, options and discount
codes can't be changed from the browser. Couriers only see an order once it's paid (or is cash
on delivery) and, for Walmart or Amazon items, ready at the warehouse. Card orders open a Stripe
Checkout page with those
server prices; if the customer leaves, the page expires after ~30 minutes and the stock is
released automatically. When an order is cancelled in the admin its items go back into stock,
and when an order is delivered and paid the customer receives its Express Points.

## Testing

- `npm run lint` — website; `npm --prefix functions run lint` — functions (also runs on deploy).
- `npm run test:functions` — order, stock, discount and delivery-fee rules, automatic prices
  (and that the website and the functions price the same way), the compact catalog, reading
  BlueCart's answers and copying product photos.
- Full local test with the Firebase emulators (needs Java):
  `firebase emulators:start --project demo-express` and point the site at them with
  `VITE_USE_EMULATORS=true npm run dev`.

## Before launch, please review

- `/privacidad` and `/terminos` (text in `src/i18n/messages/info.js`) — a solid starting point,
  not legal advice.
- Trip prices, schedules, restaurants and hotels (Admin → Trips), and claims such as
  "Spanish-speaking guide/drivers".
- Ride rates and the group discount (Admin → Settings).
