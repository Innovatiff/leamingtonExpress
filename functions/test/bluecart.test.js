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
  assert.deepEqual(B.searchResults({}).items, []);
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
  assert.equal(B.productInfo({ product: { title: "x" } }).inStock, null); // not said → not confirmed
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
