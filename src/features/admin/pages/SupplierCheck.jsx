// Products → Check suppliers: every product with its supplier's link and price on one page.
// Open the supplier's page, then: Still good / type the new price and Save price / Hide from
// store (not available, or not for pickup today at Walmart). A checked product leaves the
// "To check" list until tomorrow, so you (or Claude driving the browser) always work on the
// first product of the list.
import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, ArrowSquareOut, ArrowsClockwise, Check, Eye, EyeSlash, FloppyDisk, Package } from "@phosphor-icons/react";
import * as admin from "@backend/admin";
import Button from "@/components/ui/Button";
import { TextField } from "@/components/ui/Field";
import { Notice, Spinner } from "@/components/ui/Misc";
import { useToast } from "@/context/ToastContext";
import { money, parseMoney } from "@/lib/format";
import { Card, PageHead, Pill, SearchInput, Tabs } from "../components/AdminUI";
import { usePricing } from "../components/Pricing";
import { matches, useCollection, useNow } from "../lib";
import { checkedLabel, checkedToday, checkOrder, checkUpdate, previewPrice } from "../supplierCheck";

const PAGE = 40;
const STORE = { walmart: "Walmart", amazon: "Amazon" };
const amountText = (v) => (Number(v) > 0 ? Number(v).toFixed(2) : "");

export default function SupplierCheck() {
  const products = useCollection("products");
  const privates = useCollection("productsPrivate");
  const pricing = usePricing();
  if ([products.status, privates.status, pricing.status].includes("loading")) {
    return (
      <div className="ad-page-loading">
        <Spinner label="Loading…" />
      </div>
    );
  }
  return <CheckPage products={products.data} privates={privates.data} rules={pricing.rules} privateError={privates.error} />;
}

function CheckPage({ products, privates, rules, privateError }) {
  const toast = useToast();
  const now = useNow();
  const [tab, setTab] = useState("todo");
  const [query, setQuery] = useState("");
  const [shown, setShown] = useState(PAGE);
  const [changes, setChanges] = useState(0);
  const [publishing, setPublishing] = useState(false);

  const rows = useMemo(() => {
    const priv = new Map(privates.map((p) => [p.id, p]));
    return checkOrder(products.map((raw) => ({ raw, priv: priv.get(raw.id) || {} })));
  }, [products, privates]);
  const isDone = (r) => checkedToday(r.priv.checkedAt, now);
  const doneCount = rows.filter(isDone).length;
  const counts = { todo: rows.length - doneCount, done: doneCount, hidden: rows.filter((r) => r.raw.status === "hidden").length, all: rows.length };
  const inTab = (r) => (tab === "todo" ? !isDone(r) : tab === "done" ? isDone(r) : tab === "hidden" ? r.raw.status === "hidden" : true);
  const list = rows.filter((r) => inTab(r) && matches(query, r.raw.name, r.raw.brand, STORE[r.priv.supplier] || r.priv.sourceName));

  async function publish() {
    setPublishing(true);
    try {
      await admin.publishCatalog();
      setChanges(0);
      toast.success("The store shows the changes now");
    } catch (err) {
      console.error(err);
      toast.error("Couldn't update the store now. It updates by itself within 5 minutes.");
    } finally {
      setPublishing(false);
    }
  }

  return (
    <div className="ad-page">
      <PageHead
        title="Check suppliers"
        subtitle={
          <Link to="/admin/productos" className="ad-link">
            <ArrowLeft size={14} weight="bold" /> All products
          </Link>
        }
      />
      {privateError && <Notice tone="warning">The supplier details couldn’t be loaded. Check your admin access.</Notice>}

      <Card>
        <div className="ad-sc-intro">
          <p>
            Open each product on its supplier’s site. <strong>Not available</strong> (or, for Walmart, not for <strong>pickup today</strong> at your store):
            press <strong>Hide from store</strong>. <strong>Price changed</strong>: type the new one and press <strong>Save price</strong>. Otherwise press{" "}
            <strong>Still good</strong>. Checked products leave this list until tomorrow.
          </p>
          <div className="ad-sc-progress" aria-label={`Checked today: ${doneCount} of ${rows.length}`}>
            <span>
              Checked today: <strong>{doneCount}</strong> of {rows.length}
            </span>
            <span className="ad-sc-bar">
              <span style={{ width: `${rows.length ? Math.round((doneCount / rows.length) * 100) : 0}%` }} />
            </span>
          </div>
        </div>
      </Card>

      {changes > 0 && (
        <Notice tone="success">
          {changes} {changes === 1 ? "change" : "changes"} saved. The store shows them within 5 minutes, or{" "}
          <Button size="sm" variant="secondary" icon={ArrowsClockwise} onClick={publish} loading={publishing}>
            Update the store now
          </Button>
        </Notice>
      )}

      <div className="ad-toolbar">
        <Tabs
          label="Products to check"
          value={tab}
          onChange={(t) => {
            setTab(t);
            setShown(PAGE);
          }}
          tabs={[
            { key: "todo", label: "To check", count: counts.todo },
            { key: "done", label: "Checked today", count: counts.done },
            { key: "hidden", label: "Hidden", count: counts.hidden },
            { key: "all", label: "All", count: counts.all },
          ]}
        />
        <SearchInput value={query} onChange={setQuery} placeholder="Name, brand, supplier…" />
      </div>

      <Card flush>
        {list.length ? (
          <ul className="ad-sc-list">
            {list.slice(0, shown).map((r) => (
              <Row key={r.raw.id} row={r} rules={rules} now={now} onSaved={() => setChanges((n) => n + 1)} />
            ))}
          </ul>
        ) : (
          <p className="ad-card__empty">{tab === "todo" ? "All products are checked for today." : "No products here."}</p>
        )}
      </Card>
      {list.length > shown && (
        <div className="ad-more">
          <Button variant="secondary" size="sm" onClick={() => setShown((n) => n + PAGE)}>
            Show more ({list.length - shown} left)
          </Button>
        </div>
      )}
    </div>
  );
}

