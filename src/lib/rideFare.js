// Ride prices shown on the website: an estimate range from the city's rates
// (Admin → Settings → Rides), plus the urgent-ride fee when the customer asks
// for priority. Plain functions so tests can use them.

/** Price range for a trip of `km` — null when estimates are off or the trip is long (we quote it). */
export function estimateFare(km, vehicle, r) {
  if (!km || !r?.showEstimates || km > (Number(r.maxEstimateKm) || 120)) return null;
  let base = Number(r.baseFare || 0) + Number(r.perKm || 0) * km;
  if (vehicle === "xl") base *= Number(r.xlMultiplier) || 1.3;
  base = Math.max(base, Number(r.minFare) || 0);
  return { low: Math.max(Number(r.minFare) || 0, Math.round(base * 0.9)), high: Math.round(base * 1.1) };
}

/** Can customers ask for an urgent (priority) ride? */
export const urgentOn = (r) => r?.urgentEnabled !== false;

/** What an urgent ride costs on top of the fare ($5 unless the settings say otherwise). */
export const urgentFeeOf = (r) => (urgentOn(r) ? Math.max(0, Number(r?.urgentFee ?? 5) || 0) : 0);

/** A price range with a flat fee added to both ends. */
export const withFee = (est, fee) => (est && fee > 0 ? { low: est.low + fee, high: est.high + fee } : est);
