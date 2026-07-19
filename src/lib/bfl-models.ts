export const BFL_MODELS = [
  { id: "flux-2-klein-9b", name: "Fast", description: "Sub-second, cheapest ($0.015)", tier: "fast", promptUpsampling: false },
  { id: "flux-2-pro", name: "Standard", description: "Production quality ($0.03/MP)", tier: "standard", promptUpsampling: true },
  { id: "flux-2-max", name: "Premium", description: "Maximum quality ($0.07/MP)", tier: "premium", promptUpsampling: true },
] as const;

export type BflModelId = (typeof BFL_MODELS)[number]["id"];
export const DEFAULT_BFL_MODEL: BflModelId = "flux-2-pro";

export function getModelConfig(modelId: BflModelId) {
  return BFL_MODELS.find(m => m.id === modelId) || BFL_MODELS[1];
}
