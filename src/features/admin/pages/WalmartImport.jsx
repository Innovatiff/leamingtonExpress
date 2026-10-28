// Walmart.ca products through the BlueCart API: search, pick, check the stock at
// your Walmart store, and import the ones it has (with automatic prices).
import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, ArrowRight, Key, MagnifyingGlass, Package, Storefront } from "@phosphor-icons/react";
import * as admin from "@backend/admin";
import Button from "@/components/ui/Button";
import { TextAreaField, TextField } from "@/components/ui/Field";
import { Notice, Spinner } from "@/components/ui/Misc";
import { useToast } from "@/context/ToastContext";
import { money } from "@/lib/format";
import { sellingPrices } from "@/lib/margin";
import { Card, PageHead, Pill, Toggle } from "../components/AdminUI";
import { usePricing } from "../components/Pricing";
import { indexExisting, linkKey, planImport } from "../importer";
import { useCollection } from "../lib";
import { copyPhotos, hasOutsidePhotos, photoProblem } from "../photos";

const PER_CALL = 9; // product checks per call to the Cloud Function
// The product data from BlueCart, read by the same import as spreadsheets (ratings left out on purpose)
const MAPPING = { name: "name", supplierPrice: "price", supplierRegular: "was", link: "link", images: "images", brand: "brand", category: "category", description: "description", available: "available", aisle: "aisle" };
const record = (p) => ({
  name: p.title,
  price: String(p.price || ""),
  was: p.wasPrice ? String(p.wasPrice) : "",
  link: p.link,
  images: (p.images || []).join(" | "),
  brand: p.brand || "",
  category: p.category || "",
  description: p.description || "",
  available: p.inStock ? "yes" : "no",
  aisle: p.aisle || "",
});

// Walmart's own brands: their photos belong to Walmart, so better take your own
const OWN_BRANDS = ["great value", "mainstays", "onn", "equate", "hyper tough", "ozark trail", "george", "parents choice", "hometrends", "athletic works", "time and tru", "wonder nation", "your fresh market", "pen gear", "kid connection", "holiday time", "way to celebrate", "spark create imagine", "blackweb", "vibrant life", "special kitty", "allswell", "better homes gardens", "no boundaries", "terra sky"];
const words = (s) => ` ${String(s || "").toLowerCase().replace(/&|\+/g, " ").replace(/[^a-z0-9 ]+/g, "").replace(/\s+/g, " ").trim()} `;
/** By the brand, or by the start of the name (not "george": George Foreman isn't Walmart's) */
const walmartBrand = (item) => OWN_BRANDS.some((b) => words(item.brand) === ` ${b} `) || OWN_BRANDS.some((b) => b !== "george" && words(item.title).startsWith(` ${b} `));

