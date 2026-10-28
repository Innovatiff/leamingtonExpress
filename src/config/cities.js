// Every "Express" city runs from this same codebase and Firebase project.
// To launch a new city: set `active: true`, point its domain at a new Netlify
// site built from this repo, and (optionally) set VITE_CITY on that site.
// Anything under `defaults` can later be changed from Admin → Settings.

const LEAMINGTON_DESTINATIONS = [
  // km = approximate road distance from downtown Leamington (used for fare estimates)
  { id: "walmart", group: "local", km: 3, label: { es: "Walmart Leamington", en: "Walmart Leamington" } },
  { id: "hospital", group: "local", km: 3, label: { es: "Hospital Erie Shores HealthCare", en: "Erie Shores HealthCare (hospital)" } },
  { id: "consulate", group: "local", km: 2, label: { es: "Consulado de México en Leamington", en: "Consulate of Mexico in Leamington" } },
  { id: "ferry", group: "local", km: 2, label: { es: "Ferry a Pelee Island (muelle)", en: "Pelee Island ferry dock" } },
  { id: "pointpelee", group: "local", km: 11, label: { es: "Parque Nacional Point Pelee", en: "Point Pelee National Park" } },
  { id: "kingsville", group: "local", km: 12, label: { es: "Kingsville", en: "Kingsville" } },
  { id: "wheatley", group: "local", km: 16, label: { es: "Wheatley", en: "Wheatley" } },
  { id: "essex", group: "local", km: 26, label: { es: "Essex", en: "Essex" } },
  { id: "yqg", group: "airport", km: 42, label: { es: "Aeropuerto de Windsor (YQG)", en: "Windsor Airport (YQG)" } },
  { id: "devonshire", group: "city", km: 46, label: { es: "Devonshire Mall (Windsor)", en: "Devonshire Mall (Windsor)" } },
  { id: "windsor", group: "city", km: 50, label: { es: "Centro de Windsor", en: "Downtown Windsor" } },
  { id: "via-windsor", group: "city", km: 52, label: { es: "Estación VIA Rail Windsor", en: "VIA Rail Windsor station" } },
  { id: "chatham", group: "city", km: 58, label: { es: "Chatham", en: "Chatham" } },
  { id: "dtw", group: "airport", km: 92, crossBorder: true, label: { es: "Aeropuerto de Detroit (DTW)", en: "Detroit Metro Airport (DTW)" } },
  { id: "london", group: "city", km: 175, label: { es: "London, Ontario", en: "London, Ontario" } },
  { id: "yyz", group: "airport", km: 320, label: { es: "Aeropuerto de Toronto Pearson (YYZ)", en: "Toronto Pearson Airport (YYZ)" } },
];

export const CITIES = {
  leamington: {
    id: "leamington",
    name: "Leamington",
    brand: "Leamington Express",
    domains: ["leamingtonexpress.ca"],
    siteUrl: "https://leamingtonexpress.ca",
    province: "ON",
    active: true,
    serviceArea: ["Leamington", "Kingsville", "Wheatley", "Ruthven", "Cottam", "Essex", "Harrow"],
    rideDestinations: LEAMINGTON_DESTINATIONS,
    defaults: {},
  },
  windsor: {
    id: "windsor",
    name: "Windsor",
    brand: "Windsor Express",
    domains: ["windsorexpress.ca"],
    siteUrl: "https://windsorexpress.ca",
    province: "ON",
    active: false,
    serviceArea: ["Windsor", "Tecumseh", "LaSalle", "Lakeshore", "Amherstburg"],
    rideDestinations: [],
    defaults: {},
  },
  london: {
    id: "london",
    name: "London",
    brand: "London Express",
    domains: ["londonexpress.ca"],
    siteUrl: "https://londonexpress.ca",
    province: "ON",
    active: false,
    serviceArea: ["London", "St. Thomas", "Strathroy"],
    rideDestinations: [],
    defaults: {},
  },
};

// Defaults for every city. Admin → Settings saves overrides in
// Firestore (express_settings/{cityId}) which are merged on top of these.
export const DEFAULT_SETTINGS = {
  announcement: { es: "", en: "" },
  contact: {
    phone: "",
    whatsapp: "",
    email: "",
    address: "",
    instagram: "",
    facebook: "",
    tiktok: "",
  },
  store: {
    enabled: true,
    deliveryFee: 5,
    freeDeliveryOver: 0, // 0 = never free
    taxIncluded: true,
    payments: { cash: true, etransfer: true, card: false },
    etransferEmail: "",
    eventTitle: { es: "Temporada de regalos", en: "Gift season" },
    eventSubtitle: {
      es: "Ideas para sorprender a los que más quieres.",
      en: "Gift ideas for the people you love most.",
    },
  },
  ride: {
    enabled: true,
    showEstimates: true,
    baseFare: 4.5,
    perKm: 1.95,
    minFare: 12,
    xlMultiplier: 1.35,
    maxEstimateKm: 120, // longer trips get a personal quote
  },
  travel: {
    enabled: true,
    depositPct: 25,
    groupDiscount: { min: 6, pct: 5 }, // 5% off for groups of 6+ (set pct to 0 to disable)
    pickupPoint: { es: "Leamington — te confirmamos el punto exacto al reservar", en: "Leamington — exact pick-up point confirmed when you book" },
  },
};
