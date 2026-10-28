import {
  Bicycle,
  Broom,
  Camera,
  Desktop,
  DeviceMobile,
  DeviceTablet,
  GameController,
  HairDryer,
  Handbag,
  Headphones,
  Headset,
  House,
  Laptop,
  Lightning,
  Monitor,
  Package,
  Printer,
  Scooter,
  Sparkle,
  SpeakerHifi,
  SquaresFour,
  Tag,
  Television,
  Watch,
} from "@phosphor-icons/react";
import { categoryIcon, departmentIcon } from "@/lib/products";

const ICONS = {
  Bicycle,
  Broom,
  Camera,
  Desktop,
  DeviceMobile,
  DeviceTablet,
  GameController,
  HairDryer,
  Handbag,
  Headphones,
  Headset,
  House,
  Laptop,
  Lightning,
  Monitor,
  Package,
  Printer,
  Scooter,
  Sparkle,
  SpeakerHifi,
  SquaresFour,
  Tag,
  Television,
  Watch,
};

export function CategoryIcon({ category, size = 22, weight = "duotone", ...rest }) {
  const Icon = ICONS[categoryIcon(category)] || Tag;
  return <Icon size={size} weight={weight} {...rest} />;
}

export function DepartmentIcon({ department, size = 22, weight = "duotone", ...rest }) {
  const Icon = ICONS[departmentIcon(department)] || SquaresFour;
  return <Icon size={size} weight={weight} {...rest} />;
}
