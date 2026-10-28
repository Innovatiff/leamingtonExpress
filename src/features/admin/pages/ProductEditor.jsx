import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { ArrowDown, ArrowLeft, ArrowUp, CloudArrowUp, Eye, FloppyDisk, LockKey, Plus, Trash, Warning } from "@phosphor-icons/react";
import * as admin from "@backend/admin";
import Button from "@/components/ui/Button";
import { Checkbox, SelectField, TextAreaField, TextField } from "@/components/ui/Field";
import { Notice, Spinner } from "@/components/ui/Misc";
import { CITIES } from "@/config/cities";
import { useToast } from "@/context/ToastContext";
import ProductCard from "@/features/store/components/ProductCard";
import { money, parseMoney, round2, toDate } from "@/lib/format";
import { hasOfferEnding, hasPriceEnding, offerEnding, priceEnding, sellingPrices, SUPPLIERS } from "@/lib/margin";
import { normalizeProduct, productPath, SECTIONS } from "@/lib/products";
import { Card, PageHead, Pill, Segmented, Toggle, useConfirm } from "../components/AdminUI";
import { usePricing } from "../components/Pricing";
import { useCollection } from "../lib";
import { canUpload, uploadImage } from "../upload";

const CATEGORIES = ["Phone", "Earbuds", "Headphones", "Speaker", "Television", "Laptop", "PC", "Monitor", "Tablet", "Watch", "Printer", "Camera", "Gaming", "Vacuum", "Scooter", "Bike", "Purse", "Hair straightener", "Other"];
const UNITS = ["minutes", "hours", "days", "weeks"];

const pad = (n) => String(n).padStart(2, "0");
const SUPPLIER_OPTIONS = [
  { value: "walmart", label: "Walmart · 2 h" },
  { value: "amazon", label: "Amazon · 1–2 days" },
  { value: "other", label: "Other" },
];

/** Older products only have a supplier name or link: tell Walmart and Amazon apart. */
function guessSupplier(link, name, isNew) {
  const text = `${link || ""} ${name || ""}`;
  if (/walmart/i.test(text)) return "walmart";
  if (/amazon|amzn/i.test(text)) return "amazon";
  return isNew ? "walmart" : "other";
}
const toLocalInput = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
const numStr = (v) => (v === undefined || v === null || v === "" ? "" : String(parseMoney(v)));

function fromRaw(raw, priv, copy) {
  const pr = raw?.pricing || {};
  const cat = String(raw?.category || "Other");
  const known = CATEGORIES.find((c) => c.toLowerCase() === cat.toLowerCase());
  const endsAt = toDate(raw?.offer?.endsAt);
  return {
    name: raw ? `${raw.name || ""}${copy ? " (copy)" : ""}` : "",
    brand: raw?.brand || "",
    category: known || "__custom",
    categoryCustom: known ? "" : cat,
    categoryDetail: raw?.categoryDetail || "",
    origin: raw?.origin || "",
    productId: copy || !raw ? Date.now().toString().slice(-8) : raw.productId || "",
    sku: copy ? "" : raw?.sku || "",
    description: raw?.description || "",
    variants: (Array.isArray(raw?.variants) ? raw.variants : []).join(", "),
    images: raw?.images?.length ? [...raw.images] : [""],
    price: numStr(pr.price ?? raw?.price),
    currentPrice: parseMoney(pr.currentPrice) > 0 ? numStr(pr.currentPrice) : "",
    expressPoints: String(raw?.expressPoints ?? 0),
    trackStock: !raw || (raw.stock !== null && raw.stock !== undefined && raw.stock !== ""),
    stock: raw?.stock != null && raw.stock !== "" ? String(raw.stock) : raw ? "" : "1",
    deliveryCount: String(raw?.delivery?.count ?? 2),
    deliveryUnit: UNITS.includes(raw?.delivery?.unit) ? raw.delivery.unit : "hours",
    offerEndsAt: endsAt && endsAt.getTime() > Date.now() ? toLocalInput(endsAt) : "",
    sections: Object.fromEntries(SECTIONS.map((s) => [s.key, !!raw?.sectionDisplay?.[s.key]])),
    specs: raw?.specifications?.length ? raw.specifications.map((s) => ({ title: s?.title || "", description: s?.description || "" })) : [{ title: "", description: "" }],
    stars: String(raw?.stars ?? 0),
    ratingsNumber: String(raw?.ratingsNumber ?? 0),
    status: copy ? "hidden" : raw?.status === "hidden" || raw?.hidden ? "hidden" : "active",
    cities: Array.isArray(raw?.cities) ? raw.cities : [],
    cost: numStr(priv?.cost ?? pr.cost),
    sourceName: priv?.sourceName ?? raw?.sourceName ?? (raw ? "" : SUPPLIERS.walmart.name),
    sourceLink: priv?.sourceLink ?? raw?.sourceLink ?? "",
    stockLocation: priv?.stockLocation ?? raw?.stockLocation ?? "",
    supplier: priv?.supplier || guessSupplier(priv?.sourceLink ?? raw?.sourceLink, priv?.sourceName ?? raw?.sourceName, !raw),
    supplierPrice: numStr(priv?.supplierPrice),
    supplierRegular: parseMoney(priv?.supplierRegular) > 0 ? numStr(priv.supplierRegular) : "",
    offerPct: parseMoney(priv?.offerPct) > 0 ? String(priv.offerPct) : "",
    autoPrice: priv ? !!priv.autoPrice : !raw, // new products: on; older ones keep the price typed in
  };
}

