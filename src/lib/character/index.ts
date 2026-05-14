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

export type CharacterType = 'ghoul' | 'nana' | 'custom';

export interface CustomDna {
  name: string;
  description: string;
  reference: string;
}

function getDna(type: CharacterType = 'ghoul') {
  if (type === 'nana') return nanaDna as any;
  return dna as any;
}

export function getCharacterVisualPrompt(
  scene: string, 
  mood: string = "happy",
  characterType: CharacterType = 'ghoul',
  articleTitle?: string,
  customAtmosphere: string = "Rick and Morty",
  customDna?: CustomDna
): string {
  let selectedDna = getDna(characterType);
  let referenceUrl = "";
  let foregroundBlock = "";
  let brandingRules = selectedDna.art_style?.branding_rules || "";

  const moodKey = mood.toLowerCase();
  
  // Define visual mood influence (colors, lighting)
  const moodVisuals: Record<string, string> = {
    happy: "bright vibrant colors, golden hour lighting, celebratory sparks",
    sarcastic: "neon-noir lighting, high contrast shadows, smirk-inducing details",
    bullish: "green matrix rain elements, rising glowing charts in sky, explosive energy",
    bearish: "red stormy clouds, raining binary code, somber industrial aesthetic",
    humorous: "wacky distorted physics, bright pastel palette, slapstick elements",
    negative: "gritty dark grayscale with single red accent, glitch effects, dystopian fog",
    neutral: "balanced clean lighting, technological atmosphere"
  };
  const visualMood = moodVisuals[moodKey] || moodVisuals.neutral;

  if (characterType === 'custom' && customDna) {
    // ЛОГИКА ДЛЯ ПОЛЬЗОВАТЕЛЬСКОГО DNA
    referenceUrl = customDna.reference;
    foregroundBlock = `
      [LAYER 1: IMMUTABLE FOREGROUND ASSET]
      Subject: ${customDna.name}.
      Technical DNA Specification: ${customDna.description}.
      MANDATORY: The subject MUST remain visually identical to the provided REFERENCE_IMAGE. 
      STYLE ISOLATION: This is a unique custom mascot. Do NOT apply any cartoon style from the background to this subject.
      RENDER PROTOCOL: High-fidelity stylized digital art, clean bold outlines, cinematic rim lighting.
    `;
    brandingRules = "Maintain visual consistency with the unique traits of this custom mascot.";
  } else {
    // ЛОГИКА ДЛЯ ШТАТНЫХ ПЕРСОНАЖЕЙ (GHOUL/NANA)
    const { physical_attributes, outfit, art_style } = selectedDna;
    
    let emotionalExpression = "";
    
    if (characterType === 'ghoul' && selectedDna.emotions) {
      const emo = selectedDna.emotions[moodKey] || selectedDna.emotions.joy;
      emotionalExpression = `Mouth: ${emo.mouth}. Brows: ${emo.brows}.`;
    } else {
      const moodMap: Record<string, string> = {
        happy: "wide expressive smile, joyful eyes",
        sarcastic: "one eyebrow raised, smirking expression",
        bullish: "intense determined eyes, confident posture",
        bearish: "lowered head, sad digital eyes",
        humorous: "goofy wide-eyed look",
        negative: "sharp teeth bared, intense glowing red eyes",
        neutral: "calm robotic expression"
      };
      emotionalExpression = moodMap[moodKey] || moodMap.neutral;
    }

    const physicalDesc = `
      - Head Anatomy: ${physical_attributes.head_shape}.
      - Epidermis: ${physical_attributes.skin_color}.
      - Optical Sensors: ${physical_attributes.eyes}.
      - Chassis Details: ${physical_attributes.features}.
      - Structural Connector: ${physical_attributes.neck}.
    `;

    const outfitDesc = `
      - Head Gear: ${outfit.headwear}.
      - Torso Protection: ${outfit.jacket}.
      - External Modules: ${outfit.details}.
    `;
    
    referenceUrl = process.env.NEXT_PUBLIC_SITE_URL 
      ? `${process.env.NEXT_PUBLIC_SITE_URL.replace(/\/$/, '')}${art_style.reference_image}` 
      : `https://pager.lookhook.info${art_style.reference_image}`;

    foregroundBlock = `
      [LAYER 1: IMMUTABLE FOREGROUND ASSET]
      Subject: ${selectedDna.name}.
      MANDATORY: The subject MUST remain visually identical to the provided REFERENCE_IMAGE. 
      STYLE ISOLATION: Do NOT apply any style from the background or other layers to this subject.
      TECHNICAL ANATOMY:
      ${physicalDesc}
      EXPRESSION STATE: ${emotionalExpression}
      EQUIPMENT SPEC:
      ${outfitDesc}
      RENDER PROTOCOL: 
      - Style: ${art_style.base}. 
      - Outlines: Technical clean bold black paths. 
      - Illumination: ${art_style.lighting}.
      - RESTRICTION: No pupils, no iris, no organic human features.
    `;
  }

  const atmosphereStyle = customAtmosphere || "Rick and Morty";

  // 2. LAYER 2: THE DECORATIVE ENVIRONMENT (CUSTOM WORLD)
  const backgroundBlock = `
    [LAYER 2: DECORATIVE BACKGROUND WORLD]
    Theme: "${atmosphereStyle}".
    Aesthetic: Authentic "${atmosphereStyle}" cartoon world.
    Content: ${scene}.
    Mood Influence: ${visualMood}.
    NPCs (MUST INCLUDE): Re-imagine robotic versions of Pepe the Frog and Shiba Inu as secondary friends, strictly in the "${atmosphereStyle}" drawing style, interacting with the scene.
    Technical: Flat colors, simple cel-shading, clean outlines for everything in Layer 2.
  `;
  
  const compositionRules = `
    [COMPOSITION SPECIFICATION]
    1. SUBJECT SCALE & SHOT: Render the subject [LAYER 1] as a medium-long shot. The character should occupy approximately 35% of the total canvas height, positioned slightly to the side or center.
    2. STYLE CONTRAST: Maintain a sharp 100% style isolation. The subject [LAYER 1] must NOT inherit the visual traits or character design style of [LAYER 2].
    3. BRANDING: ${brandingRules}.
  `;

  return `
    REFERENCE_URL: ${referenceUrl}
    TASK: Professional Composite Illustration.
    ${foregroundBlock}
    ${backgroundBlock}
    ${compositionRules}
    ${articleTitle ? `OVERLAY TEXT: "${articleTitle.toUpperCase()}"` : ""}
  `.trim();
}

