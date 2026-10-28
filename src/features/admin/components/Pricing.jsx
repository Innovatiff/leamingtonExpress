// Pricing rules (Settings → Prices) and bringing product prices in line with them.
import { useMemo, useState } from "react";
import { ArrowRight, ArrowsClockwise, FloppyDisk } from "@phosphor-icons/react";
import * as admin from "@backend/admin";
import Button from "@/components/ui/Button";
import { TextField } from "@/components/ui/Field";
import { Spinner } from "@/components/ui/Misc";
import { useToast } from "@/context/ToastContext";
import { money, parseMoney } from "@/lib/format";
import { pricingRules, sellingPrices, SUPPLIERS } from "@/lib/margin";
import { normalizeProduct } from "@/lib/products";
import { useCollection } from "../lib";
import { Card } from "./AdminUI";

/** The saved pricing rules, with the defaults filled in. */
export function usePricing() {
  const { status, data, error } = useCollection("pricing");
  const saved = data.find((d) => d.id === "default") || null;
  const rules = useMemo(() => pricingRules(saved), [saved]);
  return { status, rules, error };
}

/** Does this product's saved price differ from what the rules give? → the change, or null */
export function priceChange(raw, priv, rules) {
  if (!priv?.autoPrice) return null;
  const next = sellingPrices(priv, rules);
  if (!next) return null;
  const same =
    parseMoney(raw?.pricing?.price) === next.price && parseMoney(raw?.pricing?.currentPrice) === next.currentPrice && parseMoney(priv.cost) === next.cost;
  return same ? null : { id: raw.id, pricing: { price: next.price, currentPrice: next.currentPrice }, cost: next.cost };
}

const EXAMPLES = [
  ["walmart", 3.97],
  ["walmart", 8.47],
  ["walmart", 24.97],
  ["amazon", 29.99],
  ["amazon", 189.99],
];

export function PricingCard() {
  const { status, rules } = usePricing();
  if (status === "loading") {
    return (
      <Card title="Prices (all cities)">
        <Spinner label="Loading…" />
      </Card>
    );
  }
  return <PricingForm key={JSON.stringify(rules)} rules={rules} />;
}

