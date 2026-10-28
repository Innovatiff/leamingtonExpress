import { useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { X } from "@phosphor-icons/react";

let locks = 0;
function lockScroll() {
  locks += 1;
  if (locks === 1) {
    const sbw = window.innerWidth - document.documentElement.clientWidth;
    document.body.style.overflow = "hidden";
    if (sbw > 0) document.body.style.paddingRight = `${sbw}px`;
  }
}
function unlockScroll() {
  locks = Math.max(0, locks - 1);
  if (locks === 0) {
    document.body.style.overflow = "";
    document.body.style.paddingRight = "";
  }
}

const FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

/** Scroll lock, Esc to close, focus trap and focus restore for dialogs. */
function useDialog(open, onClose, panelRef) {
  const onCloseRef = useRef(onClose);
  useEffect(() => {
    onCloseRef.current = onClose;
  });

  useEffect(() => {
    if (!open) return undefined;
    const previous = document.activeElement;
    lockScroll();
    const panel = panelRef.current;
    const first = panel?.querySelector("[data-autofocus]") || panel?.querySelector(FOCUSABLE);
    (first || panel)?.focus({ preventScroll: true });

    const onKey = (e) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        onCloseRef.current?.();
      } else if (e.key === "Tab" && panel) {
        const items = [...panel.querySelectorAll(FOCUSABLE)].filter((el) => el.offsetParent !== null);
        if (!items.length) return;
        const firstEl = items[0];
        const lastEl = items[items.length - 1];
        if (e.shiftKey && document.activeElement === firstEl) {
          e.preventDefault();
          lastEl.focus();
        } else if (!e.shiftKey && document.activeElement === lastEl) {
          e.preventDefault();
          firstEl.focus();
        }
      }
    };
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("keydown", onKey);
      unlockScroll();
      if (previous && typeof previous.focus === "function") previous.focus({ preventScroll: true });
    };
  }, [open, panelRef]);
}

export function Modal({ open, onClose, title, children, footer, wide, className = "", closeLabel = "Close" }) {
  const panelRef = useRef(null);
  useDialog(open, onClose, panelRef);
  if (!open) return null;
  return createPortal(
    <>
      <div className="overlay" onClick={onClose} />
      <div className="modal-wrap" onMouseDown={(e) => e.target === e.currentTarget && onClose?.()}>
        <div
          ref={panelRef}
          className={`modal ${wide ? "modal--wide" : ""} ${className}`}
          role="dialog"
          aria-modal="true"
          aria-label={typeof title === "string" ? title : undefined}
          tabIndex={-1}
        >
          {title != null && (
            <div className="modal__head">
              <h2 className="modal__title">{title}</h2>
              <button className="icon-btn" onClick={onClose} aria-label={closeLabel}>
                <X size={20} />
              </button>
            </div>
          )}
          <div className="modal__body">{children}</div>
          {footer && <div className="modal__foot">{footer}</div>}
        </div>
      </div>
    </>,
    document.body,
  );
}

export function Drawer({ open, onClose, title, children, footer, side = "right", className = "", closeLabel = "Close", headerExtra }) {
  const panelRef = useRef(null);
  useDialog(open, onClose, panelRef);
  if (!open) return null;
  return createPortal(
    <>
      <div className="overlay" onClick={onClose} />
      <aside
        ref={panelRef}
        className={`drawer ${side === "left" ? "drawer--left" : ""} ${className}`}
        role="dialog"
        aria-modal="true"
        aria-label={typeof title === "string" ? title : undefined}
        tabIndex={-1}
      >
        <div className="drawer__head">
          <h2 className="drawer__title">{title}</h2>
          <div className="row" style={{ "--row-gap": "4px" }}>
            {headerExtra}
            <button className="icon-btn" onClick={onClose} aria-label={closeLabel}>
              <X size={20} />
            </button>
          </div>
        </div>
        <div className="drawer__body">{children}</div>
        {footer && <div className="drawer__foot">{footer}</div>}
      </aside>
    </>,
    document.body,
  );
}
