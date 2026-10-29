import { useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ArrowsClockwise, CloudArrowUp, Copy, Eye, EyeSlash, MapTrifold, PencilSimple, Plus, Sparkle, Star, Trash } from "@phosphor-icons/react";
import * as admin from "@backend/admin";
import Button from "@/components/ui/Button";
import { Photo } from "@/components/ui/Misc";
import { CITIES } from "@/config/cities";
import { useToast } from "@/context/ToastContext";
import { DEFAULT_TRIPS, TRIP_TYPES } from "@/features/travel/data/trips";
import { builtInTrip, catalogUpdates, retiredTrips } from "@/features/travel/lib/catalog";
import { tripEconomics } from "@/features/travel/lib/costs";
import { invalidateTrips, nextDeparture, normalizeTrip } from "@/features/travel/lib/trips";
import { money } from "@/lib/format";
import { Card, Empty, ErrorNote, LoadingRows, PageHead, Pill, SearchInput, useAdminCity, useConfirm } from "../components/AdminUI";
import { useTravelCosts } from "../components/TravelCosts";
import { matches, useCollection, weekdayDate } from "../lib";

export default function Trips() {
  const { city } = useAdminCity();
  const toast = useToast();
  const navigate = useNavigate();
  const [confirm, confirmDialog] = useConfirm();
  const { status, data, error } = useCollection("trips");
  const [query, setQuery] = useState("");
  const [publishing, setPublishing] = useState(false);
  const { rules } = useTravelCosts();

  const trips = useMemo(
    () =>
      data
        .filter((t) => (t.cities || []).includes(city))
        .map((t) => normalizeTrip(t))
        .sort((a, b) => a.order - b.order || a.priceAdult - b.priceAdult),
    [data, city],
  );
  const usingDefaults = status === "ready" && trips.length === 0;
  const updates = useMemo(() => (status === "ready" && !usingDefaults ? catalogUpdates(data, city) : []), [status, usingDefaults, data, city]);
  const removals = useMemo(() => (status === "ready" ? retiredTrips(data) : []), [status, data]);
  const removalNames = removals.map((t) => t.title?.es || t.title?.en || t.id).join(", ");
  const shown = (usingDefaults ? DEFAULT_TRIPS.map(normalizeTrip) : trips).filter((t) => matches(query, t.title?.es, t.title?.en, t.destination, t.id));

  const publishDefaults = async () => {
    const ok = await confirm({
      title: `Publish the built-in trips for ${CITIES[city]?.name}?`,
      message: `This copies the ${DEFAULT_TRIPS.length} trips into Firestore so you can edit their prices, dates, hotels and restaurants. From then on the website shows the trips saved here.`,
      confirmLabel: "Publish trips",
    });
    if (!ok) return;
    setPublishing(true);
    try {
      await admin.seedTrips(DEFAULT_TRIPS.map((t) => builtInTrip(t, { cities: [city], active: true })));
      invalidateTrips();
      toast.success("Trips published — you can edit them now");
    } catch (err) {
      console.error(err);
      toast.error("Could not publish the trips. Check your admin permissions.");
    } finally {
      setPublishing(false);
    }
  };

  const updateCatalog = async () => {
    const replaced = updates.filter((u) => !u.isNew).length;
    const added = updates.length - replaced;
    const ok = await confirm({
      title: "Update the built-in trips?",
      message: [
        replaced > 0 && `${replaced} trips are replaced with the new version: real hotels and restaurants with photos, the places you'll visit, tips, and prices that cover renting the van.`,
        added > 0 && `${added} new trips are added.`,
        removals.length > 0 && `These trips are no longer offered and are deleted: ${removalNames} (bookings already made keep their details).`,
        updates.length > 0 && "Changes you made to the updated trips are replaced; whether each one is on the website stays as you set it.",
        "Trips you created yourself don't change.",
      ]
        .filter(Boolean)
        .join(" "),
      confirmLabel: "Update trips",
    });
    if (!ok) return;
    setPublishing(true);
    try {
      if (updates.length) await admin.seedTrips(updates.map((u) => u.trip));
      for (const t of removals) await admin.deleteRecord("trips", t.id);
      invalidateTrips();
      toast.success("Trips updated");
    } catch (err) {
      console.error(err);
      toast.error("Could not update the trips. Check your admin permissions.");
    } finally {
      setPublishing(false);
    }
  };

  const patch = async (trip, changes, message) => {
    try {
      const raw = data.find((t) => t.id === trip.id);
      await admin.saveTrip(trip.id, { ...raw, ...changes });
      invalidateTrips();
      toast.success(message);
    } catch (err) {
      console.error(err);
      toast.error("Could not save the trip.");
    }
  };

  const remove = async (trip) => {
    const ok = await confirm({ title: `Delete “${trip.title?.en || trip.title?.es}”?`, message: "Bookings already made keep their details. Hide the trip instead if it may come back.", confirmLabel: "Delete trip", danger: true });
    if (!ok) return;
    try {
      await admin.deleteRecord("trips", trip.id);
      invalidateTrips();
      toast.success("Trip deleted");
    } catch (err) {
      console.error(err);
      toast.error("Could not delete the trip.");
    }
  };

  return (
    <div className="ad-page">
      <PageHead
        title="Trips"
        subtitle={usingDefaults ? "Built-in catalog (not published yet)" : `${trips.length} trips · ${trips.filter((t) => t.active).length} on the website`}
        actions={
          !usingDefaults && (
            <Button to="/admin/viajes/nuevo" size="sm" icon={Plus}>
              Add trip
            </Button>
          )
        }
      />
      <ErrorNote error={error} />

      {usingDefaults && (
        <div className="ad-alert ad-alert--info">
          <MapTrifold size={24} weight="duotone" />
          <div>
            <strong>The website is showing the built-in trips</strong>
            <p>Publish them to Firestore to change prices, dates, hotels, restaurants or photos — or to add your own trips.</p>
          </div>
          <Button size="sm" icon={CloudArrowUp} onClick={publishDefaults} loading={publishing}>
            Publish trips
          </Button>
        </div>
      )}

      {(updates.length > 0 || removals.length > 0) && (
        <div className="ad-alert ad-alert--info">
          <Sparkle size={24} weight="duotone" />
          <div>
            <strong>New version of the built-in trips</strong>
            <p>
              {updates.length > 0 &&
                `Real hotels and restaurants with photos, the places each trip visits, tips, and prices worked out to cover renting the van (${updates.length} trips). `}
              {removals.length > 0 && `No longer offered, to be removed: ${removalNames}.`}
            </p>
          </div>
          <Button size="sm" icon={ArrowsClockwise} onClick={updateCatalog} loading={publishing}>
            Update trips
          </Button>
        </div>
      )}

      <div className="ad-toolbar">
        <span className="ad-toolbar__note">Prices are per person, taxes included. Profit: one departure with {rules.planningGroup} travellers (Settings → Trip costs).</span>
        <SearchInput value={query} onChange={setQuery} placeholder="Search trips…" />
      </div>

      <Card flush>
        <div className="ad-table-wrap">
          <table className={`ad-table ${usingDefaults ? "" : "ad-table--click"}`}>
            <thead>
              <tr>
                <th>Trip</th>
                <th>Type</th>
                <th className="num">Adult</th>
                <th className="num">Child</th>
                <th className="num">Profit</th>
                <th>Next departure</th>
                <th>Status</th>
                <th className="ad-actions-col">
                  <span className="sr-only">Actions</span>
                </th>
              </tr>
            </thead>
            {status === "loading" ? (
              <LoadingRows cols={8} />
            ) : (
              <tbody>
                {shown.map((t) => {
                  const next = nextDeparture(t);
                  const eco = tripEconomics(t, rules);
                  return (
                    <tr key={t.id} onClick={usingDefaults ? undefined : () => navigate(`/admin/viajes/${encodeURIComponent(t.id)}`)}>
                      <td>
                        <div className="ad-prod">
                          <Photo src={t.image} className="ad-thumb ad-thumb--wide" sizes="72px" w={160} />
                          <div>
                            {usingDefaults ? (
                              <span className="ad-cell-main strong">{t.title?.es}</span>
                            ) : (
                              <Link to={`/admin/viajes/${encodeURIComponent(t.id)}`} className="ad-rowlink" onClick={(e) => e.stopPropagation()}>
                                {t.title?.es}
                              </Link>
                            )}
                            <span className="ad-cell-sub">
                              {t.featured && <Star size={12} weight="fill" className="ad-star" aria-label="Featured" />} {t.destination}
                            </span>
                          </div>
                        </div>
                      </td>
                      <td>{TRIP_TYPES[t.type]?.en}</td>
                      <td className="num">
                        <span className="ad-cell-main strong">{money(t.fromPrice, { whole: true })}</span>
                        {t.offerPct > 0 && <span className="ad-cell-sub">−{t.offerPct}% of {money(t.priceAdult, { whole: true })}</span>}
                      </td>
                      <td className="num">{t.adultsOnly ? <span className="ad-cell-sub">Adults only</span> : t.priceChild != null ? money(t.priceChild, { whole: true }) : "—"}</td>
                      <td className="num">
                        <span className={`ad-cell-main ${eco.profit >= 0 ? "ad-good" : "ad-bad"}`}>{money(Math.round(eco.profit), { whole: true })}</span>
                        <span className="ad-cell-sub">{Math.round(eco.marginPct)}%</span>
                      </td>
                      <td>{next ? weekdayDate(next) : <span className="ad-cell-sub">No dates</span>}</td>
                      <td>
                        <Pill tone={t.active ? "green" : "neutral"}>{t.active ? "On website" : "Hidden"}</Pill>
                      </td>
                      <td className="ad-actions-col" onClick={(e) => e.stopPropagation()}>
                        <div className="ad-row-actions">
                          <Button variant="ghost" size="sm" square icon={Eye} href={`/viajes/${encodeURIComponent(t.id)}`} target="_blank" rel="noreferrer" aria-label="View on website" title="View on website" />
                          {!usingDefaults && (
                            <>
                              <Button variant="ghost" size="sm" square icon={PencilSimple} to={`/admin/viajes/${encodeURIComponent(t.id)}`} aria-label="Edit" title="Edit" />
                              <Button variant="ghost" size="sm" square icon={Copy} to={`/admin/viajes/nuevo?copia=${encodeURIComponent(t.id)}`} aria-label="Duplicate" title="Duplicate" />
                              <Button
                                variant="ghost"
                                size="sm"
                                square
                                icon={t.active ? EyeSlash : Eye}
                                onClick={() => patch(t, { active: !t.active }, t.active ? "Trip hidden from the website" : "Trip is on the website")}
                                aria-label={t.active ? "Hide" : "Show"}
                                title={t.active ? "Hide from website" : "Show on website"}
                              />
                              <Button variant="ghost" size="sm" square icon={Trash} className="ad-danger-text" onClick={() => remove(t)} aria-label="Delete" title="Delete" />
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            )}
          </table>
        </div>
        {status !== "loading" && !shown.length && <Empty icon={MapTrifold} title="No trips match" />}
      </Card>
      {confirmDialog}
    </div>
  );
}
