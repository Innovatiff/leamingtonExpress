import { useState } from "react";
import { DownloadSimple, Export } from "@phosphor-icons/react";
import Button from "@/components/ui/Button";
import { Modal } from "@/components/ui/Overlay";
import { useInstallPrompt } from "@/lib/pwa";
import { readJSON, writeJSON } from "@/lib/storage";

/**
 * "Install the app" card for any of the three apps. Android/desktop install with
 * one tap; on iPhone it explains Safari's "Add to Home Screen".
 * strings = { title, text, button, iosTitle, iosSteps[], later, how }
 */
export default function InstallApp({ id, icon, strings, dismissible = true, className = "" }) {
  const { canInstall, ios, standalone, install } = useInstallPrompt();
  const key = `lx_install_later_${id}`;
  const [hidden, setHidden] = useState(() => dismissible && Number(readJSON(key, 0)) > Date.now());
  const [howOpen, setHowOpen] = useState(false);
  if (standalone || hidden || (!canInstall && !ios)) return null;

  return (
    <div className={`install-card ${className}`}>
      <img src={icon} alt="" width="48" height="48" />
      <div className="install-card__body">
        <strong>{strings.title}</strong>
        <p>{strings.text}</p>
      </div>
      {canInstall ? (
        <Button size="sm" icon={DownloadSimple} onClick={install}>
          {strings.button}
        </Button>
      ) : (
        <Button size="sm" icon={Export} onClick={() => setHowOpen(true)}>
          {strings.how}
        </Button>
      )}
      {dismissible && (
        <button
          type="button"
          className="tiny muted"
          onClick={() => {
            writeJSON(key, Date.now() + 14 * 24 * 3600 * 1000);
            setHidden(true);
          }}
        >
          {strings.later}
        </button>
      )}
      <Modal open={howOpen} onClose={() => setHowOpen(false)} title={strings.iosTitle}>
        <ol className="install-steps">
          {strings.iosSteps.map((step) => (
            <li key={step}>{step}</li>
          ))}
        </ol>
      </Modal>
    </div>
  );
}
