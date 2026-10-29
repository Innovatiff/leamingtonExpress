"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const B = require("../lib/bluecart");

test("search results: products and prices, in the shapes BlueCart uses", () => {
  const body = {
    request_info: { success: true, credits_remaining: 97 },
    pagination: { current_page: 1, total_pages: 25 },
    search_results: [
      {
        product: { item_id: "6000203849173", title: "onn. 32\" HD Roku Smart TV", link: "https://www.walmart.ca/en/ip/onn-32-hd-roku-smart-tv/6000203849173", main_image: "https://i5.walmartimages.ca/a.jpg", brand: "onn.", rating: 4.4, ratings_total: 1532 },
        offers: { primary: { price: 148, was_price: 178 } },
      },
      { product: { title: "Kettle", link: "https://www.walmart.ca/en/ip/kettle/6000111222333", main_image: { link: "https://i5.walmartimages.ca/b.jpg" } }, price: "$24.97" },
      { product: { title: "" } },
    ],
  };
  const r = B.searchResults(body);
  assert.equal(r.items.length, 2);
  assert.deepEqual(r.items[0], {
    itemId: "6000203849173",
    title: "onn. 32\" HD Roku Smart TV",
    link: "https://www.walmart.ca/en/ip/onn-32-hd-roku-smart-tv/6000203849173",
    image: "https://i5.walmartimages.ca/a.jpg",
    brand: "onn.",
    price: 148,
    wasPrice: 178,
    rating: 4.4,
    reviews: 1532,
  });
  assert.deepEqual([r.items[1].itemId, r.items[1].image, r.items[1].price], ["6000111222333", "https://i5.walmartimages.ca/b.jpg", 24.97]);
  assert.deepEqual([r.page, r.totalPages], [1, 25]);
  assert.equal(B.creditsLeft(body), 97);
  assert.equal(r.found, 3);
  assert.equal(r.answer, undefined);
  assert.deepEqual(B.searchResults({}).items, []);
  // results somewhere else: found by their look
  const elsewhere = B.searchResults({ request_info: {}, data: { listing: [{ item_id: "6000201111111", title: "Kettle", price: 9.97 }] } });
  assert.deepEqual(elsewhere.items.map((x) => [x.itemId, x.title, x.price]), [["6000201111111", "Kettle", 9.97]]);
  // nothing readable: what BlueCart answered, in short
  const empty = B.searchResults({
    request_info: { success: true, message: "No results", credits_remaining: 94, api_key: "SECRET" },
    request_metadata: { walmart_url: "https://www.walmart.ca/search?q=toys" },
    search_results: [],
    pagination: { total_results: 0 },
  });
  assert.deepEqual([empty.items.length, empty.found], [0, 0]);
  assert.deepEqual(empty.answer, {
    fields: ["request_info", "request_metadata", "search_results", "pagination"],
    message: "No results",
    page: "https://www.walmart.ca/search?q=toys",
    total: 0,
    sample: "[]",
  });
  assert.ok(!JSON.stringify(empty.answer).includes("SECRET"));
  // a broad word opens a category page: its sub-categories come back, not products
  const toys = B.searchResults({
    request_info: { success: true },
    request_metadata: { walmart_url: "https://www.walmart.ca/search?q=toys&p=1" },
    category_info: { title: "Toys" },
    category_list: [
      { title: "Video games", link: "https://www.walmart.ca/en/cp/video-games/10012?icid=x", image: "https://i5.walmartimages.ca/v.jpg" },
      { title: "LEGO", link: "https://www.walmart.ca/en/cp/lego/12345" },
      { link: "https://www.walmart.ca/en/cp/x/1" },
    ],
  });
  assert.deepEqual([toys.items.length, toys.found, toys.answer, toys.category], [0, 0, undefined, "Toys"]);
  assert.deepEqual(toys.categories.map((c) => c.title), ["Video games", "LEGO"]);
  const odd = B.searchResults({ request_info: {}, results: [{ name: "x", sku: "1" }] });
  assert.deepEqual([odd.items.length, odd.found, odd.answer.sample], [0, 1, "{\"name\":\"x\",\"sku\":\"1\"}"]);
});

