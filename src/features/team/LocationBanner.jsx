import { useEffect, useState } from "react";
import { MapPin, WarningCircle } from "@phosphor-icons/react";
import Button from "@/components/ui/Button";
import { Modal } from "@/components/ui/Overlay";
import { useI18n } from "@/i18n";

const PROBLEMS = ["denied", "unavailable", "unsupported", "error"];

/** Under the top bar while the employee is on the way: is the customer seeing them on the map? */
export default function LocationBanner({ sharing }) {
  const { t } = useI18n();
  const [help, setHelp] = useState(false);
  const [now, setNow] = useState(() => Date.now());
  const { status, sentAt, retry } = sharing;

  useEffect(() => {
    if (status !== "on") return undefined;
    const id = setInterval(() => setNow(Date.now()), 5000);
    return () => clearInterval(id);
  }, [status]);

  if (status === "idle") return null;
  const problem = PROBLEMS.includes(status);
  const age = Math.max(1000, now - sentAt);
  const ago = age < 60000 ? t("team.loc.seconds", { n: Math.round(age / 1000) }) : t("team.loc.minutes", { n: Math.round(age / 60000) });

  return (
    <>
      <div className={`team-loc team-loc--${status}`} role="status">
        <span className="team-loc__icon" aria-hidden="true">
          {problem ? <WarningCircle size={20} weight="fill" /> : <MapPin size={20} weight="fill" />}
        </span>
        <div className="team-loc__text">
          <strong>{t(`team.loc.${status}`)}</strong>
          {status === "on" && <span>{t("team.loc.onHint", { ago })}</span>}
          {status === "waiting" && <span>{t("team.loc.waitingHint")}</span>}
        </div>
        {status === "denied" && (
          <button type="button" className="team-loc__btn" onClick={() => setHelp(true)}>
            {t("team.loc.how")}
          </button>
        )}
        {(status === "unavailable" || status === "error") && (
          <button type="button" className="team-loc__btn" onClick={retry}>
            {t("team.loc.retry")}
          </button>
        )}
      </div>
      <Modal
        open={help}
        onClose={() => setHelp(false)}
        title={t("team.loc.howTitle")}
        footer={
          <Button
            block
            onClick={() => {
              setHelp(false);
              retry();
            }}
          >
            {t("team.loc.retry")}
          </Button>
        }
      >
        <div className="team-loc__help">
          <p>{t("team.loc.iphone")}</p>
          <p>{t("team.loc.android")}</p>
          <p className="muted">{t("team.loc.after")}</p>
          <p className="small muted">{t("team.loc.privacy")}</p>
        </div>
      </Modal>
    </>
  );
}
