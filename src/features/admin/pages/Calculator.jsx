// Admin → Profit calculator: what the ride vehicle and the store leave each
// month after expenses (before HST and income tax). The numbers are saved in
// express_pricing/default → business, next to the trip costs.
import { useMemo, useState } from "react";
import { ArrowCounterClockwise, ArrowsDownUp, Car, Coins, FloppyDisk, Scales, Storefront } from "@phosphor-icons/react";
import * as admin from "@backend/admin";
import Button from "@/components/ui/Button";
import { TextField } from "@/components/ui/Field";
import { Spinner } from "@/components/ui/Misc";
import { CITIES } from "@/config/cities";
import { useToast } from "@/context/ToastContext";
import { DEFAULT_BUSINESS, businessInputs, businessMonth, driverCostPerMonth, loanPayment } from "@/lib/business";
import { money } from "@/lib/format";
import { pricingRules } from "@/lib/margin";
import { orderTotal } from "@/lib/orders";
import { Card, PageHead, Segmented, useAdminCity } from "../components/AdminUI";
import { StatTile } from "../components/Charts";
import { cityOf, isCancelledOrder, recordDate, useCollection, useNow } from "../lib";

const DAY = 86400000;
const WORK_DAYS = 26;
const dollars = (v) => (v < 0 ? `−${money(Math.round(-v), { whole: true })}` : money(Math.round(v), { whole: true }));
const cents = (v) => money(v);

// [key, label, step, hint?]
const RIDE_GROUPS = [
  {
    title: "The vehicle",
    fields: [
      ["vehiclePrice", "Van price ($)", "500"],
      ["downPayment", "Down payment ($)", "500"],
      ["loanRatePct", "Loan interest (% a year)", "0.1"],
      ["loanYears", "Loan years", "1"],
    ],
  },
  {
    title: "Running costs",
    fields: [
      ["insurancePerMonth", "Insurance per month ($)", "10", "A guess until you have the broker's quote for paying passengers (OPCF 6A)."],
      ["otherPerMonth", "Phone, washes, supplies, bookkeeping ($ a month)", "10"],
      ["fuelPrice", "Fuel ($ per litre)", "0.01"],
      ["litresPer100", "Fuel use (litres per 100 km)", "0.1", "Hybrid minivan ≈ 7.5 · regular minivan ≈ 11"],
      ["upkeepPerKm", "Maintenance and tires ($ per km)", "0.01"],
      ["kmPerRide", "Km per ride", "1", "Counting the drive to the pick-up and the way back after long rides."],
    ],
  },
  {
    title: "Rides",
    fields: [
      ["ridesPerMonth", "Rides per month", "10"],
      ["avgFare", "Average fare, with tax ($)", "0.5"],
      ["cardSharePct", "Paid by card (%)", "5"],
      ["cardFeePct", "Card fee (%)", "0.1"],
    ],
  },
];
const DRIVER_FIELDS = [
  ["driverHoursPerWeek", "Hours per week", "1", "Overtime (1.5×) starts after 44 hours."],
  ["driverWage", "Wage per hour ($)", "0.05"],
  ["employerExtrasPct", "Employer extras (% of the wage)", "0.5", "4% vacation pay, CPP, EI and WSIB."],
];
const CONTRACT_FIELDS = [
  ["contractHours", "Hours booked by businesses per month", "5", "Farms or companies paying by the hour to move their workers."],
  ["contractRate", "Price per hour, before tax ($)", "1"],
  ["contractKmPerHour", "Km driven per hour", "1"],
];
const STORE_FIELDS = [
  ["ordersPerMonth", "Orders per month", "5"],
  ["avgOrder", "Average order, with tax and delivery ($)", "1"],
  ["markupPct", "Markup on the supplier's price (%)", "1"],
  ["deliveryFee", "Delivery fee ($)", "0.5"],
  ["deliveryCost", "Delivery cost per order ($)", "0.5", "Fuel and wear when the ride car delivers between rides."],
  ["returnsPct", "Returns and damage (% of product sales)", "0.5"],
  ["toolsPerMonth", "BlueCart, hosting, domain ($ a month)", "1"],
  ["adsPerMonth", "Ads ($ a month)", "10"],
];

