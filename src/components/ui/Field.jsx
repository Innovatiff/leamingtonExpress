import { useId } from "react";

function Wrapper({ id, label, optional, hint, error, className = "", children }) {
  return (
    <div className={`field ${error ? "field--invalid" : ""} ${className}`}>
      {label && (
        <label className="field__label" htmlFor={id}>
          {label} {optional && <small>({optional})</small>}
        </label>
      )}
      {children}
      {error ? (
        <span className="field__error" id={`${id}-err`} role="alert">
          {error}
        </span>
      ) : (
        hint && (
          <span className="field__hint" id={`${id}-hint`}>
            {hint}
          </span>
        )
      )}
    </div>
  );
}

const describedBy = (id, error, hint) => (error ? `${id}-err` : hint ? `${id}-hint` : undefined);

export function TextField({ label, optional, hint, error, className, inputRef, ...props }) {
  const autoId = useId();
  const id = props.id || autoId;
  return (
    <Wrapper id={id} label={label} optional={optional} hint={hint} error={error} className={className}>
      <input
        ref={inputRef}
        id={id}
        className="input"
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy(id, error, hint)}
        {...props}
      />
    </Wrapper>
  );
}

export function SelectField({ label, optional, hint, error, className, options = [], placeholder, ...props }) {
  const autoId = useId();
  const id = props.id || autoId;
  return (
    <Wrapper id={id} label={label} optional={optional} hint={hint} error={error} className={className}>
      <select id={id} className="input" aria-invalid={error ? true : undefined} aria-describedby={describedBy(id, error, hint)} {...props}>
        {placeholder && <option value="">{placeholder}</option>}
        {options.map((o) =>
          typeof o === "string" ? (
            <option key={o} value={o}>
              {o}
            </option>
          ) : (
            <option key={o.value} value={o.value} disabled={o.disabled}>
              {o.label}
            </option>
          ),
        )}
      </select>
    </Wrapper>
  );
}

export function TextAreaField({ label, optional, hint, error, className, ...props }) {
  const autoId = useId();
  const id = props.id || autoId;
  return (
    <Wrapper id={id} label={label} optional={optional} hint={hint} error={error} className={className}>
      <textarea id={id} className="input" aria-invalid={error ? true : undefined} aria-describedby={describedBy(id, error, hint)} {...props} />
    </Wrapper>
  );
}

export function Checkbox({ label, className = "", ...props }) {
  return (
    <label className={`check ${className}`}>
      <input type="checkbox" {...props} />
      <span>{label}</span>
    </label>
  );
}
