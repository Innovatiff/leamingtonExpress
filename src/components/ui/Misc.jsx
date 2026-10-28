import { useEffect, useState } from "react";
import { Image as ImageIcon, Info, Minus, Plus, Star, StarHalf, WarningCircle, CheckCircle } from "@phosphor-icons/react";
import { useI18n } from "@/i18n";
import { cdnImage, cdnSrcSet } from "@/lib/cloudinary";
import { money } from "@/lib/format";

export const Spinner = ({ className = "", label }) => (
  <div className={`spinner ${className}`} role="status" aria-label={label || "Loading"} />
);

export const Skeleton = ({ w = "100%", h = 16, r, className = "", style }) => (
  <div className={`skeleton ${className}`} style={{ width: w, height: h, borderRadius: r, ...style }} aria-hidden="true" />
);

export const Badge = ({ tone, children, className = "" }) => (
  <span className={`badge ${tone ? `badge--${tone}` : ""} ${className}`}>{children}</span>
);

export function EmptyState({ icon: Icon, title, text, children }) {
  return (
    <div className="empty">
      {Icon && (
        <div className="empty__icon">
          <Icon size={34} weight="duotone" />
        </div>
      )}
      <h2 className="empty__title">{title}</h2>
      {text && <p className="empty__text">{text}</p>}
      {children}
    </div>
  );
}

export function Notice({ tone = "info", icon, children, className = "" }) {
  const Icon = icon || (tone === "warning" || tone === "error" ? WarningCircle : tone === "success" ? CheckCircle : Info);
  return (
    <div className={`notice notice--${tone} ${className}`} role={tone === "error" ? "alert" : undefined}>
      <Icon size={20} weight="fill" />
      <div>{children}</div>
    </div>
  );
}

export function QtyStepper({ value, min = 1, max = 99, onChange, size }) {
  const { t } = useI18n();
  return (
    <div className={`qty ${size === "sm" ? "qty--sm" : ""}`}>
      <button type="button" onClick={() => onChange(value - 1)} disabled={value <= min} aria-label={t("common.decrease")}>
        <Minus size={16} weight="bold" />
      </button>
      <span className="qty__value" aria-live="polite">
        {value}
      </span>
      <button type="button" onClick={() => onChange(value + 1)} disabled={value >= max} aria-label={t("common.increase")}>
        <Plus size={16} weight="bold" />
      </button>
    </div>
  );
}

export function Price({ now, was, size, className = "" }) {
  const sale = was > now;
  return (
    <span className={`price ${className}`} style={size ? { fontSize: size } : undefined}>
      <span className={`price__now ${sale ? "price__now--sale" : ""}`}>{money(now)}</span>
      {sale && <span className="price__was">{money(was)}</span>}
    </span>
  );
}

export function Stars({ value = 0, count, size = 14 }) {
  if (!value) return null;
  const full = Math.floor(value);
  const half = value - full >= 0.5;
  return (
    <span className="stars" aria-label={`${value.toFixed(1)} / 5`}>
      <span className="stars__icons" aria-hidden="true">
        {Array.from({ length: 5 }, (_, i) =>
          i < full ? (
            <Star key={i} size={size} weight="fill" />
          ) : i === full && half ? (
            <StarHalf key={i} size={size} weight="fill" />
          ) : (
            <Star key={i} size={size} weight="regular" />
          ),
        )}
      </span>
      {count > 0 && <span>({count >= 1000 ? `${(count / 1000).toFixed(1)}k` : count})</span>}
    </span>
  );
}

/** Product / content image with Cloudinary resizing, lazy loading and a fallback. */
export function SmartImage({ src, alt = "", w = 600, sizes, className = "", eager, fit = "contain", ...rest }) {
  const [failed, setFailed] = useState(false);
  if (!src || failed) {
    return (
      <div className={`img-fallback ${className}`} aria-hidden={!alt} role={alt ? "img" : undefined} aria-label={alt || undefined}>
        <ImageIcon size={32} weight="duotone" />
      </div>
    );
  }
  return (
    <img
      src={cdnImage(src, { w })}
      srcSet={sizes ? cdnSrcSet(src) : undefined}
      sizes={sizes}
      alt={alt}
      className={className}
      loading={eager ? "eager" : "lazy"}
      decoding="async"
      style={{ objectFit: fit }}
      onError={() => setFailed(true)}
      {...rest}
    />
  );
}

function remaining(to) {
  const ms = Math.max(0, to.getTime() - Date.now());
  const s = Math.floor(ms / 1000);
  return { ms, d: Math.floor(s / 86400), h: Math.floor((s % 86400) / 3600), m: Math.floor((s % 3600) / 60), s: s % 60 };
}

/** Live countdown "2d 05:12:33" until `to`; renders nothing once it's over. */
export function Countdown({ to, className = "", prefix }) {
  const [left, setLeft] = useState(() => (to ? remaining(to) : null));
  useEffect(() => {
    if (!to) return undefined;
    const id = setInterval(() => setLeft(remaining(to)), 1000);
    return () => clearInterval(id);
  }, [to]);
  if (!left || left.ms <= 0) return null;
  const p = (n) => String(n).padStart(2, "0");
  return (
    <span className={`countdown ${className}`} role="timer">
      {prefix}
      <span className="countdown__time">
        {left.d > 0 && `${left.d}d `}
        {p(left.h)}:{p(left.m)}:{p(left.s)}
      </span>
    </span>
  );
}
