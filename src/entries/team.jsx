// Employee app (equipo.html → /equipo): drivers, couriers and trip guides.
// It has its own sign-in and never loads the admin.
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import LeaveApp from "@/components/layout/LeaveApp";
import { ToastProvider } from "@/context/ToastContext";
import TeamApp from "@/features/team/TeamApp";
import { I18nProvider } from "@/i18n";
import { registerServiceWorker } from "@/lib/pwa";
import "@/styles/tokens.css";
import "@/styles/base.css";
import "@/styles/ui.css";
import "@/styles/layout.css";

createRoot(document.getElementById("root")).render(
  <StrictMode>
    <BrowserRouter>
      <I18nProvider>
        <ToastProvider>
          <Routes>
            <Route path="/equipo/*" element={<TeamApp />} />
            <Route path="*" element={<LeaveApp />} />
          </Routes>
        </ToastProvider>
      </I18nProvider>
    </BrowserRouter>
  </StrictMode>,
);

registerServiceWorker();
