// Import many products at once from a spreadsheet or a product-data export.
import { useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, ArrowRight, DownloadSimple, FileArrowUp, Package } from "@phosphor-icons/react";
import * as admin from "@backend/admin";
import Button from "@/components/ui/Button";
import { SelectField, TextAreaField, TextField } from "@/components/ui/Field";
import { Notice, Spinner } from "@/components/ui/Misc";
import { useToast } from "@/context/ToastContext";
import { money } from "@/lib/format";
import { readJSON, writeJSON } from "@/lib/storage";
import { Card, PageHead, Pill, Segmented, Toggle } from "../components/AdminUI";
import { usePricing } from "../components/Pricing";
import { FIELDS, guessMapping, indexExisting, mappingKey, parseTable, planImport, SAMPLE_CSV } from "../importer";
import { useCollection } from "../lib";

const SUPPLIER_OPTIONS = [
  { value: "walmart", label: "Walmart · 2 h" },
  { value: "amazon", label: "Amazon · 1–2 days" },
  { value: "other", label: "Other" },
];
const ACTION = { new: { label: "New", tone: "green" }, update: { label: "Update", tone: "blue" }, skip: { label: "Skipped", tone: "neutral" } };
const PREVIEW_ROWS = 60;

export default function ProductImport() {
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
  return <Importer products={products.data} privates={privates.data} rules={pricing.rules} />;
}

