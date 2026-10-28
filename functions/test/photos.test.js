"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const path = require("node:path");
const { pathToFileURL } = require("node:url");
const sharp = require("sharp");
const { FieldValue } = require("firebase-admin/firestore");
const { copyPhoto, copyProductPhotos, isOwnPhoto, needsCopy, outsidePhotos, PhotoError, RETRY_AFTER, sniff } = require("../lib/photos");

const BUCKET = "express-corp.firebasestorage.app";
const OURS = `https://firebasestorage.googleapis.com/v0/b/${BUCKET}/o/products%2Fabc?alt=media&token=t`;
const URLS = [
  ["https://i5.walmartimages.ca/images/Large/094/514/6000200094514.jpg", false],
  ["https://m.media-amazon.com/images/I/71abc._AC_SL1500_.jpg", false],
  ["http://example.com/a.png", false],
  [OURS, true],
  [`https://storage.googleapis.com/${BUCKET}/products/x.webp`, true],
  ["https://firebasestorage.googleapis.com/v0/b/someone-else.appspot.com/o/x?alt=media", false],
  ["https://res.cloudinary.com/dnb4uwcfy/image/upload/v1/express/products/a.jpg", true],
  [`http://127.0.0.1:9199/v0/b/${BUCKET}/o/products%2Fx?alt=media`, true],
  ["data:image/jpeg;base64,AAAA", true],
  ["/images/local.jpg", true],
  ["https://", true],
  ["", true],
  [null, true],
];

/** A Storage bucket in memory (what the tests need of @google-cloud/storage) */
function fakeBucket(name = BUCKET, { missing = false } = {}) {
  const files = new Map();
  const notFound = (message) => Object.assign(new Error(message), { code: 404 });
  return {
    name,
    files,
    file: (filePath) => ({
      async getMetadata() {
        if (missing) throw notFound("The specified bucket does not exist.");
        if (!files.has(filePath)) throw notFound(`No such object: ${name}/${filePath}`);
        return [files.get(filePath).metadata];
      },
      async setMetadata(patch) {
        const f = files.get(filePath);
        f.metadata = { ...f.metadata, metadata: { ...f.metadata.metadata, ...patch.metadata } };
      },
      async save(data, options) {
        if (missing) throw notFound("The specified bucket does not exist.");
        files.set(filePath, { data, metadata: options.metadata });
      },
    }),
  };
}

const answer = (status, body = "", type = "") => async () => new Response(body, { status, headers: type ? { "content-type": type } : {} });
const picture = (format, width = 4, height = 4) => sharp({ create: { width, height, channels: 3, background: "#c33" } })[format]().toBuffer();

test("photos on other websites are told apart from ours (the same on the website)", async () => {
  for (const [url, own] of URLS) assert.equal(isOwnPhoto(url, BUCKET), own, String(url));
  assert.equal(isOwnPhoto(OURS, ""), false); // Storage not set up: nothing there is ours
  assert.deepEqual(
    outsidePhotos(URLS.map(([u]) => u), BUCKET),
    URLS.filter(([, own]) => !own).map(([u]) => u),
  );
  assert.deepEqual(outsidePhotos(undefined, BUCKET), []);
  const web = await import(pathToFileURL(path.join(__dirname, "../../src/lib/productPhotos.js")).href);
  for (const [url] of URLS) {
    for (const bucket of [BUCKET, ""]) assert.equal(web.isOwnPhoto(url, bucket), isOwnPhoto(url, bucket), `${url} ${bucket}`);
  }
});