/** One product: its supplier's page, its prices, and what to do. */
function Row({ row, rules, now, onSaved }) {
  const toast = useToast();
  const { raw, priv } = row;
  const savedPrice = amountText(priv.supplierPrice);
  const savedWas = amountText(priv.supplierRegular);
  const [price, setPrice] = useState(savedPrice);
  const [was, setWas] = useState(savedWas);
  const [seen, setSeen] = useState(`${savedPrice}|${savedWas}`);
  if (`${savedPrice}|${savedWas}` !== seen) {
    setSeen(`${savedPrice}|${savedWas}`);
    setPrice(savedPrice);
    setWas(savedWas);
  }
  const [busy, setBusy] = useState("");
  const changed = parseMoney(price) !== parseMoney(savedPrice) || parseMoney(was) !== parseMoney(savedWas);
  const hidden = raw.status === "hidden";
  const soldOut = raw.stock !== null && raw.stock !== undefined && Number(raw.stock) <= 0;
  const store = STORE[priv.supplier] || priv.sourceName || "";
  const priceLabel = store ? `${store} price` : "Supplier price";
  const current = Number(raw.pricing?.currentPrice) > 0 ? Number(raw.pricing.currentPrice) : Number(raw.pricing?.price) || 0;
  const next = previewPrice(priv, parseMoney(price), parseMoney(was), rules);
  const image = Array.isArray(raw.images) ? raw.images.find(Boolean) : "";

  async function save(kind) {
    const input = kind === "hide" ? { status: "hidden" } : { ...(changed ? { supplierPrice: parseMoney(price), supplierRegular: parseMoney(was) } : {}), ...(kind === "show" ? { status: "active" } : {}) };
    if (kind !== "hide" && changed && !(parseMoney(price) > 0)) {
      toast.error(store ? `Type ${store}’s price.` : "Type the supplier’s price.");
      return;
    }
    setBusy(kind);
    try {
      const { publicData, privateData } = checkUpdate(raw, priv, input, rules);
      await admin.importProducts([{ id: raw.id, publicData, privateData }]);
      onSaved();
      toast.success(kind === "hide" ? "Hidden from the store" : kind === "show" ? "Back on sale" : changed ? "Price saved" : "Checked: still good");
    } catch (err) {
      console.error(err);
      toast.error("Couldn't save. Check your connection and try again.");
    } finally {
      setBusy("");
    }
  }

  return (
    <li className="ad-sc-item">
      <span className="ad-sa-item__img">{image ? <img src={image} alt="" loading="lazy" /> : <Package size={24} />}</span>
      <div className="ad-sc-item__main">
        <Link to={`/admin/productos/${encodeURIComponent(raw.id)}`} className="ad-sc-item__name">
          {raw.name || "(no name)"}
        </Link>
        <span className="ad-sc-item__meta">
          {priv.sourceLink ? (
            <a href={priv.sourceLink} target="_blank" rel="noreferrer" className="ad-link">
              {store ? `Open on ${store}` : "Open the supplier’s page"} <ArrowSquareOut size={13} weight="bold" aria-hidden="true" />
            </a>
          ) : (
            <span className="ad-sa-item__need">No supplier link</span>
          )}
          <span>Checked {checkedLabel(priv.checkedAt, now)}</span>
        </span>
        <span className="ad-sa-item__tags">
          <Pill tone={hidden ? "neutral" : "green"}>{hidden ? "Hidden" : "On sale"}</Pill>
          {soldOut && <Pill tone="amber">Sold out</Pill>}
          {!priv.autoPrice && <Pill tone="neutral">Automatic price off</Pill>}
        </span>
      </div>
      <div className="ad-sc-item__fields">
        <TextField label={priceLabel} inputMode="decimal" placeholder="0.00" value={price} onChange={(e) => setPrice(e.target.value)} disabled={Boolean(busy)} />
        <TextField label="Their regular price" inputMode="decimal" placeholder="Only on sale" value={was} onChange={(e) => setWas(e.target.value)} disabled={Boolean(busy)} />
        <span className="ad-sc-item__ours">
          Your price <strong>{money(current)}</strong>
          {changed && next !== null && Math.abs(next - current) > 0.005 && (
            <>
              {" "}
              → <strong className="ad-sc-item__new">{money(next)}</strong>
            </>
          )}
          {!priv.autoPrice && changed && " (stays: automatic price is off)"}
        </span>
      </div>
      <div className="ad-sc-item__actions">
        {hidden ? (
          <Button size="sm" icon={Eye} onClick={() => save("show")} loading={busy === "show"} disabled={Boolean(busy)}>
            Put on sale
          </Button>
        ) : (
          <Button size="sm" icon={changed ? FloppyDisk : Check} onClick={() => save("check")} loading={busy === "check"} disabled={Boolean(busy)}>
            {changed ? "Save price" : "Still good"}
          </Button>
        )}
        {hidden ? (
          <Button size="sm" variant="secondary" icon={Check} onClick={() => save("check")} loading={busy === "check"} disabled={Boolean(busy)}>
            {changed ? "Save price" : "Keep hidden"}
          </Button>
        ) : (
          <Button size="sm" variant="secondary" icon={EyeSlash} onClick={() => save("hide")} loading={busy === "hide"} disabled={Boolean(busy)}>
            Hide from store
          </Button>
        )}
      </div>
    </li>
  );
}
