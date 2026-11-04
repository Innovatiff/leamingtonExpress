// The store's departments and categories: their names in Spanish and English, their icons,
// and where the categories of Walmart, Amazon and spreadsheets land among them.
//
// Products keep the English value (category "Television", department "Electronics") and the
// store shows the label ("Televisores" / "TVs"). Other names for the same thing (aka) are
// understood too: "TVs", "Televisores", "Smart Watches"… A value the store doesn't know still
// works: it shows as it was typed.
//
// Only ./text.js is imported, so the admin, the store, the tests and the product check
// (scripts/check-products.js) all use this same file.
import { normalize } from "./text.js";

/* ------------------------------------------------------------------------ */
/* Departments                                                               */
/* ------------------------------------------------------------------------ */

const dept = (value, es, en, icon, aka = []) => ({ value, es, en, icon, aka });

export const DEPARTMENTS = [
  dept("Electronics", "Electrónica", "Electronics", "Lightning", [
    "electronicos", "electronic", "electronics & office", "tv & video", "tvs & video", "audio", "cell phones", "cell phones & accessories",
    "computers", "computers & accessories", "computers & tablets", "video games", "cameras & photo", "camera & photo", "wearable technology",
  ]),
  dept("Home", "Hogar", "Home", "House", [
    "casa", "home & kitchen", "kitchen", "kitchen & dining", "home & garden", "furniture", "home improvement", "tools & home improvement",
    "patio & garden", "patio, lawn & garden", "garden", "appliances", "bed & bath", "home decor",
  ]),
  dept("Toys", "Juguetes", "Toys", "PuzzlePiece", ["toys & games", "toys and games"]),
  dept("Baby", "Bebés", "Baby", "Baby", ["baby products", "bebe"]),
  dept("Personal care", "Cuidado personal", "Personal care", "Sparkle", ["hair care", "beauty", "beauty & personal care", "health & beauty", "bath & body"]),
  dept("Health", "Salud", "Health", "FirstAidKit", ["health & household", "health & wellness", "pharmacy", "wellness"]),
  dept("Sports", "Deportes", "Sports & outdoors", "Barbell", [
    "sports & outdoors", "sports and outdoors", "sports & recreation", "sports & fitness", "sports, fitness & outdoors", "outdoor recreation", "exercise & fitness",
  ]),
  dept("Fashion", "Moda", "Fashion", "TShirt", [
    "clothing", "apparel", "clothing & accessories", "clothing, shoes & accessories", "clothing, shoes & jewelry", "clothing, shoes & jewellery",
  ]),
  dept("Handbags", "Bolsos y accesorios", "Bags & accessories", "Handbag", ["bags", "bags & accessories", "handbags & accessories", "luggage & travel gear", "luggage & bags"]),
  dept("Pets", "Mascotas", "Pets", "PawPrint", ["pet", "pet supplies"]),
  dept("Auto", "Automotriz", "Auto", "Car", ["automotive", "auto & tires", "auto & vehicles", "auto parts & accessories"]),
  dept("Office", "Oficina y escuela", "Office & school", "Briefcase", [
    "oficina", "office products", "office supplies", "office & school supplies", "school & office supplies", "stationery", "office & stationery",
  ]),
  dept("Grocery", "Despensa", "Grocery", "Basket", ["grocery & gourmet food", "food", "pantry", "food & beverages", "household essentials"]),
  dept("Seasonal", "Temporada", "Seasonal", "Gift", ["holiday", "holidays", "party & occasions", "seasonal decor"]),
  dept("Other", "Otros", "Other", "Package", ["misc", "miscellaneous", "uncategorized"]),
];

/* ------------------------------------------------------------------------ */
/* Categories                                                                */
/* ------------------------------------------------------------------------ */
// generic: a catch-all of its department; a more precise category found elsewhere in the
// supplier's path (or in the product's name) wins over it.

const cat = (value, es, en, icon, department, aka = [], more = {}) => ({ value, es, en, icon, department, aka, ...more });

