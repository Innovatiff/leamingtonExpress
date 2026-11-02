import { Link } from "react-router-dom";
import { CalendarBlank, Clock, IdentificationCard, MoonStars, Ticket } from "@phosphor-icons/react";
import { Photo } from "@/components/ui/Misc";
import { useI18n } from "@/i18n";
import { formatDate, money } from "@/lib/format";
import { TRIP_TYPES } from "../data/trips";
import { dayDate, formatClock, nextDeparture } from "../lib/trips";
import "./trip-card.css";

const CARD_SIZES = "(max-width: 560px) 92vw, (max-width: 1100px) 46vw, 400px";
// In the trip list, phones show the photo as a thumbnail beside the details
const COMPACT_SIZES = "(max-width: 560px) 38vw, (max-width: 1100px) 46vw, 400px";

/** The trip's photo. Decorative by default (cards show the title next to it). */
export function TripMedia({ trip, className = "", alt = "", sizes = CARD_SIZES, eager }) {
  return <Photo className={`trip-media ${className}`} src={trip.image} alt={alt} sizes={sizes} eager={eager} />;
}

/** soon: show when it leaves on the photo (the "Travel now" row). */
export default function TripCard({ trip, variant, compact, soon }) {
  const { t, tx, lang } = useI18n();
  const next = nextDeparture(trip);
  const ev = trip.event;
  const shortDay = (d) => formatDate(d, lang, { weekday: "short", day: "numeric", month: "short" });
  // an event on several dates (a festival) shows the next one
  const when = next || (ev ? dayDate(ev.date) : null);
  return (
    <Link to={`/viajes/${trip.id}`} className={`trip-card ${variant ? `trip-card--${variant}` : ""}`}>
      <div className="trip-card__media">
        <TripMedia trip={trip} sizes={compact ? COMPACT_SIZES : CARD_SIZES} />
        <div className="trip-card__badges">
          {ev ? (
            <span className="trip-badge trip-badge--event">
              <Ticket size={13} weight="bold" /> {t(`travel.eventKinds.${ev.kind}`)}
            </span>
          ) : (
            <span className="trip-badge">{tx(TRIP_TYPES[trip.type])}</span>
          )}
          {trip.offerPct > 0 && <span className="trip-badge trip-badge--offer">−{trip.offerPct}%</span>}
        </div>
        {soon && next && <span className="trip-card__soon">{t("travel.leavesOn", { date: shortDay(next) })}</span>}
      </div>
      <div className="trip-card__body">
        <span className="trip-card__dest">{trip.destination}</span>
        <h3 className="trip-card__title">{tx(trip.title)}</h3>
        <p className="trip-card__tagline">{tx(trip.tagline)}</p>
        <ul className="trip-card__facts">
          <li>
            <Clock size={16} weight="bold" />
            {t("common.days", { n: trip.durationDays })}
            {trip.nights > 0 && (
              <>
                {" · "}
                <MoonStars size={16} weight="bold" /> {t("common.nights", { n: trip.nights })}
              </>
            )}
          </li>
          <li>
            <CalendarBlank size={16} weight="bold" />
            {when ? `${shortDay(when)}${ev?.time ? ` · ${formatClock(ev.time, lang)}` : ""}` : t("travel.noDates")}
          </li>
          {trip.passport && (
            <li className="trip-card__passport">
              <IdentificationCard size={16} weight="bold" /> {t("travel.passport")}
            </li>
          )}
        </ul>
        <div className="trip-card__foot">
          <div className="trip-card__price">
            <span className="trip-card__from">{t("travel.from")}</span>
            <strong>{money(trip.fromPrice, { whole: true })}</strong>
            {trip.offerPct > 0 && <s>{money(trip.priceAdult, { whole: true })}</s>}
            <span className="trip-card__pp">{t("travel.perPerson")}</span>
          </div>
          <span className="trip-card__cta">{t("travel.viewTrip")}</span>
        </div>
      </div>
    </Link>
  );
}

export function TripCardSkeleton() {
  return (
    <div className="trip-card" aria-hidden="true">
      <div className="trip-card__media skeleton" />
      <div className="trip-card__body">
        <div className="skeleton" style={{ height: 12, width: "40%" }} />
        <div className="skeleton" style={{ height: 22, width: "85%" }} />
        <div className="skeleton" style={{ height: 14, width: "95%" }} />
        <div className="skeleton" style={{ height: 30, width: "50%", marginTop: 12 }} />
      </div>
    </div>
  );
}