function Importer({ products, privates, rules }) {
  const toast = useToast();
  const fileRef = useRef(null);
  const [table, setTable] = useState(null); // { columns, records, fileName }
  const [paste, setPaste] = useState("");
  const [mapping, setMapping] = useState({});
  const [opts, setOpts] = useState({ supplier: "walmart", department: "", category: "", publish: false, onlyPrices: true, skipOutOfStock: true });
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(0);
  const progress = useRef(0);
  const [result, setResult] = useState(null);

  function load(text, fileName) {
    try {
      const t = parseTable(text);
      if (!t.records.length) {
        toast.error("No rows found. The first line must have the column names.");
        return;
      }
      setTable({ ...t, fileName });
      // the same kind of file as last time → the columns chosen then
      const saved = readJSON(mappingKey(t.columns), null);
      const usable = saved && Object.values(saved).every((c) => !c || t.columns.includes(c));
      setMapping(usable ? { ...guessMapping(t.columns), ...saved } : guessMapping(t.columns));
      setResult(null);
    } catch (err) {
      console.error(err);
      toast.error("Couldn't read that file. Use a CSV (comma or tab separated) or a JSON list.");
    }
  }

  async function onFile(file) {
    if (!file) return;
    load(await file.text(), file.name);
    if (fileRef.current) fileRef.current.value = "";
  }

  function downloadSample() {
    const url = URL.createObjectURL(new Blob([SAMPLE_CSV], { type: "text/csv" }));
    const a = Object.assign(document.createElement("a"), { href: url, download: "products-example.csv" });
    a.click();
    URL.revokeObjectURL(url);
  }

  const existing = useMemo(() => indexExisting(products, privates), [products, privates]);
  const ready = table && FIELDS.filter((f) => f.required).every((f) => mapping[f.key]);
  const plan = useMemo(() => (ready ? planImport(table.records, { ...opts, mapping }, existing, rules) : null), [ready, table, opts, mapping, existing, rules]);
  const counts = useMemo(() => {
    const c = { new: 0, update: 0, skip: 0 };
    plan?.forEach((r) => (c[r.action] += 1));
    return c;
  }, [plan]);
  const todo = plan ? plan.filter((r) => r.action !== "skip") : [];

  async function run() {
    setBusy(true);
    setDone(0);
    progress.current = 0;
    writeJSON(mappingKey(table.columns), mapping);
    try {
      const ids = await admin.importProducts(
        todo.map((r) => ({ id: r.id, publicData: r.publicData, privateData: r.privateData })),
        (n) => {
          progress.current = n;
          setDone(n);
        },
      );
      // show them in the store right away (it also catches up by itself within minutes)
      await admin.publishCatalog().catch((err) => console.warn("Catalog not updated yet", err));
      const hidden = todo.map((r, i) => (r.action === "new" && r.publicData.status === "hidden" ? ids[i] : null)).filter(Boolean);
      setResult({ new: counts.new, update: counts.update, hidden });
      setTable(null);
      setPaste("");
      toast.success(`Imported ${todo.length} products`);
    } catch (err) {
      console.error(err);
      toast.error(`Stopped after ${progress.current} products. Check your connection and import the same file again (nothing is duplicated).`);
    } finally {
      setBusy(false);
    }
  }

  const set = (patch) => setOpts((o) => ({ ...o, ...patch }));

  async function publishNew() {
    setBusy(true);
    try {
      await admin.setProductsStatus(result.hidden, "active");
      await admin.publishCatalog().catch((err) => console.warn("Catalog not updated yet", err));
      toast.success(`${result.hidden.length} products are on sale`);
      setResult((r) => ({ ...r, hidden: [] }));
    } catch (err) {
      console.error(err);
      toast.error("Could not put them on sale. Try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="ad-page">
      <PageHead
        title="Import products"
        subtitle={
          <Link to="/admin/productos" className="ad-link">
            <ArrowLeft size={14} weight="bold" /> All products
          </Link>
        }
      />

      {result && (
        <Notice tone="success">
          Done: {result.new} new products and {result.update} updated, with automatic prices.{" "}
          {result.hidden.length > 0 && <>The new ones are hidden until you put them on sale. </>}
          <Link to="/admin/productos" className="ad-link">
            See the products <ArrowRight size={14} weight="bold" />
          </Link>
          {result.hidden.length > 0 && (
            <div className="ad-import__publish">
              <Button size="sm" onClick={publishNew} loading={busy}>
                Put the {result.hidden.length} new products on sale
              </Button>
            </div>
          )}
        </Notice>
      )}

      <div className="ad-import">
        <Card title="1. Your file">
          <p className="ad-hint">
            A spreadsheet saved as CSV, or the CSV/JSON export from a product-data service. One product per row, with the column names in the first line. Importing
            the same file again updates those products instead of adding them twice.
          </p>
          <div className="ad-import__pick">
            <input ref={fileRef} type="file" accept=".csv,.tsv,.txt,.json,text/csv,application/json" hidden onChange={(e) => onFile(e.target.files?.[0])} />
            <Button icon={FileArrowUp} onClick={() => fileRef.current?.click()}>
              Choose file
            </Button>
            <Button variant="ghost" size="sm" icon={DownloadSimple} onClick={downloadSample}>
              Example file
            </Button>
          </div>
          <TextAreaField label="…or paste it here" rows={4} value={paste} onChange={(e) => setPaste(e.target.value)} placeholder="name,price,url,image…" />
          {paste.trim() && (
            <Button size="sm" variant="secondary" onClick={() => load(paste, "pasted text")}>
              Read pasted text
            </Button>
          )}
          {table && (
            <p className="ad-hint">
              <strong>{table.fileName}</strong> · {table.records.length} rows · {table.columns.length} columns
            </p>
          )}
        </Card>

        {table && (
          <Card title="2. Which column is which">
            <div className="form-grid">
              {FIELDS.map((f) => (
                <SelectField
                  key={f.key}
                  label={f.label}
                  optional={f.required ? undefined : "optional"}
                  value={mapping[f.key] || ""}
                  onChange={(e) => setMapping((m) => ({ ...m, [f.key]: e.target.value }))}
                  options={[{ value: "", label: "—" }, ...table.columns.map((c) => ({ value: c, label: c }))]}
                  error={f.required && !mapping[f.key] ? "Needed" : ""}
                />
              ))}
            </div>
          </Card>
        )}

        {table && (
          <Card title="3. Options">
            <span className="field__label">Supplier</span>
            <Segmented label="Supplier" value={opts.supplier} onChange={(supplier) => set({ supplier })} options={SUPPLIER_OPTIONS} />
            <p className="ad-hint">Used when the link doesn’t say: walmart.ca and amazon.ca links are recognized by themselves.</p>
            <div className="form-grid">
              <TextField label="Department" optional="when the file has none" value={opts.department} onChange={(e) => set({ department: e.target.value })} placeholder="Electronics" />
              <TextField label="Category" optional="when the file has none" value={opts.category} onChange={(e) => set({ category: e.target.value })} placeholder="Other" />
            </div>
            <div className="ad-stack-sm">
              <Toggle checked={opts.publish} onChange={(publish) => set({ publish })} label="Put new products on sale right away" hint="Off: they arrive hidden so you can check them first." />
              <Toggle
                checked={opts.onlyPrices}
                onChange={(onlyPrices) => set({ onlyPrices })}
                label="Products you already have: update only price and stock"
                hint="Off: also replace their name, photos, description and category with the file’s."
              />
              <Toggle checked={opts.skipOutOfStock} onChange={(skipOutOfStock) => set({ skipOutOfStock })} label="Skip new items that are out of stock" />
            </div>
          </Card>
        )}

        {plan && (
          <Card title="4. Check and import" className="ad-import__check">
            <p className="ad-import__counts">
              <Pill tone="green">{counts.new} new</Pill>
              <Pill tone="blue">{counts.update} to update</Pill>
              <Pill tone="neutral">{counts.skip} skipped</Pill>
              <span className="ad-hint">Prices use your margin (Settings → Prices) and end in 2.99, 4.99, 7.99 or 9.99.</span>
            </p>
            <div className="ad-table-wrap">
              <table className="ad-table">
                <thead>
                  <tr>
                    <th>Product</th>
                    <th className="num">Supplier</th>
                    <th className="num">Our price</th>
                    <th>Result</th>
                  </tr>
                </thead>
                <tbody>
                  {plan.slice(0, PREVIEW_ROWS).map((r) => (
                    <tr key={r.index}>
                      <td>
                        <div className="ad-prod">
                          {r.publicData?.images?.[0] ? <img src={r.publicData.images[0]} alt="" className="ad-thumb" loading="lazy" /> : <Package size={22} className="ad-thumb" />}
                          <div>
                            <span className="ad-cell-main">{r.name}</span>
                            <span className="ad-cell-sub">{[r.publicData?.brand, r.publicData?.category].filter(Boolean).join(" · ")}</span>
                          </div>
                        </div>
                      </td>
                      <td className="num">{r.privateData ? money(r.privateData.supplierPrice) : "—"}</td>
                      <td className="num">
                        {r.prices ? (
                          <>
                            <span className="ad-cell-main strong">{money(r.prices.currentPrice || r.prices.price)}</span>
                            {r.prices.currentPrice > 0 && <s className="ad-cell-sub">{money(r.prices.price)}</s>}
                          </>
                        ) : (
                          "—"
                        )}
                      </td>
                      <td>
                        <Pill tone={ACTION[r.action].tone}>{ACTION[r.action].label}</Pill>
                        {r.reason && <span className="ad-cell-sub">{r.reason}</span>}
                        {r.publicData?.stock === 0 && <span className="ad-cell-sub">Out of stock</span>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {plan.length > PREVIEW_ROWS && <p className="ad-hint">Showing the first {PREVIEW_ROWS} of {plan.length} rows.</p>}
            <div className="ad-import__go">
              <Button icon={FileArrowUp} onClick={run} loading={busy} disabled={!todo.length}>
                {busy ? `Importing… ${done}/${todo.length}` : `Import ${todo.length} products`}
              </Button>
            </div>
          </Card>
        )}
      </div>
    </div>
  );
}
