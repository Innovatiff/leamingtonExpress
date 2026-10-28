import { useState } from "react";
import { useParams } from "react-router-dom";
import { AirplaneTilt, CalendarBlank, CheckCircle, Copy, UsersThree, WhatsappLogo } from "@phosphor-icons/react";
import Button from "@/components/ui/Button";
import { useSettings } from "@/context/SettingsContext";
import { useToast } from "@/context/ToastContext";
import { useI18n } from "@/i18n";
import { formatDate, fromIsoDay, money, phoneDigits } from "@/lib/format";
import { useSeo } from "@/lib/seo";
import { readJSON } from "@/lib/storage";
import { LAST_BOOKING_KEY } from "./BookingPage";

export default function BookingSuccess() {
  const { id } = useParams();
  const { t, lang } = useI18n();
  const settings = useSettings();
  const toast = useToast();
  const [saved] = useState(() => readJSON(LAST_BOOKING_KEY, null, "session"));
  const booking = saved?.id === id ? saved : null;
  const wa = settings.contact?.whatsapp;

  useSeo({ title: t("travel.successTitle"), noindex: true });

  const date = booking ? fromIsoDay(booking.date) : null;
  const dateLabel = date ? formatDate(date, lang, { weekday: "long", day: "numeric", month: "long", year: "numeric" }) : booking?.date || "";
  const firstName = booking?.lead?.name?.split(" ")[0] || "";
  const waText = booking ? t("travel.successWhatsappMsg", { ref: booking.ref, title: booking.tripTitle, date: dateLabel }) : "";

  return (
    <div className="container bk-success">
      <div className="bk-success__card">
        <span className="bk-success__icon">
          <CheckCircle size={60} weight="fill" />
        </span>
        <h1 className="tv-h1">{t("travel.successTitle")}</h1>
        <p className="bk-success__lead">{t("travel.successText", { name: firstName })}</p>

        {booking ? (
          <>
            <button
              type="button"
              className="bk-success__ref"
              onClick={() => navigator.clipboard?.writeText(booking.ref).then(() => toast.success(t("common.copied")), () => {})}
            >
              <span>{t("travel.successRef")}</span>
              <strong>{booking.ref}</strong>
              <Copy size={16} weight="bold" />
            </button>
            <p className="muted">{t("travel.successNext")}</p>

            <div className="bk-success__details">
              <h2>{t("travel.successDetails")}</h2>
              <ul>
                <li>
                  <AirplaneTilt size={20} weight="duotone" />
                  <strong>{booking.tripTitle}</strong>
                </li>
                <li>
                  <CalendarBlank size={20} weight="duotone" />
                  <span>{dateLabel}</span>
                </li>
                <li>
                  <UsersThree size={20} weight="duotone" />
                  <span>
                    {t("travel.adultsLine", { n: booking.adults, price: money(booking.pricing.adultUnit, { whole: true }) })}
                    {booking.children > 0 && ` · ${t("travel.childrenLine", { n: booking.children, price: money(booking.pricing.childUnit, { whole: true }) })}`}
                  </span>
                </li>
              </ul>
              <div className="bk-success__total">
                <span>{t("travel.total")}</span>
                <strong>{money(booking.pricing.total)}</strong>
              </div>
              {booking.pricing.depositPct > 0 && (
                <div className="bk-success__deposit">
                  <span>{t("travel.deposit", { pct: booking.pricing.depositPct })}</span>
                  <strong>{money(booking.pricing.deposit)}</strong>
                </div>
              )}
            </div>
            <p className="small muted">{t("travel.successSaveRef")}</p>
          </>
        ) : (
          <p className="muted">{t("travel.successMissing")}</p>
        )}

        <div className="bk-success__actions">
          {wa && booking && (
            <Button href={`https://wa.me/${phoneDigits(wa)}?text=${encodeURIComponent(waText)}`} target="_blank" rel="noreferrer" icon={WhatsappLogo} className="bk-wa">
              {t("travel.successWhatsapp")}
            </Button>
          )}
          <Button to="/viajes" variant="secondary">
            {t("travel.moreTrips")}
          </Button>
          <Button to="/" variant="ghost">
            {t("common.home")}
          </Button>
        </div>
      </div>
    </div>
  );
}