const toForm = (x) => ({
  hstPct: String(x.hstPct),
  rides: Object.fromEntries(Object.entries(x.rides).map(([k, v]) => [k, typeof v === "number" ? String(Math.round(v * 100) / 100) : v])),
  store: Object.fromEntries(Object.entries(x.store).map(([k, v]) => [k, String(Math.round(v * 100) / 100)])),
});

/** Completed rides and store orders of the last 30 days in this city. */
function useLast30(city) {
  const rides = useCollection("rides");
  const orders = useCollection("orders");
  const now = useNow();
  return useMemo(() => {
    const from = now - 30 * DAY;
    const recent = (r) => cityOf(r) === city && (recordDate(r)?.getTime() || 0) >= from;
    const done = rides.data.filter((r) => recent(r) && r.status === "completed");
    const fares = done
      .map((r) => (r.fare != null && r.fare !== "" ? Number(r.fare) : r.estimate ? (Number(r.estimate.low) + Number(r.estimate.high)) / 2 : NaN))
      .filter((v) => Number.isFinite(v) && v > 0);
    const sold = orders.data.filter((o) => recent(o) && !isCancelledOrder(o));
    const totals = sold.map(orderTotal).filter((v) => v > 0);
    const avg = (list) => (list.length ? list.reduce((s, v) => s + v, 0) / list.length : 0);
    return {
      ready: rides.status !== "loading" && orders.status !== "loading",
      rides: done.length,
      avgFare: avg(fares),
      orders: sold.length,
      avgOrder: avg(totals),
    };
  }, [rides.status, rides.data, orders.status, orders.data, now, city]);
}

export default function Calculator() {
  const { city } = useAdminCity();
  const pricing = useCollection("pricing");
  const settings = useCollection("settings");
  const last30 = useLast30(city);

  const saved = pricing.data.find((d) => d.id === "default");
  const citySettings = settings.data.find((d) => d.id === city);
  // what's not saved yet comes from the store's pricing rule and delivery fee
  const base = useMemo(() => {
    const business = saved?.business || {};
    return businessInputs({
      ...business,
      store: {
        markupPct: pricingRules(saved).margin.walmart,
        deliveryFee: citySettings?.store?.deliveryFee ?? DEFAULT_BUSINESS.store.deliveryFee,
        ...(business.store || {}),
      },
    });
  }, [saved, citySettings]);

  if (pricing.status === "loading" || settings.status === "loading") {
    return (
      <div className="ad-page-loading">
        <Spinner label="Loading…" />
      </div>
    );
  }
  return <CalculatorForm key={JSON.stringify(base)} base={base} last30={last30} cityName={CITIES[city]?.name || city} />;
}

