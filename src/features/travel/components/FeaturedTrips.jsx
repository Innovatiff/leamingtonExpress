import { useTrips } from "../lib/trips";
import TripCard, { TripCardSkeleton } from "./TripCard";

/** Featured trips grid (home page). */
export default function FeaturedTrips({ limit = 4 }) {
  const { status, trips } = useTrips();
  const featured = trips.filter((t) => t.featured);
  const list = (featured.length >= limit ? featured : trips).slice(0, limit);
  return (
    <div className="trip-grid trip-grid--rail">
      {status === "loading" ? Array.from({ length: limit }, (_, i) => <TripCardSkeleton key={i} />) : list.map((trip) => <TripCard key={trip.id} trip={trip} />)}
    </div>
  );
}