function PricingForm({ rules }) {
  const toast = useToast();
  const [f, setF] = useState(() => ({
    walmart: String(rules.margin.walmart),
    amazon: String(rules.margin.amazon),
    other: String(rules.margin.other),
    minProfit: String(rules.minProfit),
    purchaseTax: String(rules.purchaseTax),
  }));
  const [saving, setSaving] = useState(false);
  const [checking, setChecking] = useState(false);
  const draft = pricingRules({ margin: { walmart: f.walmart, amazon: f.amazon, other: f.other }, minProfit: f.minProfit, purchaseTax: f.purchaseTax });
  const dirty = JSON.stringify(draft) !== JSON.stringify(rules);
  const set = (k) => (e) => setF((cur) => ({ ...cur, [k]: e.target.value }));

  async function save() {
    setSaving(true);
    try {
      await admin.savePricing(draft);
      toast.success("Prices saved. Use “Update product prices” to apply them to your products.");
    } catch (err) {
      console.error(err);
      toast.error("Could not save. Check your admin permissions (and that the latest Firestore rules are published).");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card
      title="Prices (all cities)"
      actions={
        <Button size="sm" icon={FloppyDisk} onClick={save} loading={saving} disabled={!dirty}>
          Save prices
        </Button>
      }
    >
      <p className="ad-hint">
        Automatic prices start from the supplier’s price plus the tax they charge you, add your margin and round to the nearest price ending in 2.99, 4.99,
        7.99 or 9.99 — never leaving less than the minimum profit. Offers end in .00.
      </p>
      <div className="form-grid">
        <TextField label="Walmart margin (%)" type="number" min="0" value={f.walmart} onChange={set("walmart")} hint="Local pick-up · delivered in 2 hours" />
        <TextField label="Amazon margin (%)" type="number" min="0" value={f.amazon} onChange={set("amazon")} hint="Amazon Prime · 1–2 days" />
        <TextField label="Other suppliers margin (%)" type="number" min="0" value={f.other} onChange={set("other")} />
        <TextField label="Minimum profit per item ($)" type="number" min="0" step="0.5" value={f.minProfit} onChange={set("minProfit")} hint="Cheap items still earn this much." />
        <TextField
          className="span-2"
          label="Tax the supplier charges you (%)"
          type="number"
          min="0"
          value={f.purchaseTax}
          onChange={set("purchaseTax")}
          hint="13% HST in Ontario, counted as part of your cost. Use 0 if you get it back as a tax credit."
        />
      </div>
      <ul className="ad-price-examples" aria-label="Examples">
        {EXAMPLES.map(([supplier, price]) => {
          const r = sellingPrices({ supplier, supplierPrice: price }, draft);
          return (
            <li key={`${supplier}${price}`}>
              <span>
                {SUPPLIERS[supplier].name} {money(price)}
              </span>
              <ArrowRight size={14} weight="bold" aria-hidden="true" />
              <strong>{money(r.price)}</strong>
              <small>profit {money(r.profit)}</small>
            </li>
          );
        })}
      </ul>
      {checking ? (
        <RepriceBox rules={rules} onClose={() => setChecking(false)} />
      ) : (
        <div>
          <Button variant="secondary" size="sm" icon={ArrowsClockwise} onClick={() => setChecking(true)} disabled={dirty}>
            Update product prices…
          </Button>
          {dirty && <p className="ad-hint">Save first, then update the products.</p>}
        </div>
      )}
    </Card>
  );
}

/** Which products with automatic prices would change, and applying it. */
function RepriceBox({ rules, onClose }) {
  const toast = useToast();
  const products = useCollection("products");
  const privates = useCollection("productsPrivate");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(0);
  const ready = products.status !== "loading" && privates.status !== "loading";

  const plan = useMemo(() => {
    if (!ready) return null;
    const byId = new Map(products.data.map((p) => [p.id, p]));
    const auto = privates.data.filter((v) => v.autoPrice && byId.has(v.id));
    const changes = auto.map((v) => priceChange(byId.get(v.id), v, rules)).filter(Boolean);
    return { auto: auto.length, changes, byId };
  }, [ready, products.data, privates.data, rules]);

  if (!plan) return <Spinner label="Checking prices…" />;

  async function apply() {
    setBusy(true);
    try {
      await admin.applyPrices(plan.changes, setDone);
      toast.success(`${plan.changes.length} prices updated`);
      onClose();
    } catch (err) {
      console.error(err);
      toast.error("Could not update every price. Try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="ad-reprice">
      <p>
        <strong>{plan.auto}</strong> products use automatic prices · <strong>{plan.changes.length}</strong> need a new price.
        <span className="ad-hint">Products with a price you typed yourself are not changed.</span>
      </p>
      {plan.changes.length > 0 && (
        <ul className="ad-reprice__list">
          {plan.changes.slice(0, 8).map((c) => {
            const before = normalizeProduct(plan.byId.get(c.id));
            return (
              <li key={c.id}>
                <span>{before.name}</span>
                <span>
                  {money(before.price)} <ArrowRight size={12} weight="bold" aria-hidden="true" /> <strong>{money(c.pricing.currentPrice || c.pricing.price)}</strong>
                </span>
              </li>
            );
          })}
          {plan.changes.length > 8 && <li className="ad-hint">…and {plan.changes.length - 8} more</li>}
        </ul>
      )}
      <div className="ad-reprice__actions">
        {plan.changes.length > 0 && (
          <Button size="sm" icon={ArrowsClockwise} onClick={apply} loading={busy}>
            {busy ? `Updating… ${done}/${plan.changes.length}` : `Update ${plan.changes.length} prices`}
          </Button>
        )}
        <Button size="sm" variant="ghost" onClick={onClose} disabled={busy}>
          {plan.changes.length ? "Cancel" : "Close"}
        </Button>
      </div>
    </div>
  );
}
