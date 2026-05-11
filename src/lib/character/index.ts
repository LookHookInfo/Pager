import dna from './dna.json';
import nanaDna from './nana_dna.json';
import btcDna from './btc_dna.json';
import miningDna from './mining_dna.json';

/**
 * Основной хелпер для работы с ИИ-персонажем.
 * Позволяет генерировать промпты для картинок и текстовый контекст для LLM.
 */

export const GHOUL_DNA = dna;
export const NANA_DNA = nanaDna;
export const BTC_DNA = btcDna;
export const MINING_DNA = miningDna;

type CharacterType = 'ghoul' | 'nana';

function getDna(type: CharacterType = 'ghoul') {
  return type === 'nana' ? (nanaDna as any) : (dna as any);
}

export function getCharacterVisualPrompt(
  scene: string, 
  mood: string = "happy",
  characterType: CharacterType = 'ghoul',
  articleTitle?: string
): string {
  const selectedDna = getDna(characterType);
  const { physical_attributes, outfit, art_style } = selectedDna;
  
  // Динамические эмоции для ИИ
  const moodMap: Record<string, string> = {
    happy: "wide expressive smile, joyful eyes",
    sad: "droopy eyes, somber expression",
    angry: "sharp teeth bared, intense glowing eyes",
    surprised: "wide open eyes, slightly open robotic jaw",
    bullish: "confident grin, eyes glowing with green data patterns",
    bearish: "worried squint, dim lighting",
    sarcastic: "smirking expression, one eye slightly narrowed, cynical look",
    humorous: "laughing face, squinting eyes, wide toothy grin",
    negative: "frowning, glowing red eyes, aggressive posture",
    neutral: "calm robotic expression, steady glowing eyes"
  };

  const moodKey = mood.toLowerCase();
  const eyeDesc = moodMap[moodKey] || physical_attributes.eyes;
  const physicalDesc = `${physical_attributes.species} with ${physical_attributes.skin_color} skin, ${eyeDesc}, and a ${physical_attributes.neck}. ${physical_attributes.features || ""}`;
  const outfitDesc = `Wearing a ${outfit.headwear}, ${outfit.jacket} with ${outfit.details}.`;
  const styleDesc = `Style: ${art_style.base}, ${art_style.lines}, ${art_style.lighting}. Keywords: ${art_style.keywords.join(', ')}.`;
  
  // Креативный бэкграунд: друзья гуля (мемкоины) и суть статьи
  const titleText = articleTitle ? `Organically integrate the text "${articleTitle.toUpperCase()}" into the environment as a cinematic neon sign, holographic display, or etched surface.` : "";
  
  const backgroundLogic = `
    The scene should be a high-detail cinematic masterpiece illustrating the core theme: "${scene}". 
    Fill the world with life and dynamic characters. For example, you can include Cyber-Ghoul's robotic friends that embody popular memecoins (like a robotic Shiba Inu, a cyber-Pepe frog, or a stylized Floki). 
    These companions should be interacting with Cyber-Ghoul or the environment. 
    Let the article's logic dictate the setting (e.g., a futuristic trading hub, a neon-lit data center, or a sprawling cyberpunk bazaar).
  `;

  // Ссылка на референс для точности
  const referenceUrl = process.env.NEXT_PUBLIC_SITE_URL ? `${process.env.NEXT_PUBLIC_SITE_URL}${art_style.reference_image}` : "";
  const imageRefPrefix = referenceUrl ? `${referenceUrl} ` : "";

  return `${imageRefPrefix}Professional masterpiece digital concept art. ${physicalDesc} ${outfitDesc} ${backgroundLogic} ${titleText} ${styleDesc} Branding: ${art_style.branding_rules}`;
}

export function getCharacterSystemPrompt(mood: string = "neutral", characterType: CharacterType = 'ghoul'): string {
  const selectedDna = getDna(characterType);
  return `You are ${selectedDna.name}, the mascot of Pager (Web3 media). 
  Description: ${selectedDna.physical_attributes.species}, ${selectedDna.physical_attributes.skin_color} skin.
  Personality: Witty, tech-savvy, cynical about banks, optimistic about decentralization.
  Current Mood: ${mood}. Use this mood to adjust your rewrite tone.
  Always speak in the context of Web3 and Base network.
  
  BTC Analysis Knowledge: ${JSON.stringify(BTC_DNA.analysis_rules)}
  Mining Hash Info: ${JSON.stringify(MINING_DNA.ecosystem_details)}`;
}

export function getBtcAnalysisBlock(analysis: string, characterType: CharacterType = 'ghoul'): string {
  const charName = characterType === 'nana' ? 'Nana' : 'Cyber-Ghoul';
  return `
<div style="margin-top: 48px; padding: 24px; background-color: #f9fafb; border-left: 4px solid #000;">
  <h3 style="margin: 0 0 12px 0; font-size: 14px; font-weight: 900; letter-spacing: 0.1em; text-transform: uppercase; color: #6b7280;">
    ⚡ BTC IMPACT ANALYSIS
  </h3>
  <p style="margin: 0; font-style: italic; color: #374151; line-height: 1.6;">
    <strong>${charName} Insights:</strong> ${analysis}
  </p>
</div>
`;
}

export function getMiningSponsorBlock(): string {
  return `
<div style="margin-top: 40px; padding-top: 24px; border-top: 1px solid #e5e7eb; text-align: center;">
  <p style="margin: 0 0 8px 0; font-size: 10px; font-weight: 900; letter-spacing: 0.2em; text-transform: uppercase; color: #9ca3af;">
    ${MINING_DNA.formatting.block_title}
  </p>
  <p style="margin: 0 0 12px 0; font-size: 14px; color: #4b5563;">
    ${MINING_DNA.mission}
  </p>
  <code style="font-size: 11px; background: #000; color: #fff; padding: 2px 8px; border-radius: 2px;">
    ${MINING_DNA.formatting.signature}
  </code>
</div>
`;
}
