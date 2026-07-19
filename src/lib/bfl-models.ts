export const BFL_MODELS = [
  { id: "flux-2-pro", name: "FLUX.2 Pro", description: "Best quality/price balance", tier: "standard" },
  { id: "flux-2-max", name: "FLUX.2 Max", description: "Highest quality, strongest prompt following", tier: "premium" },
  { id: "flux-2-flex", name: "FLUX.2 Flex", description: "Typography and fine detail control", tier: "standard" },
  { id: "flux-2-klein", name: "FLUX.2 Klein", description: "Fast iteration, sub-second generation", tier: "fast" },
  { id: "flux-1-1-pro-ultra", name: "FLUX 1.1 Pro Ultra", description: "4MP resolution, RAW mode", tier: "standard" },
] as const;

export type BflModelId = (typeof BFL_MODELS)[number]["id"];
export const DEFAULT_BFL_MODEL: BflModelId = "flux-2-pro";