test("a product is copied again only when it changed or a while after its photos failed", () => {
  const now = Date.parse("2026-10-28T12:00:00Z");
  const at = (ms) => new Date(ms);
  const walmart = ["https://i5.walmartimages.ca/a.jpg"];
  assert.equal(needsCopy({ images: [OURS] }, BUCKET, now), false);
  assert.equal(needsCopy({ images: walmart }, BUCKET, now), true);
  assert.equal(needsCopy({ images: walmart, updatedAt: at(now - 60000), photosFailedAt: at(now - 1000) }, BUCKET, now), false);
  assert.equal(needsCopy({ images: walmart, updatedAt: at(now - 1000), photosFailedAt: at(now - 60000) }, BUCKET, now), true);
  assert.equal(needsCopy({ images: walmart, updatedAt: at(now - RETRY_AFTER * 2), photosFailedAt: at(now - RETRY_AFTER - 1000) }, BUCKET, now), true);
});

test("pictures are recognized by their first bytes", async () => {
  assert.equal(sniff(await picture("jpeg")), "image/jpeg");
  assert.equal(sniff(await picture("png")), "image/png");
  assert.equal(sniff(await picture("webp")), "image/webp");
  assert.equal(sniff(await picture("gif")), "image/gif");
  assert.equal(sniff(Buffer.from("<!doctype html><html><body>")), "");
});

test("a photo is copied once: smaller, WebP, without its details, named so it doesn't say where it came from", async () => {
  const jpeg = await sharp({ create: { width: 1600, height: 1200, channels: 3, background: "#c33" } })
    .withExif({ IFD0: { Copyright: "Walmart", Artist: "Walmart Canada" } })
    .jpeg()
    .toBuffer();
  assert.ok((await sharp(jpeg).metadata()).exif, "the test photo has details to remove");
  const bucket = fakeBucket();
  const url = "https://i5.walmartimages.ca/images/Enlarge/094/514/6000200094514.jpg";
  let asked = null;
  const fetchImpl = async (u, init) => {
    asked = { u, init };
    return new Response(jpeg, { headers: { "content-type": "image/jpeg" } });
  };
  const link = await copyPhoto(url, bucket, { fetchImpl });
  assert.equal(asked.u, url);
  assert.match(asked.init.headers["User-Agent"], /Mozilla/);
  const base = `https://firebasestorage.googleapis.com/v0/b/${BUCKET}/o/products%2F`;
  assert.ok(link.startsWith(base), link);
  assert.match(link.slice(base.length), /^[0-9a-f]{32}\?alt=media&token=[0-9a-f-]{36}$/);
  assert.ok(isOwnPhoto(link, BUCKET));
  const [[name, saved]] = [...bucket.files];
  assert.match(name, /^products\/[0-9a-f]{32}$/);
  assert.equal(saved.metadata.contentType, "image/webp");
  assert.match(saved.metadata.cacheControl, /max-age=31536000/);
  assert.ok(link.endsWith(saved.metadata.metadata.firebaseStorageDownloadTokens));
  const meta = await sharp(saved.data).metadata();
  assert.deepEqual([meta.format, meta.width, meta.height, meta.exif], ["webp", 1000, 750, undefined]);
  assert.ok(saved.data.length < jpeg.length);

  // the same photo again (on another product): no second download
  assert.equal(await copyPhoto(url, bucket, { fetchImpl: () => assert.fail("downloaded twice") }), link);
  assert.equal(bucket.files.size, 1);
  // small photos keep their size
  await copyPhoto("https://m.media-amazon.com/images/I/small.png", bucket, { fetchImpl: async () => new Response(await picture("png", 300, 200)) });
  const small = [...bucket.files.values()][1];
  assert.deepEqual([(await sharp(small.data).metadata()).width, small.metadata.contentType], [300, "image/webp"]);
});

