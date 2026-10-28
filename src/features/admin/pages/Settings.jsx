import { useEffect, useState } from "react";
import { FloppyDisk, Warning } from "@phosphor-icons/react";
import * as admin from "@backend/admin";
import Button from "@/components/ui/Button";
import { TextField } from "@/components/ui/Field";
import { Notice, Spinner } from "@/components/ui/Misc";
import { CITIES, DEFAULT_SETTINGS } from "@/config/cities";
import { useToast } from "@/context/ToastContext";
import { money } from "@/lib/format";
import { deepMerge } from "@/lib/merge";
import { Card, ErrorNote, PageHead, Toggle, useAdminCity } from "../components/AdminUI";
import { BiInput, ListEditor } from "../components/Fields";
import { digits, phonePretty, useCollection } from "../lib";

const num = (v) => (v === "" || v == null ? 0 : Number(v));

export default function Settings() {
  const { city } = useAdminCity();
  const { status, data, error } = useCollection("settings");
  if (status === "loading") {
    return (
      <div className="ad-page-loading">
        <Spinner label="Loading…" />
      </div>
    );
  }
  const saved = data.find((s) => s.id === city) || null;
  const initial = deepMerge(deepMerge(DEFAULT_SETTINGS, CITIES[city]?.defaults || {}), saved || {});
  return <SettingsForm key={city} city={city} initial={initial} isNew={!saved} error={error} />;
}

