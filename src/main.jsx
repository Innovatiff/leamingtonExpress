import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import * as backend from "@backend";
import App from "./App";
import { AuthProvider } from "./context/AuthContext";
import { CartProvider } from "./context/CartContext";
import { CatalogProvider } from "./context/CatalogContext";
import { SettingsProvider } from "./context/SettingsContext";
import { ToastProvider } from "./context/ToastContext";
import { WishlistProvider } from "./context/WishlistContext";
import { I18nProvider } from "./i18n";
import "./styles/tokens.css";
import "./styles/base.css";
import "./styles/ui.css";
import "./styles/layout.css";

createRoot(document.getElementById("root")).render(
  <StrictMode>
    <BrowserRouter>
      <I18nProvider>
        <SettingsProvider>
          <CatalogProvider>
            <AuthProvider>
              <CartProvider>
                <WishlistProvider>
                  <ToastProvider>
                    <App />
                  </ToastProvider>
                </WishlistProvider>
              </CartProvider>
            </AuthProvider>
          </CatalogProvider>
        </SettingsProvider>
      </I18nProvider>
    </BrowserRouter>
  </StrictMode>,
);

if ("requestIdleCallback" in window) window.requestIdleCallback(() => backend.startAnalytics());
else setTimeout(() => backend.startAnalytics(), 3000);