export const CATEGORIES = [
  // Electronics
  cat("Television", "Televisores", "TVs", "Television", "Electronics", ["tv", "televisions", "televisor", "smart tvs", "smart tv"]),
  cat("TV accessories", "Accesorios para TV", "TV accessories", "TelevisionSimple", "Electronics", ["tv mounts", "tv wall mounts", "antennas", "tv antennas", "remote controls", "universal remotes"]),
  cat("Streaming devices", "Dispositivos de streaming", "Streaming devices", "Broadcast", "Electronics", ["streaming media players", "streaming players", "streaming sticks", "media streamers"]),
  cat("Projectors", "Proyectores", "Projectors", "ProjectorScreen", "Electronics"),
  cat("Soundbars", "Barras de sonido", "Soundbars", "SpeakerHifi", "Electronics", ["sound bars", "home theater", "home theatre"]),
  cat("Earbuds", "Audífonos inalámbricos", "Earbuds", "Headset", "Electronics", ["true wireless earbuds", "wireless earbuds", "earphones", "in-ear headphones", "earbud headphones"]),
  cat("Headphones", "Audífonos", "Headphones", "Headphones", "Electronics", ["on-ear headphones", "over-ear headphones", "wireless headphones", "headsets", "gaming headsets"]),
  cat("Speaker", "Bocinas", "Speakers", "SpeakerHifi", "Electronics", ["bluetooth speakers", "portable speakers", "party speakers", "smart speakers", "bocina"]),
  cat("Phone", "Celulares", "Phones", "DeviceMobile", "Electronics", ["phones", "cell phones", "smartphones", "unlocked phones", "prepaid phones", "mobile phones", "celular"]),
  cat("Phone accessories", "Accesorios para celular", "Phone accessories", "BatteryCharging", "Electronics", [
    "cell phone accessories", "chargers", "phone cases", "cases", "power banks", "screen protectors", "charging cables",
  ]),
  cat("Tablet", "Tabletas", "Tablets", "DeviceTablet", "Electronics", ["ipads", "android tablets", "kids tablets", "e-readers", "tableta"]),
  cat("Laptop", "Laptops", "Laptops", "Laptop", "Electronics", ["notebook computers", "chromebooks", "macbooks", "laptops & notebooks"]),
  cat("PC", "Computadoras", "Desktop PCs", "Desktop", "Electronics", ["pcs", "desktops", "desktop computers", "all-in-one computers", "computadora"]),
  cat("Monitor", "Monitores", "Monitors", "Monitor", "Electronics", ["computer monitors", "gaming monitors"]),
  cat("Printer", "Impresoras", "Printers", "Printer", "Electronics", ["printers & scanners", "ink & toner", "printer ink"]),
  cat("Computer accessories", "Accesorios de computadora", "Computer accessories", "Mouse", "Electronics", [
    "keyboards", "mice", "keyboards & mice", "webcams", "networking", "routers", "wifi & networking", "computer components",
  ]),
  cat("Data storage", "Almacenamiento", "Data storage", "HardDrives", "Electronics", [
    "hard drives", "external hard drives", "external drives", "solid state drives", "usb flash drives", "flash drives", "memory cards",
  ]),
  cat("Watch", "Relojes inteligentes", "Smartwatches", "Watch", "Electronics", ["smartwatches", "smart watches", "smart watch", "smartwatch", "reloj inteligente"]),
  cat("Fitness trackers", "Pulseras de actividad", "Fitness trackers", "Heartbeat", "Electronics", ["activity trackers", "fitness bands"]),
  cat("Camera", "Cámaras", "Cameras", "Camera", "Electronics", ["digital cameras", "instant cameras", "instant film cameras", "action cameras", "camcorders", "camara"]),
  cat("Gaming", "Videojuegos", "Gaming", "GameController", "Electronics", ["video games", "video game consoles", "consoles", "videojuego"]),
  cat("Smart home", "Hogar inteligente", "Smart home", "Lightbulb", "Electronics", ["smart home devices", "security cameras", "video doorbells", "smart lighting", "smart plugs"]),

  // Home
  cat("Furniture", "Muebles", "Furniture", "Armchair", "Home", ["tv stands", "office chairs", "gaming chairs", "mattresses"]),
  cat("Bedding", "Ropa de cama", "Bedding", "Bed", "Home", ["sheets", "bed sheets", "comforters", "pillows", "blankets"]),
  cat("Kitchen appliances", "Electrodomésticos de cocina", "Kitchen appliances", "CookingPot", "Home", [
    "small appliances", "small kitchen appliances", "coffee machines", "coffee makers", "coffee, tea & espresso", "air fryers", "blenders", "microwaves",
  ]),
  cat("Kitchen & dining", "Cocina y comedor", "Kitchen & dining", "ForkKnife", "Home", ["cookware", "bakeware", "dinnerware", "drinkware", "kitchen utensils"]),
  cat("Vacuum", "Aspiradoras", "Vacuums", "Broom", "Home", ["robot vacuums", "stick vacuums", "vacuums & floor care", "floor care"]),
  cat("Fans & heaters", "Ventiladores y calefactores", "Fans & heaters", "Fan", "Home", ["fans", "heaters", "space heaters", "heating & cooling", "air purifiers", "humidifiers"]),
  cat("Home decor", "Decoración", "Home decor", "Lamp", "Home", ["decor", "lighting", "lamps", "rugs", "curtains", "wall art"]),
  cat("Tools", "Herramientas", "Tools", "Wrench", "Home", ["power tools", "hand tools", "lawn & garden tools"]),

  // Toys
  cat("Toys", "Juguetes", "Toys", "Smiley", "Toys", ["kids toys", "toys for kids", "educational toys", "stem toys"], { generic: true }),
  cat("Baby toys", "Juguetes para bebés", "Baby & toddler toys", "Baby", "Toys", ["baby & toddler toys", "toddler toys", "infant toys", "preschool toys", "preschool"]),
  cat("Foam blasters", "Lanzadores de espuma", "Foam blasters", "Target", "Toys", ["blasters", "blasters & foam play", "dart blasters", "nerf"]),
  cat("Building sets", "Bloques y construcción", "Building sets", "Cube", "Toys", ["building toys", "building blocks", "building sets & blocks", "lego"]),
  cat("Dolls", "Muñecas", "Dolls", "PersonSimple", "Toys", ["dolls & accessories", "dollhouses"]),
  cat("Action figures", "Figuras de acción", "Action figures", "Robot", "Toys", ["figures", "action figures & playsets"]),
  cat("Toy vehicles", "Vehículos de juguete", "Toy vehicles", "Car", "Toys", ["toy cars", "rc cars", "remote control toys", "vehicles & remote control"]),
  cat("Games & puzzles", "Juegos de mesa y rompecabezas", "Games & puzzles", "PuzzlePiece", "Toys", ["games", "board games", "puzzles", "card games"]),
  cat("Plush", "Peluches", "Plush toys", "Heart", "Toys", ["plush toys", "stuffed animals", "stuffed animals & plush"]),
  cat("Outdoor toys", "Juguetes para exteriores", "Outdoor toys", "Sun", "Toys", ["outdoor play", "sports & outdoor play", "water toys", "ride-on toys"]),
  cat("Arts & crafts", "Manualidades", "Arts & crafts", "PaintBrush", "Toys", ["crafts", "art supplies", "kids arts & crafts"]),

  // Baby
  cat("Baby gear", "Artículos para bebé", "Baby gear", "BabyCarriage", "Baby", ["strollers", "car seats", "high chairs", "baby monitors"]),
  cat("Diapers", "Pañales y toallitas", "Diapers & wipes", "Baby", "Baby", ["diapers & wipes", "diapering", "wipes"]),

  // Personal care
  cat("Hair Straightener", "Planchas y rizadores", "Hair styling tools", "HairDryer", "Personal care", [
    "hair straighteners", "flat irons", "straighteners", "curling irons", "hair styling tools", "hair stylers", "planchas para cabello",
  ]),
  cat("Hair dryers", "Secadoras de cabello", "Hair dryers", "HairDryer", "Personal care"),
  cat("Shavers", "Rasuradoras y recortadoras", "Shavers & trimmers", "Scissors", "Personal care", ["shaving & hair removal", "electric shavers", "trimmers"]),
  cat("Beauty", "Belleza", "Beauty", "Sparkle", "Personal care", ["makeup", "skin care", "fragrance", "fragrances"]),
  cat("Oral care", "Cuidado bucal", "Oral care", "Tooth", "Personal care", ["electric toothbrushes"]),

  // Health
  cat("Health monitors", "Monitores de salud", "Health monitors", "Heartbeat", "Health", ["blood pressure monitors", "thermometers"]),

  // Sports
  cat("Exercise", "Ejercicio", "Exercise & fitness", "Barbell", "Sports", ["exercise & fitness", "fitness equipment", "exercise equipment"]),
  cat("Bike", "Bicicletas", "Bikes", "Bicycle", "Sports", ["bikes", "bicycles", "e-bikes"]),
  cat("Scooter", "Scooters", "Scooters", "Scooter", "Sports", ["electric scooters", "kick scooters"]),
  cat("Camping", "Campismo", "Camping", "Tent", "Sports", ["camping & hiking"]),
  cat("Sports equipment", "Artículos deportivos", "Sports equipment", "SoccerBall", "Sports", ["team sports"]),

  // Fashion
  cat("Clothing", "Ropa", "Clothing", "TShirt", "Fashion", ["womens clothing", "mens clothing", "kids clothing"]),
  cat("Shoes", "Zapatos", "Shoes", "Sneaker", "Fashion", ["footwear"]),
  cat("Jewelry", "Joyería", "Jewelry", "Diamond", "Fashion", ["jewellery"]),
  cat("Wristwatches", "Relojes", "Watches", "Watch", "Fashion", ["watches"]),

  // Bags & accessories
  cat("Purse", "Bolsos", "Handbags", "Handbag", "Handbags", ["purses", "handbags", "tote bags", "crossbody bags"]),
  cat("Backpacks", "Mochilas", "Backpacks", "Backpack", "Handbags"),
  cat("Luggage", "Maletas", "Luggage", "Suitcase", "Handbags", ["suitcases"]),
  cat("Wallets", "Carteras", "Wallets", "Wallet", "Handbags"),

  // Other departments
  cat("Pet supplies", "Artículos para mascotas", "Pet supplies", "PawPrint", "Pets", ["dog supplies", "cat supplies"]),
  cat("Car electronics", "Electrónica para auto", "Car electronics", "Car", "Auto", ["dash cams", "car audio"]),
  cat("Office supplies", "Útiles escolares y de oficina", "School & office supplies", "Pencil", "Office", ["school supplies"]),
  cat("Christmas", "Navidad", "Christmas", "Snowflake", "Seasonal", ["christmas decorations", "christmas decor", "christmas trees"]),
  cat("Halloween", "Halloween", "Halloween", "Ghost", "Seasonal", ["costumes"]),
  cat("Party supplies", "Fiestas", "Party supplies", "Balloon", "Seasonal", ["party decorations"]),

  cat("Other", "Otros", "Other", "Package", "", ["misc", "miscellaneous", "uncategorized"]),
];