/** walmart.ca product links or item numbers, in any amount and separated any way → [{ itemId, title, link }] */
function pastedItems(value) {
  const found = new Map();
  for (const token of String(value).split(/[\s,;]+/).filter(Boolean)) {
    const m = token.match(/walmart\.ca\/(?:(?:en|fr)\/)?ip\/(?:([^/?#]+)\/)?([A-Za-z0-9]+)/i);
    const itemId = m ? m[2] : /^(?=.*\d)[A-Za-z0-9]{6,20}$/.test(token) ? token : "";
    if (!itemId || found.has(itemId)) continue;
    const slug = m?.[1] && m[1] !== itemId ? m[1] : "";
    const name = slug.replace(/-+/g, " ").trim();
    found.set(itemId, { itemId, title: name ? name[0].toUpperCase() + name.slice(1) : `Walmart.ca item ${itemId}`, link: `https://www.walmart.ca/en/ip/${slug ? `${slug}/` : ""}${itemId}` });
  }
  return [...found.values()];
}

/** What BlueCart answered when nothing in it could be read (to adapt the reading of it) */
function BlueCartAnswer({ answer }) {
  return (
    <dl className="ad-wm-answer">
      <dt>Fields</dt>
      <dd>{answer.fields?.join(", ") || "—"}</dd>
      {answer.message && (
        <>
          <dt>Message</dt>
          <dd>{answer.message}</dd>
        </>
      )}
      {answer.page && (
        <>
          <dt>Walmart page</dt>
          <dd>{answer.page}</dd>
        </>
      )}
      <dt>First result</dt>
      <dd>
        <code>{answer.sample || "—"}</code>
      </dd>
    </dl>
  );
}

/** What went wrong, in words the admin can act on */
function problem(err) {
  const reason = err?.details?.reason;
  if (reason === "NO_KEY") return "Add your BlueCart API key first.";
  if (reason === "NO_STORE") return "Add your Walmart store number first.";
  if (reason === "BAD_KEY") return "BlueCart doesn't accept this API key. Copy it again from your BlueCart dashboard.";
  if (reason === "NO_CREDITS") return "Your BlueCart requests ran out (or BlueCart is busy). Check your plan on BlueCart.";
  return err?.message || "Something went wrong. Try again.";
}

export default function WalmartImport() {
  const integrations = useCollection("integrations");
  const products = useCollection("products");
  const privates = useCollection("productsPrivate");
  const pricing = usePricing();
  if ([integrations.status, products.status, privates.status, pricing.status].includes("loading")) {
    return (
      <div className="ad-page-loading">
        <Spinner label="Loading…" />
      </div>
    );
  }
  const cfg = integrations.data.find((d) => d.id === "bluecart") || {};
  return <Walmart cfg={cfg} products={products.data} privates={privates.data} rules={pricing.rules} />;
}

function Walmart({ cfg, products, privates, rules }) {
  const toast = useToast();
  const connected = Boolean(cfg.apiKey && cfg.storeId);
  const [editing, setEditing] = useState(!connected);
  const [credits, setCredits] = useState(cfg.credits ?? null);
  const [term, setTerm] = useState("");
  const [search, setSearch] = useState(null); // { term, page, totalPages, items, answer }
  const [paste, setPaste] = useState("");
  const [searching, setSearching] = useState(false);
  const [picked, setPicked] = useState(() => new Map()); // itemId → search result
  const [publish, setPublish] = useState(true);
  const [run, setRun] = useState(null); // { step: "check" | "photos", done, total } while working
  const [result, setResult] = useState(null);

  const existing = useMemo(() => indexExisting(products, privates), [products, privates]);
  const have = (item) => existing.byLink.has(linkKey(item.link)) || existing.byItem.has(`walmart:${String(item.itemId).toUpperCase()}`);

  async function find(page = 1) {
    const q = (page === 1 ? term : search?.term || "").trim();
    if (q.length < 2) {
      toast.error("Write what to look for (e.g. coffee maker).");
      return;
    }
    setSearching(true);
    try {
      const r = await admin.walmart("search", { term: q, page });
      if (r.credits != null) setCredits(r.credits);
      setSearch((cur) => {
        const before = page === 1 ? [] : cur?.items || [];
        const fresh = r.items.filter((x) => !before.some((y) => y.itemId === x.itemId));
        // nothing readable in BlueCart's answer: keep what it said, to show it
        return { term: q, page: r.page || page, totalPages: r.totalPages || 0, items: [...before, ...fresh], answer: r.items.length ? null : r.answer || null };
      });
      if (!r.items.length && !r.answer) toast.info("No products found for that search.");
    } catch (err) {
      console.error(err);
      toast.error(problem(err));
    } finally {
      setSearching(false);
    }
  }

  const toggle = (item) =>
    setPicked((cur) => {
      const next = new Map(cur);
      if (next.has(item.itemId)) next.delete(item.itemId);
      else next.set(item.itemId, item);
      return next;
    });
  const pasted = useMemo(() => pastedItems(paste), [paste]);
  const addPasted = () => {
    setPicked((cur) => {
      const next = new Map(cur);
      pasted.forEach((x) => next.set(x.itemId, x));
      return next;
    });
    toast.success(pasted.length === 1 ? "1 product added to the selection" : `${pasted.length} products added to the selection`);
    setPaste("");
  };
  const pickAllNew = () =>
    setPicked((cur) => {
      const next = new Map(cur);
      search?.items.filter((x) => !have(x)).forEach((x) => next.set(x.itemId, x));
      return next;
    });

  async function checkAndImport() {
    const list = [...picked.values()];
    const nameOf = (id) => picked.get(id)?.title || id;
    setResult(null);
    setRun({ step: "check", done: 0, total: list.length });
    const found = [];
    const skipped = [];
    let stopped = "";
    for (let i = 0; i < list.length; i += PER_CALL) {
      try {
        const r = await admin.walmart("products", { itemIds: list.slice(i, i + PER_CALL).map((x) => x.itemId) });
        if (r.credits != null) setCredits(r.credits);
        for (const x of r.items) {
          const p = x.product;
          if (!x.ok) skipped.push({ name: nameOf(x.itemId), why: x.error || "BlueCart couldn't read it" });
          else if (!p.title) skipped.push({ name: nameOf(x.itemId), why: "BlueCart's answer couldn't be read", answer: p.answer });
          else if (p.inStock === true && p.price > 0) found.push(p);
          else {
            const unsure = `Store stock not confirmed (BlueCart said ${p.stockNote ? `“${p.stockNote}”` : "nothing about this store's stock"})`;
            skipped.push({ name: p.title || nameOf(x.itemId), why: p.inStock === false ? "Not in stock at your store" : !(p.price > 0) ? "No price" : unsure });
          }
        }
      } catch (err) {
        console.error(err);
        stopped = problem(err);
        break;
      }
      setRun({ step: "check", done: Math.min(list.length, i + PER_CALL), total: list.length });
    }
    let counts = { new: 0, update: 0 };
    let photos = "";
    if (found.length) {
      try {
        const plan = planImport(found.map(record), { mapping: MAPPING, supplier: "walmart", department: "", category: "", publish, onlyPrices: true, skipOutOfStock: true }, existing, rules);
        const todo = plan.filter((r) => r.action !== "skip");
        const ids = await admin.importProducts(todo.map((r) => ({ id: r.id, publicData: r.publicData, privateData: r.privateData })));
        counts = { new: todo.filter((r) => r.action === "new").length, update: todo.filter((r) => r.action === "update").length };
        // their photos move to Express's own storage before the store shows them
        const withPhotos = ids.filter((id, i) => hasOutsidePhotos(todo[i].publicData.images));
        if (withPhotos.length) {
          setRun({ step: "photos", done: 0, total: withPhotos.length });
          try {
            const r = await copyPhotos(withPhotos, (done) => setRun({ step: "photos", done, total: withPhotos.length }));
            if (r.failed) photos = `${r.failed} couldn’t be downloaded right now. They’re tried again by themselves (or replace them in the product).`;
          } catch (err) {
            console.error(err);
            photos = photoProblem(err);
          }
        }
        await admin.publishCatalog().catch((err) => console.warn("Catalog not updated yet", err));
      } catch (err) {
        console.error(err);
        stopped = "The products were checked but couldn't be saved. Check your connection and try again.";
      }
    }
    setResult({ ...counts, skipped, stopped, photos });
    setPicked(new Map());
    setRun(null);
  }

  return (
    <div className="ad-page">
      <PageHead
        title="Add from Walmart.ca"
        subtitle={
          <Link to="/admin/productos" className="ad-link">
            <ArrowLeft size={14} weight="bold" /> All products
          </Link>
        }
      />

      <Connection cfg={cfg} credits={credits} open={editing} onOpen={() => setEditing(true)} onClose={() => setEditing(false)} />

      {result && (
        <Notice tone={result.new + result.update > 0 ? "success" : "warning"}>
          {result.new + result.update > 0 && (
            <>
              Imported {result.new} new {result.new === 1 ? "product" : "products"}
              {result.update ? ` and updated ${result.update}` : ""}, in stock at your store, with automatic prices
              {result.photos ? "." : " and their photos in Express’s own storage."}{" "}
              <Link to="/admin/productos" className="ad-link">
                See the products <ArrowRight size={14} weight="bold" />
              </Link>
            </>
          )}
          {result.skipped.length > 0 && (
            <details className="ad-wm-skipped" open={!(result.new + result.update)}>
              <summary>
                {result.skipped.length} not imported
              </summary>
              <ul>
                {result.skipped.map((s, i) => (
                  <li key={i}>
                    {s.name} — {s.why}
                    {s.answer && <BlueCartAnswer answer={s.answer} />}
                  </li>
                ))}
              </ul>
            </details>
          )}
          {result.photos && <p>Photos: {result.photos}</p>}
          {result.stopped && <p>{result.stopped}</p>}
        </Notice>
      )}

      {connected && !editing && (
        <Card title="Find products">
          <form
            className="ad-wm-search"
            onSubmit={(e) => {
              e.preventDefault();
              find(1);
            }}
          >
            <TextField aria-label="Search walmart.ca" value={term} onChange={(e) => setTerm(e.target.value)} placeholder="coffee maker, kids toys, phone charger…" />
            <Button type="submit" icon={MagnifyingGlass} loading={searching && !search?.items.length}>
              Search
            </Button>
          </form>
          <p className="ad-hint">Each page of results uses 1 BlueCart request. Checking the stock at your store uses 1 request per product you pick.</p>

          <div className="ad-wm-paste">
            <TextAreaField
              label="…or paste walmart.ca product links"
              rows={3}
              value={paste}
              onChange={(e) => setPaste(e.target.value)}
              placeholder="https://www.walmart.ca/en/ip/…  (one per line, or item numbers)"
              hint="Browse walmart.ca with your store selected and copy the links of what you want. Pasting is free; checking the stock uses 1 request per product."
            />
            {pasted.length > 0 && (
              <Button size="sm" variant="secondary" onClick={addPasted}>
                Add {pasted.length} to the selection
              </Button>
            )}
          </div>

          {search?.answer && (
            <Notice tone="warning">
              <p>
                BlueCart answered, but no products could be read from it{search.answer.total ? ` (it reports ${search.answer.total} results)` : ""}. A screenshot of this box shows what to
                adapt. Meanwhile, paste product links above.
              </p>
              <BlueCartAnswer answer={search.answer} />
            </Notice>
          )}
          {search && (
            <>
              <div className="ad-wm-head">
                <span>
                  <strong>{search.items.length}</strong> results for “{search.term}”
                </span>
                <Button size="sm" variant="ghost" onClick={pickAllNew}>
                  Select all new
                </Button>
                {picked.size > 0 && (
                  <Button size="sm" variant="ghost" onClick={() => setPicked(new Map())}>
                    Clear
                  </Button>
                )}
              </div>
              {search.items.some(walmartBrand) && (
                <p className="ad-hint">
                  <span>
                    <strong>Walmart brand:</strong> Walmart’s own products (Great Value, Mainstays, onn. and others). Their photos belong to Walmart, so for these it’s
                    better to take your own photos when you buy them (Products → the product → Photos).
                  </span>
                </p>
              )}
              <ul className="ad-wm-grid">
                {search.items.map((item) => {
                  const ours = item.price > 0 ? sellingPrices({ supplier: "walmart", supplierPrice: item.price, supplierRegular: item.wasPrice }, rules) : null;
                  const on = picked.has(item.itemId);
                  const already = have(item);
                  return (
                    <li key={item.itemId}>
                      <label className={`ad-wm-card ${on ? "is-on" : ""}`}>
                        <input type="checkbox" checked={on} onChange={() => toggle(item)} />
                        <span className="ad-wm-card__img">{item.image ? <img src={item.image} alt="" loading="lazy" /> : <Package size={28} />}</span>
                        <span className="ad-wm-card__name">{item.title}</span>
                        <span className="ad-wm-card__meta">
                          {item.price > 0 ? (
                            <>
                              Walmart {money(item.price)}
                              {ours && (
                                <>
                                  {" "}
                                  → <strong>{money(ours.currentPrice || ours.price)}</strong>
                                </>
                              )}
                            </>
                          ) : (
                            "Price after the store check"
                          )}
                        </span>
                        {(already || walmartBrand(item)) && (
                          <span className="ad-wm-card__tags">
                            {already && <Pill tone="blue">In your store</Pill>}
                            {walmartBrand(item) && <Pill tone="amber">Walmart brand</Pill>}
                          </span>
                        )}
                      </label>
                    </li>
                  );
                })}
              </ul>
              {(!search.totalPages || search.page < search.totalPages) && search.items.length > 0 && (
                <div className="ad-more">
                  <Button variant="secondary" size="sm" onClick={() => find(search.page + 1)} loading={searching}>
                    More results (1 request)
                  </Button>
                </div>
              )}
            </>
          )}
        </Card>
      )}

      {picked.size > 0 && (
        <div className="ad-wm-bar" role="region" aria-label="Selected products">
          <span>
            <strong>{picked.size}</strong> selected · checking them uses {picked.size} {picked.size === 1 ? "request" : "requests"}
            {credits != null ? ` (${credits} left)` : ""}
          </span>
          <Toggle checked={publish} onChange={setPublish} label="Put them on sale" />
          <Button icon={Storefront} onClick={checkAndImport} loading={Boolean(run)}>
            {!run ? "Check store stock & import" : run.step === "photos" ? `Copying photos ${run.done}/${run.total}…` : `Checking ${run.done}/${run.total}…`}
          </Button>
        </div>
      )}
    </div>
  );
}

function Connection({ cfg, credits, open, onOpen, onClose }) {
  const toast = useToast();
  const [key, setKey] = useState("");
  const [store, setStore] = useState(String(cfg.storeId || ""));
  const [saving, setSaving] = useState(false);

  async function save() {
    const patch = { storeId: store.trim() };
    if (key.trim()) patch.apiKey = key.trim();
    if (!cfg.apiKey && !patch.apiKey) {
      toast.error("Paste your BlueCart API key.");
      return;
    }
    if (!/^\d+$/.test(patch.storeId)) {
      toast.error("The store number is digits only.");
      return;
    }
    setSaving(true);
    try {
      await admin.saveIntegration("bluecart", patch);
      setKey("");
      toast.success("BlueCart connected");
      onClose();
    } catch (err) {
      console.error(err);
      toast.error("Could not save. Check your admin permissions (and that the latest Firestore rules are published).");
    } finally {
      setSaving(false);
    }
  }

  if (!open) {
    return (
      <Card
        title="BlueCart · Walmart.ca"
        actions={
          <Button size="sm" variant="secondary" onClick={onOpen}>
            Change
          </Button>
        }
      >
        <p className="ad-hint">
          Connected · API key ••••{String(cfg.apiKey).slice(-4)} · Walmart store #{cfg.storeId}
          {credits != null ? ` · ${credits} requests left` : ""}
        </p>
      </Card>
    );
  }

  return (
    <Card title="Connect BlueCart (Walmart.ca)">
      <ol className="ad-wm-steps">
        <li>
          Create an account at{" "}
          <a href="https://trajectdata.com/ecommerce/blue-cart-api/" target="_blank" rel="noreferrer" className="ad-link">
            BlueCart API
          </a>{" "}
          (100 free requests) and copy your API key from its dashboard.
        </li>
        <li>
          Find your Walmart&apos;s store number in BlueCart&apos;s{" "}
          <a href="https://docs.trajectdata.com/bluecartapi/store-ids" target="_blank" rel="noreferrer" className="ad-link">
            Store IDs list
          </a>{" "}
          (look for your city).
        </li>
      </ol>
      <div className="form-grid">
        <TextField
          label="BlueCart API key"
          type="password"
          autoComplete="off"
          value={key}
          onChange={(e) => setKey(e.target.value)}
          placeholder={cfg.apiKey ? `••••${String(cfg.apiKey).slice(-4)} — leave empty to keep it` : "Paste it here"}
        />
        <TextField
          label="Walmart store number"
          inputMode="numeric"
          value={store}
          onChange={(e) => setStore(e.target.value)}
          placeholder="e.g. 3093"
          hint="Only products in stock at this store are imported."
        />
      </div>
      <div className="ad-wm-actions">
        <Button size="sm" icon={Key} onClick={save} loading={saving}>
          Save
        </Button>
        {cfg.apiKey && cfg.storeId && (
          <Button size="sm" variant="ghost" onClick={onClose}>
            Cancel
          </Button>
        )}
      </div>
      <p className="ad-hint">The key is kept in your private admin settings: only admins and the Cloud Functions can read it.</p>
    </Card>
  );
}