function CalculatorForm({ base, last30, cityName }) {
  const toast = useToast();
  const [f, setF] = useState(() => toForm(base));
  const [saving, setSaving] = useState(false);
  const draft = businessInputs(f);
  const m = businessMonth(draft);
  const dirty = JSON.stringify(draft) !== JSON.stringify(base);
  const { rides: r, store: s } = m;
  const hired = draft.rides.driver === "hired";

  const set = (group, k) => (e) => setF((cur) => ({ ...cur, [group]: { ...cur[group], [k]: e.target.value } }));
  const setDriver = (driver) => setF((cur) => ({ ...cur, rides: { ...cur.rides, driver } }));

  // the same month with the other driver choice
  const other = businessMonth({ ...draft, rides: { ...draft.rides, driver: hired ? "owner" : "hired" } });
  // half and one and a half times your volumes
  const volumes = [0.5, 1, 1.5].map((k) => {
    const ridesN = Math.round(draft.rides.ridesPerMonth * k);
    const ordersN = Math.round(draft.store.ordersPerMonth * k);
    return { k, ridesN, ordersN, ...businessMonth(draft, { rides: { ridesPerMonth: ridesN }, store: { ordersPerMonth: ordersN } }) };
  });

  const useReal = () => {
    setF((cur) => ({
      ...cur,
      rides: {
        ...cur.rides,
        ...(last30.rides ? { ridesPerMonth: String(last30.rides) } : {}),
        ...(last30.avgFare ? { avgFare: String(Math.round(last30.avgFare * 100) / 100) } : {}),
      },
      store: {
        ...cur.store,
        ...(last30.orders ? { ordersPerMonth: String(last30.orders) } : {}),
        ...(last30.avgOrder ? { avgOrder: String(Math.round(last30.avgOrder * 100) / 100) } : {}),
      },
    }));
    toast.success("Filled in with the last 30 days");
  };

  async function save() {
    setSaving(true);
    try {
      await admin.savePricing({ business: draft });
      toast.success("Calculator saved");
    } catch (err) {
      console.error(err);
      toast.error("Could not save. Check your admin permissions.");
    } finally {
      setSaving(false);
    }
  }

  const loan = loanPayment(draft.rides.vehiclePrice - draft.rides.downPayment, draft.rides.loanRatePct, draft.rides.loanYears);
  const field = (group) =>
    function Field([k, label, step, hint]) {
      return <TextField key={k} label={label} type="number" min="0" step={step} inputMode="decimal" value={f[group][k]} onChange={set(group, k)} hint={hint} />;
    };
  const rideField = field("rides");
  const storeField = field("store");

  return (
    <div className="ad-page">
      <PageHead
        title="Profit calculator"
        subtitle="What the ride vehicle and the store leave each month after expenses — before HST and income tax."
        actions={
          <>
            <Button variant="ghost" size="sm" icon={ArrowCounterClockwise} onClick={() => setF(toForm(base))} disabled={!dirty}>
              Undo changes
            </Button>
            <Button size="sm" icon={FloppyDisk} onClick={save} loading={saving} disabled={!dirty}>
              Save
            </Button>
          </>
        }
      />

      <div className="ad-stats">
        <StatTile icon={Car} label="Rides profit / month" value={dollars(r.profit)} note={hired ? "With your employee driving" : "You drive (it's also your pay)"} />
        <StatTile icon={Storefront} label="Store profit / month" value={dollars(s.profit)} note={`${dollars(s.perOrder.margin)} left per order`} />
        <StatTile icon={Coins} label="Total / month" value={dollars(m.profit)} note={`${hired ? "If you drove yourself" : "With a hired driver"}: ${dollars(other.profit)}`} />
        <StatTile
          icon={Scales}
          label="Rides to break even"
          value={r.breakEven == null ? "—" : `${r.breakEven} / month`}
          note={r.breakEven == null ? "Each ride costs more than it brings in" : `≈ ${Math.ceil(r.breakEven / WORK_DAYS)} a day over ${WORK_DAYS} days`}
        />
      </div>

      <div className="ad-editor ad-calc">
        <div className="ad-editor__main">
          <Card title="Ride vehicle">
            {RIDE_GROUPS.map((g) => (
              <fieldset key={g.title} className="ad-fieldset">
                <legend>{g.title}</legend>
                <div className="form-grid">{g.fields.map(rideField)}</div>
                {g.title === "The vehicle" && (
                  <p className="ad-hint">
                    Loan payment: <strong>{dollars(loan)} a month</strong>
                    {draft.rides.downPayment > 0 && ` · ${dollars(draft.rides.downPayment)} down to start`}
                  </p>
                )}
              </fieldset>
            ))}
            <fieldset className="ad-fieldset">
              <legend>Who drives</legend>
              <Segmented
                label="Who drives"
                value={draft.rides.driver}
                onChange={setDriver}
                options={[
                  { value: "owner", label: "I drive" },
                  { value: "hired", label: "An employee" },
                ]}
              />
              {hired ? (
                <>
                  <div className="form-grid">{DRIVER_FIELDS.map(rideField)}</div>
                  <p className="ad-hint">
                    The employee costs <strong>{dollars(driverCostPerMonth(draft.rides))} a month</strong>. Register with WSIB within 10 days of hiring.
                  </p>
                </>
              ) : (
                <p className="ad-hint">The rides profit is also your pay for the hours you drive.</p>
              )}
            </fieldset>
            <fieldset className="ad-fieldset">
              <legend>Hours sold to businesses</legend>
              <div className="form-grid">{CONTRACT_FIELDS.map(rideField)}</div>
            </fieldset>
          </Card>

          <Card title="Store">
            <div className="form-grid">{STORE_FIELDS.map(storeField)}</div>
          </Card>
        </div>

        <div className="ad-editor__side">
          <Card title="This month" className="ad-calc__result">
            <table className="ad-table ad-calc__table">
              <tbody>
                <tr className="ad-calc__head">
                  <th colSpan={2}>Rides</th>
                </tr>
                <Line label={`${draft.rides.ridesPerMonth} rides × ${cents(r.perRide.fare)}`} value={r.rideRevenue} />
                {r.contractRevenue > 0 && <Line label={`${draft.rides.contractHours} business hours × ${cents(draft.rides.contractRate)}`} value={r.contractRevenue} />}
                <Line label="Fuel and upkeep" value={-r.running} />
                <Line label="Card fees" value={-r.cardFees} />
                <Line label="Van payment" value={-r.vehicle} />
                <Line label="Insurance" value={-r.insurance} />
                <Line label="Phone, washes, bookkeeping" value={-r.other} />
                {hired && <Line label="Driver's pay" value={-r.driver} />}
                <Line label="Rides profit" value={r.profit} total />
                <tr className="ad-calc__head">
                  <th colSpan={2}>Store</th>
                </tr>
                <Line label={`${draft.store.ordersPerMonth} orders: profit on products`} value={s.grossProfit} />
                <Line label="Delivery fees" value={s.fees} />
                <Line label="Deliveries" value={-s.delivery} />
                <Line label="Returns and damage" value={-s.returns} />
                <Line label="BlueCart, hosting, domain" value={-s.tools} />
                <Line label="Ads" value={-s.ads} />
                <Line label="Store profit" value={s.profit} total />
                <Line label="Total for the month" value={m.profit} total grand />
              </tbody>
            </table>
            <p className="ad-hint">
              Each ride leaves <strong>{cents(r.perRide.margin)}</strong> after fuel, upkeep and card fees; each order leaves <strong>{cents(s.perOrder.margin)}</strong>
              {s.breakEven != null && <> ({s.breakEven} orders a month cover the store&rsquo;s fixed costs)</>}.
            </p>
          </Card>

          <Card title="At other volumes">
            <table className="ad-table">
              <thead>
                <tr>
                  <th />
                  {volumes.map((v) => (
                    <th key={v.k} className="num">
                      {v.k === 1 ? "Yours" : `${v.k}×`}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>Rides / month</td>
                  {volumes.map((v) => (
                    <td key={v.k} className="num">
                      {v.ridesN}
                    </td>
                  ))}
                </tr>
                <tr>
                  <td>Orders / month</td>
                  {volumes.map((v) => (
                    <td key={v.k} className="num">
                      {v.ordersN}
                    </td>
                  ))}
                </tr>
                <tr>
                  <td>Rides profit</td>
                  {volumes.map((v) => (
                    <td key={v.k} className={`num ${v.rides.profit >= 0 ? "ad-good" : "ad-bad"}`}>
                      {dollars(v.rides.profit)}
                    </td>
                  ))}
                </tr>
                <tr>
                  <td>Store profit</td>
                  {volumes.map((v) => (
                    <td key={v.k} className={`num ${v.store.profit >= 0 ? "ad-good" : "ad-bad"}`}>
                      {dollars(v.store.profit)}
                    </td>
                  ))}
                </tr>
                <tr>
                  <td className="strong">Total</td>
                  {volumes.map((v) => (
                    <td key={v.k} className={`num strong ${v.profit >= 0 ? "ad-good" : "ad-bad"}`}>
                      {dollars(v.profit)}
                    </td>
                  ))}
                </tr>
              </tbody>
            </table>
          </Card>

          <Card title={`Last 30 days in ${cityName}`}>
            {!last30.ready ? (
              <Spinner label="Loading…" />
            ) : last30.rides || last30.orders ? (
              <>
                <ul className="ad-calc__real">
                  <li>
                    <span>Rides completed</span>
                    <strong>{last30.rides}</strong>
                    <small>{last30.avgFare ? `average ${cents(last30.avgFare)}` : "no prices yet"}</small>
                  </li>
                  <li>
                    <span>Store orders</span>
                    <strong>{last30.orders}</strong>
                    <small>{last30.avgOrder ? `average ${cents(last30.avgOrder)}` : "—"}</small>
                  </li>
                </ul>
                <Button variant="secondary" size="sm" icon={ArrowsDownUp} onClick={useReal}>
                  Use these numbers
                </Button>
              </>
            ) : (
              <p className="ad-hint">No completed rides or store orders yet. The calculator uses your estimates until real numbers come in.</p>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}

function Line({ label, value, total, grand }) {
  return (
    <tr className={total ? `ad-calc__total${grand ? " is-grand" : ""}` : undefined}>
      <td>{label}</td>
      <td className={`num ${total ? (value >= 0 ? "ad-good" : "ad-bad") : ""}`}>{dollars(value)}</td>
    </tr>
  );
}
