// Trip costs: the rates in Settings, and the profit box in the trip editor.
import { useMemo, useState } from "react";
import { FloppyDisk, MagicWand, Warning } from "@phosphor-icons/react";
import * as admin from "@backend/admin";
import Button from "@/components/ui/Button";
import { SelectField, TextField } from "@/components/ui/Field";
import { Spinner } from "@/components/ui/Misc";
import { useToast } from "@/context/ToastContext";
import { breakEven, fixedCosts, isServiceLine, perPersonCost, suggestedPrice, travelCostRules, tripEconomics, VEHICLES } from "@/features/travel/lib/costs";
import { money } from "@/lib/format";
import { useCollection } from "../lib";
import { Card } from "./AdminUI";

/** The saved trip-cost rates, with the defaults filled in. */
export function useTravelCosts() {
  const { status, data } = useCollection("pricing");
  const saved = data.find((d) => d.id === "default")?.travel || null;
  const rules = useMemo(() => travelCostRules(saved), [saved]);
  return { status, rules };
}

// [key, label, step, hint]
const FIELDS = [
  ["fuelPrice", "Fuel ($ per litre)", "0.01"],
  ["crewPerDay", "Driver-guide pay per day ($)", "10", "Count it even when you drive: it's your work."],
  ["crewMealsPerDay", "Driver's meals per day ($)", "5"],
  ["crewRoomPerNight", "Driver's room per night ($)", "5", "When the trip doesn't set its own."],
  ["cardFeePct", "Card fees (% of the price)", "0.1"],
  ["contingencyPct", "Safety margin (% of the price)", "0.5", "Price changes, a parking ticket, a late night…"],
  ["targetMarginPct", "Profit you want (% of the price)", "1"],
  ["planningGroup", "Usual group (travellers)", "1", "Suggested prices count on this many."],
];
const VEHICLE_FIELDS = [
  ["seats", "Seats for travellers", "1"],
  ["dailyRate", "Rent per day, with insurance and taxes ($)", "5"],
  ["litresPer100", "Fuel (litres per 100 km)", "0.5"],
  ["kmIncludedPerDay", "Km included per day (0 = unlimited)", "50"],
  ["extraKmRate", "Each extra km ($)", "0.01"],
];
const dollars = (v) => money(Math.round(v), { whole: true });
const SERVICE_LABEL = { es: "Transporte, guía y organización", en: "Transport, guide and organization" };
const PARTS = {
  vehicle: "Vehicle",
  fuel: "Fuel",
  crew: "Driver-guide",
  crewMeals: "Driver's meals",
  crewRooms: "Driver's room",
  parking: "Parking",
  tollsAndFerries: "Tolls & ferries",
  other: "Other",
};
const SAMPLES = [
  ["Day trip, 300 km each way", { durationDays: 1, nights: 0, distanceKm: 300, ops: { localKm: 40, parkingPerDay: 30 } }],
  ["3 days and 2 nights, 300 km each way", { durationDays: 3, nights: 2, distanceKm: 300, ops: { localKm: 100, parkingPerDay: 30 } }],
];

const toForm = (r) => ({
  vehicle: r.vehicle,
  ...Object.fromEntries(FIELDS.map(([k]) => [k, String(r[k])])),
  vehicles: Object.fromEntries(Object.entries(r.vehicles).map(([key, v]) => [key, Object.fromEntries(VEHICLE_FIELDS.map(([k]) => [k, String(v[k])]))])),
});
// What gets saved: the numbers only (vehicle names come from the code)
const toSaved = (r) => ({ ...r, vehicles: Object.fromEntries(Object.entries(r.vehicles).map(([key, v]) => [key, Object.fromEntries(VEHICLE_FIELDS.map(([k]) => [k, v[k]]))])) });

export function TravelCostsCard() {
  const { status, rules } = useTravelCosts();
  if (status === "loading") {
    return (
      <Card title="Trip costs (all cities)">
        <Spinner label="Loading…" />
      </Card>
    );
  }
  return <TravelCostsForm key={JSON.stringify(rules)} rules={rules} />;
}

