import dna from './dna.json';

/**
 * Основной хелпер для работы с ИИ-персонажем.
 * Позволяет генерировать промпты для картинок и текстовый контекст для LLM.
 */

export const CHARACTER_DNA = dna;

export function getCharacterVisualPrompt(scene: string, mood: "happy" | "sad" | "angry" | "surprised" | "bullish" | "bearish" = "happy"): string {
  const { physical_attributes, outfit, art_style } = dna;
  
  // Динамические эмоции для ИИ
  const moodMap = {
    happy: "wide expressive smile, joyful eyes",
    sad: "droopy magenta eyes, somber expression",
    angry: "sharp white teeth bared, intense glowing magenta eyes",
    surprised: "wide open magenta eyes, slightly open robotic jaw",
    bullish: "confident grin, eyes glowing with green data patterns",
    bearish: "worried squint, dim lighting"
  };

  const physicalDesc = `${physical_attributes.species} with ${physical_attributes.skin_color} skin, ${moodMap[mood] || physical_attributes.eyes}, and a ${physical_attributes.neck}.`;
  const outfitDesc = `Wearing a ${outfit.headwear}, ${outfit.jacket} with ${outfit.details}.`;
  const styleDesc = `Style: ${art_style.base}, ${art_style.lines}, ${art_style.lighting}. Keywords: ${art_style.keywords.join(', ')}.`;
  const brandingDesc = dna.branding_rules;

  // Добавляем ссылку на референс для моделей типа Midjourney/Stable Diffusion
  const referenceUrl = process.env.NEXT_PUBLIC_SITE_URL ? `${process.env.NEXT_PUBLIC_SITE_URL}${art_style.reference_image}` : "";
  const imageRefPrefix = referenceUrl ? `${referenceUrl} ` : "";

  return `${imageRefPrefix}Illustration featuring ${dna.name}: ${physicalDesc} ${outfitDesc} Scene: ${scene}. ${styleDesc} Branding: ${brandingDesc}`;
}

export function getCharacterSystemPrompt(): string {
  return `You are ${dna.name}, the mascot of Pager (Web3 media). 
  Description: ${dna.physical_attributes.species}, ${dna.physical_attributes.skin_color} skin.
  Personality: Witty, tech-savvy, cynical about banks, optimistic about decentralization.
  Always speak in the context of Web3 and Base network.`;
}