test("a product at one store: price, stock and aisle", () => {
  const body = {
    request_info: { success: true, credits_remaining: 96 },
    product: {
      item_id: "6000203849173",
      title: "onn. 32\" HD Roku Smart TV",
      link: "https://www.walmart.ca/en/ip/onn-32-hd-roku-smart-tv/6000203849173",
      brand: "onn.",
      main_image: { link: "https://i5.walmartimages.ca/a.jpg" },
      images: [{ link: "https://i5.walmartimages.ca/a.jpg" }, { link: "https://i5.walmartimages.ca/c.jpg" }],
      categories: [{ name: "Electronics" }, { name: "TVs" }, { name: "32\" TVs" }],
      feature_bullets: ["Roku built in", "3 HDMI ports"],
      availability: { raw: "In stock", in_stock: true },
      buybox_winner: { price: 148, was_price: 178 },
      aisle: "A12",
      rating: 4.4,
      ratings_total: 1532,
    },
  };
  const p = B.productInfo(body);
  assert.deepEqual(p, {
    itemId: "6000203849173",
    title: "onn. 32\" HD Roku Smart TV",
    link: "https://www.walmart.ca/en/ip/onn-32-hd-roku-smart-tv/6000203849173",
    images: ["https://i5.walmartimages.ca/a.jpg", "https://i5.walmartimages.ca/c.jpg"],
    brand: "onn.",
    description: "Roku built in\n3 HDMI ports",
    category: "Electronics > TVs > 32\" TVs",
    price: 148,
    wasPrice: 178,
    inStock: true,
    aisle: "A12",
    rating: 4.4,
    reviews: 1532,
  });
  // other ways of saying it
  assert.equal(B.productInfo({ product: { buybox_winner: { availability: { raw: "Out of stock" } } } }).inStock, false);
  const said = (product) => B.productInfo({ product }).inStock;
  assert.deepEqual(
    [said({ availability: "IN_STOCK" }), said({ availability_status: "OUT_OF_STOCK" }), said({ inventory: { quantity: 0 } }), said({ inventory: { quantity: 4 } })],
    [true, false, false, true],
  );
  assert.deepEqual([said({ stock_status: "Limited stock" }), said({ availability: { raw: "Not available at this store" } })], [true, false]);
  assert.deepEqual([said({ availability: { raw: "Available for shipping only" } }), said({ availability: { raw: "Available for pickup today" } })], [false, true]);
  const unknown = B.productInfo({ product: { title: "x", fulfillment: { pickup_today: "maybe", options: ["SHIPPING"] }, images: [{ link: "https://a" }] } });
  assert.equal(unknown.inStock, null); // not said → not confirmed
  assert.equal(unknown.stockNote, "product.fulfillment.pickup_today=maybe");
  assert.equal(B.productInfo({ product: { location: { aisle: ["A12", "A13"] } } }).aisle, "A12, A13");
  assert.equal(B.productInfo({ product: { name: "Kettle", offers: { primary: { price: 24.97 } } } }).price, 24.97);
  assert.deepEqual(B.productInfo({ request_info: { message: "Item not found" }, product: {} }).answer.message, "Item not found");
  assert.equal(B.productInfo(body).answer, undefined);
  assert.equal(B.productInfo({ product: { aisle: { location: "B4" }, buybox_winner: { price: { value: 9.97 } } } }).aisle, "B4");
  assert.equal(B.productInfo({ product: { buybox_winner: { price: { value: 9.97 } } } }).price, 9.97);
  assert.equal(B.itemIdFrom("https://www.walmart.ca/en/ip/mainstays-kettle/6000196512345?from=/search"), "6000196512345");
});

test("requests: walmart.ca, the key, and BlueCart's error messages", async () => {
  let asked = "";
  const ok = async (url) => {
    asked = String(url);
    return { ok: true, status: 200, json: async () => ({ request_info: { success: true } }) };
  };
  await B.bluecart("KEY", { type: "product", item_id: "123", store_id: "3093" }, { fetchImpl: ok });
  assert.match(asked, /api_key=KEY/);
  assert.match(asked, /walmart_domain=walmart\.ca/);
  assert.match(asked, /type=product&item_id=123&store_id=3093/);
  const bad = async () => ({ ok: false, status: 401, json: async () => ({ request_info: { success: false, message: "Invalid API key" } }) });
  await assert.rejects(B.bluecart("BAD", { type: "search" }, { fetchImpl: bad }), (e) => e.message === "Invalid API key" && e.status === 401);
  const html = async () => ({
    ok: false,
    status: 503,
    json: async () => {
      throw new Error("not json");
    },
  });
  await assert.rejects(B.bluecart("K", { type: "search" }, { fetchImpl: html }), /BlueCart answered 503/);
});

