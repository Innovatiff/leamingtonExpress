import { useMemo, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { Copy, Eye, EyeSlash, FileArrowUp, LockKey, Package, PencilSimple, Plus, ShieldWarning, Trash } from "@phosphor-icons/react";
import * as admin from "@backend/admin";
import Button from "@/components/ui/Button";
import { useToast } from "@/context/ToastContext";
import { money } from "@/lib/format";
import { categoryLabel, departmentLabel, normalizeProduct, productPath } from "@/lib/products";
import { Card, Empty, ErrorNote, LoadingRows, PageHead, Pill, SearchInput, Tabs, useAdminCity, useConfirm } from "../components/AdminUI";
import { matches, useCollection } from "../lib";

const FILTERS = {
  all: { label: "All", test: () => true },
  active: { label: "On sale", test: (p) => p.status === "active" },
  hidden: { label: "Hidden", test: (p) => p.status !== "active" },
  low: { label: "Low stock", test: (p) => p.stock !== null && p.stock > 0 && p.stock <= 3 },
  out: { label: "Sold out", test: (p) => p.stock === 0 },
  deals: { label: "On offer", test: (p) => p.onSale },
};
const PAGE = 100; // rows shown at a time (there can be thousands)
const SORTS = {
  newest: (a, b) => (b.createdAt?.getTime() || 0) - (a.createdAt?.getTime() || 0),
  name: (a, b) => a.name.localeCompare(b.name),
  priceAsc: (a, b) => a.price - b.price,
  priceDesc: (a, b) => b.price - a.price,
  stock: (a, b) => (a.stock ?? 9999) - (b.stock ?? 9999),
  sold: (a, b) => b.performance - a.performance,
};

export default function Products() {
  const { city } = useAdminCity();
  const toast = useToast();
  const navigate = useNavigate();
  const [confirm, confirmDialog] = useConfirm();
  const { status, data, error } = useCollection("products");
  const [params, setParams] = useSearchParams();
  const filter = FILTERS[params.get("stock")] ? params.get("stock") : FILTERS[params.get("f")] ? params.get("f") : "all";
  const [query, setQuery] = useState("");
  const [dept, setDept] = useState("");
  const [sort, setSort] = useState("newest");
  const [shown, setShown] = useState(PAGE);
  const [migrating, setMigrating] = useState(false);
  const [publishing, setPublishing] = useState(false);

  const products = useMemo(() => data.map((raw) => ({ ...normalizeProduct(raw), raw })), [data]);
  const exposed = useMemo(() => data.filter(admin.hasExposedPrivateData), [data]);
  const departments = useMemo(() => [...new Set(products.map((p) => p.department).filter(Boolean))].sort(), [products]);
  const inCity = (p) => !p.cities || p.cities.includes(city);
  const counts = useMemo(() => Object.fromEntries(Object.entries(FILTERS).map(([k, f]) => [k, products.filter((p) => f.test(p)).length])), [products]);
  const list = products
    .filter((p) => FILTERS[filter].test(p) && (!dept || p.department === dept) && matches(query, p.name, p.brand, p.category, p.department, p.sku, p.productId))
    .sort(SORTS[sort]);

  // a new search or filter starts again from the top
  const view = `${filter}|${dept}|${sort}|${query}`;
  const [lastView, setLastView] = useState(view);
  if (view !== lastView) {
    setLastView(view);
    setShown(PAGE);
  }

  const setFilter = (k) => {
    const next = new URLSearchParams(params);
    next.delete("stock");
    if (k === "all") next.delete("f");
    else next.set("f", k);
    setParams(next, { replace: true });
  };

  const toggleHidden = async (p) => {
    try {
      await admin.saveProduct(p.id, { status: p.status === "active" ? "hidden" : "active" }, null);
      toast.success(p.status === "active" ? `“${p.name}” is hidden from the store` : `“${p.name}” is back on sale`);
    } catch (err) {
      console.error(err);
      toast.error("Could not update the product.");
    }
  };

  const remove = async (p) => {
    const ok = await confirm({
      title: `Delete “${p.name}”?`,
      message: "This removes the product for good. Past orders keep their copy of it. If you only want to stop selling it, hide it instead.",
      confirmLabel: "Delete product",
      danger: true,
    });
    if (!ok) return;
    try {
      await admin.deleteProduct(p.id);
      toast.success("Product deleted");
    } catch (err) {
      console.error(err);
      toast.error("Could not delete the product.");
    }
  };

  const publishAll = async () => {
    const ids = list.map((p) => p.id);
    const ok = await confirm({
      title: `Put ${ids.length} products on sale?`,
      message: query || dept ? "Only the hidden products that match your search and department." : "Every hidden product appears in the store.",
      confirmLabel: `Put ${ids.length} on sale`,
    });
    if (!ok) return;
    setPublishing(true);
    try {
      await admin.setProductsStatus(ids, "active");
      toast.success(`${ids.length} products are on sale`);
    } catch (err) {
      console.error(err);
      toast.error("Could not update every product. Try again.");
    } finally {
      setPublishing(false);
    }
  };

  const migrate = async () => {
    const ok = await confirm({
      title: "Move private data out of the public catalog?",
      message: `${exposed.length} products show their cost, profit or supplier to anyone who opens the website's data. This copies those fields to a private admin-only collection and removes them from the public product documents. Selling prices are not changed.`,
      confirmLabel: "Move private data",
    });
    if (!ok) return;
    setMigrating(true);
    try {
      const n = await admin.migratePrivateFields(data);
      toast.success(`Done — ${n} products cleaned`);
    } catch (err) {
      console.error(err);
      toast.error("Could not finish. Check your admin permissions and try again.");
    } finally {
      setMigrating(false);
    }
  };

  return (
    <div className="ad-page">
      <PageHead
        title="Products"
        subtitle={`${products.length} products · ${counts.active} on sale · ${counts.out} sold out`}
        actions={
          <>
            <Button to="/admin/productos/importar" icon={FileArrowUp} size="sm" variant="secondary">
              Import
            </Button>
            <Button to="/admin/productos/nuevo" icon={Plus} size="sm">
              Add product
            </Button>
          </>
        }
      />
      <ErrorNote error={error} />

      {exposed.length > 0 && (
        <div className="ad-alert">
          <ShieldWarning size={24} weight="duotone" />
          <div>
            <strong>{exposed.length} products expose private data</strong>
            <p>Cost, profit and supplier links are stored in the public product documents, so anyone can read them. Move them to the private admin collection.</p>
          </div>
          <Button size="sm" icon={LockKey} onClick={migrate} loading={migrating}>
            Move private data
          </Button>
        </div>
      )}

      <div className="ad-toolbar">
        <Tabs label="Product filters" value={filter} onChange={setFilter} tabs={Object.entries(FILTERS).map(([key, f]) => ({ key, label: f.label, count: counts[key] }))} />
        <div className="ad-toolbar__right">
          <label className="ad-select ad-select--inline">
            <span className="sr-only">Department</span>
            <select value={dept} onChange={(e) => setDept(e.target.value)}>
              <option value="">All departments</option>
              {departments.map((d) => (
                <option key={d} value={d}>
                  {departmentLabel(d, "en")}
                </option>
              ))}
            </select>
          </label>
          <label className="ad-select ad-select--inline">
            <span className="sr-only">Sort</span>
            <select value={sort} onChange={(e) => setSort(e.target.value)}>
              <option value="newest">Newest</option>
              <option value="name">Name A–Z</option>
              <option value="priceAsc">Price: low to high</option>
              <option value="priceDesc">Price: high to low</option>
              <option value="stock">Stock: lowest first</option>
              <option value="sold">Best sellers</option>
            </select>
          </label>
          <SearchInput value={query} onChange={setQuery} placeholder="Name, brand, SKU…" />
          {filter === "hidden" && list.length > 0 && (
            <Button size="sm" variant="secondary" icon={Eye} onClick={publishAll} loading={publishing}>
              Put {list.length} on sale
            </Button>
          )}
        </div>
      </div>

      <Card flush>
        <div className="ad-table-wrap">
          <table className="ad-table ad-table--click">
            <thead>
              <tr>
                <th>Product</th>
                <th>Category</th>
                <th className="num">Price</th>
                <th className="num">Stock</th>
                <th>Status</th>
                <th className="ad-actions-col">
                  <span className="sr-only">Actions</span>
                </th>
              </tr>
            </thead>
            {status === "loading" ? (
              <LoadingRows cols={6} />
            ) : (
              <tbody>
                {list.slice(0, shown).map((p) => (
                  <tr key={p.id} onClick={() => navigate(`/admin/productos/${encodeURIComponent(p.id)}`)}>
                    <td>
                      <div className="ad-prod">
                        {p.image ? <img src={p.image} alt="" className="ad-thumb" loading="lazy" /> : <Package size={22} className="ad-thumb" />}
                        <div>
                          <Link to={`/admin/productos/${encodeURIComponent(p.id)}`} className="ad-rowlink" onClick={(e) => e.stopPropagation()}>
                            {p.name}
                          </Link>
                          <span className="ad-cell-sub">
                            {[p.brand, p.sku || p.productId].filter(Boolean).join(" · ")}
                            {!inCity(p) && " · not sold in this city"}
                          </span>
                        </div>
                      </div>
                    </td>
                    <td>
                      <span className="ad-cell-main">{categoryLabel(p.category, "en")}</span>
                      <span className="ad-cell-sub">{departmentLabel(p.department, "en")}</span>
                    </td>
                    <td className="num">
                      <span className="ad-cell-main strong">{money(p.price)}</span>
                      {p.compareAt > 0 && <s className="ad-cell-sub">{money(p.compareAt)}</s>}
                    </td>
                    <td className="num">
                      {p.stock === null ? (
                        <span className="ad-cell-sub">Not tracked</span>
                      ) : (
                        <Pill tone={p.stock === 0 ? "red" : p.stock <= 3 ? "amber" : "neutral"}>{p.stock === 0 ? "Sold out" : p.stock}</Pill>
                      )}
                    </td>
                    <td>
                      <Pill tone={p.status === "active" ? "green" : "neutral"}>{p.status === "active" ? "On sale" : "Hidden"}</Pill>
                    </td>
                    <td className="ad-actions-col" onClick={(e) => e.stopPropagation()}>
                      <div className="ad-row-actions">
                        <Button variant="ghost" size="sm" square to={`/admin/productos/${encodeURIComponent(p.id)}`} aria-label={`Edit ${p.name}`} title="Edit" icon={PencilSimple} />
                        <Button variant="ghost" size="sm" square to={`/admin/productos/nuevo?copia=${encodeURIComponent(p.id)}`} aria-label={`Duplicate ${p.name}`} title="Duplicate" icon={Copy} />
                        <Button variant="ghost" size="sm" square onClick={() => toggleHidden(p)} aria-label={p.status === "active" ? `Hide ${p.name}` : `Show ${p.name}`} title={p.status === "active" ? "Hide from store" : "Put on sale"} icon={p.status === "active" ? EyeSlash : Eye} />
                        <Button variant="ghost" size="sm" square href={productPath(p)} target="_blank" rel="noreferrer" aria-label={`View ${p.name} in the store`} title="View in store" icon={Package} />
                        <Button variant="ghost" size="sm" square className="ad-danger-text" onClick={() => remove(p)} aria-label={`Delete ${p.name}`} title="Delete" icon={Trash} />
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            )}
          </table>
        </div>
        {list.length > shown && (
          <div className="ad-more">
            <span className="ad-hint">
              Showing {shown} of {list.length}
            </span>
            <Button variant="secondary" size="sm" onClick={() => setShown((n) => n + PAGE)}>
              Show {Math.min(PAGE, list.length - shown)} more
            </Button>
          </div>
        )}
        {status !== "loading" && !list.length && (
          <Empty icon={Package} title="No products match" text="Change the filters or add a new product.">
            <Button to="/admin/productos/nuevo" icon={Plus} size="sm">
              Add product
            </Button>
          </Empty>
        )}
      </Card>
      {confirmDialog}
    </div>
  );
}
