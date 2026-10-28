import { useId } from "react";
import { ArrowDown, ArrowUp, Plus, Trash } from "@phosphor-icons/react";
import Button from "@/components/ui/Button";

const L = (v) => ({ es: v?.es ?? (typeof v === "string" ? v : ""), en: v?.en ?? "" });

/** Spanish + English versions of one text, side by side. */
export function BiInput({ label, value, onChange, textarea, rows = 3, placeholder = {}, hint }) {
  const id = useId();
  const v = L(value);
  const Tag = textarea ? "textarea" : "input";
  return (
    <div className="field ad-bi">
      {label && <span className="field__label">{label}</span>}
      <div className="ad-bi__pair">
        {["es", "en"].map((lang) => (
          <label key={lang} className="ad-bi__item" htmlFor={`${id}-${lang}`}>
            <span className="ad-bi__lang">{lang.toUpperCase()}</span>
            <Tag
              id={`${id}-${lang}`}
              className="input"
              rows={textarea ? rows : undefined}
              value={v[lang]}
              placeholder={placeholder[lang] || ""}
              aria-label={`${label || "Text"} (${lang === "es" ? "Spanish" : "English"})`}
              onChange={(e) => onChange({ ...v, [lang]: e.target.value })}
            />
          </label>
        ))}
      </div>
      {hint && <span className="field__hint">{hint}</span>}
    </div>
  );
}

/** Generic editable list: reorder, remove, add. */
export function ListEditor({ items, onChange, newItem, addLabel = "Add", renderItem, itemLabel = "Item", compact }) {
  const update = (i, next) => onChange(items.map((it, j) => (j === i ? next : it)));
  const move = (i, dir) => {
    const j = i + dir;
    if (j < 0 || j >= items.length) return;
    const copy = [...items];
    [copy[i], copy[j]] = [copy[j], copy[i]];
    onChange(copy);
  };
  return (
    <div className={`ad-listed ${compact ? "ad-listed--compact" : ""}`}>
      {items.map((item, i) => (
        <div key={i} className="ad-listed__item">
          <div className="ad-listed__body">{renderItem(item, (next) => update(i, next), i)}</div>
          <div className="ad-listed__tools">
            <Button variant="ghost" size="sm" square icon={ArrowUp} onClick={() => move(i, -1)} disabled={i === 0} aria-label={`Move ${itemLabel} ${i + 1} up`} />
            <Button variant="ghost" size="sm" square icon={ArrowDown} onClick={() => move(i, 1)} disabled={i === items.length - 1} aria-label={`Move ${itemLabel} ${i + 1} down`} />
            <Button variant="ghost" size="sm" square icon={Trash} className="ad-danger-text" onClick={() => onChange(items.filter((_, j) => j !== i))} aria-label={`Remove ${itemLabel} ${i + 1}`} />
          </div>
        </div>
      ))}
      <Button variant="ghost" size="sm" icon={Plus} onClick={() => onChange([...items, typeof newItem === "function" ? newItem(items) : newItem])}>
        {addLabel}
      </Button>
    </div>
  );
}

/** Checkbox row for picking numbers (weekdays, months…). */
export function PickMany({ options, value = [], onChange, label }) {
  return (
    <div className="field">
      {label && <span className="field__label">{label}</span>}
      <div className="ad-pick" role="group" aria-label={label}>
        {options.map((o) => {
          const on = value.includes(o.value);
          return (
            <button key={o.value} type="button" className={`ad-pick__opt ${on ? "is-on" : ""}`} aria-pressed={on} onClick={() => onChange(on ? value.filter((v) => v !== o.value) : [...value, o.value].sort((a, b) => a - b))}>
              {o.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
