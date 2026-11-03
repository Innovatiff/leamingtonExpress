// The Express browser extension: reading prices and links on store pages, handing products
// to the admin in the address, the admin's waiting list, and the .zip the admin hands out.
import test from "node:test";
import assert from "node:assert/strict";
import "../extension/extract.js";
import { decodePayload, encodePayload, itemKey, mergeQueue, sanitizeItem } from "../src/features/admin/storeQueue.js";
import { crc32, makeZip } from "../src/features/admin/zip.js";

const X = globalThis.ExpressExtract;

test("prices as stores write them", () => {
  assert.equal(X.parsePrice("$1,299.99"), 1299.99);
  assert.equal(X.parsePrice("1 299,99 $"), 1299.99); // walmart.ca/fr
  assert.equal(X.parsePrice("1 299,99 $"), 1299.99);
  assert.equal(X.parsePrice("CDN$ 19.99"), 19.99);
  assert.equal(X.parsePrice("19,99 $"), 19.99);
  assert.equal(X.parsePrice("$1,299"), 1299);
  assert.equal(X.parsePrice("$19.99 - $24.99"), 19.99);
  assert.equal(X.parsePrice(34.5), 34.5);
  assert.equal(X.parsePrice("Currently unavailable"), 0);
  assert.equal(X.parsePrice(""), 0);
  assert.equal(X.parsePrice(-4), 0);
});

test("descriptions: HTML to plain text, without the page's DOM", () => {
  assert.equal(X.plainText("<p>Fast &amp; quiet</p><ul><li>2 speeds</li><li>Timer&nbsp;&#8211; 60 min</li></ul>"), "Fast & quiet\n• 2 speeds\n• Timer – 60 min");
  assert.equal(X.plainText("Line one<br>Line two"), "Line one\nLine two");
});

test("stores, item numbers and clean links", () => {
  assert.equal(X.supplierOf("https://www.walmart.ca/en/ip/onn-32/6000203849173"), "walmart");
  assert.equal(X.supplierOf("https://www.amazon.ca/dp/B09B8V1LZ3"), "amazon");
  assert.equal(X.supplierOf("https://www.bestbuy.ca/en-ca/product/123"), "other");
  assert.equal(X.walmartItemId("https://www.walmart.ca/en/ip/onn-32-hd-tv/6000203849173?from=search"), "6000203849173");
  assert.equal(X.cleanLink("https://www.walmart.ca/fr/ip/onn-32-hd-tv/6000203849173?classType=REGULAR#reviews"), "https://www.walmart.ca/fr/ip/onn-32-hd-tv/6000203849173");
  assert.equal(X.cleanLink("https://www.amazon.ca/Echo-Dot/dp/B09B8V1LZ3/ref=sr_1_1?keywords=echo&th=1"), "https://www.amazon.ca/dp/B09B8V1LZ3");
  assert.equal(X.cleanLink("https://www.amazon.ca/gp/product/B09B8V1LZ3"), "https://www.amazon.ca/dp/B09B8V1LZ3");
  assert.equal(X.amazonLarge("https://m.media-amazon.com/images/I/61fd2oCrvyL._AC_SX342_.jpg"), "https://m.media-amazon.com/images/I/61fd2oCrvyL._AC_SL1500_.jpg");
});

const sample = {
  v: 1,
  supplier: "walmart",
  name: "Hamilton Beach 12-Cup Coffee Maker — “Brew Station”",
  price: 59.97,
  was: 69.97,
  link: "https://www.walmart.ca/en/ip/hamilton-beach/6000196530731",
  images: ["https://i5.walmartimages.ca/images/Enlarge/1.jpg", "javascript:alert(1)", "http://insecure.example/2.jpg"],
  brand: "Hamilton Beach",
  category: "Home > Kitchen > Coffee Makers",
  description: "Brews 12 cups.\n• Auto shut-off",
  available: true,
  sku: "6000196530731",
  store: "walmart.ca",
};

test("the extension's message survives the trip in the address (accents and quotes too)", () => {
  const [item] = decodePayload(encodePayload([sample]));
  assert.equal(item.name, sample.name);
  assert.equal(item.price, 59.97);
  assert.equal(item.was, 69.97);
  assert.equal(item.description, sample.description);
  assert.deepEqual(item.images, ["https://i5.walmartimages.ca/images/Enlarge/1.jpg"], "only https photos");
  assert.deepEqual(decodePayload("not base64 at all"), []);
  assert.deepEqual(decodePayload(encodePayload({ hello: "world" })), [], "not a product");
});

test("only products with a name and a web link get on the list", () => {
  assert.equal(sanitizeItem({ ...sample, link: "javascript:alert(1)" }), null);
  assert.equal(sanitizeItem({ ...sample, name: "   " }), null);
  const odd = sanitizeItem({ ...sample, supplier: "ebay", price: "abc", available: "yes" });
  assert.equal(odd.supplier, "other");
  assert.equal(odd.price, 0);
  assert.equal(odd.available, null);
});

test("adding a product again replaces it (newest first, new price kept)", () => {
  const a = sanitizeItem(sample);
  const b = sanitizeItem({ ...sample, name: "Echo Dot", supplier: "amazon", link: "https://www.amazon.ca/dp/B09B8V1LZ3", sku: "B09B8V1LZ3", price: 69.99 });
  let list = mergeQueue([], [a]);
  list = mergeQueue(list, [b]);
  assert.deepEqual(
    list.map((x) => x.name),
    ["Echo Dot", sample.name],
  );
  const cheaper = sanitizeItem({ ...sample, link: `${sample.link}?from=search`, price: 54.97 });
  list = mergeQueue(list, [cheaper]);
  assert.equal(list.length, 2, "same product, written differently");
  assert.equal(list[0].price, 54.97);
  assert.equal(itemKey(cheaper), itemKey(a));
});

test("zip: CRC-32 and a file the computer can open", () => {
  assert.equal(crc32(new TextEncoder().encode("123456789")), 0xcbf43926);
  const files = [
    { name: "manifest.json", data: '{"name":"Express"}' },
    { name: "icon.png", data: new Uint8Array([137, 80, 78, 71, 0, 255]) },
  ];
  const zip = makeZip(files, new Date(2026, 10, 3, 12, 30));
  const view = new DataView(zip.buffer);
  // read it back: each local header, then the central directory and its end
  let at = 0;
  for (const f of files) {
    assert.equal(view.getUint32(at, true), 0x04034b50);
    const size = view.getUint32(at + 18, true);
    const nameLength = view.getUint16(at + 26, true);
    const name = new TextDecoder().decode(zip.subarray(at + 30, at + 30 + nameLength));
    const data = zip.subarray(at + 30 + nameLength, at + 30 + nameLength + size);
    const expected = typeof f.data === "string" ? new TextEncoder().encode(f.data) : f.data;
    assert.equal(name, f.name);
    assert.deepEqual([...data], [...expected]);
    assert.equal(view.getUint32(at + 14, true), crc32(expected));
    at += 30 + nameLength + size;
  }
  assert.equal(view.getUint32(at, true), 0x02014b50);
  const end = zip.length - 22;
  assert.equal(view.getUint32(end, true), 0x06054b50);
  assert.equal(view.getUint16(end + 10, true), 2);
  assert.equal(view.getUint32(end + 16, true), at, "the directory starts after the files");
});
