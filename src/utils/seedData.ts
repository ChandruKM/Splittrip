import type { Trip } from "@/types/trip";

export const MEMBER_COLORS = [
  "#10b981", // emerald
  "#38bdf8", // sky
  "#f59e0b", // amber
  "#ec4899", // pink
  "#8b5cf6", // violet
  "#06b6d4", // cyan
  "#f97316", // orange
  "#84cc16", // lime
];

export const INITIAL_TRIPS: Trip[] = [
  {
    id: "trip-default",
    name: "My Trip",
    createdAt: "2026-11-26T00:00:00.000Z",
    members: [],
    expenses: [],
    transfers: [],
  },
];
