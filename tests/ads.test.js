import test from "node:test";
import assert from "node:assert/strict";
import { adState, liveAds, normalizeAd, rotate, safeUrl, splitRails } from "../src/lib/ads.js";

test("ad links: web pages, pages of the site, phone and email only", () => {
  assert.equal(safeUrl("https://tacos.example.com/menu"), "https://tacos.example.com/menu");
  assert.equal(safeUrl("www.tacos.example.com"), "https://www.tacos.example.com");
  assert.equal(safeUrl("/tienda/producto/abc"), "/tienda/producto/abc");
  assert.equal(safeUrl("tel:+15195550100"), "tel:+15195550100");
  assert.equal(safeUrl("mailto:hola@example.com"), "mailto:hola@example.com");
  for (const bad of ["javascript:alert(1)", "JAVASCRIPT:alert(1)", "data:text/html,hi", "//evil.example.com", "   ", null, 42]) {
    assert.equal(safeUrl(bad), "", String(bad));
  }
});

test("an ad is cleaned up: known kinds, pages and colours; text trimmed", () => {
  const ad = normalizeAd({ id: "a1", kind: "banner", pages: ["travel", "nope", "travel"], theme: "pink", name: "  Samsung ", url: "javascript:x", startsAt: "2026-13-1" });
  assert.deepEqual([ad.kind, ad.pages, ad.theme, ad.name, ad.url, ad.startsAt], ["banner", ["travel"], "blue", "Samsung", "", ""]);
  const side = normalizeAd({ id: "s1" });
  assert.deepEqual([side.kind, side.pages, side.theme, side.active], ["side", ["shop", "travel"], "light", true]);
  assert.equal(normalizeAd(null).kind, "side");
});

test("dates: an ad shows from its first day through its last day", () => {
  const now = new Date("2026-11-10T12:00:00");
  const at = (patch) => adState(normalizeAd({ id: "x", title: "x", ...patch }), now);
  assert.equal(at({}), "live");
  assert.equal(at({ active: false }), "off");
  assert.equal(at({ startsAt: "2026-11-11" }), "scheduled");
  assert.equal(at({ startsAt: "2026-11-10" }), "live");
  assert.equal(at({ endsAt: "2026-11-10" }), "live");
  assert.equal(at({ endsAt: "2026-11-09" }), "ended");
});

test("the page's ads: by page, live, with something to show, in the owner's order", () => {
  const now = new Date("2026-11-10T12:00:00");
  const list = [
    { id: "a", kind: "side", title: "Tacos", pages: ["shop"] },
    { id: "b", kind: "side", title: "Pan", pages: ["travel"] },
    { id: "c", kind: "banner", productId: "tv-1" },
    { id: "d", kind: "side", title: "Off", active: false },
    { id: "e", kind: "side" },
    { id: "f", kind: "side", image: "https://res.cloudinary.com/x/image/upload/a.jpg", endsAt: "2026-11-01" },
    { id: "g", kind: "side", creative: "https://res.cloudinary.com/x/image/upload/b.jpg" },
  ];
  const shop = liveAds(list, "shop", now);
  assert.deepEqual(shop.side.map((a) => a.id), ["a", "g"]);
  assert.deepEqual(shop.banner.map((a) => a.id), ["c"]);
  assert.deepEqual(liveAds(list, "travel", now).side.map((a) => a.id), ["b", "g"]);
  assert.deepEqual(liveAds(undefined, "shop", now), { side: [], banner: [] });
});

test("rotation and the two side columns", () => {
  assert.deepEqual(rotate([1, 2, 3], 4), [2, 3, 1]);
  assert.deepEqual(rotate([1, 2, 3], -1), [3, 1, 2]);
  assert.deepEqual(rotate([], 3), []);
  assert.deepEqual(splitRails(["a", "b", "c"]), { left: ["a", "c"], right: ["b"] });
});