/** The automatic price for the form (null when it's off or there's no supplier price). */
const autoPriceOf = (f, rules) =>
  f.autoPrice
    ? sellingPrices({ supplier: f.supplier, supplierPrice: parseMoney(f.supplierPrice), supplierRegular: parseMoney(f.supplierRegular), offerPct: Number(f.offerPct) || 0 }, rules)
    : null;

function toDocs(f, rules) {
  const auto = autoPriceOf(f, rules);
  const regular = round2(parseMoney(f.price));
  const sale = round2(parseMoney(f.currentPrice));
  const endsAt = f.offerEndsAt ? new Date(f.offerEndsAt) : null;
  const publicData = {
    name: f.name.trim(),
    brand: f.brand.trim(),
    category: f.category === "__custom" ? f.categoryCustom.trim() || "Other" : f.category,
    categoryDetail: f.categoryDetail.trim(),
    origin: f.origin.trim(),
    productId: f.productId.trim(),
    sku: f.sku.trim(),
    description: f.description.trim(),
    variants: f.variants
      .split(",")
      .map((v) => v.trim())
      .filter(Boolean),
    images: f.images.map((u) => u.trim()).filter(Boolean),
    pricing: auto ? { price: auto.price, currentPrice: auto.currentPrice } : { price: regular, currentPrice: sale > 0 && sale < regular ? sale : 0 },
    expressPoints: Math.max(0, Math.floor(Number(f.expressPoints) || 0)),
    stock: f.trackStock ? Math.max(0, Math.floor(Number(f.stock) || 0)) : null,
    delivery: { count: Math.max(0, Number(f.deliveryCount) || 0), unit: f.deliveryUnit },
    offer: { endsAt: endsAt && !Number.isNaN(endsAt.getTime()) ? endsAt : null },
    sectionDisplay: { allProducts: true, ...f.sections },
    specifications: f.specs.filter((s) => s.title.trim() || s.description.trim()).map((s) => ({ title: s.title.trim(), description: s.description.trim() })),
    stars: Math.min(5, Math.max(0, Number(f.stars) || 0)),
    ratingsNumber: Math.max(0, Math.floor(Number(f.ratingsNumber) || 0)),
    status: f.status,
    cities: f.cities.length ? f.cities : null,
  };
  const privateData = {
    cost: auto ? auto.cost : round2(parseMoney(f.cost)),
    sourceName: f.sourceName.trim(),
    sourceLink: f.sourceLink.trim(),
    stockLocation: f.stockLocation.trim(),
    supplier: f.supplier,
    supplierPrice: round2(parseMoney(f.supplierPrice)),
    supplierRegular: round2(parseMoney(f.supplierRegular)),
    offerPct: Math.min(90, Math.max(0, Number(f.offerPct) || 0)),
    autoPrice: f.autoPrice,
  };
  return { publicData, privateData };
}

