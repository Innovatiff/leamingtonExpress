import { useEffect, useState } from "react";
import * as backend from "@backend";

/**
 * Live status of one service. → { status: "loading" | "ready" | "missing", view }
 * Right after a request the live page can take a few seconds to appear, so
 * "missing" only shows up after a short wait.
 */
export function useTracking(token, { waitMs = 15000 } = {}) {
  const [state, setState] = useState({ token: null, status: "loading", view: null });

  useEffect(() => {
    if (!token) return undefined;
    let timer = null;
    const unsub = backend.subscribeTracking(
      token,
      (view) => {
        clearTimeout(timer);
        if (view) setState({ token, status: "ready", view });
        else timer = setTimeout(() => setState((s) => (s.token === token && s.view ? s : { token, status: "missing", view: null })), waitMs);
      },
      (err) => {
        console.warn("Live status unavailable", err);
        setState({ token, status: "missing", view: null });
      },
    );
    return () => {
      clearTimeout(timer);
      unsub();
    };
  }, [token, waitMs]);

  if (!token) return { status: "missing", view: null };
  return state.token === token ? state : { status: "loading", view: null };
}
