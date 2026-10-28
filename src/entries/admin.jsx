// Admin app (admin.html → /admin): dashboard, orders, rides, bookings, employees…
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import AppProviders from "@/AppProviders";
import LeaveApp from "@/components/layout/LeaveApp";
import AdminApp from "@/features/admin/AdminApp";
import { registerServiceWorker } from "@/lib/pwa";
import "@/styles/tokens.css";
import "@/styles/base.css";
import "@/styles/ui.css";
import "@/styles/layout.css";

createRoot(document.getElementById("root")).render(
  <StrictMode>
    <BrowserRouter>
      <AppProviders>
        <Routes>
          <Route path="/admin/*" element={<AdminApp />} />
          <Route path="*" element={<LeaveApp />} />
        </Routes>
      </AppProviders>
    </BrowserRouter>
  </StrictMode>,
);

registerServiceWorker();
