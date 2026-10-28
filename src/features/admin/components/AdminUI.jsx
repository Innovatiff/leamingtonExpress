import { createContext, useContext, useState } from "react";
import { MagnifyingGlass, X } from "@phosphor-icons/react";
import Button from "@/components/ui/Button";
import { Modal } from "@/components/ui/Overlay";

/* ------------------------------ City scope ------------------------------- */
export const AdminCityContext = createContext({ city: "leamington", setCity: () => {} });
export const useAdminCity = () => useContext(AdminCityContext);

/* -------------------------------- Layout -------------------------------- */
export function PageHead({ title, subtitle, actions, children }) {
  return (
    <header className="ad-head">
      <div className="ad-head__text">
        <h1 className="ad-head__title">{title}</h1>
        {subtitle && <p className="ad-head__sub">{subtitle}</p>}
      </div>
      {actions && <div className="ad-head__actions">{actions}</div>}
      {children}
    </header>
  );
}

export function Card({ title, actions, children, className = "", flush }) {
  return (
    <section className={`ad-card ${flush ? "ad-card--flush" : ""} ${className}`}>
      {(title || actions) && (
        <div className="ad-card__head">
          {title && <h2 className="ad-card__title">{title}</h2>}
          {actions && <div className="ad-card__actions">{actions}</div>}
        </div>
      )}
      {children}
    </section>
  );
}

/** Filter tabs with counts. tabs = [{ key, label, count }] */
export function Tabs({ tabs, value, onChange, label = "Filter" }) {
  return (
    <div className="ad-tabs" role="tablist" aria-label={label}>
      {tabs.map((t) => (
        <button key={t.key} type="button" role="tab" aria-selected={value === t.key} className={`ad-tab ${value === t.key ? "is-active" : ""}`} onClick={() => onChange(t.key)}>
          {t.label}
          {t.count != null && <span className="ad-tab__count">{t.count}</span>}
        </button>
      ))}
    </div>
  );
}

export function SearchInput({ value, onChange, placeholder = "Search…" }) {
  return (
    <label className="ad-search">
      <MagnifyingGlass size={18} weight="bold" aria-hidden="true" />
      <input type="search" value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} aria-label={placeholder} />
      {value && (
        <button type="button" onClick={() => onChange("")} aria-label="Clear search">
          <X size={14} weight="bold" />
        </button>
      )}
    </label>
  );
}

/** Status pill — tone carries meaning together with the text (never color alone). */
export function Pill({ tone = "neutral", icon: Icon, children }) {
  return (
    <span className={`ad-pill ad-pill--${tone}`}>
      {Icon && <Icon size={13} weight="bold" aria-hidden="true" />}
      {children}
    </span>
  );
}

export function Empty({ icon: Icon, title, text, children }) {
  return (
    <div className="ad-empty">
      {Icon && <Icon size={36} weight="duotone" />}
      <strong>{title}</strong>
      {text && <p>{text}</p>}
      {children}
    </div>
  );
}

export function KV({ rows }) {
  return (
    <dl className="ad-kv">
      {rows.filter(Boolean).map(([k, v]) => (
        <div key={k}>
          <dt>{k}</dt>
          <dd>{v ?? "—"}</dd>
        </div>
      ))}
    </dl>
  );
}

export function LoadingRows({ cols = 5, rows = 6 }) {
  return (
    <tbody aria-hidden="true">
      {Array.from({ length: rows }, (_, i) => (
        <tr key={i}>
          {Array.from({ length: cols }, (_, j) => (
            <td key={j}>
              <span className="skeleton" style={{ display: "block", height: 14, width: `${50 + ((i * 7 + j * 13) % 40)}%` }} />
            </td>
          ))}
        </tr>
      ))}
    </tbody>
  );
}

export function ErrorNote({ error }) {
  if (!error) return null;
  const denied = String(error.code || error.message || "").includes("permission");
  return (
    <div className="ad-error" role="alert">
      {denied
        ? "Firestore denied access to this data. Deploy the new firestore.rules and make sure your account is an admin (express_admins/{uid})."
        : `Could not load data: ${error.message || error}`}
    </div>
  );
}

/* --------------------------- Confirm dialog ------------------------------ */
export function useConfirm() {
  const [state, setState] = useState(null);
  const confirm = (opts) =>
    new Promise((resolve) => {
      setState({ ...opts, resolve });
    });
  const close = (ok) => {
    state?.resolve(ok);
    setState(null);
  };
  const dialog = (
    <Modal
      open={!!state}
      onClose={() => close(false)}
      title={state?.title || "Are you sure?"}
      footer={
        <div className="ad-modal-actions">
          <Button variant="ghost" onClick={() => close(false)}>
            Cancel
          </Button>
          <Button variant={state?.danger ? "danger" : "primary"} onClick={() => close(true)}>
            {state?.confirmLabel || "Confirm"}
          </Button>
        </div>
      }
    >
      <p className="muted">{state?.message}</p>
    </Modal>
  );
  return [confirm, dialog];
}

/* ------------------------------- Inputs ---------------------------------- */
export function Toggle({ checked, onChange, label, hint, disabled }) {
  return (
    <label className={`ad-toggle ${disabled ? "is-disabled" : ""}`}>
      <input type="checkbox" role="switch" checked={!!checked} onChange={(e) => onChange(e.target.checked)} disabled={disabled} />
      <span className="ad-toggle__track" aria-hidden="true" />
      <span className="ad-toggle__text">
        {label}
        {hint && <small>{hint}</small>}
      </span>
    </label>
  );
}

export function Segmented({ options, value, onChange, label }) {
  return (
    <div className="ad-seg" role="radiogroup" aria-label={label}>
      {options.map((o) => (
        <button key={o.value} type="button" role="radio" aria-checked={value === o.value} className={value === o.value ? "is-active" : ""} onClick={() => onChange(o.value)}>
          {o.icon && <o.icon size={16} weight="bold" />}
          {o.label}
        </button>
      ))}
    </div>
  );
}
