// Sample orders, rides, travel bookings and messages so the admin panel has
// something to show in demo mode. Never used in production builds.

const HOUR = 3600000;
const DAY = 24 * HOUR;

function rng(seed) {
  let s = seed;
  return () => {
    s = (s * 9301 + 49297) % 233280;
    return s / 233280;
  };
}

const FIRST = ["María", "José", "Juan", "Guadalupe", "Luis", "Ana", "Carlos", "Rosa", "Miguel", "Sofía", "Jorge", "Lucía", "Pedro", "Elena", "Ricardo", "Daniela"];
const LAST = ["Hernández", "García", "Martínez", "López", "González", "Pérez", "Ramírez", "Torres", "Flores", "Rivera", "Cruz", "Morales"];
const STREETS = ["Erie St S", "Talbot St W", "Oak St E", "Seacliff Dr W", "Mill St W", "Robson Rd", "Sherk St", "Elliott St"];
const TOWNS = [
  ["Leamington", "N8H"],
  ["Leamington", "N8H"],
  ["Leamington", "N8H"],
  ["Kingsville", "N9Y"],
  ["Wheatley", "N0P"],
];
const METHOD_LABEL = { cash: "Cash", etransfer: "E-transfer", card: "Debit / Credit Card" };

/** Sample employees for the employee app and the admin's Employees page. */
export const DEMO_STAFF = [
  {
    id: "demo-staff-carlos",
    name: "Carlos Méndez",
    email: "carlos@demo.local",
    phone: "5195550142",
    photo: "",
    active: true,
    can: { rides: true, deliveries: true, trips: false },
    vehicle: { make: "Toyota", model: "Sienna", color: "Gris", plate: "CXKP 214", seats: 7 },
    cities: ["leamington"],
    online: false,
  },
  {
    id: "demo-staff-ana",
    name: "Ana Rodríguez",
    email: "ana@demo.local",
    phone: "2265550177",
    photo: "",
    active: true,
    can: { rides: false, deliveries: false, trips: true },
    vehicle: { make: "Ford", model: "Transit (12 asientos)", color: "Blanca", plate: "BVTR 908", seats: 12 },
    cities: ["leamington"],
    online: false,
  },
  {
    id: "demo-staff-luis",
    name: "Luis Ortega",
    email: "luis@demo.local",
    phone: "5195550163",
    photo: "",
    active: true,
    can: { rides: true, deliveries: true, trips: true },
    vehicle: { make: "Honda", model: "CR-V", color: "Negra", plate: "DLMN 377", seats: 5 },
    cities: ["leamington"],
    online: false,
  },
  {
    id: "demo-staff-sofia",
    name: "Sofía Ramírez",
    email: "sofia@demo.local",
    phone: "2265550118",
    photo: "",
    active: false,
    can: { rides: false, deliveries: true, trips: false },
    vehicle: { make: "Nissan", model: "Versa", color: "Roja", plate: "CJRT 552", seats: 5 },
    cities: ["leamington"],
    online: false,
  },
];

const snapshotOf = (s) => ({ uid: s.id, name: s.name, phone: s.phone, photo: s.photo, vehicle: { make: s.vehicle.make, model: s.vehicle.model, color: s.vehicle.color, plate: s.vehicle.plate } });
const [CARLOS, ANA, LUIS] = DEMO_STAFF;

const pad = (n, len = 2) => String(n).padStart(len, "0");
const iso = (ms) => new Date(ms).toISOString();
const dayIso = (ms) => {
  const d = new Date(ms);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};
const money = (n) => Math.round(n * 100) / 100;

function person(r) {
  const first = FIRST[Math.floor(r() * FIRST.length)];
  const last = LAST[Math.floor(r() * LAST.length)];
  const phone = `${r() > 0.5 ? "519" : "226"}555${pad(Math.floor(r() * 10000), 4)}`;
  const email = r() > 0.35 ? `${first}.${last}`.toLowerCase().normalize("NFD").replace(/[^a-z.]/g, "") + "@example.com" : "";
  return { first, last, phone, email };
}

function price(raw) {
  const regular = Number(raw.pricing?.price) || 0;
  const current = Number(raw.pricing?.currentPrice) || 0;
  const now = current > 0 ? current : regular;
  return { now, old: regular > now ? regular : now };
}

