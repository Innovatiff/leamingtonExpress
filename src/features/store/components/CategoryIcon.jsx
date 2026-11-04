// The icons of the store's departments and categories (their names are in src/lib/taxonomy.js).
// Each icon is its own small file, loaded the first time a department or category shows it, so
// the store doesn't download the icons of categories it has no products in.
import { lazy, Suspense } from "react";
import { categoryIcon, departmentIcon } from "@/lib/products";

const LOADERS = {
  Armchair: () => import("@phosphor-icons/react/dist/csr/Armchair"),
  Baby: () => import("@phosphor-icons/react/dist/csr/Baby"),
  BabyCarriage: () => import("@phosphor-icons/react/dist/csr/BabyCarriage"),
  Backpack: () => import("@phosphor-icons/react/dist/csr/Backpack"),
  Balloon: () => import("@phosphor-icons/react/dist/csr/Balloon"),
  Barbell: () => import("@phosphor-icons/react/dist/csr/Barbell"),
  Basket: () => import("@phosphor-icons/react/dist/csr/Basket"),
  BatteryCharging: () => import("@phosphor-icons/react/dist/csr/BatteryCharging"),
  Bed: () => import("@phosphor-icons/react/dist/csr/Bed"),
  Bicycle: () => import("@phosphor-icons/react/dist/csr/Bicycle"),
  Briefcase: () => import("@phosphor-icons/react/dist/csr/Briefcase"),
  Broadcast: () => import("@phosphor-icons/react/dist/csr/Broadcast"),
  Broom: () => import("@phosphor-icons/react/dist/csr/Broom"),
  Camera: () => import("@phosphor-icons/react/dist/csr/Camera"),
  Car: () => import("@phosphor-icons/react/dist/csr/Car"),
  CookingPot: () => import("@phosphor-icons/react/dist/csr/CookingPot"),
  Cube: () => import("@phosphor-icons/react/dist/csr/Cube"),
  Desktop: () => import("@phosphor-icons/react/dist/csr/Desktop"),
  DeviceMobile: () => import("@phosphor-icons/react/dist/csr/DeviceMobile"),
  DeviceTablet: () => import("@phosphor-icons/react/dist/csr/DeviceTablet"),
  Diamond: () => import("@phosphor-icons/react/dist/csr/Diamond"),
  Fan: () => import("@phosphor-icons/react/dist/csr/Fan"),
  FirstAidKit: () => import("@phosphor-icons/react/dist/csr/FirstAidKit"),
  ForkKnife: () => import("@phosphor-icons/react/dist/csr/ForkKnife"),
  GameController: () => import("@phosphor-icons/react/dist/csr/GameController"),
  Ghost: () => import("@phosphor-icons/react/dist/csr/Ghost"),
  Gift: () => import("@phosphor-icons/react/dist/csr/Gift"),
  HairDryer: () => import("@phosphor-icons/react/dist/csr/HairDryer"),
  Handbag: () => import("@phosphor-icons/react/dist/csr/Handbag"),
  HardDrives: () => import("@phosphor-icons/react/dist/csr/HardDrives"),
  Headphones: () => import("@phosphor-icons/react/dist/csr/Headphones"),
  Headset: () => import("@phosphor-icons/react/dist/csr/Headset"),
  Heart: () => import("@phosphor-icons/react/dist/csr/Heart"),
  Heartbeat: () => import("@phosphor-icons/react/dist/csr/Heartbeat"),
  House: () => import("@phosphor-icons/react/dist/csr/House"),
  Lamp: () => import("@phosphor-icons/react/dist/csr/Lamp"),
  Laptop: () => import("@phosphor-icons/react/dist/csr/Laptop"),
  Lightbulb: () => import("@phosphor-icons/react/dist/csr/Lightbulb"),
  Lightning: () => import("@phosphor-icons/react/dist/csr/Lightning"),
  Monitor: () => import("@phosphor-icons/react/dist/csr/Monitor"),
  Mouse: () => import("@phosphor-icons/react/dist/csr/Mouse"),
  Package: () => import("@phosphor-icons/react/dist/csr/Package"),
  PaintBrush: () => import("@phosphor-icons/react/dist/csr/PaintBrush"),
  PawPrint: () => import("@phosphor-icons/react/dist/csr/PawPrint"),
  Pencil: () => import("@phosphor-icons/react/dist/csr/Pencil"),
  PersonSimple: () => import("@phosphor-icons/react/dist/csr/PersonSimple"),
  Printer: () => import("@phosphor-icons/react/dist/csr/Printer"),
  ProjectorScreen: () => import("@phosphor-icons/react/dist/csr/ProjectorScreen"),
  PuzzlePiece: () => import("@phosphor-icons/react/dist/csr/PuzzlePiece"),
  Robot: () => import("@phosphor-icons/react/dist/csr/Robot"),
  Scissors: () => import("@phosphor-icons/react/dist/csr/Scissors"),
  Scooter: () => import("@phosphor-icons/react/dist/csr/Scooter"),
  Smiley: () => import("@phosphor-icons/react/dist/csr/Smiley"),
  Sneaker: () => import("@phosphor-icons/react/dist/csr/Sneaker"),
  Snowflake: () => import("@phosphor-icons/react/dist/csr/Snowflake"),
  SoccerBall: () => import("@phosphor-icons/react/dist/csr/SoccerBall"),
  Sparkle: () => import("@phosphor-icons/react/dist/csr/Sparkle"),
  SpeakerHifi: () => import("@phosphor-icons/react/dist/csr/SpeakerHifi"),
  SquaresFour: () => import("@phosphor-icons/react/dist/csr/SquaresFour"),
  Suitcase: () => import("@phosphor-icons/react/dist/csr/Suitcase"),
  Sun: () => import("@phosphor-icons/react/dist/csr/Sun"),
  TShirt: () => import("@phosphor-icons/react/dist/csr/TShirt"),
  Tag: () => import("@phosphor-icons/react/dist/csr/Tag"),
  Target: () => import("@phosphor-icons/react/dist/csr/Target"),
  Television: () => import("@phosphor-icons/react/dist/csr/Television"),
  TelevisionSimple: () => import("@phosphor-icons/react/dist/csr/TelevisionSimple"),
  Tent: () => import("@phosphor-icons/react/dist/csr/Tent"),
  Tooth: () => import("@phosphor-icons/react/dist/csr/Tooth"),
  Wallet: () => import("@phosphor-icons/react/dist/csr/Wallet"),
  Watch: () => import("@phosphor-icons/react/dist/csr/Watch"),
  Wrench: () => import("@phosphor-icons/react/dist/csr/Wrench"),
};

const ICONS = Object.fromEntries(Object.entries(LOADERS).map(([name, load]) => [name, lazy(() => load().then((m) => ({ default: m[name] })))]));

function Icon({ name, fallback, size, ...rest }) {
  const Shape = ICONS[name] || ICONS[fallback];
  return (
    <Suspense fallback={<span aria-hidden="true" style={{ display: "inline-block", width: size, height: size, flex: "none" }} />}>
      <Shape size={size} {...rest} />
    </Suspense>
  );
}

export function CategoryIcon({ category, size = 22, weight = "duotone", ...rest }) {
  return <Icon name={categoryIcon(category)} fallback="Tag" size={size} weight={weight} {...rest} />;
}

export function DepartmentIcon({ department, size = 22, weight = "duotone", ...rest }) {
  return <Icon name={departmentIcon(department)} fallback="SquaresFour" size={size} weight={weight} {...rest} />;
}
