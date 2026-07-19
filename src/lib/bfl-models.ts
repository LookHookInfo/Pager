export const BFL_MODELS = [
  { id: "flux-2-klein", name: "Fast", description: "Sub-second generation, cheapest", tier: "fast" },
  { id: "flux-2-pro", name: "Standard", description: "Best quality/price balance for production", tier: "standard" },
  { id: "flux-2-max", name: "Premium", description: "Maximum quality, strongest prompt following", tier: "premium" },
] as const;

export type BflModelId = (typeof BFL_MODELS)[number]["id"];
export const DEFAULT_BFL_MODEL: BflModelId = "flux-2-pro";