/* ------------------------------------------------------------------------ */
/* What other stores call them                                               */
/* ------------------------------------------------------------------------ */
// Tried in this order on the supplier's own category (the last part of its path) and, when
// the supplier sends none, on the product's name. Text is matched after normalize(): lower
// case, no accents (ñ → n), punctuation other than " . - turned into spaces.

export const CATEGORY_RULES = [
  [/\b(pet supplies|(pets?|dogs?|cats?|puppy|puppies|kittens?)\b.*\b(food|beds?|toys?|treats|chews?|leash(es)?|collars?|harness(es)?|carriers?|crates?|bowls?|litter|trees?|scratchers?)|squeaky|para (perros?|gatos?|mascotas?)|mascotas?)\b/, "Pet supplies"],
  [/\b(strollers?|(car|booster) seats?|high ?chairs?|baby (monitors?|carriers?|gates?|bouncers?|swings?|walkers?|bottles?)|play ?yards?|playards?|cribs?|carriolas?|autoasientos?|cunas?)\b/, "Baby gear"],
  [/\b(diapers?|baby wipes|panales|toallitas humedas)\b/, "Diapers"],
  [/\b(blood pressure monitors?|pulse oximeters?|thermometers?|(bathroom|body fat|body) scales?|glucose meters?|baumanometros?|termometros?)\b/, "Health monitors"],
  [/\b(dash ?cams?|car (chargers?|mounts?|phone (holders?|mounts?)|stereos?|audio|electronics|speakers?|vacuums?|cameras?)|backup cameras?|jump starters?|tire inflators?|gps (navigators?|units?))\b/, "Car electronics"],
  [/\b(smart home|smart (plugs?|bulbs?|lights?|lighting|locks?|thermostats?|displays?|switches|sensors?)|security cameras?|(video )?doorbells?|home security|hogar inteligente|camaras? de seguridad|focos? inteligentes?)\b/, "Smart home"],
  [/\b(camping|campismo|tents?|casas? de campana|sleeping bags?|sacos? de dormir|coolers?|hieleras?|camp (chairs?|stoves?))\b/, "Camping"],
  // toys, before the furniture, sports and seasonal words some of them carry
  [/\b((baby|toddler|infant|preschool) toys?|baby toddler toys|preschool|juguetes? (para|de) bebes?|little people|fisher-price)\b/, "Baby toys"],
  [/\b((foam|dart|water) blasters?|blasters?|nerf|x-?shot|lanzadores?)\b/, "Foam blasters"],
  [/\b(building (sets?|toys?|blocks?|kits?)|construction toys?|lego|mega bloks|bloques de construccion)\b/, "Building sets"],
  [/\b(dolls?|dollhouses?|barbie|munecas?)\b/, "Dolls"],
  [/\b(action figures?|figuras? de accion|collectible figures?)\b/, "Action figures"],
  [/\b(toy (cars?|trucks?|vehicles?|trains?)|(rc|remote control) (cars?|trucks?|vehicles?|helicopters?|boats?)|hot wheels|matchbox|vehiculos? de juguete|carritos?|train sets?)\b/, "Toy vehicles"],
  [/\b(board games?|card games?|family games?|puzzles?|jigsaw|juegos? de mesa|rompecabezas|monopoly|jenga)\b/, "Games & puzzles"],
  [/\b(plush|plushies|stuffed (animals?|toys?)|teddy bears?|peluches?|squishmallows?)\b/, "Plush"],
  [/\b(outdoor (toys?|play|games?)|water (toys?|tables?)|pool (toys?|floats?)|ride-?ons?|trampolines?|swing sets?|playhouses?|sandbox(es)?|sand toys?|bubbles?|kites?)\b/, "Outdoor toys"],
  [/\b(arts? (and )?crafts?|crafts?|art supplies|play-?doh|slime|coloring|manualidades)\b/, "Arts & crafts"],
  [/\b(toys?|juguetes?)\b/, "Toys"],
  // seasonal, before the decor words
  [/\b(christmas|xmas|navidad|navidenos?|navidenas?|ornaments?|advent calendars?)\b/, "Christmas"],
  [/\b(halloween|costumes?|disfraces?)\b/, "Halloween"],
  [/\b(party (supplies|decorations?|favou?rs?)|balloons?|globos?|pinatas?|birthday (decorations?|supplies))\b/, "Party supplies"],
  [/\b(home decor|decor|decoracion|lamps?|lamparas?|lighting|light fixtures?|string lights|led strips?|rugs?|alfombras?|tapetes?|curtains?|cortinas?|wall art|picture frames?|candles?|velas?|mirrors?|espejos?|vases?|floreros?|artificial (plants?|flowers?)|throw pillows?)\b/, "Home decor"],
  [/\b(bedding|bed sheets?|sheet sets?|sheets|sabanas?|comforters?|edredones?|duvets?( covers?)?|pillows?|almohadas?|blankets?|cobijas?|quilts?|colchas?|mattress (toppers?|pads?|protectors?)|ropa de cama)\b/, "Bedding"],
  [/\b(furniture|muebles?|sofas?|couch(es)?|loveseats?|recliners?|tv stands?|entertainment (centers?|centres?|units?)|chairs?|sillas?|tables?|mesas?|desks?|escritorios?|dressers?|bookcases?|bookshelves|shelving( units?)?|nightstands?|bed frames?|mattress(es)?|colchones?)\b/, "Furniture"],
  // TVs and what goes with them
  [/\b(tv (wall )?mounts?|wall mounts?|tv brackets?|tv antennas?|antennas?|universal remotes?|remote controls?|tv accessories|hdmi cables?|soportes? (para|de) (tv|televisor|pared))\b/, "TV accessories"],
  [/\b(streaming (media )?(devices?|players?|sticks?|boxes?)|media (streamers?|players?)|fire tv (stick|cube)|chromecast|google tv streamer|roku (express|ultra|premiere|streaming stick)|apple tv 4k|reproductor(es)? de streaming)\b/, "Streaming devices"],
  [/\b(projectors?|proyector(es)?)\b/, "Projectors"],
  [/\b(sound ?bars?|barras? de sonido|home theat(er|re)( systems?)?)\b/, "Soundbars"],
  [/\b(tvs?|televisions?|televisores?|smart tv)\b/, "Television"],
  // audio
  [/\b(airpods max|over-?ear (headphones?|audifonos?))\b/, "Headphones"],
  [/\b(earbuds?|ear buds|earphones?|in-?ear|true wireless|airpods( pro)?|tws)\b/, "Earbuds"],
  [/\b(headphones?|headsets?|on-?ear|over-?ear|audifonos?|diademas?)\b/, "Headphones"],
  [/\b(speakers?|bocinas?|altavoz|altavoces|echo dot|homepod)\b/, "Speaker"],
  // computers and phones
  [/\b(keyboards?|teclados?|(computer|wireless|gaming|bluetooth|optical|ergonomic) mouse|mice|mouse pads?|webcams?|web ?cameras?|usb (hubs?|adapters?)|docking stations?|laptop (stands?|sleeves?|accessories|chargers?)|tablet (cases?|covers?|accessories|stands?)|computer accessories|routers?|wi-?fi (extenders?|routers?|systems?|adapters?)|mesh (wi-?fi|systems?|routers?)|networking|modems?|ethernet)\b/, "Computer accessories"],
  [/\b(phone (cases?|accessories|chargers?|mounts?|holders?|grips?|stands?|cables?)|cases? (for|para)|(iphone|galaxy|pixel)\b.*\bcases?|fundas?|screen protectors?|protectores? de pantalla|power banks?|portable chargers?|wireless chargers?|chargers?|cargadores?|charging (cables?|stations?|pads?|docks?)|usb-?c cables?|lightning cables?|selfie sticks?)\b/, "Phone accessories"],
  [/\b((cell|mobile|smart|unlocked|prepaid|android) ?phones?|smartphones?|celulares?|telefonos? (celulares?|inteligentes?)|iphone( \d+)?|galaxy [saz]\d+|pixel \d+|moto g)\b/, "Phone"],
  [/\b(tablets?|tabletas?|ipad( air| pro| mini)?|galaxy tab|e-?readers?|kindle|lenovo tab|fire (hd )?\d+)\b/, "Tablet"],
  [/\b(laptops?|chromebooks?|macbook( air| pro)?|notebook (computers?|pcs?)|portatil(es)?|computadoras? portatiles?)\b/, "Laptop"],
  [/\b(desktops?( computers?| pcs?)?|all-?in-?one (computers?|pcs?)|gaming (pcs?|desktops?)|mini pcs?|computadoras? de escritorio|imac)\b/, "PC"],
  [/\b(fitness (trackers?|bands?|watch(es)?)|activity trackers?|heart rate monitors?|fitbit (inspire|charge|luxe|ace)|smart ?bands?|mi band|pulseras? (de actividad|inteligentes?))\b/, "Fitness trackers"],
  [/\b(monitors?|monitores?)\b/, "Monitor"],
  [/\b(printers?|impresoras?|multifuncionales?|scanners?|escaneres?|ink (cartridges?|tanks?)|ink|toner|tintas?|cartuchos?)\b/, "Printer"],
  [/\b((external |portable |internal )?hard (disk )?drives?|hdds?|ssds?|solid state drives?|(usb )?flash drives?|thumb drives?|memory cards?|(micro ?)?sd(hc|xc)? cards?|micro ?sd|data storage|discos? duros?|memorias? (usb|sd|micro ?sd))\b/, "Data storage"],
  [/\b(smart ?watch(es)?|apple watch|galaxy watch|pixel watch|fitbit (versa|sense)|garmin (forerunner|venu|fenix|vivoactive)|relojes? inteligentes?)\b/, "Watch"],
  [/\b(cameras?|camcorders?|instant film|instax|polaroid|gopro|action cams?|camaras?|dslr|mirrorless)\b/, "Camera"],
  [/\b(video ?games?|videojuegos?|gaming|game consoles?|consoles?|consolas?|playstation|ps[45]|xbox|nintendo|game controllers?|gamepads?)\b/, "Gaming"],
  // home
  [/\b(air fryers?|freidoras? de aire|coffee (makers?|machines?)|espresso (machines?|makers?)|cafeteras?|blenders?|licuadoras?|toasters?( ovens?)?|tostadores?|microwaves?|microondas|kettles?|slow cookers?|pressure cookers?|multi-?cookers?|instant pot|rice cookers?|(stand|hand) mixers?|batidoras?|food processors?|juicers?|extractores? de jugo|griddles?|waffle makers?|(small )?(kitchen )?appliances|electrodomesticos)\b/, "Kitchen appliances"],
  [/\b(cookware|bakeware|dinnerware|drinkware|flatware|pots? (and )?pans?|frying pans?|skillets?|sartenes?|ollas?|knife (sets?|blocks?)|knives|cuchillos?|cutlery|kitchen (utensils|tools|gadgets|storage)|utensilios( de cocina)?|food storage|tumblers?|travel mugs?|water bottles?|lunch (boxes?|bags?)|termos?)\b/, "Kitchen & dining"],
  [/\b(vacuums?|vacuum cleaners?|aspiradoras?|carpet cleaners?|steam mops?|floor cleaners?|mops?)\b/, "Vacuum"],
  [/\b((tower|box|pedestal|desk|ceiling|portable|floor|table) fans?|(space|electric|oil|ceramic|portable) heaters?|heaters?|air conditioners?|portable ac|humidifiers?|dehumidifiers?|air purifiers?|ventiladores?|calefactores?|purificadores? de aire|humidificadores?|aires? acondicionados?)\b/, "Fans & heaters"],
  // personal care, before the tools (styling tools, trimmers)
  [/\b(hair ?dryers?|blow ?dryers?|secadoras? (de|para) (cabello|pelo))\b/, "Hair dryers"],
  [/\b((hair )?straighteners?|flat irons?|curling (irons?|wands?)|hair (stylers?|styling( tools?)?|curlers?)|hot (air )?brushes?|airwrap|airflow stylers?|planchas? (para|de) (cabello|pelo)|rizadores?|tenazas?)\b/, "Hair Straightener"],
  [/\b(power tools?|hand tools?|tool (sets?|kits?|boxes?|bags?|storage)|tools?|drills?|taladros?|impact drivers?|screwdrivers?|desarmadores?|saws?|sierras?|wrenches?|hammers?|martillos?|herramientas?|lawn mowers?|cortadoras? de pasto|(string|hedge) trimmers?|(leaf|snow) blowers?|pressure washers?|hidrolavadoras?|ladders?|workbenches?)\b/, "Tools"],
  [/\b(shavers?|razors?|trimmers?|clippers?|epilators?|rasuradoras?|afeitadoras?|recortadoras?|depiladoras?)\b/, "Shavers"],
  [/\b((electric |sonic )?toothbrush(es)?|oral care|water flossers?|cepillos? (de |electricos? )?dientes|cepillos? dentales?|irrigadores?)\b/, "Oral care"],
  [/\b(make-?up|cosmetics?|skin ?care|fragrances?|perfumes?|colognes?|nail (polish|care|kits?)|lipsticks?|mascaras?|maquillaje|belleza|cuidado de la piel)\b/, "Beauty"],
  // sports
  [/\b(exercise (bikes?|equipment|machines?|mats?)|fitness equipment|home gym|treadmills?|caminadoras?|ellipticals?|rowing machines?|dumbbells?|mancuernas?|kettlebells?|weights|pesas|yoga( mats?)?|resistance bands?|bandas? de resistencia|jump ropes?)\b/, "Exercise"],
  [/\b(bikes?|bicycles?|e-?bikes?|bicicletas?)\b/, "Bike"],
  [/\b((electric |kick |e-?)?scooters?|patinetas?|patinetes?|monopatines?)\b/, "Scooter"],
  [/\b(sports equipment|team sports|soccer|futbol|basketball|baloncesto|basquetbol|football|baseball|beisbol|hockey|tennis|golf|volleyball|voleibol|skates?|patines|balls?|balones?|pelotas?)\b/, "Sports equipment"],
  // fashion and bags
  [/\b(clothing|apparel|t-?shirts?|shirts?|hoodies?|sweaters?|sweatshirts?|jackets?|coats?|parkas?|pants|jeans|leggings|dresses?|skirts?|shorts|pajamas?|socks|underwear|ropa|playeras?|sudaderas?|chamarras?|abrigos?|pantalones?|vestidos?)\b/, "Clothing"],
  [/\b(shoes?|footwear|sneakers?|boots?|sandals?|slippers?|heels|zapatos?|tenis|botas?|sandalias?|pantuflas?)\b/, "Shoes"],
  [/\b(jewel(le)?ry|necklaces?|bracelets?|earrings?|pendants?|(engagement|wedding|promise|silver|gold|diamond) rings?|joyeria|collares?|aretes?|pulseras?)\b/, "Jewelry"],
  [/\b(watches|wristwatches?|relojes?)\b/, "Wristwatches"],
  [/\b(purses?|handbags?|totes?|tote bags?|crossbody( bags?)?|satchels?|clutch(es)?|shoulder bags?|bolsos?|bolsas? de mano)\b/, "Purse"],
  [/\b(backpacks?|mochilas?|laptop bags?|school bags?)\b/, "Backpacks"],
  [/\b(luggage|suitcases?|carry-?ons?|duffel bags?|duffle bags?|travel bags?|maletas?|equipaje)\b/, "Luggage"],
  [/\b(wallets?|carteras?|billeteras?)\b/, "Wallets"],
  [/\b(school supplies|office supplies|utiles( escolares)?|pens|pencils?|lapices|lapiz|markers?|plumones?|crayons?|crayolas?|notebooks?|cuadernos?|binders?|calculators?|calculadoras?|staplers?|engrapadoras?|sticky notes|planners?)\b/, "Office supplies"],
];