function TravelCostsForm({ rules }) {
  const toast = useToast();
  const [f, setF] = useState(() => toForm(rules));
  const [saving, setSaving] = useState(false);
  const draft = travelCostRules(f);
  const dirty = JSON.stringify(draft) !== JSON.stringify(rules);
  const set = (k) => (e) => setF((cur) => ({ ...cur, [k]: e.target.value }));
  const setVehicle = (key, k) => (e) => setF((cur) => ({ ...cur, vehicles: { ...cur.vehicles, [key]: { ...cur.vehicles[key], [k]: e.target.value } } }));

  async function save() {
    setSaving(true);
    try {
      await admin.savePricing({ travel: toSaved(draft) });
      toast.success("Trip costs saved. Open each trip to see its profit with them.");
    } catch (err) {
      console.error(err);
      toast.error("Could not save. Check your admin permissions.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card
      title="Trip costs (all cities)"
      actions={
        <Button size="sm" icon={FloppyDisk} onClick={save} loading={saving} disabled={!dirty}>
          Save trip costs
        </Button>
      }
    >
      <p className="ad-hint">
        What a departure costs you whatever the group size: the rented vehicle, its fuel, the driver-guide and their meals and room. Each trip adds its own
        distance, parking and tolls, and its price lines (tickets, meals, hotel) are paid per traveller. The trip editor shows the profit and suggests a price.
      </p>
      <SelectField
        label="Vehicle the trips use"
        value={f.vehicle}
        onChange={set("vehicle")}
        options={Object.entries(VEHICLES).map(([value, v]) => ({ value, label: v.label }))}
        hint="A trip can choose another one."
      />
      {Object.entries(VEHICLES).map(([key, v]) => (
        <fieldset key={key} className="ad-fieldset">
          <legend>{v.label}</legend>
          <div className="form-grid">
            {VEHICLE_FIELDS.map(([k, label, step]) => (
              <TextField key={k} label={label} type="number" min="0" step={step} value={f.vehicles[key][k]} onChange={setVehicle(key, k)} />
            ))}
          </div>
        </fieldset>
      ))}
      <div className="form-grid">
        {FIELDS.map(([k, label, step, hint]) => (
          <TextField key={k} label={label} type="number" min="0" step={step} value={f[k]} onChange={set(k)} hint={hint} />
        ))}
      </div>
      <ul className="ad-price-examples" aria-label="Examples">
        {SAMPLES.map(([label, trip]) => {
          const fixed = fixedCosts(trip, draft);
          return (
            <li key={label}>
              <span>{label}</span>
              <strong>{dollars(fixed.total)}</strong>
              <small>
                {dollars(fixed.total / draft.planningGroup)} each with {draft.planningGroup}
              </small>
            </li>
          );
        })}
      </ul>
      <p className="ad-hint">
        Before carrying paying passengers, check the rental contract allows it and that your insurance, licence and permits cover it (see README → Trips).
      </p>
    </Card>
  );
}

/** The trip editor's "Costs & profit" card. */
export function TripProfitCard({ trip, onChange }) {
  const { status, rules } = useTravelCosts();
  if (status === "loading") {
    return (
      <Card title="Costs & profit">
        <Spinner label="Loading…" />
      </Card>
    );
  }
  return <TripProfit trip={trip} rules={rules} onChange={onChange} />;
}

/** New adult price, with the transport/guide line changed so the price lines still add up to it. */
export function withPrice(trip, price) {
  const lines = trip.breakdown || [];
  const theirs = lines.filter((b) => !isServiceLine(b, lines)).reduce((s, b) => s + (Number(b.amount) || 0), 0);
  const ours = lines.filter((b) => isServiceLine(b, lines));
  const restOfOurs = ours.slice(1).reduce((s, b) => s + (Number(b.amount) || 0), 0);
  let breakdown;
  if (!ours.length) breakdown = [...lines, { kind: "service", label: SERVICE_LABEL, amount: Math.max(0, price - theirs) }];
  else if (price - theirs - restOfOurs >= 0) breakdown = lines.map((b) => (b === ours[0] ? { ...b, kind: "service", amount: price - theirs - restOfOurs } : b));
  else breakdown = lines.filter((b) => !ours.includes(b) || b === ours[0]).map((b) => (b === ours[0] ? { ...b, kind: "service", amount: Math.max(0, price - theirs) } : b));
  return { priceAdult: price, breakdown };
}

function TripProfit({ trip, rules, onChange }) {
  const ops = trip.ops || {};
  const setOps = (k) => (e) => onChange({ ops: { ...ops, [k]: e.target.value } });
  const fixed = fixedCosts(trip, rules);
  const perPerson = perPersonCost(trip);
  const seats = fixed.seats;
  const sizes = [...new Set([4, 6, 8, rules.planningGroup, seats])].filter((n) => n >= 1 && n <= seats).sort((a, b) => a - b);
  const rows = sizes.map((n) => tripEconomics(trip, rules, { travellers: n }));
  const even = breakEven(trip, rules);
  const suggested = suggestedPrice(trip, rules);
  const price = Number(trip.priceAdult) || 0;
  const offer = Number(trip.offer?.pct) || 0;
  const tooMany = (Number(trip.groupSize) || 0) > seats;
  const parts = Object.entries(fixed.parts).filter(([, v]) => v > 0);

  return (
    <Card title="Costs & profit">
      <div className="form-grid">
        <SelectField
          label="Vehicle"
          value={ops.vehicle || ""}
          onChange={setOps("vehicle")}
          options={[{ value: "", label: `Usual (${rules.vehicles[rules.vehicle].label})` }, ...Object.entries(VEHICLES).map(([value, v]) => ({ value, label: v.label }))]}
        />
        <TextField label="Driving around there (km)" type="number" min="0" value={ops.localKm ?? ""} onChange={setOps("localKm")} hint={`Plus ${Number(trip.distanceKm) || 0} km each way (Trip card)`} />
        <TextField label="Parking per day ($)" type="number" min="0" value={ops.parkingPerDay ?? ""} onChange={setOps("parkingPerDay")} />
        <TextField label="Tolls, whole trip ($)" type="number" min="0" value={ops.tolls ?? ""} onChange={setOps("tolls")} />
        <TextField label="Ferry for the vehicle ($)" type="number" min="0" value={ops.ferryVehicle ?? ""} onChange={setOps("ferryVehicle")} />
        <TextField
          label="Driver's room per night ($)"
          type="number"
          min="0"
          value={ops.crewRoomPerNight ?? ""}
          onChange={setOps("crewRoomPerNight")}
          hint={`Empty = ${dollars(rules.crewRoomPerNight)} (Settings)`}
        />
        <TextField className="span-2" label="Other costs per departure ($)" type="number" min="0" value={ops.otherFixed ?? ""} onChange={setOps("otherFixed")} />
      </div>

      <dl className="ad-kv ad-costs">
        <div>
          <dt>Each departure ({fixed.km.toLocaleString("en-CA")} km)</dt>
          <dd>
            <strong>{dollars(fixed.total)}</strong>
            <small>{parts.map(([k, v]) => `${PARTS[k]} ${dollars(v)}`).join(" · ")}</small>
          </dd>
        </div>
        <div>
          <dt>Each traveller (price lines except transport and guide)</dt>
          <dd>
            <strong>{dollars(perPerson)}</strong>
          </dd>
        </div>
      </dl>

      {price > 0 && (
        <div className="ad-table-wrap">
          <table className="ad-table ad-table--compact ad-profit">
            <thead>
              <tr>
                <th>Travellers</th>
                <th className="num">Sales</th>
                <th className="num">Costs</th>
                <th className="num">Profit</th>
                <th className="num">Margin</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.travellers} className={r.travellers === rules.planningGroup ? "is-plan" : ""}>
                  <td>
                    {r.travellers}
                    {r.travellers === seats && " (full)"}
                  </td>
                  <td className="num">{dollars(r.revenue)}</td>
                  <td className="num">{dollars(r.cost)}</td>
                  <td className={`num ${r.profit >= 0 ? "ad-good" : "ad-bad"}`}>{dollars(r.profit)}</td>
                  <td className="num">{Math.round(r.marginPct)}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {price > 0 && (
        <p className={`ad-hint ${even ? "" : "ad-bad"}`}>
          {even ? (
            even <= seats ? (
              <>
                No loss from <strong>{even}</strong> {even === 1 ? "traveller" : "travellers"}
                {offer > 0 && ` (with the ${offer}% offer)`}.
              </>
            ) : (
              <>
                <Warning size={14} weight="bold" /> It takes {even} travellers to cover the costs, more than the {seats} seats.
              </>
            )
          ) : (
            <>
              <Warning size={14} weight="bold" /> This price doesn't cover what each traveller costs.
            </>
          )}
        </p>
      )}
      {tooMany && (
        <p className="ad-hint ad-bad">
          <Warning size={14} weight="bold" /> Max group is {trip.groupSize}, but the vehicle takes {seats} travellers. Lower it, or plan a second vehicle.
        </p>
      )}

      {suggested && (
        <div className="ad-suggest">
          <p>
            For {rules.targetMarginPct}% profit with {rules.planningGroup} travellers: <strong>{dollars(suggested)}</strong>
            {offer > 0 && <small> before the {offer}% offer</small>}
          </p>
          {suggested !== price && (
            <Button size="sm" variant="secondary" icon={MagicWand} onClick={() => onChange(withPrice(trip, suggested))}>
              Use {dollars(suggested)}
            </Button>
          )}
        </div>
      )}
      <p className="ad-hint">Profit counts everyone at the adult price. Rates: Settings → Trip costs.</p>
    </Card>
  );
}
