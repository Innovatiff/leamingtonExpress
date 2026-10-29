// The richer parts of a trip page: photos of the hotels, restaurants and
// places (with their credit and whether the photo is the place itself, its
// area or only an example), the places the trip visits, and travel tips.
import { ArrowUpRight, Bed, CalendarCheck, Check, ForkKnife, Lightbulb, MapPin, Star } from "@phosphor-icons/react";
import { Photo } from "@/components/ui/Misc";
import { useI18n } from "@/i18n";
import { isCommons, isUnsplash } from "@/lib/photos";
import { MEAL_LABELS } from "../data/trips";
import { formatClock } from "../lib/trips";
import "./trip-extras.css";

const mapLink = (q) => `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(q)}`;

/** "Foto: Ana · Unsplash", "Foto: Ana · CC BY-SA 4.0 · Wikimedia Commons" or "Foto: Ana". */
export function photoCredit(t, { image, photoBy, photoLicense }) {
  if (!photoBy) return "";
  if (isUnsplash(image)) return t("travel.photoByUnsplash", { name: photoBy });
  if (isCommons(image)) return t("travel.photoByCommons", { name: photoBy, license: photoLicense || "CC" });
  return t("travel.photoBy", { name: photoBy });
}

/** A photo with its credit; "photo of the area" / "representative photo" when it isn't the place itself. */
export function VenuePhoto({ item, alt = "", sizes, className = "", w = 960 }) {
  const { t } = useI18n();
  if (!item?.image) return null;
  const credit = photoCredit(t, item);
  const badge = item.photoMatch === "representative" ? t("travel.photoIllustrative") : item.photoMatch === "area" ? t("travel.photoArea") : "";
  return (
    <figure className={`venue-photo ${className}`}>
      <Photo src={item.image} alt={alt} sizes={sizes} w={w} />
      {badge && <span className="venue-photo__badge">{badge}</span>}
      {credit &&
        (item.photoLink ? (
          <a className="venue-photo__credit" href={item.photoLink} target="_blank" rel="noreferrer">
            {credit}
          </a>
        ) : (
          <figcaption className="venue-photo__credit">{credit}</figcaption>
        ))}
    </figure>
  );
}

function Links({ item }) {
  const { t } = useI18n();
  if (!item.address && !item.website) return null;
  return (
    <p className="venue__links">
      {item.address && (
        <a href={mapLink(`${item.name || item.place || ""} ${item.address}`)} target="_blank" rel="noreferrer">
          <MapPin size={15} weight="fill" aria-hidden="true" /> {item.address}
        </a>
      )}
      {item.website && (
        <a href={item.website} target="_blank" rel="noreferrer">
          {t("travel.website")} <ArrowUpRight size={13} weight="bold" aria-hidden="true" />
        </a>
      )}
    </p>
  );
}

/** "What you'll see": the main places of the trip. */
export function TripSights({ trip }) {
  const { tx } = useI18n();
  if (!trip.sights?.length) return null;
  return (
    <div className="tv-sights">
      {trip.sights.map((s) => (
        <article key={tx(s.name)} className="tv-sight">
          <VenuePhoto item={s} sizes="(max-width: 700px) 92vw, 360px" w={720} className="tv-sight__photo" />
          <div className="tv-sight__body">
            <h3>{tx(s.name)}</h3>
            {tx(s.text) && <p>{tx(s.text)}</p>}
          </div>
        </article>
      ))}
    </div>
  );
}

// "16:00" → "4:00 p.m." in the visitor's language; other text as it is
const clock = (v, lang) => (/^\d{1,2}:\d{2}$/.test(v || "") ? formatClock(v, lang) : v || "");

export function HotelCard({ hotel: h, trip }) {
  const { t, tx, lang } = useI18n();
  const times = t("travel.checkInOut", { checkIn: clock(h.checkIn, lang), checkOut: clock(h.checkOut, lang) });
  return (
    <article className={`tv-hotel2 ${h.image ? "" : "tv-hotel2--nophoto"}`}>
      {h.image ? (
        <VenuePhoto item={h} alt={h.name} sizes="(max-width: 760px) 92vw, 720px" w={1280} className="tv-hotel2__photo" />
      ) : (
        <span className="tv-hotel2__icon" aria-hidden="true">
          <Bed size={32} weight="duotone" />
        </span>
      )}
      <div className="tv-hotel2__body">
        {h.stars > 0 && (
          <span className="tv-hotel__stars" role="img" aria-label={t("travel.stars", { n: h.stars })}>
            {Array.from({ length: h.stars }, (_, i) => (
              <Star key={i} size={14} weight="fill" />
            ))}
          </span>
        )}
        <h3 className="tv-hotel__name">{h.name}</h3>
        <p className="tv-hotel2__nights">
          <CalendarCheck size={16} weight="bold" aria-hidden="true" /> {t("travel.nightsIn", { n: h.nights || trip.nights, city: h.city || trip.destination })}
        </p>
        {tx(h.text) && <p className="tv-hotel2__text">{tx(h.text)}</p>}
        {tx(h.room) && (
          <p className="tv-hotel__room">
            <strong>{t("travel.room")}:</strong> {tx(h.room)}
          </p>
        )}
        {h.perks?.length > 0 && (
          <ul className="tv-hotel2__perks">
            {h.perks.map((perk) => (
              <li key={tx(perk)}>
                <Check size={16} weight="bold" aria-hidden="true" />
                <span>{tx(perk)}</span>
              </li>
            ))}
          </ul>
        )}
        {times && <p className="tv-hotel2__times">{times}</p>}
        <Links item={h} />
      </div>
    </article>
  );
}

export function MealCard({ meal: m, trip }) {
  const { t, tx } = useI18n();
  return (
    <article className="tv-meal2">
      {m.image ? (
        <VenuePhoto item={m} alt={m.place} sizes="(max-width: 700px) 92vw, 360px" w={720} className="tv-meal2__photo" />
      ) : (
        <span className="tv-meal2__icon" aria-hidden="true">
          <ForkKnife size={30} weight="duotone" />
        </span>
      )}
      <div className="tv-meal2__body">
        <span className="tv-meal__kind">
          {tx(MEAL_LABELS[m.meal]) || m.meal}
          {trip.durationDays > 1 && ` · ${t("travel.dayN", { n: m.day })}`}
        </span>
        <h3 className="tv-meal2__name">{m.place}</h3>
        {tx(m.cuisine) && <span className="tv-meal__cuisine">{tx(m.cuisine)}</span>}
        {tx(m.text) && <p className="tv-meal2__text">{tx(m.text)}</p>}
        {tx(m.note) && (
          <p className="tv-meal2__note">
            <strong>{t("travel.mealIncludes")}:</strong> {tx(m.note)}
          </p>
        )}
        <Links item={{ ...m, name: m.place }} />
      </div>
    </article>
  );
}

/** Tips: weather, walking, documents, money… */
export function TripTips({ trip }) {
  const { t, tx } = useI18n();
  if (!trip.goodToKnow?.length) return null;
  return (
    <div className="tv-tips">
      <h3 className="tv-sec__sub">{t("travel.tipsTitle")}</h3>
      <ul>
        {trip.goodToKnow.map((g) => (
          <li key={tx(g)}>
            <Lightbulb size={20} weight="duotone" aria-hidden="true" />
            <span>{tx(g)}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
