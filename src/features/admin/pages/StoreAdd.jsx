// Products → Add from Walmart & Amazon. What you send with the Express browser extension
// ("Add to Express" on walmart.ca / amazon.ca product pages, see /extension) waits here:
// check it, fix the price or category, and add it to the store with automatic prices.
import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, ArrowRight, ArrowSquareOut, CheckCircle, DownloadSimple, Package, PuzzlePiece, Storefront, Trash, X } from "@phosphor-icons/react";
import * as admin from "@backend/admin";
import Button from "@/components/ui/Button";
import { TextField } from "@/components/ui/Field";
import { Notice, Spinner } from "@/components/ui/Misc";
import { useToast } from "@/context/ToastContext";
import { money, parseMoney } from "@/lib/format";
import { Card, PageHead, Pill, Toggle, useConfirm } from "../components/AdminUI";
import { usePricing } from "../components/Pricing";
import { downloadExtension, EXTENSION_FILE, EXTENSION_VERSION } from "../extension";
import { indexExisting, isWalmartBrand, planImport } from "../importer";
import { useCollection } from "../lib";
import { copyPhotos, hasOutsidePhotos, photoProblem } from "../photos";
import { clearQueue, itemKey, justInstalled, removeFromQueue, updateQueueItem } from "../storeQueue";
import { useStoreQueue } from "../useStoreQueue";

// Read by the same import as spreadsheets and BlueCart (ratings left out on purpose)
const MAPPING = { name: "name", supplierPrice: "price", supplierRegular: "was", link: "link", images: "images", brand: "brand", category: "category", description: "description", available: "available", sku: "sku" };
const record = (x) => ({
  name: x.name,
  price: x.price ? String(x.price) : "",
  was: x.was ? String(x.was) : "",
  link: x.link,
  images: x.images.join(" | "),
  brand: x.brand,
  category: x.category,
  description: x.description,
  available: x.available === true ? "yes" : x.available === false ? "no" : "",
  sku: x.sku,
});
const STORE = { walmart: "Walmart", amazon: "Amazon" };
const storeName = (x) => STORE[x.supplier] || x.store || "Store";

const splitPath = (path) => {
  const parts = String(path || "")
    .split(/\s*(?:>|\/|\||›|»)\s*/)
    .map((p) => p.trim())
    .filter(Boolean);
  return { department: parts.length > 1 ? parts[0] : "", leaf: parts.at(-1) || "" };
};

export default function StoreAdd() {
  const products = useCollection("products");
  const privates = useCollection("productsPrivate");
  const pricing = usePricing();
  const queue = useStoreQueue();
  if ([products.status, privates.status, pricing.status].includes("loading")) {
    return (
      <div className="ad-page-loading">
        <Spinner label="Loading…" />
      </div>
    );
  }
  return <AddPage queue={queue} products={products.data} privates={privates.data} rules={pricing.rules} />;
}