/* ------------------------------------------------------------------------ */
/* Looking things up                                                         */
/* ------------------------------------------------------------------------ */

// Parts of a supplier's path that aren't departments ("Root" is how Walmart's start)
const SKIP = new Set(
  ["root", "home page", "homepage", "all departments", "all categories", "departments", "categories", "shop all", "shop by department", "shop by category", "walmart", "walmart.ca", "amazon", "amazon.ca", "all", "products"].map(normalize),
);

function index(list) {
  const map = new Map();
  for (const x of list) {
    for (const name of [x.value, x.en, x.es, ...x.aka]) {
      const key = normalize(name);
      if (key && !map.has(key)) map.set(key, x);
    }
  }
  return map;
}
const DEPARTMENT_INDEX = index(DEPARTMENTS);
const CATEGORY_INDEX = index(CATEGORIES);
const CATEGORY_BY_VALUE = new Map(CATEGORIES.map((c) => [c.value, c]));
const RULE_LIST = CATEGORY_RULES.map(([re, value]) => [re, CATEGORY_BY_VALUE.get(value)]);

const clean = (v) =>
  String(v ?? "")
    .replace(/[\u200b-\u200f\u202a-\u202e\u2060\ufeff]/g, "")
    .replace(/\s+/g, " ")
    .trim();

