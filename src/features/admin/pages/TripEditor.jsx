import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { ArrowLeft, CloudArrowUp, Eye, FloppyDisk, Trash, Warning } from "@phosphor-icons/react";
import * as admin from "@backend/admin";
import Button from "@/components/ui/Button";
import { Checkbox, SelectField, TextField } from "@/components/ui/Field";
import { Notice, Photo, Spinner } from "@/components/ui/Misc";
import { useToast } from "@/context/ToastContext";
import TripCard from "@/features/travel/components/TripCard";
import { DEFAULT_TRIPS, MEAL_LABELS, TRIP_CATEGORIES, TRIP_TYPES } from "@/features/travel/data/trips";
import { invalidateTrips, normalizeTrip, upcomingDepartures } from "@/features/travel/lib/trips";
import { money } from "@/lib/format";
import { slugify } from "@/lib/text";
import { Card, PageHead, Toggle, useAdminCity, useConfirm } from "../components/AdminUI";
import { BiInput, ListEditor, PickMany } from "../components/Fields";
import { PhotoFields } from "../components/PhotoFields";
import { TripProfitCard } from "../components/TravelCosts";
import { useCollection, weekdayDate } from "../lib";
import { canUpload, uploadImage } from "../upload";

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((label, value) => ({ value, label }));
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"].map((label, i) => ({ value: i + 1, label }));
const WEEKS = ["1st", "2nd", "3rd", "4th", "5th"].map((label, i) => ({ value: i + 1, label }));
const BI = { es: "", en: "" };
const NO_PHOTO = { image: "", photoBy: "", photoLicense: "", photoLink: "", photoMatch: "" };
const ACTIVITY = [
  { value: "", label: "Not shown" },
  { value: "easy", label: "Easy — short walks" },
  { value: "moderate", label: "Moderate — 1 to 2 hours walking" },
  { value: "active", label: "Active — hiking or sports" },
];

function blankTrip(city) {
  return {
    id: "",
    type: "day",
    categories: [],
    featured: false,
    active: true,
    order: 50,
    image: "",
    photoBy: "",
    photoLicense: "",
    photoLink: "",
    cities: [city],
    destination: "",
    title: { ...BI },
    tagline: { ...BI },
    summary: { ...BI },
    durationDays: 1,
    nights: 0,
    distanceKm: 0,
    driveTime: "",
    activity: "",
    departure: { time: "07:00", returnTime: "21:00" },
    schedule: { weekdays: [6], months: [], weeks: [], dates: [], blackout: [] },
    groupSize: 14,
    priceAdult: 0,
    priceChild: null,
    childAges: "3–12",
    singleSupplement: 0,
    offer: null,
    passport: false,
    adultsOnly: false,
    highlights: [],
    includes: [],
    excludes: [],
    itinerary: [{ day: 1, title: { ...BI }, items: [] }],
    sights: [],
    hotels: [],
    meals: [],
    breakdown: [],
    ops: {},
    notes: { ...BI },
    goodToKnow: [],
  };
}

/** Fill the fields the editor needs, keeping everything else as saved. */
function prepare(raw, city, copy) {
  const t = { ...blankTrip(city), ...structuredClone(raw || {}) };
  t.schedule = { weekdays: [], months: [], weeks: [], dates: [], blackout: [], ...(t.schedule || {}) };
  t.departure = { time: "", returnTime: "", ...(t.departure || {}) };
  t.offer = t.offer ? { pct: Number(t.offer.pct) || 0, label: { ...BI, ...(t.offer.label || {}) } } : { pct: 0, label: { ...BI } };
  t.ops = { ...(t.ops || {}) };
  t.active = t.active !== false;
  if (copy) {
    t.id = "";
    t.title = { es: `${t.title?.es || ""} (copia)`, en: `${t.title?.en || ""} (copy)` };
    t.active = false;
  }
  delete t.updatedAt;
  return t;
}

