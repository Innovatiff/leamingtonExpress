import { lazy, Suspense } from "react";
import { Route, Routes } from "react-router-dom";
import { PageLoader, ScrollManager } from "./components/layout/Extras";
import LeaveApp from "./components/layout/LeaveApp";
import SiteLayout from "./components/layout/SiteLayout";
import HomePage from "./features/home/HomePage";

// Each section is code-split so visitors only download what they use.
const StoreLayout = lazy(() => import("./features/store/StoreLayout"));
const StoreHome = lazy(() => import("./features/store/StoreHome"));
const CatalogPage = lazy(() => import("./features/store/CatalogPage"));
const ProductPage = lazy(() => import("./features/store/ProductPage"));
const CartPage = lazy(() => import("./features/store/CartPage"));
const CheckoutPage = lazy(() => import("./features/store/CheckoutPage"));
const OrderSuccessPage = lazy(() => import("./features/store/OrderSuccessPage"));
const WishlistPage = lazy(() => import("./features/store/WishlistPage"));
const RidePage = lazy(() => import("./features/ride/RidePage"));
const TravelLayout = lazy(() => import("./features/travel/TravelLayout"));
const TravelHome = lazy(() => import("./features/travel/TravelHome"));
const TripPage = lazy(() => import("./features/travel/TripPage"));
const BookingPage = lazy(() => import("./features/travel/BookingPage"));
const BookingSuccess = lazy(() => import("./features/travel/BookingSuccess"));
const AccountPage = lazy(() => import("./features/account/AccountPage"));
const TrackingPage = lazy(() => import("./features/tracking/TrackingPage"));
const HelpPage = lazy(() => import("./features/info/InfoPages").then((m) => ({ default: m.HelpPage })));
const ContactPage = lazy(() => import("./features/info/InfoPages").then((m) => ({ default: m.ContactPage })));
const PrivacyPage = lazy(() => import("./features/info/InfoPages").then((m) => ({ default: () => <m.LegalPage kind="privacy" /> })));
const TermsPage = lazy(() => import("./features/info/InfoPages").then((m) => ({ default: () => <m.LegalPage kind="terms" /> })));
const NotFoundPage = lazy(() => import("./features/info/InfoPages").then((m) => ({ default: m.NotFoundPage })));

export default function App() {
  return (
    <>
      <ScrollManager />
      <Suspense fallback={<PageLoader />}>
        <Routes>
          <Route element={<SiteLayout />}>
            <Route index element={<HomePage />} />
            <Route path="tienda" element={<StoreLayout />}>
              <Route index element={<StoreHome />} />
              <Route path="productos" element={<CatalogPage />} />
              <Route path="producto/:id/:slug?" element={<ProductPage />} />
              <Route path="carrito" element={<CartPage />} />
              <Route path="checkout" element={<CheckoutPage />} />
              <Route path="pedido/:orderId" element={<OrderSuccessPage />} />
              <Route path="favoritos" element={<WishlistPage />} />
            </Route>
            <Route path="viajes" element={<TravelLayout />}>
              <Route index element={<TravelHome />} />
              <Route path="reserva/:id" element={<BookingSuccess />} />
              <Route path=":slug" element={<TripPage />} />
              <Route path=":slug/reservar" element={<BookingPage />} />
            </Route>
            <Route path="cuenta" element={<AccountPage />} />
            <Route path="seguimiento" element={<TrackingPage />} />
            <Route path="seguimiento/:token" element={<TrackingPage />} />
            <Route path="ayuda" element={<HelpPage />} />
            <Route path="contacto" element={<ContactPage />} />
            <Route path="privacidad" element={<PrivacyPage />} />
            <Route path="terminos" element={<TermsPage />} />
            <Route path="*" element={<NotFoundPage />} />
          </Route>
          <Route path="ride" element={<RidePage />} />
          {/* separate apps (admin.html, equipo.html) */}
          <Route path="admin/*" element={<LeaveApp />} />
          <Route path="equipo/*" element={<LeaveApp />} />
        </Routes>
      </Suspense>
    </>
  );
}