/** The department called this (its value, label or another name), or null. */
export const departmentOf = (value) => DEPARTMENT_INDEX.get(normalize(value)) || null;

/** The category called this (its value, label or another name), or null. */
export const categoryOf = (value) => CATEGORY_INDEX.get(normalize(value)) || null;

/** The category a supplier's category name or a product name points to, by the rules above, or null. */
export function categoryByRules(text) {
  const t = normalize(text);
  if (!t) return null;
  for (const [re, c] of RULE_LIST) if (re.test(t)) return c;
  return null;
}

/** A department as products store it: "electrónica" → "Electronics", "Root" → "", unknown → as typed. */
export function canonicalDepartment(value) {
  const v = clean(value);
  if (!v || SKIP.has(normalize(v))) return "";
  return departmentOf(v)?.value || v;
}

/** A category as products store it: "TVs" → "Television", unknown → as typed. */
export function canonicalCategory(value) {
  const v = clean(value);
  return v ? categoryOf(v)?.value || v : "";
}

/** The department a category belongs to ("" when the store doesn't know the category). */
export const departmentFor = (category) => categoryOf(category)?.department || "";

/** "Root > Electronics > TVs" → ["Electronics", "TVs"]: the parts that say something. */
export function pathParts(path) {
  const parts = clean(path)
    .split(/\s*(?:>|\/|\||›|»)\s*/)
    .map(clean)
    .filter((p) => p && !SKIP.has(normalize(p)));
  // breadcrumbs often start with the website's home page: "Home > Electronics > TVs"
  if (parts.length > 1 && normalize(parts[0]) === "home" && departmentOf(parts[1])) parts.shift();
  return parts;
}