function SettingsForm({ city, initial, isNew, error }) {
  const toast = useToast();
  const [s, setS] = useState(initial);
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);

  const set = (path, value) => {
    setS((cur) => {
      const next = structuredClone(cur);
      const keys = path.split(".");
      let node = next;
      for (const k of keys.slice(0, -1)) node = node[k] = node[k] || {};
      node[keys.at(-1)] = value;
      return next;
    });
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

  async function save() {
    setSaving(true);
    try {
      const doc = {
        announcement: s.announcement,
        contact: { ...s.contact, phone: digits(s.contact.phone), whatsapp: digits(s.contact.whatsapp), email: s.contact.email.trim() },
        store: {
          ...s.store,
          deliveryFee: num(s.store.deliveryFee),
          freeDeliveryOver: num(s.store.freeDeliveryOver),
          etransferEmail: (s.store.etransferEmail || "").trim(),
          promos: {
            ...s.store.promos,
            coupons: (s.store.promos?.coupons || [])
              .map((c) => ({ code: String(c.code || "").trim().toUpperCase(), amount: num(c.amount), minSubtotal: num(c.minSubtotal) }))
              .filter((c) => c.code && c.amount > 0),
          },
        },
        ride: {
          ...s.ride,
          baseFare: num(s.ride.baseFare),
          perKm: num(s.ride.perKm),
          minFare: num(s.ride.minFare),
          xlMultiplier: num(s.ride.xlMultiplier) || 1,
          maxEstimateKm: num(s.ride.maxEstimateKm),
        },
        travel: {
          ...s.travel,
          depositPct: Math.min(100, Math.max(0, num(s.travel.depositPct))),
          groupDiscount: { min: num(s.travel.groupDiscount?.min), pct: Math.min(50, Math.max(0, num(s.travel.groupDiscount?.pct))) },
        },
      };
      await admin.saveSettings(city, doc);
      setDirty(false);
      toast.success("Settings saved — the website updates right away");
    } catch (err) {
      console.error(err);
      toast.error("Could not save the settings. Check your admin permissions.");
    } finally {
      setSaving(false);
    }
  }

  const fare = (km, xl) => {
    let base = num(s.ride.baseFare) + num(s.ride.perKm) * km;
    if (xl) base *= num(s.ride.xlMultiplier) || 1;
    base = Math.max(base, num(s.ride.minFare));
    return `${money(Math.round(base * 0.9), { whole: true })}–${money(Math.round(base * 1.1), { whole: true })}`;
  };

  return (
    <div className="ad-page">
      <PageHead
        title="Settings"
        subtitle={`${CITIES[city]?.brand} website`}
        actions={
          <Button size="sm" icon={FloppyDisk} onClick={save} loading={saving} disabled={!dirty && !isNew}>
            Save settings
          </Button>
        }
      />
      <ErrorNote error={error} />
      {isNew && <Notice tone="info">This city has no saved settings yet — the website uses the defaults below until you save.</Notice>}

      <div className="ad-settings">
        <Card title="Contact">
          <div className="form-grid">
            <TextField label="Phone" inputMode="tel" value={s.contact.phone} onChange={(e) => set("contact.phone", e.target.value)} hint={s.contact.phone ? phonePretty(s.contact.phone) : "Shown in the footer and help pages."} />
            <TextField label="WhatsApp" inputMode="tel" value={s.contact.whatsapp} onChange={(e) => set("contact.whatsapp", e.target.value)} hint="Turns on the green WhatsApp button." />
            <TextField label="Email" type="email" value={s.contact.email} onChange={(e) => set("contact.email", e.target.value)} />
            <TextField label="Address" value={s.contact.address} onChange={(e) => set("contact.address", e.target.value)} placeholder="Leamington, ON" />
            <TextField label="Instagram" value={s.contact.instagram} onChange={(e) => set("contact.instagram", e.target.value)} placeholder="https://instagram.com/…" />
            <TextField label="Facebook" value={s.contact.facebook} onChange={(e) => set("contact.facebook", e.target.value)} placeholder="https://facebook.com/…" />
            <TextField label="TikTok" value={s.contact.tiktok} onChange={(e) => set("contact.tiktok", e.target.value)} placeholder="https://tiktok.com/@…" />
          </div>
        </Card>

        <Card title="Announcement bar">
          <BiInput value={s.announcement} onChange={(v) => set("announcement", v)} placeholder={{ es: "Envío gratis en pedidos de más de $100", en: "Free delivery on orders over $100" }} hint="Shown at the top of every page. Leave empty to hide it." />
        </Card>

        <Card title="Store">
          <Toggle checked={s.store.enabled !== false} onChange={(v) => set("store.enabled", v)} label="Store open" />
          <div className="form-grid">
            <TextField label="Delivery fee ($)" type="number" min="0" step="0.5" value={s.store.deliveryFee} onChange={(e) => set("store.deliveryFee", e.target.value)} />
            <TextField label="Free delivery over ($)" type="number" min="0" value={s.store.freeDeliveryOver} onChange={(e) => set("store.freeDeliveryOver", e.target.value)} hint="0 = never free" />
            <TextField className="span-2" label="E-transfer email" type="email" value={s.store.etransferEmail} onChange={(e) => set("store.etransferEmail", e.target.value)} hint="Shown to customers who pay by Interac e-Transfer." />
          </div>
          <span className="field__label">Payment methods at checkout</span>
          <div className="ad-stack-sm">
            <Toggle checked={!!s.store.payments?.cash} onChange={(v) => set("store.payments.cash", v)} label="Cash on delivery" />
            <Toggle checked={!!s.store.payments?.etransfer} onChange={(v) => set("store.payments.etransfer", v)} label="Interac e-Transfer" />
            <Toggle checked={!!s.store.payments?.card} onChange={(v) => set("store.payments.card", v)} label="Card (Stripe)" hint="Turn on only after the Stripe Cloud Functions and webhook are deployed and tested." />
          </div>
          <BiInput label="Seasonal section title" value={s.store.eventTitle} onChange={(v) => set("store.eventTitle", v)} />
          <BiInput label="Seasonal section subtitle" value={s.store.eventSubtitle} onChange={(v) => set("store.eventSubtitle", v)} />
        </Card>

        <Card title="Store promotions">
          <p className="ad-hint">Coupons advertised at the top of the store home (customers tap to copy the code). Create the same code in Discount codes first: this only shows it.</p>
          <ListEditor
            items={s.store.promos?.coupons || []}
            onChange={(coupons) => set("store.promos.coupons", coupons)}
            newItem={{ code: "", amount: "", minSubtotal: "" }}
            addLabel="Add coupon"
            itemLabel="coupon"
            renderItem={(c, update) => (
              <div className="form-grid">
                <TextField className="span-2" label="Code" value={c.code} onChange={(e) => update({ ...c, code: e.target.value.toUpperCase() })} placeholder="BIENVENIDO10" />
                <TextField label="Amount off ($)" type="number" min="0" value={c.amount} onChange={(e) => update({ ...c, amount: e.target.value })} />
                <TextField label="Minimum order ($)" type="number" min="0" value={c.minSubtotal} onChange={(e) => update({ ...c, minSubtotal: e.target.value })} hint="0 = any order" />
              </div>
            )}
          />
        </Card>

        <Card title="Rides">
          <Toggle checked={s.ride.enabled !== false} onChange={(v) => set("ride.enabled", v)} label="Accept ride requests" />
          <Toggle checked={s.ride.showEstimates !== false} onChange={(v) => set("ride.showEstimates", v)} label="Show price estimates" hint="Customers see a price range before requesting." />
          <div className="form-grid">
            <TextField label="Base fare ($)" type="number" min="0" step="0.5" value={s.ride.baseFare} onChange={(e) => set("ride.baseFare", e.target.value)} />
            <TextField label="Per km ($)" type="number" min="0" step="0.05" value={s.ride.perKm} onChange={(e) => set("ride.perKm", e.target.value)} />
            <TextField label="Minimum fare ($)" type="number" min="0" value={s.ride.minFare} onChange={(e) => set("ride.minFare", e.target.value)} />
            <TextField label="XL multiplier" type="number" min="1" step="0.05" value={s.ride.xlMultiplier} onChange={(e) => set("ride.xlMultiplier", e.target.value)} />
            <TextField label="Estimate up to (km)" type="number" min="0" value={s.ride.maxEstimateKm} onChange={(e) => set("ride.maxEstimateKm", e.target.value)} hint="Longer trips ask for a quote." />
          </div>
          <p className="ad-hint">
            Examples · in town (3 km): <strong>{fare(3)}</strong> · Windsor airport (42 km): <strong>{fare(42)}</strong> · same in XL: <strong>{fare(42, true)}</strong>
          </p>
        </Card>

        <Card title="Travel agency">
          <Toggle checked={s.travel.enabled !== false} onChange={(v) => set("travel.enabled", v)} label="Show the travel agency" />
          <div className="form-grid">
            <TextField label="Deposit (%)" type="number" min="0" max="100" value={s.travel.depositPct} onChange={(e) => set("travel.depositPct", e.target.value)} hint="0 = full payment" />
            <TextField label="Group discount (%)" type="number" min="0" max="50" value={s.travel.groupDiscount?.pct} onChange={(e) => set("travel.groupDiscount.pct", e.target.value)} hint="0 = no group discount" />
            <TextField label="Group from (people)" type="number" min="2" value={s.travel.groupDiscount?.min} onChange={(e) => set("travel.groupDiscount.min", e.target.value)} />
          </div>
          <BiInput label="Pick-up point" value={s.travel.pickupPoint} onChange={(v) => set("travel.pickupPoint", v)} />
          {num(s.travel.groupDiscount?.pct) > 0 && (
            <p className="ad-hint">
              <Warning size={14} weight="bold" /> Group and trip offers don’t add up — customers get whichever is bigger.
            </p>
          )}
        </Card>
      </div>

      <div className={`ad-savebar ${dirty ? "is-visible" : ""}`} aria-hidden={!dirty}>
        <span>Unsaved changes</span>
        <Button size="sm" icon={FloppyDisk} onClick={save} loading={saving} tabIndex={dirty ? 0 : -1}>
          Save settings
        </Button>
      </div>
    </div>
  );
}
