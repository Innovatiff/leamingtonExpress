import { useMemo, useRef, useState } from "react";
import { CloudArrowUp, Megaphone, PencilSimple, Plus, Trash, X } from "@phosphor-icons/react";
import * as admin from "@backend/admin";
import Button from "@/components/ui/Button";
import { TextAreaField, TextField } from "@/components/ui/Field";
import { Notice, SmartImage, Spinner } from "@/components/ui/Misc";
import { Modal } from "@/components/ui/Overlay";
import { useCatalog } from "@/context/CatalogContext";
import { useToast } from "@/context/ToastContext";
import { HouseAd, SideAd, SponsoredBanner } from "@/features/ads/Ads";
import { AD_THEMES, adState, normalizeAd, safeUrl } from "@/lib/ads";
import { money } from "@/lib/format";
import { Card, Empty, ErrorNote, PageHead, Pill, Segmented, Toggle, useAdminCity, useConfirm } from "../components/AdminUI";
import { matches, shortDate, useCollection } from "../lib";
import { canUpload, uploadImage } from "../upload";

// Ads are saved with the city settings (express_settings/{city}.ads): the
// website already loads those, so new ads show right away. See lib/ads.js.

const STATE = { live: ["Showing", "green"], scheduled: ["Starts later", "blue"], ended: ["Ended", "neutral"], off: ["Off", "neutral"] };
const THEME_LABELS = { light: "White", blue: "Blue", red: "Red", dark: "Black", green: "Green", gold: "Yellow", purple: "Purple" };
// [key, short name, switch label]
const PAGES = [
  ["shop", "Shop", "Shop page"],
  ["travel", "Travel", "Travel page and each trip's page"],
];
const KINDS = [
  { value: "side", label: "Local business (side)" },
  { value: "banner", label: "Sponsored banner" },
];

