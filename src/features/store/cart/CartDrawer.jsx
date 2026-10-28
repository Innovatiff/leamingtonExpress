import { useNavigate } from "react-router-dom";
import { ArrowRight, ShoppingCartSimple } from "@phosphor-icons/react";
import Button from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/Misc";
import { Drawer } from "@/components/ui/Overlay";
import { useCart } from "@/context/CartContext";
import { useI18n } from "@/i18n";
import { money } from "@/lib/format";
import { CartLine, CartTotals, PromoCodeForm } from "./CartParts";

export default function CartDrawer() {
  const { t } = useI18n();
  const navigate = useNavigate();
  const { drawerOpen, closeDrawer, lines, totals } = useCart();
  const go = (to) => {
    closeDrawer();
    navigate(to);
  };
  const blocked = lines.some((l) => l.unavailable || l.overStock) || totals.count === 0;

  return (
    <Drawer
      open={drawerOpen}
      onClose={closeDrawer}
      title={
        <>
          {t("cart.title")} {totals.count > 0 && <span className="muted small">· {t("cart.items", { n: totals.count })}</span>}
        </>
      }
      closeLabel={t("common.close")}
      className="theme-store cart-drawer"
      footer={
        lines.length > 0 && (
          <div className="stack" style={{ "--stack-gap": "10px" }}>
            <Button size="lg" block onClick={() => go("/tienda/checkout")} disabled={blocked} iconRight={ArrowRight}>
              {t("cart.checkout")} · {money(totals.total)}
            </Button>
            <Button variant="ghost" block onClick={() => go("/tienda/carrito")}>
              {t("cart.viewCart")}
            </Button>
          </div>
        )
      }
    >
      {lines.length === 0 ? (
        <EmptyState icon={ShoppingCartSimple} title={t("cart.empty")} text={t("cart.emptyText")}>
          <Button onClick={() => go("/tienda")}>{t("cart.startShopping")}</Button>
        </EmptyState>
      ) : (
        <div className="stack" style={{ "--stack-gap": "18px" }}>
          <ul className="cart-lines">
            {lines.map((line) => (
              <CartLine key={line.key} line={line} onNavigate={closeDrawer} compact />
            ))}
          </ul>
          <PromoCodeForm />
          <CartTotals />
        </div>
      )}
    </Drawer>
  );
}