/**
 * Where a product goes in the store → { category, department } (the values products store).
 * `path` is the supplier's category ("Root > Electronics > TV & Video > 30 inch - 39 inch TVs",
 * "Electronics › Headphones › Earbud Headphones", or just a category someone typed).
 * Its last part is read by name and by the rules; the parts above it only by name ("TV & Video"
 * is no reason to call a DVD player a TV). Without a usable path: `fallback` (a category chosen
 * for a whole file), then the product's `name`. Otherwise the supplier's own last part is kept.
 */
export function placeInStore(path, { name = "", fallback = "" } = {}) {
  const parts = pathParts(path);
  const leaf = parts.at(-1) || "";
  const found = [];
  if (leaf) {
    const c = categoryOf(leaf) || categoryByRules(leaf);
    if (c) found.push(c);
  }
  for (const part of parts.slice(0, -1).reverse()) {
    const c = categoryOf(part);
    if (c) found.push(c);
  }
  let category = found.find((c) => !c.generic) || found[0] || null;
  if (category?.generic) {
    // "Toys > Kids Toys" says little: the name may say which toys
    const byName = categoryByRules(name);
    if (byName && !byName.generic && byName.department === category.department) category = byName;
  }
  const pathDepartment = () => parts.map(departmentOf).find(Boolean)?.value || (parts.length > 1 ? parts[0] : "");
  if (category) return { category: category.value, department: category.department || pathDepartment() };

  const typed = clean(fallback);
  if (typed) {
    const known = categoryOf(typed);
    return { category: known?.value || typed, department: known?.department || pathDepartment() };
  }
  // a category the store doesn't have yet, named as the supplier names it (not when the
  // path is only a department: "Electronics" says nothing about the category)
  const ownLeaf = leaf && !departmentOf(leaf) ? leaf.slice(0, 60) : "";
  if (ownLeaf && parts.length > 1) return { category: ownLeaf, department: pathDepartment() };
  const byName = categoryByRules(name);
  if (byName) return { category: byName.value, department: byName.department };
  return { category: ownLeaf || "Other", department: pathDepartment() };
}

/* ------------------------------------------------------------------------ */
/* Labels and icons                                                          */
/* ------------------------------------------------------------------------ */

export const categoryLabel = (value, lang = "es") => categoryOf(value)?.[lang === "en" ? "en" : "es"] || clean(value);
export const departmentLabel = (value, lang = "es") => departmentOf(value)?.[lang === "en" ? "en" : "es"] || clean(value);
export const categoryIcon = (value) => categoryOf(value)?.icon || "Tag";
export const departmentIcon = (value) => departmentOf(value)?.icon || "SquaresFour";

/** Every icon name used above (CategoryIcon.jsx imports each one). */
export const TAXONOMY_ICONS = [...new Set([...DEPARTMENTS, ...CATEGORIES].map((x) => x.icon))].sort();