function toDoc(t) {
  const n = (v) => (v === "" || v == null ? 0 : Number(v));
  const doc = {
    ...t,
    priceAdult: n(t.priceAdult),
    priceChild: t.adultsOnly || t.priceChild === "" || t.priceChild == null ? null : Number(t.priceChild),
    singleSupplement: n(t.singleSupplement),
    groupSize: n(t.groupSize) || 14,
    distanceKm: n(t.distanceKm),
    driveTime: String(t.driveTime || "").trim(),
    ops: Object.fromEntries(Object.entries(t.ops || {}).filter(([, v]) => v !== "" && v != null).map(([k, v]) => [k, k === "vehicle" ? v : n(v)])),
    durationDays: Math.max(1, n(t.durationDays)),
    nights: Math.max(0, n(t.nights)),
    order: n(t.order),
    offer: Number(t.offer?.pct) > 0 ? { pct: Math.min(90, Number(t.offer.pct)), label: t.offer.label } : null,
    breakdown: (t.breakdown || []).map((b) => ({ ...b, amount: n(b.amount) })),
    hotels: (t.hotels || []).map((h) => ({ ...h, stars: n(h.stars), nights: n(h.nights) })),
    sights: (t.sights || []).filter((x) => x.name?.es || x.name?.en),
    goodToKnow: (t.goodToKnow || []).filter((x) => x.es || x.en),
    meals: (t.meals || []).map((m) => ({ ...m, day: Math.max(1, n(m.day)) })),
    itinerary: (t.itinerary || []).map((d, i) => ({ ...d, day: i + 1 })),
    schedule: {
      ...t.schedule,
      dates: (t.schedule.dates || []).filter(Boolean).sort(),
      blackout: (t.schedule.blackout || []).filter(Boolean).sort(),
    },
  };
  delete doc.fromPrice;
  delete doc.offerPct;
  // Old illustration settings (trips now use photos)
  delete doc.scene;
  delete doc.palette;
  return doc;
}

export default function TripEditor() {
  const { id } = useParams();
  const [params] = useSearchParams();
  const { city } = useAdminCity();
  const copyId = params.get("copia");
  const trips = useCollection("trips");
  if (trips.status === "loading") {
    return (
      <div className="ad-page-loading">
        <Spinner label="Loading…" />
      </div>
    );
  }
  const sourceId = id || copyId;
  const raw = sourceId ? trips.data.find((t) => t.id === sourceId) || (copyId ? DEFAULT_TRIPS.find((t) => t.id === copyId) : null) : null;
  if (id && !raw) {
    return (
      <div className="ad-page">
        <PageHead title="Trip not found" actions={<Button to="/admin/viajes">Back to trips</Button>} />
        <Notice tone="warning">This trip may have been deleted, or the built-in trips haven’t been published yet.</Notice>
      </div>
    );
  }
  return <TripForm key={`${id || "new"}-${copyId || ""}`} id={id} initial={prepare(raw, city, !id && !!copyId)} existingIds={trips.data.map((t) => t.id)} />;
}