test("photos that are gone or aren't photos are dropped; other failures are tried again later", async () => {
  const bucket = fakeBucket();
  const failure = (fetchImpl, b = bucket) => copyPhoto("https://x.example/a.jpg", b, { fetchImpl }).then(() => assert.fail("copied"), (err) => err);
  for (const status of [404, 410]) {
    const err = await failure(answer(status, "nope"));
    assert.ok(err instanceof PhotoError && err.gone, String(status));
  }
  assert.equal((await failure(answer(200, "<html>blocked</html>", "text/html"))).gone, true);
  for (const status of [403, 429, 500, 503]) assert.equal((await failure(answer(status, "x"))).gone, false, String(status));
  const slow = await failure(async () => {
    throw Object.assign(new Error("The operation was aborted due to timeout"), { name: "TimeoutError" });
  });
  assert.equal(slow.gone, false);
  assert.match(slow.message, /too slow/);
  assert.equal(bucket.files.size, 0);
  const off = await failure(answer(200, await picture("jpeg"), "image/jpeg"), fakeBucket(BUCKET, { missing: true }));
  assert.equal(off.code, "NO_STORAGE");
});

/** A product document with just what copyProductPhotos uses; `later` = its photos when the transaction reads them */
function fakeProduct(data, later) {
  const doc = { data, patch: undefined };
  const snap = (d) => ({ exists: Boolean(d), get: (k) => d?.[k] });
  const ref = {
    id: "p1",
    get: async () => snap(doc.data),
    firestore: {
      runTransaction: async (fn) =>
        fn({
          get: async () => snap(later || doc.data),
          update: (r, patch) => {
            doc.patch = patch;
          },
        }),
    },
  };
  return { ref, doc };
}

test("a product's outside photos are swapped in place; gone ones are taken off; failed ones wait", async () => {
  const png = await picture("png", 40, 40);
  const bucket = fakeBucket();
  const ok = "https://i5.walmartimages.ca/ok.jpg";
  const gone = "https://i5.walmartimages.ca/gone.jpg";
  const busy = "https://i5.walmartimages.ca/busy.jpg";
  const fetchImpl = async (u) => (u === ok ? new Response(png) : u === gone ? new Response("", { status: 404 }) : new Response("", { status: 503 }));

  const { ref, doc } = fakeProduct({ images: [busy, OURS, ok, gone, ok] });
  assert.deepEqual(await copyProductPhotos(ref, bucket, { fetchImpl }), { copied: 1, removed: 1, failed: 1 });
  const [first, second, third, ...rest] = doc.patch.images;
  assert.deepEqual([first, second, rest], [busy, OURS, []]); // order kept, the repeated one once
  assert.ok(isOwnPhoto(third, BUCKET) && third.includes("products%2F"));
  assert.ok(doc.patch.updatedAt.isEqual(FieldValue.serverTimestamp())); // so the store's catalog updates
  assert.ok(doc.patch.photosFailedAt.isEqual(FieldValue.serverTimestamp()));

  // all copied: the failure mark goes away
  const fixed = fakeProduct({ images: [ok], photosFailedAt: new Date() });
  assert.deepEqual(await copyProductPhotos(fixed.ref, bucket, { fetchImpl }), { copied: 1, removed: 0, failed: 0 });
  assert.ok(fixed.doc.patch.photosFailedAt.isEqual(FieldValue.delete()));

  // photos changed in the admin meanwhile: theirs are kept
  const edited = fakeProduct({ images: [ok] }, { images: [OURS] });
  await copyProductPhotos(edited.ref, bucket, { fetchImpl });
  assert.equal(edited.doc.patch, undefined);

  // nothing from other websites: nothing to do
  const clean = fakeProduct({ images: [OURS] });
  assert.deepEqual(await copyProductPhotos(clean.ref, bucket, { fetchImpl: () => assert.fail("downloaded") }), { copied: 0, removed: 0, failed: 0 });
  assert.equal(clean.doc.patch, undefined);

  // Storage not turned on: stops, nothing written
  const off = fakeProduct({ images: [ok] });
  await assert.rejects(copyProductPhotos(off.ref, fakeBucket(BUCKET, { missing: true }), { fetchImpl }), (err) => err.code === "NO_STORAGE");
  assert.equal(off.doc.patch, undefined);
});