const newId = () => `ad-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
const blank = (kind) => ({ ...normalizeAd({ kind }), id: newId() });
const day = (d) => (d ? shortDate(new Date(`${d}T12:00:00`)) : "");

function when(ad) {
  if (ad.startsAt && ad.endsAt) return `${day(ad.startsAt)} – ${day(ad.endsAt)}`;
  if (ad.startsAt) return `from ${day(ad.startsAt)}`;
  if (ad.endsAt) return `until ${day(ad.endsAt)}`;
  return "no end date";
}

export default function Ads() {
  const { city } = useAdminCity();
  const toast = useToast();
  const [confirm, confirmDialog] = useConfirm();
  const { status, data, error } = useCollection("settings");
  const [editing, setEditing] = useState(null);
  const saved = data.find((s) => s.id === city) || null;
  const ads = useMemo(() => (Array.isArray(saved?.ads) ? saved.ads.map(normalizeAd) : []), [saved]);

  async function saveList(next, message) {
    try {
      await admin.saveSettings(city, { ads: next });
      if (message) toast.success(message);
      return true;
    } catch (err) {
      console.error(err);
      toast.error("Could not save the ads. Check your admin permissions.");
      return false;
    }
  }

  const upsert = (ad) => saveList(ads.some((a) => a.id === ad.id) ? ads.map((a) => (a.id === ad.id ? ad : a)) : [...ads, ad], "Ad saved — the website shows it right away");
  const toggle = (ad) => saveList(ads.map((a) => (a.id === ad.id ? { ...a, active: !a.active } : a)), ad.active ? "Ad turned off" : "Ad turned on");
  async function remove(ad) {
    const ok = await confirm({ title: `Delete "${ad.name || ad.title || "this ad"}"?`, message: "It disappears from the website right away.", confirmLabel: "Delete ad", danger: true });
    if (ok) await saveList(ads.filter((a) => a.id !== ad.id), "Ad deleted");
  }

  if (status === "loading") {
    return (
      <div className="ad-page-loading">
        <Spinner label="Loading…" />
      </div>
    );
  }

  const side = ads.filter((a) => a.kind === "side");
  const banners = ads.filter((a) => a.kind === "banner");
  const showing = (list) => list.filter((a) => adState(a) === "live").length;
  const tile = (ad) => <AdTile key={ad.id} ad={ad} onEdit={() => setEditing({ ...ad })} onToggle={() => toggle(ad)} onDelete={() => remove(ad)} />;

  return (
    <div className="ad-page">
      <PageHead
        title="Ads"
        subtitle="Local businesses and restaurants beside the shop and travel pages, and sponsored products between sections."
        actions={
          <>
            <Button size="sm" variant="secondary" icon={Plus} onClick={() => setEditing(blank("banner"))}>
              Sponsored banner
            </Button>
            <Button size="sm" icon={Plus} onClick={() => setEditing(blank("side"))}>
              Local business ad
            </Button>
          </>
        }
      />
      <ErrorNote error={error} />

      <Card title={`Local businesses (sides) · ${showing(side)} showing`}>
        <p className="ad-hint">
          On computers they show in the columns left and right of the page, one at a time (they change every few seconds when there are several). On phones and tablets they show as a row of cards. Empty spots
          invite businesses to advertise and link to the contact form.
        </p>
        {side.length ? (
          <div className="ads-admin-grid">{side.map(tile)}</div>
        ) : (
          <div className="ads-admin-empty">
            <div className="ads-preview-side" inert>
              <HouseAd />
            </div>
            <Empty icon={Megaphone} title="No local business ads yet" text="Until there's one, the columns show this invitation to advertise.">
              <Button icon={Plus} onClick={() => setEditing(blank("side"))}>
                Local business ad
              </Button>
            </Empty>
          </div>
        )}
      </Card>

      <Card title={`Sponsored banners · ${showing(banners)} showing`}>
        <p className="ad-hint">Wide banners between sections, for a sponsored product or brand. They only appear when there's one; several take turns in the different spots.</p>
        {banners.length ? (
          <div className="ads-admin-list">{banners.map(tile)}</div>
        ) : (
          <Empty icon={Megaphone} title="No sponsored banners yet" text="A banner can link to a product of the store and show its photo and price.">
            <Button variant="secondary" icon={Plus} onClick={() => setEditing(blank("banner"))}>
              Sponsored banner
            </Button>
          </Empty>
        )}
      </Card>

      {editing && <AdEditor key={editing.id} initial={editing} isNew={!ads.some((a) => a.id === editing.id)} onClose={() => setEditing(null)} onSave={upsert} />}
      {confirmDialog}
    </div>
  );
}

function AdTile({ ad, onEdit, onToggle, onDelete }) {
  const [label, tone] = STATE[adState(ad)];
  const name = ad.name || ad.title || "Untitled ad";
  return (
    <div className={`ads-admin-tile ads-admin-tile--${ad.kind}`}>
      <button type="button" className="ads-admin-tile__preview" onClick={onEdit} aria-label={`Edit ${name}`}>
        <span className={ad.kind === "side" ? "ads-preview-side" : "ads-preview-banner"} inert>
          {ad.kind === "side" ? <SideAd ad={ad} preview /> : <SponsoredBanner ad={ad} preview />}
        </span>
      </button>
      <div className="ads-admin-tile__info">
        <strong>{name}</strong>
        <span className="ad-cell-sub">
          {ad.pages.map((p) => PAGES.find(([k]) => k === p)?.[1]).join(" + ")} · {when(ad)}
        </span>
        <Pill tone={tone}>{label}</Pill>
      </div>
      <div className="ad-row-actions">
        <Toggle checked={ad.active} onChange={onToggle} label={<span className="sr-only">Active</span>} />
        <Button variant="ghost" size="sm" square icon={PencilSimple} aria-label={`Edit ${name}`} onClick={onEdit} />
        <Button variant="ghost" size="sm" square icon={Trash} className="ad-danger-text" aria-label={`Delete ${name}`} onClick={onDelete} />
      </div>
    </div>
  );
}

function AdEditor({ initial, isNew, onClose, onSave }) {
  const [f, setF] = useState(initial);
  const [saving, setSaving] = useState(false);
  const [touched, setTouched] = useState(false);
  const set = (patch) => setF((cur) => ({ ...cur, ...patch }));
  const banner = f.kind === "banner";

  const errors = {
    url: f.url.trim() && !safeUrl(f.url) ? "Use a full link (https://…), a page of this site (/tienda/…), tel: or mailto:." : "",
    content: f.creative || f.image || f.title.trim() || f.name.trim() || (banner && f.productId) ? "" : banner ? "Add a headline, a product or your own design." : "Add a name, a headline, a photo or your own design.",
    pages: f.pages.length ? "" : "Choose at least one page.",
    dates: f.startsAt && f.endsAt && f.endsAt < f.startsAt ? "The last day is before the first day." : "",
  };
  const preview = normalizeAd(f);

  async function save() {
    if (Object.values(errors).some(Boolean)) {
      setTouched(true);
      return;
    }
    setSaving(true);
    if (await onSave(normalizeAd(f))) onClose();
    else setSaving(false);
  }

  return (
    <Modal
      open
      wide
      className={`ads-editor-modal ${banner ? "ads-editor-modal--banner" : ""}`}
      onClose={onClose}
      title={isNew ? (banner ? "New sponsored banner" : "New local business ad") : `Edit ${initial.name || initial.title || "ad"}`}
      footer={
        <div className="ad-modal-actions">
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={save} loading={saving}>
            {isNew ? "Create ad" : "Save"}
          </Button>
        </div>
      }
    >
      <div className="ads-editor">
        <div className="ads-editor__form">
          {isNew && <Segmented label="Kind of ad" options={KINDS} value={f.kind} onChange={(kind) => set({ kind, theme: kind === "banner" ? "blue" : "light" })} />}
          <div className="form-grid">
            <TextField label={banner ? "Brand" : "Business name"} value={f.name} onChange={(e) => set({ name: e.target.value })} placeholder={banner ? "Samsung" : "Taquería El Sol"} maxLength={80} data-autofocus />
            <TextField label="Headline" value={f.title} onChange={(e) => set({ title: e.target.value })} placeholder={banner ? "Samsung week at Express" : "Taco Tuesday 2×1"} maxLength={120} />
          </div>
          <TextAreaField label="Text" optional="optional" rows={2} value={f.text} onChange={(e) => set({ text: e.target.value })} placeholder={banner ? "TVs and phones delivered in 2 hours in Leamington." : "Homemade tacos al pastor and fresh aguas frescas."} maxLength={240} />
          <TextField
            label={banner ? "Small print" : "Address or hours"}
            optional="optional"
            value={f.note}
            onChange={(e) => set({ note: e.target.value })}
            placeholder={banner ? "*While supplies last." : "Talbot St E, Leamington · open until 10 p.m."}
            maxLength={140}
          />
          <div className="form-grid">
            <TextField label="Button" optional="optional" value={f.cta} onChange={(e) => set({ cta: e.target.value })} placeholder={banner ? "Shop now" : "See the menu"} maxLength={40} />
            <TextField
              label="Link"
              optional={banner && f.productId ? "optional" : undefined}
              value={f.url}
              onChange={(e) => set({ url: e.target.value })}
              placeholder="https://…"
              error={errors.url}
              hint={banner && f.productId ? "Empty = the product's page." : "Their website, Facebook page, menu or a page of this site."}
            />
          </div>

          {banner && <ProductPicker value={f.productId} onChange={(productId) => set({ productId })} />}
          <ImageInput
            label="Photo"
            optional="optional"
            value={f.image}
            onChange={(image) => set({ image })}
            hint={banner ? "Empty = the product's photo." : "The food, the place or the products. A wide photo works best."}
          />
          {banner && (f.image || f.productId) && (
            <div className="field">
              <span className="field__label">Photo in the circle</span>
              <Segmented
                label="Photo in the circle"
                options={[
                  { value: "", label: "Automatic" },
                  { value: "cover", label: "Fill it" },
                  { value: "contain", label: "Whole product" },
                ]}
                value={f.fit}
                onChange={(fit) => set({ fit })}
              />
            </div>
          )}
          <ImageInput
            label="Their own design"
            optional="optional"
            value={f.creative}
            onChange={(creative) => set({ creative })}
            hint={banner ? "A finished banner replaces everything above. Best size: 1200 × 200 px." : "A finished ad replaces everything above. Best size: 300 × 600 px."}
          />
          <ThemePicker value={f.theme} onChange={(theme) => set({ theme })} />

          <div className="field">
            <span className="field__label">Show on</span>
            <div className="ads-editor__pages">
              {PAGES.map(([key, , label]) => (
                <Toggle key={key} checked={f.pages.includes(key)} onChange={(on) => set({ pages: on ? [...new Set([...f.pages, key])] : f.pages.filter((p) => p !== key) })} label={label} />
              ))}
            </div>
            {touched && errors.pages && <span className="field__error">{errors.pages}</span>}
          </div>
          <div className="form-grid">
            <TextField label="First day" optional="optional" type="date" value={f.startsAt} onChange={(e) => set({ startsAt: e.target.value })} />
            <TextField label="Last day" optional="optional" type="date" value={f.endsAt} onChange={(e) => set({ endsAt: e.target.value })} error={errors.dates} hint="Empty = until you turn it off." />
          </div>
          <Toggle checked={f.active} onChange={(active) => set({ active })} label="Active" hint="Off = saved but not shown." />
          {touched && errors.content && <Notice tone="error">{errors.content}</Notice>}
        </div>

        <div className="ads-editor__preview">
          <span className="field__label">Preview</span>
          {banner ? (
            <>
              <div className="ads-preview-banner" inert>
                <SponsoredBanner ad={preview} preview />
              </div>
              <span className="field__label">On a phone</span>
              <div className="ads-preview-banner ads-preview-banner--phone" inert>
                <SponsoredBanner ad={preview} preview />
              </div>
            </>
          ) : (
            <div className="ads-preview-side" inert>
              <SideAd ad={preview} preview />
            </div>
          )}
        </div>
      </div>
    </Modal>
  );
}

/** A photo: upload it (Cloudinary) or paste a link. */
function ImageInput({ label, optional, value, onChange, hint }) {
  const toast = useToast();
  const fileRef = useRef(null);
  const [busy, setBusy] = useState(false);

  async function onFile(file) {
    if (!file) return;
    setBusy(true);
    try {
      onChange(await uploadImage(file, "express/ads", 1400));
      toast.success("Photo added");
    } catch (err) {
      toast.error(err.message || "Upload failed.");
    } finally {
      setBusy(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  return (
    <div className="ads-image-input">
      {value && (
        <span className="ads-image-input__thumb">
          <SmartImage src={value} alt="" w={160} fit="cover" />
        </span>
      )}
      <TextField label={label} optional={optional} value={value} onChange={(e) => onChange(e.target.value.trim())} placeholder={canUpload ? "Upload a photo or paste its link" : "https://…"} hint={hint} />
      <div className="ads-image-input__actions">
        {canUpload && (
          <>
            <input ref={fileRef} type="file" accept="image/*" hidden onChange={(e) => onFile(e.target.files?.[0])} />
            <Button size="sm" variant="secondary" icon={CloudArrowUp} loading={busy} onClick={() => fileRef.current?.click()}>
              Upload
            </Button>
          </>
        )}
        {value && (
          <Button size="sm" variant="ghost" onClick={() => onChange("")}>
            Remove
          </Button>
        )}
      </div>
    </div>
  );
}

/** Pick a product of the store: the banner links to it and shows its photo and price. */
function ProductPicker({ value, onChange }) {
  const { products, byId } = useCatalog();
  const [query, setQuery] = useState("");
  const chosen = value ? byId.get(value) || null : null;
  const results = useMemo(() => (query.trim().length < 2 ? [] : products.filter((p) => matches(query, p.name, p.brand, p.sku)).slice(0, 6)), [query, products]);

  return (
    <div className="field">
      <span className="field__label">
        Product <small>(optional)</small>
      </span>
      {value ? (
        <div className="ads-pick-chosen">
          {chosen ? (
            <>
              <SmartImage src={chosen.image} alt="" w={96} />
              <span>
                <strong>{chosen.name}</strong>
                <small>{money(chosen.price)}</small>
              </span>
            </>
          ) : (
            <span>
              <strong>Product not found</strong>
              <small>It may have been removed from the store.</small>
            </span>
          )}
          <Button variant="ghost" size="sm" square icon={X} aria-label="Remove the product" onClick={() => onChange("")} />
        </div>
      ) : (
        <>
          <input className="input" type="search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search the store: Samsung TV…" aria-label="Search a product" />
          {results.length > 0 && (
            <ul className="ads-pick-results">
              {results.map((p) => (
                <li key={p.id}>
                  <button
                    type="button"
                    onClick={() => {
                      onChange(p.id);
                      setQuery("");
                    }}
                  >
                    <SmartImage src={p.image} alt="" w={80} />
                    <span>{p.name}</span>
                    <small>{money(p.price)}</small>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </>
      )}
      <span className="field__hint">The banner then links to the product and shows its photo and price.</span>
    </div>
  );
}

function ThemePicker({ value, onChange }) {
  return (
    <div className="field">
      <span className="field__label">Colour</span>
      <div className="ads-swatches" role="radiogroup" aria-label="Colour">
        {AD_THEMES.map((theme) => (
          <button
            key={theme}
            type="button"
            role="radio"
            aria-checked={value === theme}
            title={THEME_LABELS[theme]}
            className={`ads-swatch ads-swatch--${theme} ${value === theme ? "is-active" : ""}`}
            onClick={() => onChange(theme)}
          >
            <span className="sr-only">{THEME_LABELS[theme]}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
