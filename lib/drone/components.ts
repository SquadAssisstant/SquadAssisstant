// lib/drone/components.ts
export type DroneComponentKey =
  | "radar"
  | "chip"
  | "engine"
  | "core"
  | "weapon"
  | "battery"; // include 6th placeholder; rename later if needed

export type DroneComponent = {
  key: DroneComponentKey;
  // percent shown on the component tile (e.g., 63%)
  percent?: number;
  // level shown on the tile (e.g., Lv.8)
  level?: number;
  // optional label if you want (Radar, Engine, etc.)
  label?: string;
};

export type DroneComponentsState = {
  kind: "drone_components";
  // list style so it supports 5 or 6 naturally
  components: DroneComponent[];
  saved_at: string;
  source_urls?: string[];
  _history?: Array<{ at: string; value: unknown }>;
};

export const DEFAULT_DRONE_COMPONENT_KEYS: DroneComponentKey[] = [
  "radar",
  "chip",
  "engine",
  "core",
  "weapon",
  "battery",
];