function AddPage({ queue, products, privates, rules }) {
  const toast = useToast();
  const [confirm, confirmDialog] = useConfirm();
  const [publish, setPublish] = useState(true);
  const [run, setRun] = useState(null); // { step: "save" | "photos", done, total } while working
  const [result, setResult] = useState(null);
  const [installed] = useState(justInstalled);
  const [downloading, setDownloading] = useState(false);

  const existing = useMemo(() => indexExisting(products, privates), [products, privates]);
  const categories = useMemo(() => [...new Set(products.map((p) => p.category).filter(Boolean))].sort(), [products]);
  const rows = useMemo(
    () =>
      queue.map((item) => {
        const [plan] = planImport([record(item)], { mapping: MAPPING, supplier: item.supplier, department: "", category: "", publish, onlyPrices: true, skipOutOfStock: false }, existing, rules);
        return { key: itemKey(item), item, plan };
      }),
    [queue, existing, rules, publish],
  );
  const adding = rows.filter((r) => r.plan.action === "new").length;
  const updating = rows.filter((r) => r.plan.action === "update").length;
  const missing = rows.filter((r) => r.plan.action === "skip").length;

  async function download() {
    setDownloading(true);
    try {
      await downloadExtension();
      toast.success("Downloaded. Unzip it, then follow the steps on this page.");
    } catch (err) {
      console.error(err);
      toast.error("Couldn't make the download. Try again.");
    } finally {
      setDownloading(false);
    }
  }

  async function addAll() {
    const todo = rows.filter((r) => r.plan.action !== "skip");
    if (!todo.length) return;
    setResult(null);
    setRun({ step: "save", done: 0, total: todo.length });
    try {
      const ids = await admin.importProducts(todo.map(({ plan }) => ({ id: plan.id, publicData: plan.publicData, privateData: plan.privateData })));
      removeFromQueue(todo.map((r) => r.key));
      const fresh = todo.map((r, i) => ({ ...r, id: ids[i] })).filter((r) => r.plan.action === "new");
      let photos = "";
      // their photos move to Express's own storage before the store shows them
      const withPhotos = fresh.filter((r) => hasOutsidePhotos(r.plan.publicData.images)).map((r) => r.id);
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
      setResult({ added: fresh.length, updated: todo.length - fresh.length, hidden: !publish, photos, onlyId: fresh.length === 1 && todo.length === 1 ? fresh[0].id : null });
    } catch (err) {
      console.error(err);
      toast.error("Couldn't save the products. Check your connection and try again.");
    } finally {
      setRun(null);
    }
  }

  async function clearAll() {
    const ok = await confirm({ title: "Clear the list?", message: "The products on it are not added to the store. You can send them again from Walmart or Amazon.", confirmLabel: "Clear list", danger: true });
    if (ok) clearQueue();
  }

  const working = Boolean(run);
  const button = !run
    ? [adding ? `Add ${adding} to the store` : "", updating ? `${adding ? "update" : "Update"} ${updating} ${updating === 1 ? "price" : "prices"}` : ""].filter(Boolean).join(" · ") || "Add to the store"
    : run.step === "photos"
      ? `Copying photos ${run.done}/${run.total}…`
      : `Saving ${run.total}…`;

  return (
    <div className="ad-page">
      {confirmDialog}
      <PageHead
        title="Add from Walmart & Amazon"
        subtitle={
          <Link to="/admin/productos" className="ad-link">
            <ArrowLeft size={14} weight="bold" /> All products
          </Link>
        }
        actions={
          <Button variant="secondary" size="sm" icon={DownloadSimple} onClick={download} loading={downloading}>
            Get the extension
          </Button>
        }
      />

      {installed && !queue.length && !result && (
        <Notice tone="success">
          The extension is installed. Open a product on <strong>walmart.ca</strong> or <strong>amazon.ca</strong> and press <strong>Add to Express</strong> (bottom
          left of the page): it shows up here.
        </Notice>
      )}

      {result && (
        <Notice tone="success">
          {[
            result.added ? `Added ${result.added} ${result.added === 1 ? "product" : "products"} to the store${result.hidden ? " (hidden until you put them on sale)" : ""}` : "",
            result.updated ? `${result.added ? "updated" : "Updated"} the price of ${result.updated}` : "",
          ]
            .filter(Boolean)
            .join(" and ")}
          , with automatic prices.{" "}
          {result.onlyId ? (
            <Link to={`/admin/productos/${encodeURIComponent(result.onlyId)}`} className="ad-link">
              Open it <ArrowRight size={14} weight="bold" />
            </Link>
          ) : (
            <Link to="/admin/productos" className="ad-link">
              See the products <ArrowRight size={14} weight="bold" />
            </Link>
          )}
          {result.photos && <p>Photos: {result.photos}</p>}
        </Notice>
      )}

      {rows.length > 0 ? (
        <Card
          title={`${rows.length} waiting ${rows.length === 1 ? "product" : "products"}`}
          flush
          actions={
            <Button variant="ghost" size="sm" icon={Trash} onClick={clearAll} disabled={working}>
              Clear list
            </Button>
          }
        >
          <datalist id="ad-sa-categories">
            {categories.map((c) => (
              <option key={c} value={c} />
            ))}
          </datalist>
          <ul className="ad-sa-list">
            {rows.map((r) => (
              <Row key={r.key} row={r} disabled={working} />
            ))}
          </ul>
        </Card>
      ) : (
        !result && <HowItWorks onDownload={download} downloading={downloading} />
      )}

      {rows.length > 0 && <Install onDownload={download} downloading={downloading} />}

      {rows.length > 0 && (
        <div className="ad-wm-bar" role="region" aria-label="Add the products">
          <span>
            <strong>{rows.length}</strong> on the list
            {missing ? ` · ${missing} without a price` : ""}
          </span>
          <Toggle checked={publish} onChange={setPublish} label="Put them on sale" />
          <Button icon={Storefront} onClick={addAll} loading={working} disabled={!adding && !updating}>
            {button}
          </Button>
        </div>
      )}
    </div>
  );
}