export default function ProductEditor() {
  const { id } = useParams();
  const [params] = useSearchParams();
  const copyId = params.get("copia");
  const products = useCollection("products");
  const privates = useCollection("productsPrivate");
  const pricing = usePricing();
  const sourceId = id || copyId;
  const raw = sourceId ? products.data.find((p) => p.id === sourceId) : null;
  const priv = sourceId ? privates.data.find((p) => p.id === sourceId) : null;
  const ready = products.status !== "loading" && privates.status !== "loading" && pricing.status !== "loading";

  if (!ready) {
    return (
      <div className="ad-page-loading">
        <Spinner label="Loading…" />
      </div>
    );
  }
  if (id && !raw) {
    return (
      <div className="ad-page">
        <PageHead title="Product not found" actions={<Button to="/admin/productos">Back to products</Button>} />
        <Notice tone="warning">This product may have been deleted.</Notice>
      </div>
    );
  }
  const departments = [...new Set(products.data.map((p) => p.categoryDetail).filter(Boolean))].sort();
  return (
    <ProductForm
      key={`${id || "new"}-${copyId || ""}`}
      id={id}
      raw={raw}
      initial={fromRaw(raw, priv, !id && !!copyId)}
      departments={departments}
      privateError={privates.error}
      rules={pricing.rules}
    />
  );
}