export function getCharacterSystemPrompt(mood: string = "neutral", characterType: CharacterType = 'ghoul', customDna?: CustomDna): string {
  if (characterType === 'custom' && customDna) {
    return `You are ${customDna.name}, the mascot of Pager. 
    Your DNA Description: ${customDna.description}.
    Current Mood: ${mood}.
    Always speak in the context of Web3 and Base network.`;
  }

  const selectedDna = getDna(characterType);
  return `You are ${selectedDna.name}, the mascot of Pager (Web3 media). 
  Description: ${selectedDna.physical_attributes.species}, ${selectedDna.physical_attributes.skin_color} skin.
  Personality: Witty, tech-savvy, cynical about banks, optimistic about decentralization.
  Current Mood: ${mood}. Use this mood to adjust your rewrite tone.
  Always speak in the context of Web3 and Base network.
  
  BTC Analysis Knowledge: ${JSON.stringify(BTC_DNA.analysis_rules)}
  Mining Hash Info: ${JSON.stringify(MINING_DNA.ecosystem_details)}`;
}

export function getBtcAnalysisBlock(analysis: string, characterType: CharacterType = 'ghoul', customDna?: CustomDna): string {
  let charName = characterType === 'nana' ? 'Nana' : 'Cyber-Ghoul';
  if (characterType === 'custom' && customDna) charName = customDna.name;

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
  <p style="margin: 0; font-size: 14px; color: #4b5563;">
    ${MINING_DNA.mission}
  </p>
  <code style="font-size: 11px; background: #000; color: #fff; padding: 2px 8px; border-radius: 2px;">
    ${MINING_DNA.formatting.signature}
  </code>
</div>
`;
}