export function seedAdminData(products, now = Date.now()) {
  const r = rng(20261028);
  const listed = products.filter((p) => price(p).now > 0);

  /* -------------------------------- Orders -------------------------------- */
  const orders = [];
  for (let i = 0; i < 30; i++) {
    const ageH = i < 3 ? 2 + i * 5 : i < 7 ? 20 + (i - 3) * 14 : 72 + (i - 7) * 28 + Math.floor(r() * 12);
    const created = now - ageH * HOUR;
    const who = person(r);
    const [town, fsa] = TOWNS[Math.floor(r() * TOWNS.length)];
    const method = ["cash", "cash", "etransfer", "card"][Math.floor(r() * 4)];
    const lines = [];
    const count = 1 + Math.floor(r() * 2.2);
    for (let k = 0; k < count; k++) {
      const raw = listed[Math.floor(r() * listed.length)];
      if (lines.some((l) => l.docId === raw.id)) continue;
      const { now: unit, old } = price(raw);
      const qty = r() > 0.85 ? 2 : 1;
      lines.push({
        docId: raw.id,
        productId: raw.productId || "",
        name: raw.name,
        image: raw.images?.[0] || "",
        category: raw.category || "",
        brand: raw.brand || "",
        sku: raw.sku || "",
        variant: Array.isArray(raw.variants) && raw.variants.length ? raw.variants[0] : "",
        quantity: qty,
        price: unit,
        oldPrice: old,
        lineTotal: money(unit * qty),
        lineSaved: money((old - unit) * qty),
        points: Number(raw.expressPoints) || 0,
        delivery: raw.delivery || { count: 2, unit: "hours" },
      });
    }
    const productsTotal = money(lines.reduce((s, l) => s + l.lineTotal, 0));
    const discount = i % 9 === 4 ? Math.min(10, productsTotal) : 0;
    const cancelled = i === 11 || i === 23;
    const stage =
      cancelled ? "Unfulfilled" : ageH < 6 ? "Unfulfilled" : ageH < 24 ? (i % 2 ? "Preparing" : "Unfulfilled") : ageH < 60 ? "Out for delivery" : "Fulfilled";
    const paid = !cancelled && (stage === "Fulfilled" || method === "card" || (method === "cash" && stage === "Out for delivery") || (method === "etransfer" && ageH > 10));
    orders.push({
      id: `demo-order-${pad(i + 1, 3)}`,
      orderNumber: `ODR${600100 + i * 37}`,
      date: new Date(created).toLocaleDateString("en-CA", { day: "2-digit", month: "short", year: "numeric" }),
      payment: cancelled ? "Expired" : paid ? "Success" : "Pending",
      paymentMethod: METHOD_LABEL[method],
      paymentMethodKey: method,
      customer: `${who.first} ${who.last}`,
      customerInfo: {
        firstName: who.first,
        lastName: who.last,
        fullName: `${who.first} ${who.last}`,
        phone: who.phone,
        email: who.email,
        address: `${10 + Math.floor(r() * 380)} ${STREETS[Math.floor(r() * STREETS.length)]}`,
        unit: r() > 0.8 ? `Apt ${1 + Math.floor(r() * 12)}` : "",
        city: town,
        province: "Ontario",
        country: "Canada",
        postalCode: `${fsa} ${1 + Math.floor(r() * 8)}${"ABCEGHJK"[Math.floor(r() * 8)]}${Math.floor(r() * 9)}`,
        orderNotes: i % 7 === 2 ? "Tocar el timbre dos veces, por favor." : "",
      },
      total: {
        productsTotal,
        shipping: 5,
        discount,
        tax: 0,
        totalSaved: money(lines.reduce((s, l) => s + l.lineSaved, 0)),
        totalAccumulatedPoints: lines.reduce((s, l) => s + l.points * l.quantity, 0),
        finalTotal: money(productsTotal - discount + 5),
      },
      discountCode: discount ? "BIENVENIDO10" : "",
      discountAmount: discount,
      productsCount: lines.reduce((s, l) => s + l.quantity, 0),
      fulfilment: stage,
      ...(stage === "Out for delivery" || stage === "Fulfilled"
        ? { courierUid: (i % 2 ? LUIS : CARLOS).id, courier: snapshotOf(i % 2 ? LUIS : CARLOS), courierAt: iso(created + HOUR) }
        : { courierUid: null }),
      ...(stage === "Fulfilled" ? { deliveredAt: iso(created + 3 * HOUR) } : {}),
      status: cancelled ? "Cancelled" : stage === "Fulfilled" ? "Closed" : "Opened",
      priority: !cancelled && ageH < 30 && i % 3 === 0,
      inventoryApplied: !cancelled,
      products: lines,
      source: "web",
      channel: "web-v2",
      city: "leamington",
      lang: r() > 0.2 ? "es" : "en",
      userId: null,
      accessToken: `demo-token-${i}`,
      createdAt: iso(created),
      updatedAt: iso(created + 2 * HOUR),
    });
  }

  /* --------------------------------- Rides -------------------------------- */
  const PLACES = [
    ["Aeropuerto de Windsor (YQG)", "yqg", 42],
    ["Consulado de México en Leamington", "consulate", 2],
    ["Hospital Erie Shores HealthCare", "hospital", 3],
    ["Devonshire Mall (Windsor)", "devonshire", 46],
    ["Aeropuerto de Toronto Pearson (YYZ)", "yyz", 320],
    ["Walmart Leamington", "walmart", 3],
    ["Estación de tren VIA Rail (Windsor)", "via-windsor", 52],
  ];
  const RIDE_STATES = ["requested", "requested", "confirmed", "assigned", "requested", "completed", "completed", "cancelled", "completed", "completed"];
  const rides = RIDE_STATES.map((status, i) => {
    const who = person(r);
    const [label, presetId, km] = PLACES[i % PLACES.length];
    const created = now - (i < 5 ? (i + 1) * 3 * HOUR : (i - 3) * 2 * DAY);
    const scheduled = i === 1 || i === 2 || i === 3;
    const atRaw = new Date(now + (8 + i * 20) * HOUR);
    atRaw.setMinutes(atRaw.getMinutes() < 30 ? 0 : 30, 0, 0);
    const at = scheduled ? atRaw.getTime() : 0;
    const base = Math.max(12, 4.5 + 1.95 * km);
    const fare = status === "requested" ? null : Math.round(base);
    return {
      id: `demo-ride-${pad(i + 1, 3)}`,
      ref: `R-${(0x5a3f00 + i * 7919).toString(36).toUpperCase().slice(-6)}`,
      city: "leamington",
      lang: "es",
      pickup: { address: `${20 + i * 31} ${STREETS[i % STREETS.length]}, Leamington`, lat: null, lng: null },
      dropoff: { address: label, presetId, km },
      schedule: scheduled
        ? { type: "later", date: dayIso(at), time: `${pad(new Date(at).getHours())}:${pad(new Date(at).getMinutes())}`, at: iso(at) }
        : { type: "now", date: "", time: "", at: "" },
      passengers: 1 + (i % 4),
      luggage: presetId === "yqg" || presetId === "yyz" ? 2 : 0,
      vehicle: i % 4 === 3 ? "xl" : "standard",
      options: { childSeat: i === 2, wheelchair: false, pet: false, stops: false },
      stops: "",
      notes: presetId === "yqg" ? "Vuelo a CDMX a las 6:40 am" : "",
      contact: { name: `${who.first} ${who.last}`, phone: who.phone, email: who.email },
      payment: ["cash", "card", "etransfer"][i % 3],
      estimate: km <= 120 ? { low: Math.round(base * 0.9), high: Math.round(base * 1.1), km } : null,
      status,
      fare,
      trackToken: `demo-ride-token-${i + 1}`,
      driverUid: status === "assigned" || status === "completed" ? CARLOS.id : null,
      driver: status === "assigned" || status === "completed" ? snapshotOf(CARLOS) : null,
      ...(status === "assigned" || status === "completed" ? { assignedAt: iso(created + HOUR) } : {}),
      ...(status === "completed" ? { pickedUpAt: iso(created + 2 * HOUR), completedAt: iso(created + 3 * HOUR) } : {}),
      userId: null,
      createdAt: iso(created),
      updatedAt: iso(created + HOUR),
    };
  });

  // Finished rides from the last two months, so the dashboard has a history
  const WEIGHTED = [0, 0, 0, 0, 1, 1, 1, 2, 2, 2, 3, 3, 4, 5, 5, 5, 5, 6, 6];
  const HOURS = [5, 6, 7, 8, 8, 9, 11, 13, 15, 16, 17, 17, 18, 19, 21];
  for (let i = 0; i < 48; i++) {
    const who = person(r);
    const [label, presetId, km] = PLACES[WEIGHTED[Math.floor(r() * WEIGHTED.length)]];
    const day = new Date(now - (1 + Math.floor(r() * 59)) * DAY);
    day.setHours(HOURS[Math.floor(r() * HOURS.length)], Math.floor(r() * 4) * 15, 0, 0);
    const created = day.getTime();
    const cancelled = r() < 0.1;
    const driver = r() < 0.55 ? CARLOS : LUIS;
    const base = Math.max(12, 4.5 + 1.95 * km);
    rides.push({
      id: `demo-ride-h${pad(i + 1, 3)}`,
      ref: `R-${(0x3b2e00 + i * 5381).toString(36).toUpperCase().slice(-6)}`,
      city: "leamington",
      lang: r() < 0.8 ? "es" : "en",
      pickup: { address: `${10 + Math.floor(r() * 400)} ${STREETS[Math.floor(r() * STREETS.length)]}, Leamington`, lat: null, lng: null },
      dropoff: { address: label, presetId, km },
      schedule: { type: "now", date: "", time: "", at: "" },
      passengers: 1 + Math.floor(r() * 3),
      luggage: presetId === "yqg" || presetId === "yyz" ? 2 : 0,
      vehicle: r() < 0.2 ? "xl" : "standard",
      options: { childSeat: false, wheelchair: false, pet: false, stops: false },
      stops: "",
      notes: "",
      contact: { name: `${who.first} ${who.last}`, phone: who.phone, email: who.email },
      payment: ["cash", "cash", "cash", "card", "etransfer"][Math.floor(r() * 5)],
      estimate: km <= 120 ? { low: Math.round(base * 0.9), high: Math.round(base * 1.1), km } : null,
      status: cancelled ? "cancelled" : "completed",
      fare: cancelled ? null : Math.round(base * (0.95 + r() * 0.12)),
      trackToken: `demo-ride-token-h${i + 1}`,
      driverUid: cancelled ? null : driver.id,
      driver: cancelled ? null : snapshotOf(driver),
      ...(cancelled
        ? { cancelledAt: iso(created + 20 * 60000) }
        : { assignedAt: iso(created + 4 * 60000), pickedUpAt: iso(created + 18 * 60000), completedAt: iso(created + (30 + km) * 60000) }),
      userId: null,
      createdAt: iso(created),
      updatedAt: iso(created + HOUR),
    });
  }

  /* ------------------------------- Bookings ------------------------------- */
  const TRIPS = [
    { id: "niagara-falls-dia", title: "Cataratas del Niágara: día clásico", type: "day", dest: "Niagara Falls, ON", adult: 229, child: 169, offer: 10, nights: 0, time: "06:00", weekday: 0 },
    { id: "toronto-en-un-dia", title: "Toronto en un día", type: "day", dest: "Toronto, ON", adult: 239, child: 179, offer: 0, nights: 0, time: "06:30", weekday: 6 },
    { id: "niagara-fallsview-fin-de-semana", title: "Fin de semana Fallsview en Niagara", type: "weekend", dest: "Niagara Falls, ON", adult: 549, child: 249, offer: 8, nights: 1, time: "07:00", weekday: 6 },
    { id: "tobermory-bruce", title: "Tobermory y la península de Bruce", type: "weekend", dest: "Tobermory, ON", adult: 749, child: 449, offer: 0, nights: 2, time: "06:00", weekday: 5 },
    { id: "frankenmuth-outlets", title: "Frankenmuth y outlets de Birch Run", type: "day", dest: "Frankenmuth & Birch Run, Michigan", adult: 189, child: 129, offer: 0, nights: 0, time: "07:00", weekday: 6 },
  ];
  const BOOK_STATES = ["pending", "pending", "confirmed", "deposit_paid", "paid", "cancelled", "pending"];
  const nextWeekday = (from, weekday, weeksAhead) => {
    const d = new Date(from);
    d.setHours(0, 0, 0, 0);
    d.setDate(d.getDate() + ((weekday - d.getDay() + 7) % 7) + 7 * weeksAhead);
    return d.getTime();
  };
  const bookings = BOOK_STATES.map((status, i) => {
    const trip = TRIPS[i % TRIPS.length];
    const who = person(r);
    const adults = 1 + (i % 4);
    const children = i % 3 === 0 ? 1 : 0;
    const base = adults * trip.adult + children * trip.child;
    const pct = Math.max(trip.offer, adults + children >= 6 ? 5 : 0);
    const discount = Math.round((base * pct) / 100);
    const supplement = trip.nights > 0 && adults === 1 && children === 0 ? 199 : 0;
    const total = base - discount + supplement;
    const deposit = Math.ceil(total * 0.25);
    const created = now - (i + 1) * 19 * HOUR;
    return {
      id: `demo-booking-${pad(i + 1, 3)}`,
      ref: `V-${(0x7b2e00 + i * 104729).toString(36).toUpperCase().slice(-6)}`,
      city: "leamington",
      lang: "es",
      channel: "web-v2",
      tripId: trip.id,
      tripTitle: trip.title,
      tripType: trip.type,
      destination: trip.dest,
      date: dayIso(nextWeekday(now, trip.weekday, 2 + (i % 3))),
      departureTime: trip.time,
      nights: trip.nights,
      adults,
      children,
      singleRoom: supplement > 0,
      pricing: {
        currency: "CAD",
        adultUnit: trip.adult,
        childUnit: trip.child,
        base,
        discountPct: pct,
        discountKind: pct === 0 ? null : pct === trip.offer ? "offer" : "group",
        discount,
        supplement,
        total,
        depositPct: 25,
        deposit,
      },
      lead: { name: `${who.first} ${who.last}`, phone: who.phone, email: who.email },
      travelers: adults + children > 1 ? [`${FIRST[(i + 3) % FIRST.length]} ${who.last}`] : [],
      requests: i === 2 ? "Celebramos un aniversario" : "",
      payPref: ["etransfer", "cash", "card"][i % 3],
      confirms: { passport: trip.id === "frankenmuth-outlets", adults: false },
      status,
      amountPaid: status === "paid" ? total : status === "deposit_paid" ? deposit : 0,
      trackToken: `demo-booking-token-${i + 1}`,
      guideUid: status === "paid" ? ANA.id : null,
      ...(status === "paid" ? { guide: snapshotOf(ANA), tripStage: "assigned", guideAt: iso(created + 5 * HOUR) } : { tripStage: "" }),
      userId: null,
      createdAt: iso(created),
      updatedAt: iso(created + 3 * HOUR),
    };
  });

  /* ------------------------------- Messages ------------------------------- */
  const messages = [
    { topic: "viajes", message: "Hola, somos un grupo de 12 compañeros de trabajo y queremos ir a Niagara en junio. ¿Nos pueden cotizar?", status: "new", hoursAgo: 5 },
    { topic: "tienda", message: "¿Tienen el iPhone en color azul? Lo quiero apartar para el viernes.", status: "new", hoursAgo: 26 },
    { topic: "ride", message: "Necesito un ride al aeropuerto de Toronto para 4 personas el próximo mes, ¿cuánto sería?", status: "read", hoursAgo: 60 },
    { topic: "otro", message: "Gracias por la entrega tan rápida, ¡excelente servicio!", status: "archived", hoursAgo: 140 },
  ].map((m, i) => {
    const who = person(r);
    return {
      id: `demo-msg-${pad(i + 1, 3)}`,
      name: `${who.first} ${who.last}`,
      phone: who.phone,
      email: who.email,
      topic: m.topic,
      message: m.message,
      city: "leamington",
      lang: "es",
      status: m.status,
      userId: null,
      createdAt: iso(now - m.hoursAgo * HOUR),
      updatedAt: iso(now - m.hoursAgo * HOUR),
    };
  });

  const staff = DEMO_STAFF.map((s) => ({ ...s, uid: s.id, createdAt: iso(now - 40 * DAY), updatedAt: iso(now - 2 * DAY) }));

  return { orders, rides, bookings, messages, staff };
}