test("BlueCart's store list: any shape, searched by city or postal code, Canadian stores first", () => {
  const shapes = [
    [
      { store_id: 3164, name: "Leamington Supercentre", address: "304 Erie St S", city: "Leamington", province: "ON", postal_code: "N8H 3C5" },
      { store_id: 5678, name: "Windsor", city: "Windsor", state: "CT", zip: "06095" },
      { store_id: 2033, name: "Windsor Supercentre", city: "Windsor", province: "ON" },
    ],
    { "walmart.com": [{ id: "5678", city: "Windsor", state: "CT" }], "walmart.ca": [{ id: "3164", name: "Leamington", address: { line1: "304 Erie St S", city: "Leamington" } }] },
    { 3164: { name: "Leamington Supercentre", city: "Leamington" }, 2033: { name: "Windsor Supercentre", city: "Windsor" } },
    { 3164: "Leamington Supercentre, 304 Erie St S, Leamington ON", 2033: "Windsor Supercentre, Windsor ON" },
    { stores: [{ storeId: 3164, store_name: "Leamington", city: "Leamington" }] },
  ];
  for (const json of shapes) {
    const found = B.findStores(B.storeList(json), "leamington");
    assert.deepEqual(found.map((x) => x.id), ["3164"], JSON.stringify(json).slice(0, 60));
    assert.match(found[0].label, /Leamington/);
  }
  const list = B.storeList(shapes[0]);
  assert.deepEqual(B.findStores(list, "Windsor").map((x) => x.id), ["2033", "5678"]); // Ontario first
  assert.deepEqual(B.findStores(list, "Windsor", { canadaOnly: true }).map((x) => x.id), ["2033"]);
  assert.deepEqual(list.map(B.isCanadian), [true, false, true]);
  // a California store ("CA") isn't Canadian; a Newfoundland one is, by its postal code
  const more = B.storeList([{ id: 2553, name: "Windsor Store", address: "6650 Hembree Ln, Windsor, CA 95492" }, { id: 3036, name: "Grand Falls-Windsor", address: "19 Cromer Ave, A2A 1X3" }]);
  assert.deepEqual(more.map(B.isCanadian), [false, true]);
  assert.deepEqual(B.findStores(list, "n8h 3c5").map((x) => x.id), ["3164"]);
  assert.deepEqual(B.findStores(list, "  "), []);
  assert.equal(B.storeList(shapes[0])[0].label, "Leamington Supercentre · 304 Erie St S · Leamington · ON · N8H 3C5");
});

test("the store list is downloaded without the API key", async () => {
  let asked = "";
  const list = await B.walmartStores({ fetchImpl: async (url) => ((asked = String(url)), { ok: true, json: async () => [{ id: 1, city: "Leamington", name: "x" }] }) });
  assert.equal(list.length, 1);
  assert.ok(!/api_key/.test(asked));
  await assert.rejects(B.walmartStores({ fetchImpl: async () => ({ ok: false, status: 404 }) }), /answered 404/);
});

test("postal-code mode: pickup at the nearest store decides, and what BlueCart said comes along", () => {
  const product = (extra) => ({ product: { title: "Kettle", item_id: "6000201111111", buybox_winner: { price: 29.88, availability: { in_stock: true } }, ...extra } });
  const pickup = B.productInfo(product({ fulfillment: { pickup: true, pickup_information: "Pickup today at Leamington Supercentre" } }), { mode: "postal" });
  assert.equal(pickup.inStock, true);
  assert.match(pickup.stockNote, /pickup_information=Pickup today at Leamington/);
  assert.equal(B.productInfo(product({ fulfillment: { pickup: false, shipping: true } }), { mode: "postal" }).inStock, false);
  assert.equal(B.productInfo(product({ fulfillment: { pickup_information: "Pickup not available" } }), { mode: "postal" }).inStock, false);
  // in stock online, but nothing about pickup: not confirmed for the store
  const online = B.productInfo(product({}), { mode: "postal" });
  assert.equal(online.inStock, null);
  assert.equal(typeof online.stockNote, "string");
  // the store mode is unchanged
  assert.equal(B.productInfo(product({})).inStock, true);
  assert.equal(B.productInfo(product({})).stockNote, undefined);
  assert.deepEqual(["n8h3c5", "N8H 3C5", " n8h-3c5 ", "12345", ""].map(B.postalCode), ["N8H 3C5", "N8H 3C5", "N8H 3C5", "", ""]);
});
