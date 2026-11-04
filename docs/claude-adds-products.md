# Claude adds products from your computer

Two Claudes work together:

- **Claude on your computer** (Claude Code in a terminal, driving your own Chrome): opens
  walmart.ca or amazon.ca, sends products to your Express list with the Express extension,
  gives them good names and categories, and adds them to the store.
- **Claude in the cloud** (this project on claude.ai/code): checks the store afterwards with
  `npm run check:products` — photos copied, prices following your rules, specs, names,
  categories, duplicates — and fixes what's wrong.

## Set up (once)

1. A Claude plan that includes Claude Code with Chrome: **Pro, Max, Team or Enterprise**.
2. Install **Claude Code** on the computer (see code.claude.com → Docs → Quickstart).
3. In Chrome, install **Claude in Chrome** from the Chrome Web Store
   (https://chromewebstore.google.com/detail/claude/fcoeoabgfenejglbffodgkkbkcdhcgfn) and sign
   in with the same Claude account. Use Google Chrome.
4. The **Express extension 1.2 or later** (Admin → Products → Add from Walmart & Amazon → Get the
   extension; replace the old folder's files and reload it in `chrome://extensions`).
5. In Chrome: sign in to the Express admin (`https://leamingtonexpress.ca/admin`), and on
   walmart.ca choose your **Leamington** store.
6. In a terminal: `claude --chrome` (or `/chrome` inside Claude → "Enabled by default"). If it
   asks, sign in with `/login`. `/chrome` shows whether Chrome is connected; "Reconnect
   extension" fixes a lost connection.

Claude uses your Chrome with your logins, in its own group of tabs you can watch. When a site
shows a "verify you're human" check (Walmart's *Press & Hold*) or a login, Claude stops and asks
you to do it.

## How Claude adds a product

Any of these work; the first is the most reliable for Claude:

- Open the product's page with **`#express-add`** at the end of the address, e.g.
  `https://www.walmart.ca/en/ip/some-product/6000203849173#express-add`.
- Press **Alt+Shift+E** (Option+Shift+E on a Mac) on the product's page.
- Click the **Add to Express** button at the bottom left of the page.

The result appears at the bottom left: *Added to your Express list · $59.97* (green), a warning
(no price on the page, out of stock), or an error. It's also on the page for tools to read:
the element `[data-express-add]` has `data-express-status` (`added`, `error`, `reloading`) and
`data-express-message`.

## What to tell Claude (paste it, then change the parts in [brackets])

```text
Add products to my store Leamington Express. Use my Chrome.

What to add: [10] products from walmart.ca in [Electronics > TVs and headphones], priced
[$20–$500], in stock for pickup at my Leamington store. [Or: these product links: …]

Rules:
- Walmart's selected store must be Leamington. If it isn't, stop and tell me.
- Skip Walmart's own brands (Great Value, Mainstays, onn., Equate, Hyper Tough, Parent's
  Choice…) unless I list them, and skip products sold only online or by other sellers.
- One product at a time: open its page with #express-add at the end of the address, wait for
  the message at the bottom left ("Added to your Express list · $…"), then the next one.
  If the message says there's no price or it's out of stock, note it.
- Never buy anything, never use the Walmart cart, never change my Walmart account or store,
  never sign in anywhere. If you see "Press & Hold" or any human check, stop and ask me.

Then open https://leamingtonexpress.ca/admin/productos/agregar and, for each product:
- "Name in your store": short and clear, [in Spanish], at most 60 characters: brand + what it
  is + the key detail (size, capacity, colour). No store marketing words.
- Category: if it says Other, pick a fitting one from the suggestions.
- If it shows "Needed" (no price), type the price from the product page, or remove it.
- Remove anything that doesn't fit the rules above.
Leave "Put them on sale" [on], press "Add … to the store", and wait for the green message.

Finally, give me a list: what you added (name and price), and what you skipped and why.
```

To fill in specs or descriptions on products you already sell, the cloud check lists them with
their supplier link ready to open (`…#express-add`). Paste that list to Claude on your computer
with: *"Open each of these links, wait for 'Added to your Express list', then on the Add from
Walmart & Amazon page press Add to the store."* Only their price, specs and description change.

## Checking prices and stock at the suppliers (Claude on your computer)

Admin → Products → **Check suppliers** (`/admin/productos/revisar`) lists every product with its
supplier link and price. Each product has **Open on Walmart/Amazon**, the supplier's price boxes,
and the buttons **Still good**, **Save price** (after typing a new price), **Hide from store** /
**Put on sale** / **Keep hidden**. A checked product leaves the *To check* list until tomorrow,
so the work is always "the first product of the list". Paste this to Claude on your computer:

```text
Check every product in my store Leamington Express against its supplier. Use my Chrome.

Setup:
- On walmart.ca, the selected store must be Leamington. If it isn't, stop and tell me.
- Open https://leamingtonexpress.ca/admin/productos/revisar (Check suppliers), tab "To check".

Repeat with the FIRST product in the list until the list is empty:
1. Click its "Open on Walmart" (or "Open on Amazon") link; it opens in a new tab.
2. Walmart: it must be available for PICKUP TODAY at my Leamington store. Amazon: it must be
   in stock, sold by Amazon. If it isn't, close the tab and press "Hide from store"
   (or "Keep hidden" if the product is already hidden).
3. If it's available, compare the price on the page with the product's "Walmart price" (or
   "Amazon price") box:
   - Same → press "Still good" (or "Put on sale" if the product is hidden).
   - Different → type the new price in that box. If the page shows a sale with a crossed-out
     "was" price, type that in "Their regular price"; otherwise leave it empty. Then press
     "Save price" (or "Put on sale" if the product is hidden).
4. Close the supplier tab. The product leaves the list; go on with the new first product.
If a product says "No supplier link", press "Still good" and note it for me.

Rules:
- Only use those links, price boxes and buttons. Don't change anything else in my admin.
- Never buy anything, never use the Walmart or Amazon cart, never change my Walmart account
  or store. If you see "Press & Hold" or any human check, stop and ask me.
- Every 25 products, show me a short summary, then go on.

When the list is empty, press "Update the store now" and give me 4 lists: price changed
(old → new), hidden (and why), put back on sale, and no supplier link.
```

## Checking (Claude in the cloud)

Give the cloud Claude a separate admin account (not yours), so it can also check the private
side (supplier, its price and link, cost and profit):

1. Firebase console → Authentication → **Add user** (an email for Claude and a strong password).
2. Firestore → collection `express_admins` → add a document whose ID is that user's **UID**.
3. claude.ai/code → this project's environment (menu in the session's title bar) → **Edit** →
   add `EXPRESS_ADMIN_EMAIL` and `EXPRESS_ADMIN_PASSWORD` (Network secrets, or environment
   variables). Never paste them in a chat. A new session picks them up.

Then ask the cloud Claude: *"Check the products added today."* It runs
`npm run check:products -- --days 1` (read only) and reports or fixes what's wrong. Removing the
`express_admins` document takes its access away at once.