function TripForm({ id, initial, existingIds }) {
  const toast = useToast();
  const navigate = useNavigate();
  const [confirm, confirmDialog] = useConfirm();
  const [t, setT] = useState(initial);
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [touched, setTouched] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef(null);

  const set = (patch) => {
    setT((cur) => ({ ...cur, ...patch }));
    setDirty(true);
  };
  const setIn = (key, patch) => set({ [key]: { ...t[key], ...patch } });

  useEffect(() => {
    if (!dirty) return undefined;
    const warn = (e) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);

  const slug = id || t.id || slugify(t.title.es || t.title.en);
  const preview = useMemo(() => normalizeTrip({ ...toDoc(t), id: slug || "preview" }), [t, slug]);
  const departures = useMemo(() => upcomingDepartures(preview, { count: 6 }), [preview]);
  const breakdownSum = (t.breakdown || []).reduce((s, b) => s + (Number(b.amount) || 0), 0);
  const errors = {
    title: !t.title.es.trim() || !t.title.en.trim() ? "Write the title in Spanish and English." : "",
    destination: !t.destination.trim() ? "Write the destination." : "",
    priceAdult: !(Number(t.priceAdult) > 0) ? "Set the adult price." : "",
    slug: !id && (!slug || existingIds.includes(slug)) ? (slug ? "Another trip already uses this web address." : "Write a web address.") : "",
  };
  const hasErrors = Object.values(errors).some(Boolean);
  const err = (k) => (touched ? errors[k] : "");

  async function save() {
    if (hasErrors) {
      setTouched(true);
      toast.error("Please fix the highlighted fields.");
      return;
    }
    setSaving(true);
    try {
      await admin.saveTrip(slug, { ...toDoc(t), id: slug });
      invalidateTrips();
      setDirty(false);
      toast.success(id ? "Trip saved" : "Trip created");
      if (!id) navigate(`/admin/viajes/${encodeURIComponent(slug)}`, { replace: true });
    } catch (e) {
      console.error(e);
      toast.error("Could not save the trip. Check your admin permissions.");
    } finally {
      setSaving(false);
    }
  }

  async function remove() {
    const ok = await confirm({ title: "Delete this trip?", message: "Bookings already made keep their details.", confirmLabel: "Delete trip", danger: true });
    if (!ok) return;
    try {
      await admin.deleteRecord("trips", id);
      invalidateTrips();
      setDirty(false);
      toast.success("Trip deleted");
      navigate("/admin/viajes", { replace: true });
    } catch (e) {
      console.error(e);
      toast.error("Could not delete the trip.");
    }
  }

  async function onFile(file) {
    if (!file) return;
    setUploading(true);
    try {
      const url = await uploadImage(file, "express/trips");
      set({ image: url, photoBy: "", photoLicense: "", photoLink: "" });
      toast.success("Photo added");
    } catch (e) {
      toast.error(e.message || "Upload failed.");
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  return (
    <div className="ad-page">
      <PageHead
        title={id ? t.title.en || t.title.es || "Edit trip" : "New trip"}
        subtitle={
          <Link to="/admin/viajes" className="ad-link">
            <ArrowLeft size={14} weight="bold" /> All trips
          </Link>
        }
        actions={
          <>
            {id && (
              <Button variant="secondary" size="sm" icon={Eye} href={`/viajes/${encodeURIComponent(id)}`} target="_blank" rel="noreferrer">
                View on website
              </Button>
            )}
            <Button size="sm" icon={FloppyDisk} onClick={save} loading={saving}>
              {id ? "Save" : "Create trip"}
            </Button>
          </>
        }
      />

      <div className="ad-editor">
        <div className="ad-editor__main">
          <Card title="Trip">
            <div className="form-grid">
              <BiInput label="Title" value={t.title} onChange={(title) => set({ title })} />
              {touched && errors.title && <span className="field__error span-2">{errors.title}</span>}
              <TextField label="Destination" value={t.destination} onChange={(e) => set({ destination: e.target.value })} error={err("destination")} placeholder="Niagara Falls, ON" />
              <TextField
                label="Web address"
                value={slug}
                disabled={!!id}
                onChange={(e) => set({ id: slugify(e.target.value) })}
                error={err("slug")}
                hint={`leamingtonexpress.ca/viajes/${slug || "…"}`}
              />
              <SelectField label="Type" value={t.type} onChange={(e) => set({ type: e.target.value })} options={Object.entries(TRIP_TYPES).map(([value, l]) => ({ value, label: l.en }))} />
              <TextField label="Order on the website" type="number" value={t.order} onChange={(e) => set({ order: e.target.value })} hint="Lower numbers show first." />
              <TextField label="Distance from Leamington (km, one way)" type="number" min="0" value={t.distanceKm || ""} onChange={(e) => set({ distanceKm: e.target.value })} hint="Also used for the fuel cost." />
              <TextField label="Time on the road (one way)" value={t.driveTime || ""} onChange={(e) => set({ driveTime: e.target.value })} placeholder="3 h 30 min" />
              <SelectField className="span-2" label="Activity level" value={t.activity || ""} onChange={(e) => set({ activity: e.target.value })} options={ACTIVITY} />
              <BiInput label="Short description (card)" value={t.tagline} onChange={(tagline) => set({ tagline })} />
              <BiInput label="Overview" value={t.summary} onChange={(summary) => set({ summary })} textarea rows={4} />
            </div>
            <div className="ad-checks">
              {TRIP_CATEGORIES.map((c) => (
                <Checkbox key={c.key} label={c.label.en} checked={t.categories.includes(c.key)} onChange={(e) => set({ categories: e.target.checked ? [...t.categories, c.key] : t.categories.filter((k) => k !== c.key) })} />
              ))}
            </div>
          </Card>

          <Card title="Schedule">
            <div className="form-grid">
              <TextField label="Days" type="number" min="1" value={t.durationDays} onChange={(e) => set({ durationDays: e.target.value })} />
              <TextField label="Nights (hotel)" type="number" min="0" value={t.nights} onChange={(e) => set({ nights: e.target.value })} />
              <TextField label="Departure time" type="time" value={t.departure.time} onChange={(e) => setIn("departure", { time: e.target.value })} />
              <TextField label="Approx. return time" type="time" value={t.departure.returnTime} onChange={(e) => setIn("departure", { returnTime: e.target.value })} />
            </div>
            <PickMany label="Departs on" options={WEEKDAYS} value={t.schedule.weekdays} onChange={(weekdays) => setIn("schedule", { weekdays })} />
            <PickMany label="Months (none = all year)" options={MONTHS} value={t.schedule.months} onChange={(months) => setIn("schedule", { months })} />
            <PickMany label="Only these weeks of the month (none = every week)" options={WEEKS} value={t.schedule.weeks} onChange={(weeks) => setIn("schedule", { weeks })} />
            <div className="form-grid">
              <div className="field">
                <span className="field__label">Specific dates (replace the pattern above)</span>
                <ListEditor
                  compact
                  itemLabel="date"
                  items={t.schedule.dates}
                  onChange={(dates) => setIn("schedule", { dates })}
                  newItem=""
                  addLabel="Add date"
                  renderItem={(d, update) => <input className="input" type="date" value={d} onChange={(e) => update(e.target.value)} aria-label="Date" />}
                />
              </div>
              <div className="field">
                <span className="field__label">No departure on</span>
                <ListEditor
                  compact
                  itemLabel="date"
                  items={t.schedule.blackout}
                  onChange={(blackout) => setIn("schedule", { blackout })}
                  newItem=""
                  addLabel="Add date"
                  renderItem={(d, update) => <input className="input" type="date" value={d} onChange={(e) => update(e.target.value)} aria-label="Blocked date" />}
                />
              </div>
            </div>
            <p className="ad-hint">
              <strong>Next departures:</strong> {departures.length ? departures.map((d) => weekdayDate(d)).join(" · ") : "none — check the days and months."}
            </p>
          </Card>

          <Card title="What's included">
            <span className="field__label">Highlights</span>
            <ListEditor items={t.highlights} onChange={(highlights) => set({ highlights })} newItem={{ ...BI }} addLabel="Add highlight" itemLabel="highlight" renderItem={(h, update) => <BiInput value={h} onChange={update} />} />
            <span className="field__label">Includes</span>
            <ListEditor items={t.includes} onChange={(includes) => set({ includes })} newItem={{ ...BI }} addLabel="Add item" itemLabel="included item" renderItem={(h, update) => <BiInput value={h} onChange={update} />} />
            <span className="field__label">Not included</span>
            <ListEditor items={t.excludes} onChange={(excludes) => set({ excludes })} newItem={{ ...BI }} addLabel="Add item" itemLabel="excluded item" renderItem={(h, update) => <BiInput value={h} onChange={update} />} />
          </Card>

          <Card title="What you'll see">
            <p className="ad-hint">The main places of the trip, each with a photo and a few lines.</p>
            <ListEditor
              items={t.sights}
              itemLabel="place"
              onChange={(sights) => set({ sights })}
              newItem={{ name: { ...BI }, text: { ...BI }, ...NO_PHOTO }}
              addLabel="Add place"
              renderItem={(x, update) => (
                <div className="form-grid">
                  <BiInput label="Place" value={x.name} onChange={(name) => update({ ...x, name })} />
                  <BiInput label="A few lines about it" value={x.text} onChange={(text) => update({ ...x, text })} textarea rows={3} />
                  <PhotoFields value={x} onChange={update} />
                </div>
              )}
            />
          </Card>

          <Card title="Itinerary">
            <ListEditor
              items={t.itinerary}
              itemLabel="day"
              onChange={(itinerary) => set({ itinerary })}
              newItem={(items) => ({ day: items.length + 1, title: { ...BI }, items: [] })}
              addLabel="Add day"
              renderItem={(d, update, i) => (
                <div className="ad-day">
                  <strong className="ad-day__n">Day {i + 1}</strong>
                  <BiInput label="Day title" value={d.title} onChange={(title) => update({ ...d, title })} />
                  <ListEditor
                    compact
                    itemLabel="stop"
                    items={d.items || []}
                    onChange={(items) => update({ ...d, items })}
                    newItem={{ time: "", text: { ...BI } }}
                    addLabel="Add stop"
                    renderItem={(it, upd) => (
                      <div className="ad-stop">
                        <input className="input ad-stop__time" type="time" value={it.time} onChange={(e) => upd({ ...it, time: e.target.value })} aria-label="Time" />
                        <BiInput value={it.text} onChange={(text) => upd({ ...it, text })} />
                      </div>
                    )}
                  />
                </div>
              )}
            />
          </Card>

          <Card title="Hotels">
            <ListEditor
              items={t.hotels}
              itemLabel="hotel"
              onChange={(hotels) => set({ hotels })}
              newItem={{ name: "", stars: 3, nights: 1, city: "", address: "", website: "", checkIn: "", checkOut: "", room: { ...BI }, text: { ...BI }, perks: [], ...NO_PHOTO }}
              addLabel="Add hotel"
              renderItem={(h, update) => (
                <div className="form-grid">
                  <TextField label="Hotel name" value={h.name} onChange={(e) => update({ ...h, name: e.target.value })} />
                  <TextField label="City" value={h.city} onChange={(e) => update({ ...h, city: e.target.value })} />
                  <TextField label="Stars" type="number" min="1" max="5" value={h.stars} onChange={(e) => update({ ...h, stars: e.target.value })} />
                  <TextField label="Nights" type="number" min="1" value={h.nights} onChange={(e) => update({ ...h, nights: e.target.value })} />
                  <TextField label="Address" value={h.address || ""} onChange={(e) => update({ ...h, address: e.target.value })} />
                  <TextField label="Website" value={h.website || ""} onChange={(e) => update({ ...h, website: e.target.value.trim() })} placeholder="https://…" />
                  <TextField label="Check-in" value={h.checkIn || ""} onChange={(e) => update({ ...h, checkIn: e.target.value })} placeholder="4:00 p.m." />
                  <TextField label="Check-out" value={h.checkOut || ""} onChange={(e) => update({ ...h, checkOut: e.target.value })} placeholder="11:00 a.m." />
                  <BiInput label="About the hotel" value={h.text} onChange={(text) => update({ ...h, text })} textarea rows={3} />
                  <BiInput label="Room" value={h.room} onChange={(room) => update({ ...h, room })} />
                  <div className="field span-2">
                    <span className="field__label">Perks</span>
                    <ListEditor compact itemLabel="perk" items={h.perks || []} onChange={(perks) => update({ ...h, perks })} newItem={{ ...BI }} addLabel="Add perk" renderItem={(p, upd) => <BiInput value={p} onChange={upd} />} />
                  </div>
                  <PhotoFields value={h} onChange={update} />
                </div>
              )}
            />
          </Card>

          <Card title="Restaurants & meals">
            <ListEditor
              items={t.meals}
              itemLabel="meal"
              onChange={(meals) => set({ meals })}
              newItem={{ day: 1, meal: "lunch", place: "", address: "", website: "", cuisine: { ...BI }, text: { ...BI }, note: { ...BI }, ...NO_PHOTO }}
              addLabel="Add meal"
              renderItem={(m, update) => (
                <div className="form-grid">
                  <TextField label="Day" type="number" min="1" value={m.day} onChange={(e) => update({ ...m, day: e.target.value })} />
                  <SelectField label="Meal" value={m.meal} onChange={(e) => update({ ...m, meal: e.target.value })} options={Object.entries(MEAL_LABELS).map(([value, l]) => ({ value, label: l.en }))} />
                  <TextField className="span-2" label="Restaurant" value={m.place} onChange={(e) => update({ ...m, place: e.target.value })} />
                  <BiInput label="Cuisine / description" value={m.cuisine} onChange={(cuisine) => update({ ...m, cuisine })} />
                  <BiInput label="Note (optional)" value={m.note} onChange={(note) => update({ ...m, note })} placeholder={{ es: "Menú de 2 tiempos", en: "2-course menu" }} />
                  <TextField label="Address" value={m.address || ""} onChange={(e) => update({ ...m, address: e.target.value })} />
                  <TextField label="Website" value={m.website || ""} onChange={(e) => update({ ...m, website: e.target.value.trim() })} placeholder="https://…" />
                  <BiInput label="About the restaurant" value={m.text} onChange={(text) => update({ ...m, text })} textarea rows={3} />
                  <PhotoFields value={m} onChange={update} />
                </div>
              )}
            />
          </Card>

          <Card title="Price breakdown (per adult)">
            <ListEditor
              items={t.breakdown}
              itemLabel="cost line"
              onChange={(breakdown) => set({ breakdown })}
              newItem={{ label: { ...BI }, amount: 0 }}
              addLabel="Add line"
              renderItem={(b, update) => (
                <div className="ad-cost">
                  <BiInput value={b.label} onChange={(label) => update({ ...b, label })} />
                  <input className="input" type="number" min="0" step="1" value={b.amount} onChange={(e) => update({ ...b, amount: e.target.value })} aria-label="Amount" />
                </div>
              )}
            />
            {t.breakdown.length > 0 && (
              <p className={`ad-hint ${Math.round(breakdownSum) === Math.round(Number(t.priceAdult) || 0) ? "ad-good" : "ad-bad"}`}>
                Lines add up to {money(breakdownSum)}
                {Math.round(breakdownSum) !== Math.round(Number(t.priceAdult) || 0) && (
                  <>
                    {" "}
                    <Warning size={14} weight="bold" /> but the adult price is {money(Number(t.priceAdult) || 0)}. Customers see both, so make them match.
                  </>
                )}
              </p>
            )}
          </Card>

          <TripProfitCard trip={t} onChange={set} />

          <Card title="Important information">
            <BiInput label="Notes for travellers" value={t.notes} onChange={(notes) => set({ notes })} textarea rows={3} />
            <Toggle checked={!!t.passport} onChange={(passport) => set({ passport })} label="Passport required (USA trip)" />
            <span className="field__label">Tips for the trip</span>
            <ListEditor
              items={t.goodToKnow}
              onChange={(goodToKnow) => set({ goodToKnow })}
              newItem={{ ...BI }}
              addLabel="Add tip"
              itemLabel="tip"
              renderItem={(g, update) => <BiInput value={g} onChange={update} placeholder={{ es: "Lleva zapatos cómodos…", en: "Bring comfortable shoes…" }} />}
            />
          </Card>
        </div>

        <aside className="ad-editor__side">
          <Card title="Visibility">
            <Toggle checked={t.active} onChange={(active) => set({ active })} label={t.active ? "On the website" : "Hidden"} />
            <Toggle checked={!!t.featured} onChange={(featured) => set({ featured })} label="Featured on the home page" />
          </Card>

          <Card title="Price per person">
            <div className="form-grid">
              <TextField label="Adult" type="number" min="0" value={t.priceAdult} onChange={(e) => set({ priceAdult: e.target.value })} error={err("priceAdult")} />
              <TextField label="Child" type="number" min="0" value={t.priceChild ?? ""} onChange={(e) => set({ priceChild: e.target.value })} disabled={t.adultsOnly} hint="Empty = same as adult" />
              <TextField label="Child ages" value={t.childAges || ""} onChange={(e) => set({ childAges: e.target.value })} disabled={t.adultsOnly} />
              <TextField label="Max group" type="number" min="1" value={t.groupSize} onChange={(e) => set({ groupSize: e.target.value })} />
              <TextField className="span-2" label="Single room supplement" type="number" min="0" value={t.singleSupplement} onChange={(e) => set({ singleSupplement: e.target.value })} hint="Charged when one adult travels alone on hotel trips." />
            </div>
            <Toggle checked={!!t.adultsOnly} onChange={(adultsOnly) => set({ adultsOnly })} label="Adults only (19+)" />
          </Card>

          <Card title="Offer">
            <TextField label="Discount %" type="number" min="0" max="90" value={t.offer.pct} onChange={(e) => setIn("offer", { pct: e.target.value })} hint="0 = no offer" />
            <BiInput label="Offer label" value={t.offer.label} onChange={(label) => setIn("offer", { label })} placeholder={{ es: "Precio de lanzamiento", en: "Launch price" }} />
            {Number(t.offer.pct) > 0 && Number(t.priceAdult) > 0 && (
              <p className="ad-hint ad-good">
                Shows {money(Math.round(Number(t.priceAdult) * (1 - Number(t.offer.pct) / 100)), { whole: true })} instead of {money(Number(t.priceAdult), { whole: true })}.
              </p>
            )}
          </Card>

          <Card
            title="Image"
            actions={
              canUpload && (
                <>
                  <input ref={fileRef} type="file" accept="image/*" hidden onChange={(e) => onFile(e.target.files?.[0])} />
                  <Button size="sm" variant="secondary" icon={CloudArrowUp} loading={uploading} onClick={() => fileRef.current?.click()}>
                    Upload
                  </Button>
                </>
              )
            }
          >
            <div className="ad-trip-art">
              <Photo src={t.image} sizes="360px" w={720} />
            </div>
            <TextField
              label="Photo link"
              value={t.image || ""}
              onChange={(e) => set({ image: e.target.value.trim(), photoBy: "", photoLicense: "", photoLink: "" })}
              placeholder="https://…"
              hint="A landscape photo of the destination. Free photos: unsplash.com (open a photo → right-click → Copy image address)."
            />
            <TextField label="Photographer" optional="optional" value={t.photoBy || ""} onChange={(e) => set({ photoBy: e.target.value })} hint="Shown as a small credit on the trip page." />
            <TextField label="License" optional="optional" value={t.photoLicense || ""} onChange={(e) => set({ photoLicense: e.target.value })} placeholder="CC BY-SA 4.0" />
            <TextField label="Photo page" optional="optional" value={t.photoLink || ""} onChange={(e) => set({ photoLink: e.target.value.trim() })} hint="Where the photo comes from; the credit links to it." />
          </Card>

          <Card title="Website preview">
            <div className="ad-preview ad-preview--travel theme-travel" inert>
              <TripCard trip={preview} />
            </div>
          </Card>

          {id && (
            <Button variant="ghost" icon={Trash} className="ad-danger-text" onClick={remove} block>
              Delete trip
            </Button>
          )}
        </aside>
      </div>

      <div className={`ad-savebar ${dirty ? "is-visible" : ""}`} aria-hidden={!dirty}>
        <span>Unsaved changes</span>
        <Button size="sm" icon={FloppyDisk} onClick={save} loading={saving} tabIndex={dirty ? 0 : -1}>
          {id ? "Save" : "Create trip"}
        </Button>
      </div>
      {confirmDialog}
    </div>
  );
}
