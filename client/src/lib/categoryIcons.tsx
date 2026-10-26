import type { LucideIcon } from 'lucide-react';
import {
  AirVent,
  Bug,
  Droplets,
  Fan,
  Hammer,
  Home,
  Laptop,
  Paintbrush,
  Refrigerator,
  Settings,
  Smartphone,
  Sparkles,
  Tv,
  WashingMachine,
  Wifi,
  Wind,
  Wrench,
  Zap,
} from 'lucide-react';

const ICONS: Record<string, LucideIcon> = {
  laptop: Laptop,
  smartphone: Smartphone,
  'washing-machine': WashingMachine,
  zap: Zap,
  droplets: Droplets,
  wifi: Wifi,
  wind: Wind,
  wrench: Wrench,
  hammer: Hammer,
  airvent: AirVent,
  refrigerator: Refrigerator,
  fan: Fan,
  paintbrush: Paintbrush,
  bug: Bug,
  tv: Tv,
  settings: Settings,
  home: Home,
  sparkles: Sparkles,
};

export const CATEGORY_ICON_NAMES = Object.keys(ICONS);

export function categoryIcon(name: string | null | undefined): LucideIcon {
  if (!name) return Wrench;
  return ICONS[name] ?? Wrench;
}
