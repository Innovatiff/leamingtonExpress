import { AuthProvider } from "./context/AuthContext";
import { CartProvider } from "./context/CartContext";
import { CatalogProvider } from "./context/CatalogContext";
import { SettingsProvider } from "./context/SettingsContext";
import { ToastProvider } from "./context/ToastContext";
import { WishlistProvider } from "./context/WishlistContext";
import { I18nProvider } from "./i18n";

/** Everything the website (client app) and the admin app share. */
export default function AppProviders({ children }) {
  return (
    <I18nProvider>
      <SettingsProvider>
        <CatalogProvider>
          <AuthProvider>
            <CartProvider>
              <WishlistProvider>
                <ToastProvider>{children}</ToastProvider>
              </WishlistProvider>
            </CartProvider>
          </AuthProvider>
        </CatalogProvider>
      </SettingsProvider>
    </I18nProvider>
  );
}
