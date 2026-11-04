// Express — reads the product on the page you're looking at: Walmart.ca, Amazon.ca, or any
// store that describes its products for search engines (schema.org / Open Graph). It runs in
// your browser only when you click "Add to Express"; it never visits pages by itself.
//
// A plain script (no import/export): the extension loads it before content.js, and the tests
// load it to check the helpers. Everything is on globalThis.ExpressExtract.
(function () {
  "use strict";
  if (globalThis.ExpressExtract) return;

  const MAX_IMAGES = 8;
  // also drops invisible characters some stores put in their titles (zero-width spaces, direction marks)
  const clean = (s) =>
    String(s ?? "")
      .replace(/[\u200b-\u200f\u202a-\u202e\u2060\ufeff]/g, "")
      .replace(/\s+/g, " ")
      .trim();

  /* -------------------------------- Text -------------------------------- */

  const ENTITIES = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " ", rsquo: "’", lsquo: "‘", rdquo: "”", ldquo: "“", ndash: "–", mdash: "—", hellip: "…", reg: "®", trade: "™", copy: "©", deg: "°" };

  /** HTML (or plain text) → plain text with line breaks kept, without touching the page's DOM. */
  function plainText(value) {
    return String(value ?? "")
      .replace(/<\s*br\s*\/?>/gi, "\n")
      .replace(/<\s*\/\s*(p|li|div|h[1-6]|tr|ul|ol)\s*>/gi, "\n")
      .replace(/<\s*li[^>]*>/gi, "• ")
      .replace(/<[^>]*>/g, " ")
      .replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (m, e) => {
        if (e[0] === "#") {
          const code = e[1] === "x" || e[1] === "X" ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10);
          return Number.isFinite(code) && code > 0 && code < 0x110000 ? String.fromCodePoint(code) : m;
        }
        return ENTITIES[e.toLowerCase()] ?? m;
      })
      .replace(/[ \t\u00a0]+/g, " ")
      .replace(/ *\n */g, "\n")
      .replace(/\n{3,}/g, "\n\n")
      .trim();
  }

  /** "$1,299.99" · "1 299,99 $" · "CDN$ 19.99" · "$19.99 - $24.99" → the (first) amount; 0 when there's none. */
  function parsePrice(value) {
    if (typeof value === "number") return Number.isFinite(value) && value > 0 ? Math.round(value * 100) / 100 : 0;
    const first = String(value ?? "").split(/\s[-–]\s|\sto\s|\sà\s/)[0];
    let s = first.replace(/[\s\u00a0\u202f]/g, "").replace(/[^0-9.,]/g, "");
    if (!/\d/.test(s)) return 0;
    const comma = s.lastIndexOf(",");
    const dot = s.lastIndexOf(".");
    if (comma > dot) {
      // the comma is the decimal mark when 1 or 2 digits follow it ("19,99"), else it groups thousands ("1,299")
      const decimals = s.length - comma - 1;
      s = decimals > 0 && decimals <= 2 ? `${s.slice(0, comma).replace(/[.,]/g, "")}.${s.slice(comma + 1)}` : s.replace(/,/g, "");
    } else {
      s = s.replace(/,/g, "");
    }
    s = s.replace(/\.(?=.*\.)/g, ""); // "1.299.99" → "1299.99"
    const n = Number(s);
    return Number.isFinite(n) && n > 0 ? Math.round(n * 100) / 100 : 0;
  }

  /** walmart / amazon / other, from the address */
  function supplierOf(url) {
    let host;
    try {
      host = new URL(url).hostname;
    } catch {
      return "other";
    }
    if (/(^|\.)walmart\./i.test(host)) return "walmart";
    if (/(^|\.)amazon\./i.test(host)) return "amazon";
    return "other";
  }

  /** The product's address without tracking (walmart.ca/en/ip/name/ID, amazon.ca/dp/ASIN). */
  function cleanLink(url, ids = {}) {
    let u;
    try {
      u = new URL(url);
    } catch {
      return "";
    }
    const origin = `${u.protocol}//${u.hostname}`;
    const walmart = u.pathname.match(/\/(?:(en|fr)\/)?ip\/(?:([^/?#]+)\/)?([A-Za-z0-9]+)\/?$/);
    if (/walmart\./i.test(u.hostname) && walmart) return `${origin}/${walmart[1] || "en"}/ip/${walmart[2] ? `${walmart[2]}/` : ""}${walmart[3]}`;
    const asin = ids.asin || u.pathname.match(/\/(?:dp|gp\/product|gp\/aw\/d)\/([A-Z0-9]{10})(?:[/?]|$)/i)?.[1];
    if (/amazon\./i.test(u.hostname) && asin) return `${origin}/dp/${asin.toUpperCase()}`;
    return `${origin}${u.pathname}${u.search}`;
  }

  /** Amazon photo sizes ("…_AC_SX342_.jpg") → the large one ("…_AC_SL1500_.jpg") */
  const amazonLarge = (src) => String(src || "").replace(/\._[A-Za-z0-9,_-]+_\.(jpe?g|png|webp)$/i, "._AC_SL1500_.$1");

  /** Walmart's photos can be 4000 px; its image server sends 1200 px when asked (Express keeps 1000) */
  function walmartSized(src) {
    try {
      const u = new URL(String(src || ""));
      if (/(^|\.)walmartimages\.(ca|com)$/i.test(u.hostname) && !u.searchParams.has("odnWidth") && !u.searchParams.has("odnHeight")) {
        u.searchParams.set("odnHeight", "1200");
        u.searchParams.set("odnWidth", "1200");
        u.searchParams.set("odnBg", "FFFFFF");
        return u.href;
      }
    } catch {
      // not a full link: left as it is
    }
    return src;
  }

  const absolute = (src, base) => {
    try {
      const u = new URL(String(src || "").trim(), base);
      return u.protocol === "https:" || u.protocol === "http:" ? u.href : "";
    } catch {
      return "";
    }
  };

  /** First object in a (big) JSON tree that passes the test. */
  function findObject(root, test, limit = 60000) {
    const queue = [root];
    let seen = 0;
    while (queue.length && seen < limit) {
      const x = queue.shift();
      seen++;
      if (!x || typeof x !== "object") continue;
      if (!Array.isArray(x) && test(x)) return x;
      for (const v of Array.isArray(x) ? x : Object.values(x)) if (v && typeof v === "object") queue.push(v);
    }
    return null;
  }

  /* ------------------------------- Specs -------------------------------- */

  // Not specs for customers: other stores' reviews and ranks, their own codes and dates
  const SKIP_SPEC = /customer reviews?|best ?sellers? rank|^asin$|date first available|discontinued by manufacturer|^upc$|^gtin|^ean$|^item id$|^walmart item|^sku$/i;
  const NO_VALUE = /^(n\/?a|unknown|not applicable|none|null|undefined|-|—|–)$/i;

  /** [name, value] pairs → [{ title, description }]: cleaned, no repeats, at most 25 */
  function cleanSpecs(pairs, max = 25) {
    const out = [];
    const seen = new Set();
    for (const [rawName, rawValue] of pairs || []) {
      const strip = (v) => clean(String(Array.isArray(v) ? v.join(", ") : (v ?? "")).replace(/[\u200b-\u200f\u202a-\u202e\ufeff]/g, ""));
      const title = strip(rawName).replace(/\s*:\s*$/, "").slice(0, 60);
      const description = strip(rawValue).replace(/^:\s*/, "").slice(0, 300);
      if (!title || !description || SKIP_SPEC.test(title) || NO_VALUE.test(description)) continue;
      const key = title.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      out.push({ title, description });
      if (out.length >= max) break;
    }
    return out;
  }

  /* ---------------------------- schema.org ------------------------------ */

  /** Product objects in the page's JSON-LD (also inside @graph and lists). */
  function jsonLdProducts(doc) {
    const out = [];
    for (const el of doc.querySelectorAll('script[type="application/ld+json"]')) {
      let data;
      try {
        data = JSON.parse(el.textContent);
      } catch {
        continue;
      }
      const stack = [data];
      while (stack.length) {
        const x = stack.pop();
        if (Array.isArray(x)) stack.push(...x);
        else if (x && typeof x === "object") {
          const types = [].concat(x["@type"] || []).map(String);
          if (types.some((t) => /^(Product|ProductGroup|IndividualProduct|Vehicle)$/i.test(t))) out.push(x);
          if (x["@graph"]) stack.push(x["@graph"]);
          if (x.mainEntity) stack.push(x.mainEntity);
        }
      }
    }
    return out;
  }

  const inStock = (availability) => {
    const a = String(availability || "");
    if (/OutOfStock|SoldOut|Discontinued/i.test(a)) return false;
    if (/InStock|LimitedAvailability|InStoreOnly|OnlineOnly|PreOrder|PreSale/i.test(a)) return true;
    return null;
  };

  /** A schema.org Product → our fields */
  function fromSchema(p) {
    const offers = []
      .concat(p.offers || [])
      .flatMap((o) => (o && o.offers ? [].concat(o.offers, o) : [o]))
      .filter((o) => o && typeof o === "object");
    const offer = offers.find((o) => parsePrice(o.price ?? o.lowPrice) > 0) || offers[0] || {};
    const variant = !parsePrice(offer.price ?? offer.lowPrice) && p.hasVariant ? [].concat(p.hasVariant).map(fromSchema).find((v) => v.price > 0) : null;
    const brand = typeof p.brand === "string" ? p.brand : p.brand?.name;
    const images = []
      .concat(p.image || [])
      .map((i) => (typeof i === "string" ? i : i?.url || i?.contentUrl))
      .filter(Boolean);
    return {
      name: clean(p.name),
      price: parsePrice(offer.price ?? offer.lowPrice) || variant?.price || 0,
      images: images.length ? images : variant?.images || [],
      brand: clean(brand),
      description: plainText(p.description),
      sku: clean(p.sku || p.productID || p.mpn),
      gtin: clean(p.gtin13 || p.gtin12 || p.gtin14 || p.gtin8 || p.gtin),
      category: clean(typeof p.category === "string" ? p.category : p.category?.name),
      available: inStock(offer.availability) ?? variant?.available ?? null,
      specs: cleanSpecs(
        []
          .concat(p.additionalProperty || [])
          .filter((x) => x && typeof x === "object")
          .map((x) => [x.name, x.value ?? x.description]),
      ),
    };
  }

  /* ------------------------------ Walmart ------------------------------- */

  /** The item number in a walmart.ca address (…/ip/name/6000203849173) */
  const walmartItemId = (url) => String(url).match(/\/ip\/(?:[^/?#]+\/)?([A-Za-z0-9]+)\/?(?:[?#]|$)/)?.[1] || "";

  /**
   * Walmart pages carry their data in __NEXT_DATA__. That's written when the page first loads,
   * so after Walmart switches products without reloading it can describe another product:
   * `stale` tells the button to reload the page first.
   */
  function walmartPage(doc, url) {
    const el = doc.getElementById("__NEXT_DATA__");
    if (!el) return null;
    let data;
    try {
      data = JSON.parse(el.textContent);
    } catch {
      return null;
    }
    const p = findObject(data, (o) => typeof o.name === "string" && o.priceInfo && typeof o.priceInfo === "object");
    if (!p) return null;
    const id = String(p.usItemId || p.itemId || p.id || "");
    const wanted = walmartItemId(url);
    // the item number in the address appears somewhere in this product's data → it's this product
    let mentioned = !wanted;
    if (wanted) {
      try {
        mentioned = JSON.stringify(p).includes(wanted);
      } catch {
        mentioned = true;
      }
    }
    const stale = !mentioned;
    const idml = findObject(data, (o) => o !== p && (typeof o.longDescription === "string" || (Array.isArray(o.productHighlights) && o.productHighlights.length)));
    const specList = findObject(data, (o) => Array.isArray(o.specifications) && o.specifications.some((x) => x && typeof x === "object" && (x.name || x.title)));
    const pi = p.priceInfo || {};
    const path = []
      .concat(p.category?.path || [])
      .map((c) => clean(c?.name))
      .filter(Boolean);
    const status = String(p.availabilityStatus || p.availabilityStatusV2?.value || "");
    return {
      stale,
      name: clean(p.name),
      price: parsePrice(pi.currentPrice?.price ?? pi.currentPrice?.priceString ?? pi.priceRange?.minPrice),
      was: parsePrice(pi.wasPrice?.price ?? pi.wasPrice?.priceString),
      images: (p.imageInfo?.allImages || []).map((i) => i?.url).filter(Boolean),
      brand: clean(p.brand),
      description: plainText(p.shortDescription || idml?.shortDescription || idml?.longDescription || ""),
      sku: id,
      gtin: clean(p.upc || p.gtin13),
      category: path.join(" > "),
      available: /IN_STOCK|AVAILABLE/i.test(status) && !/OUT_OF_STOCK|NOT_AVAILABLE|UNAVAILABLE/i.test(status) ? true : /OUT_OF_STOCK|NOT_AVAILABLE|UNAVAILABLE/i.test(status) ? false : null,
      specs: cleanSpecs((specList?.specifications || []).map((x) => [x?.name ?? x?.title, x?.value ?? x?.description])),
    };
  }

  /* ------------------------------- Amazon ------------------------------- */

  const text = (doc, sel) => clean(doc.querySelector(sel)?.textContent);

  const AMAZON_PRICE = [
    "#corePriceDisplay_desktop_feature_div .priceToPay .a-offscreen",
    "#corePriceDisplay_desktop_feature_div .apexPriceToPay .a-offscreen",
    "#corePriceDisplay_desktop_feature_div .a-price:not(.a-text-price) .a-offscreen",
    "#corePrice_desktop .apexPriceToPay .a-offscreen",
    "#corePrice_desktop .a-price:not(.a-text-price) .a-offscreen",
    "#corePrice_feature_div .a-price:not(.a-text-price) .a-offscreen",
    "#apex_desktop .priceToPay .a-offscreen",
    "#apex_desktop .apexPriceToPay .a-offscreen",
    "#apex_desktop .a-price:not(.a-text-price) .a-offscreen",
    "#tp_price_block_total_price_ww .a-offscreen",
    "#price_inside_buybox",
    "#newBuyBoxPrice",
    "#priceblock_dealprice",
    "#priceblock_saleprice",
    "#priceblock_ourprice",
    "#sns-base-price",
  ];

  function amazonPage(doc, url) {
    const name = text(doc, "#productTitle") || text(doc, "#title");
    if (!name) return null;
    let price = 0;
    for (const sel of AMAZON_PRICE) {
      price = parsePrice(doc.querySelector(sel)?.textContent);
      if (price) break;
    }
    if (!price) {
      for (const sel of ["#twister-plus-price-data-price", "#attach-base-product-price", "input[name='displayedPrice']", "input[name='items[0.base][customerVisiblePrice][amount]']"]) {
        price = parsePrice(doc.querySelector(sel)?.value);
        if (price) break;
      }
    }
    // Only a price they really charged before ("Was:"), not the maker's list price
    let was = 0;
    for (const el of doc.querySelectorAll("#corePriceDisplay_desktop_feature_div .basisPrice, #corePrice_desktop .basisPrice, #apex_desktop .basisPrice")) {
      if (/\b(was|avant|précédemment)\b/i.test(el.textContent || "")) {
        was = parsePrice(el.querySelector(".a-offscreen")?.textContent);
        if (was) break;
      }
    }

    // Photos: the large versions listed in the page's script (hiRes), else the main photo
    let images = [];
    const html = doc.documentElement?.innerHTML || "";
    for (const m of html.matchAll(/"hiRes":"(https:[^"]+?)"/g)) if (!images.includes(m[1])) images.push(m[1]);
    if (!images.length) {
      const img = doc.querySelector("#landingImage, #imgBlkFront, #main-image");
      let best = img?.getAttribute("data-old-hires") || "";
      if (!best) {
        try {
          const sizes = Object.entries(JSON.parse(img?.getAttribute("data-a-dynamic-image") || "{}"));
          best = sizes.sort((a, b) => b[1][0] * b[1][1] - a[1][0] * a[1][1])[0]?.[0] || "";
        } catch {
          best = "";
        }
      }
      if (best || img?.src) images.push(amazonLarge(best || img.src));
      for (const t of doc.querySelectorAll("#altImages .imageThumbnail img, #altImages li.item img")) {
        const big = amazonLarge(t.getAttribute("src"));
        if (big && !/sprite|play-button|transparent-pixel/i.test(big) && !images.includes(big)) images.push(big);
      }
    }

    const brandRow = text(doc, "#productOverview_feature_div tr.po-brand td:last-child, #productOverview_feature_div tr.po-brand td.a-span9");
    const byline = text(doc, "#bylineInfo")
      .replace(/^(Visit the|Visitez la boutique|Brand:|Marque\s*:)\s*/i, "")
      .replace(/\s+(Store|Boutique)$/i, "")
      .trim();
    let bulletEls = [...doc.querySelectorAll("#feature-bullets li:not(.aok-hidden) .a-list-item")];
    if (!bulletEls.length) bulletEls = [...doc.querySelectorAll("#feature-bullets li:not(.aok-hidden)")];
    const bullets = bulletEls.map((el) => clean(el.textContent)).filter((t, i, all) => t && all.indexOf(t) === i);
    const about = bullets.length ? bullets.map((b) => `• ${b}`).join("\n") : "";
    const longText = plainText(doc.querySelector("#productDescription")?.innerHTML || doc.querySelector("#bookDescription_feature_div")?.innerHTML || "");
    const crumbs = [...doc.querySelectorAll("#wayfinding-breadcrumbs_feature_div ul a, #wayfinding-breadcrumbs_container ul a")].map((a) => clean(a.textContent)).filter(Boolean);
    const availability = text(doc, "#availability");
    const gone = Boolean(doc.querySelector("#outOfStock")) || /currently unavailable|out of stock|unavailable|non disponible|rupture de stock|actuellement indisponible/i.test(availability);
    const asin =
      clean(doc.querySelector("#ASIN, input[name='ASIN']")?.value) || String(url).match(/\/(?:dp|gp\/product|gp\/aw\/d)\/([A-Z0-9]{10})(?:[/?]|$)/i)?.[1] || "";
    // Specs: the overview at the top, "Technical details" and the "Product information" tables/list
    const pairs = [];
    const tables =
      "#productOverview_feature_div tr, #tech tr, #productDetails_techSpec_section_1 tr, #productDetails_techSpec_section_2 tr, #productDetails_detailBullets_sections1 tr, #prodDetails table tr, table.prodDetTable tr";
    for (const tr of doc.querySelectorAll(tables)) {
      const cells = tr.querySelectorAll("th, td");
      if (cells.length >= 2) pairs.push([cells[0].textContent, cells[cells.length - 1].textContent]);
    }
    for (const li of doc.querySelectorAll("#detailBullets_feature_div li, #detailBulletsWrapper_feature_div li")) {
      const label = li.querySelector(".a-text-bold");
      if (label) pairs.push([label.textContent, (li.textContent || "").replace(label.textContent || "", "")]);
    }
    return {
      name,
      price,
      was: was > price ? was : 0,
      images,
      brand: brandRow || byline,
      description: [about, longText].filter(Boolean).join("\n\n"),
      sku: asin.toUpperCase(),
      gtin: "",
      category: crumbs.join(" > "),
      available: gone ? false : /in stock|en stock|left in stock|il ne reste/i.test(availability) ? true : null,
      specs: cleanSpecs(pairs),
    };
  }

  /* ------------------------------ Anywhere ------------------------------ */

  const meta = (doc, ...names) => {
    for (const n of names) {
      const el = doc.querySelector(`meta[property="${n}"], meta[name="${n}"], meta[itemprop="${n}"]`);
      const v = clean(el?.getAttribute("content"));
      if (v) return v;
    }
    return "";
  };

  /** Open Graph, microdata and the page title: what nearly every store has */
  function genericPage(doc) {
    const itemprop = doc.querySelector('[itemprop="price"]');
    const images = [meta(doc, "og:image:secure_url"), meta(doc, "og:image"), meta(doc, "twitter:image")].filter(Boolean);
    return {
      name: meta(doc, "og:title", "twitter:title") || text(doc, "h1") || clean(doc.title),
      price: parsePrice(meta(doc, "product:price:amount", "og:price:amount")) || parsePrice(itemprop?.getAttribute("content") || itemprop?.textContent),
      images,
      brand: meta(doc, "product:brand", "og:brand"),
      description: meta(doc, "og:description", "description", "twitter:description"),
      sku: "",
      gtin: "",
      category: "",
      available: /out ?of ?stock|oos/i.test(meta(doc, "product:availability", "og:availability")) ? false : /in ?stock|instock/i.test(meta(doc, "product:availability", "og:availability")) ? true : null,
      specs: [],
    };
  }

  /* ------------------------------- Product ------------------------------ */

  /** Is this a single product's page (to show the button)? */
  function isProductPage(doc, url) {
    const supplier = supplierOf(url);
    if (supplier === "walmart") return /\/ip\//.test(new URL(url).pathname);
    if (supplier === "amazon") return Boolean(doc.querySelector("#productTitle")) || /\/(dp|gp\/product)\//.test(url);
    return jsonLdProducts(doc).length > 0;
  }

  /**
   * The product on this page → { v, supplier, name, price, was, link, images, brand, category,
   * description, available, sku, gtin, specs: [{ title, description }], store, stale }. price is 0 when the page doesn't show one.
   * options.fresh: the page hasn't changed address since it loaded, so its data is this product's.
   */
  function extract(doc, url, options = {}) {
    const supplier = supplierOf(url);
    const site = supplier === "walmart" ? walmartPage(doc, url) : supplier === "amazon" ? amazonPage(doc, url) : null;
    const usableSite = site && (!site.stale || options.fresh) ? site : null;
    const schema = jsonLdProducts(doc).map(fromSchema);
    const wantedId = supplier === "walmart" ? walmartItemId(url) : "";
    // On Walmart, the schema written for this very item. When the page's data describes the
    // product shown before (Walmart switched products without reloading), nothing else on
    // the page can be trusted either: `stale` asks for a reload.
    const exact = wantedId ? schema.find((s) => s.sku === wantedId) : null;
    const stale = !options.fresh && Boolean(site?.stale) && !exact;
    const ld = exact || (stale ? null : schema.find((s) => s.name && s.price > 0) || schema[0] || null);
    const generic = genericPage(doc);
    const sources = [usableSite, ld, stale ? null : generic].filter(Boolean);
    const pick = (key) => {
      for (const s of sources) {
        const v = s[key];
        if (Array.isArray(v) ? v.length : typeof v === "number" ? v > 0 : v !== null && v !== undefined && v !== "") return v;
      }
      return key === "available" ? null : Array.isArray(generic[key]) ? [] : typeof generic[key] === "number" ? 0 : "";
    };
    const images = [];
    for (const src of pick("images")) {
      const abs = walmartSized(absolute(supplier === "amazon" ? amazonLarge(src) : src, url));
      if (abs && !images.includes(abs)) images.push(abs);
      if (images.length >= MAX_IMAGES) break;
    }
    const sku = pick("sku");
    const price = pick("price");
    let host;
    try {
      host = new URL(url).hostname.replace(/^www\./, "");
    } catch {
      host = "";
    }
    const canonical = doc.querySelector('link[rel="canonical"]')?.getAttribute("href");
    const link = supplier === "other" && canonical ? cleanLink(absolute(canonical, url)) || cleanLink(url) : cleanLink(url, supplier === "amazon" ? { asin: sku } : {});
    return {
      v: 1,
      supplier,
      name: pick("name").slice(0, 200),
      price,
      was: usableSite?.was > price ? usableSite.was : 0,
      link,
      images,
      brand: pick("brand").slice(0, 80),
      category: pick("category").slice(0, 200),
      description: pick("description").slice(0, 5000),
      available: pick("available"),
      sku: String(sku).slice(0, 40),
      gtin: pick("gtin").slice(0, 20),
      specs: pick("specs"),
      store: host,
      stale,
    };
  }

  globalThis.ExpressExtract = { extract, isProductPage, parsePrice, plainText, supplierOf, cleanLink, amazonLarge, walmartSized, walmartItemId, cleanSpecs };
})();