function ProductForm({ id, raw, initial, departments, privateError, rules }) {
  const toast = useToast();
  const navigate = useNavigate();
  const [confirm, confirmDialog] = useConfirm();
  const [f, setF] = useState(initial);
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [touched, setTouched] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef(null);

  const set = (patch) => {
    setF((cur) => ({ ...cur, ...patch }));
    setDirty(true);
  };

  useEffect(() => {
    if (!dirty) return undefined;
    const warn = (e) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);

  const auto = autoPriceOf(f, rules);
  const regular = auto ? auto.price : parseMoney(f.price);
  const sale = auto ? auto.currentPrice : parseMoney(f.currentPrice);
  const cost = auto ? auto.cost : parseMoney(f.cost);
  const selling = sale > 0 ? sale : regular;
  const margin = selling > 0 && cost > 0 ? selling - cost : null;
  const supplierPrice = parseMoney(f.supplierPrice);
  const errors = {
    name: f.name.trim().length < 2 ? "Write the product name." : "",
    price: !f.autoPrice && f.status === "active" && !(regular > 0) ? "A product on sale needs a price." : "",
    currentPrice: !f.autoPrice && sale > 0 && sale >= regular ? "The sale price must be lower than the regular price." : "",
    supplierPrice: f.autoPrice && f.status === "active" && !(supplierPrice > 0) ? "Enter what the supplier charges (or turn off the automatic price)." : "",
    supplierRegular: parseMoney(f.supplierRegular) > 0 && parseMoney(f.supplierRegular) <= supplierPrice ? "Only for a sale: it must be higher than the supplier price." : "",
    categoryCustom: f.category === "__custom" && !f.categoryCustom.trim() ? "Write the category." : "",
  };
  const hasErrors = Object.values(errors).some(Boolean);
  const preview = useMemo(() => normalizeProduct({ id: id || "preview", ...toDocs(f, rules).publicData }), [f, id, rules]);

  // Choosing the supplier sets how soon it arrives (and its name)
  const setSupplier = (supplier) => {
    const s = SUPPLIERS[supplier];
    const knownName = !f.sourceName.trim() || Object.values(SUPPLIERS).some((x) => x.name && x.name === f.sourceName.trim());
    set({
      supplier,
      ...(s.delivery ? { deliveryCount: String(s.delivery.count), deliveryUnit: s.delivery.unit } : {}),
      ...(knownName ? { sourceName: s.name } : {}),
    });
  };

  async function save() {
    if (hasErrors) {
      setTouched(true);
      toast.error("Please fix the highlighted fields.");
      return;
    }
    setSaving(true);
    try {
      const { publicData, privateData } = toDocs(f, rules);
      const savedId = await admin.saveProduct(id || null, publicData, privateData);
      setDirty(false);
      toast.success(id ? "Product saved" : "Product created");
      if (!id) navigate(`/admin/productos/${encodeURIComponent(savedId)}`, { replace: true });
    } catch (err) {
      console.error(err);
      toast.error("Could not save the product. Check your connection and permissions.");
    } finally {
      setSaving(false);
    }
  }

  async function remove() {
    const ok = await confirm({ title: `Delete “${f.name}”?`, message: "This removes the product for good. Hide it instead if you might sell it again.", confirmLabel: "Delete product", danger: true });
    if (!ok) return;
    try {
      await admin.deleteProduct(id);
      setDirty(false);
      toast.success("Product deleted");
      navigate("/admin/productos", { replace: true });
    } catch (err) {
      console.error(err);
      toast.error("Could not delete the product.");
    }
  }

  async function onFiles(files) {
    const list = [...(files || [])];
    if (!list.length) return;
    setUploading(true);
    try {
      const urls = [];
      for (const file of list) urls.push(await uploadImage(file));
      setF((cur) => ({ ...cur, images: [...cur.images.filter((u) => u.trim()), ...urls] }));
      setDirty(true);
      toast.success(urls.length === 1 ? "Photo added" : `${urls.length} photos added`);
    } catch (err) {
      toast.error(err.message || "Upload failed.");
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  const moveImage = (i, dir) => {
    const images = [...f.images];
    const j = i + dir;
    if (j < 0 || j >= images.length) return;
    [images[i], images[j]] = [images[j], images[i]];
    set({ images });
  };
  const err = (k) => (touched ? errors[k] : "");

  return (
    <div className="ad-page">
      <PageHead
        title={id ? f.name || "Edit product" : "New product"}
        subtitle={
          <Link to="/admin/productos" className="ad-link">
            <ArrowLeft size={14} weight="bold" /> All products
          </Link>
        }
        actions={
          <>
            {id && raw && (
              <Button variant="secondary" size="sm" icon={Eye} href={productPath(normalizeProduct(raw))} target="_blank" rel="noreferrer">
                View in store
              </Button>
            )}
            <Button size="sm" icon={FloppyDisk} onClick={save} loading={saving}>
              {id ? "Save" : "Create product"}
            </Button>
          </>
        }
      />
      {privateError && <Notice tone="warning">Private cost/supplier data couldn’t be loaded (deploy the new Firestore rules). Saving will still work for admins.</Notice>}

      <div className="ad-editor">
        <div className="ad-editor__main">
          <Card title="Basic information">
            <div className="form-grid">
              <TextField className="span-2" label="Product name" value={f.name} onChange={(e) => set({ name: e.target.value })} error={err("name")} maxLength={140} />
              <TextField label="Brand" value={f.brand} onChange={(e) => set({ brand: e.target.value })} placeholder="Samsung" />
              <SelectField
                label="Category"
                value={f.category}
                onChange={(e) => set({ category: e.target.value })}
                options={[...CATEGORIES.map((c) => ({ value: c, label: c })), { value: "__custom", label: "Other (type it)…" }]}
              />
              {f.category === "__custom" && <TextField label="Category name" value={f.categoryCustom} onChange={(e) => set({ categoryCustom: e.target.value })} error={err("categoryCustom")} />}
              <TextField label="Department" value={f.categoryDetail} onChange={(e) => set({ categoryDetail: e.target.value })} list="ad-departments" placeholder="Electronics" hint="Groups categories in the store menu." />
              <datalist id="ad-departments">
                {departments.map((d) => (
                  <option key={d} value={d} />
                ))}
              </datalist>
              <TextField label="Origin" optional="optional" value={f.origin} onChange={(e) => set({ origin: e.target.value })} placeholder="USA" />
              <TextField label="Product ID" value={f.productId} onChange={(e) => set({ productId: e.target.value })} hint="Shown to customers on the product page." />
              <TextField label="SKU" optional="optional" value={f.sku} onChange={(e) => set({ sku: e.target.value })} />
              <TextAreaField className="span-2" label="Description" optional="optional" rows={4} value={f.description} onChange={(e) => set({ description: e.target.value })} />
              <TextField className="span-2" label="Options / variants" optional="optional" value={f.variants} onChange={(e) => set({ variants: e.target.value })} placeholder="Black, White, Blue" hint="Separate with commas. Customers must choose one." />
            </div>
          </Card>

          <Card
            title="Photos"
            actions={
              canUpload && (
                <>
                  <input ref={fileRef} type="file" accept="image/*" multiple hidden onChange={(e) => onFiles(e.target.files)} />
                  <Button size="sm" variant="secondary" icon={CloudArrowUp} loading={uploading} onClick={() => fileRef.current?.click()}>
                    Upload photos
                  </Button>
                </>
              )
            }
          >
            <p className="ad-hint">The first photo is the main one. {canUpload ? "Upload photos or paste image links." : "Paste image links (https://…)."}</p>
            <ul className="ad-images">
              {f.images.map((url, i) => (
                <li key={i}>
                  <span className="ad-images__thumb">{url.trim() ? <img src={url} alt="" /> : <span>{i + 1}</span>}</span>
                  <TextField aria-label={`Photo ${i + 1} link`} placeholder="https://…" value={url} onChange={(e) => set({ images: f.images.map((u, j) => (j === i ? e.target.value : u)) })} />
                  <div className="ad-images__actions">
                    <Button variant="ghost" size="sm" square icon={ArrowUp} onClick={() => moveImage(i, -1)} disabled={i === 0} aria-label="Move up" />
                    <Button variant="ghost" size="sm" square icon={ArrowDown} onClick={() => moveImage(i, 1)} disabled={i === f.images.length - 1} aria-label="Move down" />
                    <Button
                      variant="ghost"
                      size="sm"
                      square
                      icon={Trash}
                      className="ad-danger-text"
                      onClick={() => set({ images: f.images.length > 1 ? f.images.filter((_, j) => j !== i) : [""] })}
                      aria-label={`Remove photo ${i + 1}`}
                    />
                  </div>
                </li>
              ))}
            </ul>
            <Button variant="ghost" size="sm" icon={Plus} onClick={() => set({ images: [...f.images, ""] })}>
              Add photo link
            </Button>
          </Card>

          <Card title="Specifications">
            <ul className="ad-specs">
              {f.specs.map((s, i) => (
                <li key={i}>
                  <TextField aria-label={`Spec ${i + 1} name`} placeholder="Battery" value={s.title} onChange={(e) => set({ specs: f.specs.map((x, j) => (j === i ? { ...x, title: e.target.value } : x)) })} />
                  <TextField aria-label={`Spec ${i + 1} value`} placeholder="Up to 30 hours" value={s.description} onChange={(e) => set({ specs: f.specs.map((x, j) => (j === i ? { ...x, description: e.target.value } : x)) })} />
                  <Button variant="ghost" size="sm" square icon={Trash} className="ad-danger-text" aria-label={`Remove spec ${i + 1}`} onClick={() => set({ specs: f.specs.length > 1 ? f.specs.filter((_, j) => j !== i) : [{ title: "", description: "" }] })} />
                </li>
              ))}
            </ul>
            <Button variant="ghost" size="sm" icon={Plus} onClick={() => set({ specs: [...f.specs, { title: "", description: "" }] })}>
              Add specification
            </Button>
          </Card>

          <Card title="Home page sections">
            <p className="ad-hint">Choose where this product appears on the store's home page.</p>
            <div className="ad-checks">
              {SECTIONS.map((s) => (
                <Checkbox key={s.key} label={`${s.emoji} ${s.en}`} checked={!!f.sections[s.key]} onChange={(e) => set({ sections: { ...f.sections, [s.key]: e.target.checked } })} />
              ))}
            </div>
          </Card>
        </div>

        <aside className="ad-editor__side">
          <Card title="Visibility">
            <Toggle checked={f.status === "active"} onChange={(on) => set({ status: on ? "active" : "hidden" })} label={f.status === "active" ? "On sale" : "Hidden from the store"} hint="Hidden products keep their data but customers can't see them." />
            <div className="ad-field-group">
              <span className="field__label">Cities</span>
              <div className="ad-checks ad-checks--tight">
                {Object.values(CITIES).map((c) => (
                  <Checkbox key={c.id} label={c.name} checked={f.cities.includes(c.id)} onChange={(e) => set({ cities: e.target.checked ? [...f.cities, c.id] : f.cities.filter((x) => x !== c.id) })} />
                ))}
              </div>
              <span className="field__hint">None checked = sold in every city.</span>
            </div>
          </Card>

          <Card
            title={
              <>
                <LockKey size={16} weight="bold" /> Supplier (admins only)
              </>
            }
          >
            <Segmented label="Supplier" value={f.supplier} onChange={setSupplier} options={SUPPLIER_OPTIONS} />
            <div className="form-grid">
              <TextField
                label="Supplier price"
                inputMode="decimal"
                value={f.supplierPrice}
                onChange={(e) => set({ supplierPrice: e.target.value })}
                error={err("supplierPrice")}
                placeholder="0.00"
                hint="What they charge today, before tax."
              />
              <TextField
                label="Their regular price"
                optional="optional"
                inputMode="decimal"
                value={f.supplierRegular}
                onChange={(e) => set({ supplierRegular: e.target.value })}
                error={err("supplierRegular")}
                placeholder="—"
                hint="Only when they have it on sale."
              />
              <TextField className="span-2" label="Supplier link" value={f.sourceLink} onChange={(e) => set({ sourceLink: e.target.value })} placeholder="https://…" />
              {f.supplier === "other" && <TextField className="span-2" label="Supplier name" value={f.sourceName} onChange={(e) => set({ sourceName: e.target.value })} />}
              {!f.autoPrice && <TextField label="Your cost" inputMode="decimal" value={f.cost} onChange={(e) => set({ cost: e.target.value })} placeholder="0.00" />}
              <TextField label="Stock location" optional="optional" value={f.stockLocation} onChange={(e) => set({ stockLocation: e.target.value })} />
            </div>
            {auto && (
              <p className="ad-hint">
                Cost with {rules.purchaseTax}% tax: {money(auto.cost)} · margin {rules.margin[f.supplier] ?? rules.margin.other}%
              </p>
            )}
            {margin !== null && (
              <p className={`ad-hint ${margin > 0 ? "ad-good" : "ad-bad"}`}>
                {margin > 0 ? (
                  <>
                    Profit per unit: {money(margin)} ({Math.round((margin / selling) * 100)}%)
                  </>
                ) : (
                  <>
                    <Warning size={14} weight="bold" /> You lose {money(-margin)} per unit at this price.
                  </>
                )}
              </p>
            )}
          </Card>

          <Card title="Price">
            <Toggle
              checked={f.autoPrice}
              onChange={(on) => set(on ? { autoPrice: true } : { autoPrice: false, price: regular ? String(regular) : f.price, currentPrice: sale ? String(sale) : "", cost: cost ? String(cost) : f.cost })}
              label="Automatic price"
              hint="From the supplier price and your margin (Settings → Prices). Follows their price changes."
            />
            {f.autoPrice ? (
              <>
                {auto ? (
                  <div className="ad-autoprice">
                    <strong>{money(auto.currentPrice || auto.price)}</strong>
                    {auto.currentPrice > 0 && <s>{money(auto.price)}</s>}
                    {auto.currentPrice > 0 && <Pill tone="green">Offer</Pill>}
                  </div>
                ) : (
                  <p className="ad-hint">Enter the supplier price to see it.</p>
                )}
                <TextField
                  label="Our offer (% off)"
                  optional="optional"
                  type="number"
                  min="0"
                  max="90"
                  value={f.offerPct}
                  onChange={(e) => set({ offerPct: e.target.value })}
                  hint="Offer prices end in .00. A sale at the supplier becomes an offer by itself."
                />
              </>
            ) : (
              <div className="form-grid">
                <TextField label="Regular price" inputMode="decimal" value={f.price} onChange={(e) => set({ price: e.target.value })} error={err("price")} placeholder="0.00" />
                <TextField label="Sale price" optional="optional" inputMode="decimal" value={f.currentPrice} onChange={(e) => set({ currentPrice: e.target.value })} error={err("currentPrice")} placeholder="—" />
                {regular > 0 && !hasPriceEnding(regular) && (
                  <p className="ad-hint span-2">
                    Store prices end in 2.99, 4.99, 7.99 or 9.99.
                    <button type="button" className="chip" onClick={() => set({ price: String(priceEnding(regular)) })}>
                      Use {money(priceEnding(regular))}
                    </button>
                  </p>
                )}
                {sale > 0 && !hasOfferEnding(sale) && (
                  <p className="ad-hint span-2">
                    Offer prices end in .00.
                    <button type="button" className="chip" onClick={() => set({ currentPrice: String(offerEnding(sale)) })}>
                      Use {money(offerEnding(sale))}
                    </button>
                  </p>
                )}
              </div>
            )}
            <TextField label="Express Points" type="number" min="0" value={f.expressPoints} onChange={(e) => set({ expressPoints: e.target.value })} hint="Points the customer earns per unit." />
            {sale > 0 && sale < regular && (
              <p className="ad-hint ad-good">
                Customers save {money(regular - sale)} ({Math.round(((regular - sale) / regular) * 100)}% off).
              </p>
            )}
          </Card>

          <Card title="Inventory & delivery">
            <Toggle checked={f.trackStock} onChange={(on) => set({ trackStock: on })} label="Track stock" hint="Stops selling when it reaches 0." />
            {f.trackStock && <TextField label="Units in stock" type="number" min="0" value={f.stock} onChange={(e) => set({ stock: e.target.value })} />}
            <div className="form-grid">
              <TextField label="Delivery time" type="number" min="0" value={f.deliveryCount} onChange={(e) => set({ deliveryCount: e.target.value })} />
              <SelectField label="Unit" value={f.deliveryUnit} onChange={(e) => set({ deliveryUnit: e.target.value })} options={UNITS} />
            </div>
          </Card>

          <Card title="Offer countdown">
            <TextField label="Offer ends" type="datetime-local" value={f.offerEndsAt} onChange={(e) => set({ offerEndsAt: e.target.value })} hint="Shows a countdown on the product. Leave empty for none." />
            <div className="ad-quick">
              {[
                ["24 h", 24],
                ["3 days", 72],
                ["1 week", 168],
              ].map(([label, hours]) => (
                <button key={label} type="button" className="chip" onClick={() => set({ offerEndsAt: toLocalInput(new Date(Date.now() + hours * 3600000)) })}>
                  +{label}
                </button>
              ))}
              {f.offerEndsAt && (
                <button type="button" className="chip" onClick={() => set({ offerEndsAt: "" })}>
                  Clear
                </button>
              )}
            </div>
          </Card>

          <Card title="Reviews">
            <div className="form-grid">
              <TextField label="Stars (0–5)" type="number" min="0" max="5" step="0.1" value={f.stars} onChange={(e) => set({ stars: e.target.value })} />
              <TextField label="Number of reviews" type="number" min="0" value={f.ratingsNumber} onChange={(e) => set({ ratingsNumber: e.target.value })} />
            </div>
          </Card>

          <Card title="Store preview">
            <div className="ad-preview" inert>
              <ProductCard product={preview} />
            </div>
          </Card>

          {id && (
            <Button variant="ghost" icon={Trash} className="ad-danger-text" onClick={remove} block>
              Delete product
            </Button>
          )}
        </aside>
      </div>

      <div className={`ad-savebar ${dirty ? "is-visible" : ""}`} aria-hidden={!dirty}>
        <span>Unsaved changes</span>
        <Button size="sm" icon={FloppyDisk} onClick={save} loading={saving} tabIndex={dirty ? 0 : -1}>
          {id ? "Save" : "Create product"}
        </Button>
      </div>
      {confirmDialog}
    </div>
  );
}
