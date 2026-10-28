// Client app: store, rides, trips and live status (index.html).
// The admin (admin.html) and employee app (equipo.html) are separate apps — see src/entries.
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import * as backend from "@backend";
import App from "./App";
import AppProviders from "./AppProviders";
import { registerServiceWorker } from "./lib/pwa";
import "./styles/tokens.css";
import "./styles/base.css";
import "./styles/ui.css";
import "./styles/layout.css";

createRoot(document.getElementById("root")).render(
  <StrictMode>
    <BrowserRouter>
      <AppProviders>
        <App />
      </AppProviders>
    </BrowserRouter>
  </StrictMode>,
);

registerServiceWorker();
if ("requestIdleCallback" in window) window.requestIdleCallback(() => backend.startAnalytics());
else setTimeout(() => backend.startAnalytics(), 3000);