/** One waiting product: what it is, its price there and here, its category. */
function Row({ row, disabled }) {
  const { key, item, plan } = row;
  const prices = plan.prices;
  const selling = prices ? prices.currentPrice || prices.price : 0;
  const { department, leaf } = splitPath(item.category);
  const ownBrand = item.supplier === "walmart" && isWalmartBrand(item.name, item.brand);
  return (
    <li className="ad-sa-item">
      <span className="ad-sa-item__img">{item.images[0] ? <img src={item.images[0]} alt="" loading="lazy" referrerPolicy="no-referrer" /> : <Package size={26} />}</span>
      <div className="ad-sa-item__main">
        <a href={item.link} target="_blank" rel="noreferrer" className="ad-sa-item__name">
          {item.name} <ArrowSquareOut size={13} weight="bold" aria-hidden="true" />
        </a>
        <span className="ad-sa-item__meta">{[storeName(item), item.brand, item.images.length ? `${item.images.length} ${item.images.length === 1 ? "photo" : "photos"}` : ""].filter(Boolean).join(" · ")}</span>
        <span className="ad-sa-item__tags">
          {plan.action === "update" && <Pill tone="blue">In your store: only its price is updated</Pill>}
          {item.available === false && <Pill tone="amber">Out of stock there: shows as sold out</Pill>}
          {!item.images.length && <Pill tone="amber">No photo: add one later</Pill>}
          {ownBrand && <Pill tone="amber">Walmart brand: better take your own photos</Pill>}
        </span>
      </div>
      <div className="ad-sa-item__fields">
        <PriceField label={`${storeName(item)} price`} value={item.price} disabled={disabled} onCommit={(price) => updateQueueItem(key, { price })} />
        <TextCommit
          label="Category"
          list="ad-sa-categories"
          value={leaf}
          disabled={disabled || plan.action === "update"}
          placeholder="Other"
          onCommit={(text) => updateQueueItem(key, { category: [department, text.trim()].filter(Boolean).join(" > ") })}
        />
        <span className="ad-sa-item__ours">
          {prices ? (
            <>
              Your price <strong>{money(selling)}</strong>
              {prices.currentPrice > 0 && <s>{money(prices.price)}</s>} · {money(selling - prices.cost)} profit
            </>
          ) : (
            <span className="ad-sa-item__need">Type {storeName(item)}’s price to see yours</span>
          )}
        </span>
      </div>
      <button type="button" className="ad-sa-item__remove" onClick={() => removeFromQueue([key])} disabled={disabled} aria-label={`Remove ${item.name} from the list`} title="Remove from the list">
        <X size={16} weight="bold" />
      </button>
    </li>
  );
}

/** A price typed in: saved when you leave the box (or press Enter). */
function PriceField({ label, value, onCommit, disabled }) {
  const shown = value > 0 ? value.toFixed(2) : "";
  const [text, setText] = useState(shown);
  const [seen, setSeen] = useState(value);
  if (value !== seen) {
    setSeen(value);
    setText(shown);
  }
  const commit = () => {
    const n = parseMoney(text);
    const next = n > 0 ? Math.round(n * 100) / 100 : 0;
    if (next !== value) onCommit(next);
    else setText(shown);
  };
  return (
    <TextField
      label={label}
      inputMode="decimal"
      value={text}
      disabled={disabled}
      placeholder="0.00"
      error={value > 0 ? "" : "Needed"}
      onChange={(e) => setText(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => e.key === "Enter" && commit()}
    />
  );
}

/** Text typed in: saved when you leave the box (or press Enter). */
function TextCommit({ value, onCommit, ...props }) {
  const [text, setText] = useState(value);
  const [seen, setSeen] = useState(value);
  if (value !== seen) {
    setSeen(value);
    setText(value);
  }
  const commit = () => text.trim() !== value && onCommit(text);
  return <TextField {...props} value={text} onChange={(e) => setText(e.target.value)} onBlur={commit} onKeyDown={(e) => e.key === "Enter" && commit()} />;
}

/** Nothing waiting: what this is and how to start. */
function HowItWorks({ onDownload, downloading }) {
  return (
    <Card title="Add products while you look at them">
      <ol className="ad-sa-steps">
        <li>
          <strong>Get the Express extension</strong> for Chrome or Edge on your computer (once).
        </li>
        <li>
          Open a product on <strong>walmart.ca</strong> (with your store chosen) or <strong>amazon.ca</strong> and press <strong>Add to Express</strong>, at the
          bottom left of the page.
        </li>
        <li>
          It shows up on this page with your price already worked out. Check it and press <strong>Add to the store</strong>.
        </li>
      </ol>
      <p className="ad-hint">
        Other stores work too: open the product, then press the Express button in the browser’s toolbar. The extension only reads the page you’re on, when you
        press the button.
      </p>
      <InstallSteps onDownload={onDownload} downloading={downloading} />
    </Card>
  );
}

/** With products on the list: the install steps, folded away. */
function Install({ onDownload, downloading }) {
  return (
    <details className="ad-sa-install">
      <summary>
        <PuzzlePiece size={18} weight="duotone" aria-hidden="true" /> Install or update the extension
      </summary>
      <InstallSteps onDownload={onDownload} downloading={downloading} />
    </details>
  );
}

function InstallSteps({ onDownload, downloading }) {
  return (
    <div className="ad-sa-howto">
      <Button icon={DownloadSimple} onClick={onDownload} loading={downloading}>
        Download the extension
      </Button>
      <span className="ad-sa-howto__file">
        {EXTENSION_FILE} · version {EXTENSION_VERSION}
      </span>
      <ol>
        <li>Unzip the file (double-click it). You get a folder “express-add-products”. Keep it: the browser uses it.</li>
        <li>
          In Chrome, open <code>chrome://extensions</code> (in Edge, <code>edge://extensions</code>) by typing it in the address bar.
        </li>
        <li>
          Turn on <strong>Developer mode</strong>, press <strong>Load unpacked</strong> and choose the unzipped folder.
        </li>
        <li>
          Done: this page opens and says the extension is installed. To update it later, download again, replace the folder’s files and press the reload arrow
          on the extension.
        </li>
      </ol>
      <p className="ad-hint">
        <CheckCircle size={15} weight="bold" aria-hidden="true" /> Sign in to this admin in the same browser. Your list stays in this browser until you add the
        products.
      </p>
    </div>
  );
}
