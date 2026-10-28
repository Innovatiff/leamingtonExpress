import { createContext, useCallback, useContext, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { CheckCircle, Info, WarningCircle, X } from "@phosphor-icons/react";

const ToastContext = createContext(null);

const ICONS = { success: CheckCircle, error: WarningCircle, info: Info };

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);
  const seq = useRef(0);

  const dismiss = useCallback((id) => setToasts((list) => list.filter((t) => t.id !== id)), []);

  const push = useCallback(
    (type, message, opts = {}) => {
      const id = ++seq.current;
      setToasts((list) => [...list.slice(-2), { id, type, message, ...opts }]);
      setTimeout(() => dismiss(id), opts.duration || (type === "error" ? 6000 : 3800));
      return id;
    },
    [dismiss],
  );

  const api = useMemo(
    () => ({
      success: (m, o) => push("success", m, o),
      error: (m, o) => push("error", m, o),
      info: (m, o) => push("info", m, o),
      dismiss,
    }),
    [push, dismiss],
  );

  return (
    <ToastContext.Provider value={api}>
      {children}
      <div className="toaster" role="region" aria-live="polite" aria-label="Notifications">
        {toasts.map((t) => {
          const Icon = ICONS[t.type] || Info;
          return (
            <div key={t.id} className={`toast toast--${t.type}`} role={t.type === "error" ? "alert" : "status"}>
              <Icon size={20} weight="fill" className="toast__icon" />
              <div className="toast__body">
                <span>{t.message}</span>
                {t.action && (
                  <Link className="toast__action" to={t.action.to} onClick={() => dismiss(t.id)}>
                    {t.action.label}
                  </Link>
                )}
              </div>
              <button className="toast__close" onClick={() => dismiss(t.id)} aria-label="Close">
                <X size={16} />
              </button>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used inside <ToastProvider>");
  return ctx;
}
