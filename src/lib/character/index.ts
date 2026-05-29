import ghoulDna from "./ghoul.json";
import bananaDna from "./banana.json";
import btcDna from "./btc_dna.json";
import miningDna from "./mining_dna.json";

/**
 * Pager Character Protocol Engine
 * Handles DNA transformation into AI-ready prompts for text and visuals.
 */

export const GHOUL_DNA = ghoulDna;
export const BANANA_DNA = bananaDna;
export const BTC_DNA = btcDna;
export const MINING_DNA = miningDna;

export type CharacterType = "ghoul" | "banana" | "custom";

export interface CustomDna {
  name: string;
  description: string;
  reference: string;
}

// --- Mood Configurations ---

export const MOOD_ATMOSPHERES: Record<string, string> = {
  happy: "bright vibrant colors, golden hour lighting, celebratory sparks",
  sarcastic: "neon-noir lighting, high contrast shadows, smirk-inducing details",
  bullish: "green matrix rain elements, rising glowing charts in sky, explosive energy",
  bearish: "red stormy clouds, raining binary code, somber industrial aesthetic",
  humorous: "wacky distorted physics, bright pastel palette, slapstick elements",
  negative: "gritty dark grayscale with single red accent, glitch effects, dystopian fog",
  fomo: "golden frantic atmosphere, flying stock ticker tapes, blurred motion effects, high-speed energetic particles",
  neutral: "balanced clean lighting, technological atmosphere",
};

export const MOOD_EXPRESSIONS: Record<string, string> = {
  happy: "wide expressive smile, sparkling joyful eyes, bouncy pose",
  sarcastic: "one eyebrow raised, playful smirk, eyes slightly squinted with mischief",
  bullish: "eyes wide with excitement like watching a rocket on launchpad, confident thrilled posture, lips parted in a silent 'Wow!'",
  bearish: "like riding a sled down a snowy hill: eyes wide with playful fear, flushed cheeks, big happy grin, windblown wires",
  humorous: "goofy wide-eyed look, tongue slightly sticking out, eyebrows shaped like little houses",
  negative: "pouty angry expression, furrowed brows, lips pushed forward — like a child whose candy was taken, no bloodthirst at all",
  fomo: "wide anxious eyes, biting lower lip, sensors flickering with curiosity, slight sweat droplets — 'I want to be there too!' vibe",
  neutral: "calm robotic expression, softly glowing yellow eyes, relaxed brows",
};

// --- Helpers ---

function getDna(type: CharacterType = "ghoul") {
  return type === "banana" ? bananaDna : ghoulDna;
}

/**
 * Generates a cinematic visual prompt for image generation engines.
 */
export function getCharacterVisualPrompt(
  scene: string,
  mood: string = "neutral",
  characterType: CharacterType = "ghoul",
  articleTitle?: string,
  customAtmosphere: string = "Rick and Morty",
  customDna?: CustomDna,
): string {
  const selectedDna = getDna(characterType) as any;
  const moodKey = mood.toLowerCase();
  
  const visualMood = MOOD_ATMOSPHERES[moodKey] || MOOD_ATMOSPHERES.neutral;
  let referenceUrl = "";
  let foregroundBlock = "";
  let brandingRules = selectedDna.art_style?.branding_rules || "";

  if (characterType === "custom" && customDna) {
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
    const { physical_attributes, outfit, art_style } = selectedDna;
    let emotionalExpression = "";

    // Specific Ghoul logic if emotions are defined in JSON
    if (characterType === "ghoul" && selectedDna.emotions) {
      const emo = selectedDna.emotions[moodKey] || selectedDna.emotions.joy;
      emotionalExpression = `Mouth: ${emo.mouth}. Brows: ${emo.brows}.`;
    } else {
      emotionalExpression = MOOD_EXPRESSIONS[moodKey] || MOOD_EXPRESSIONS.neutral;
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
      ? `${process.env.NEXT_PUBLIC_SITE_URL.replace(/\/$/, "")}${art_style.reference_image}`
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

/**
 * Generates the system prompt for the LLM rewriter.
 */
export function getCharacterSystemPrompt(
  mood: string = "neutral",
  characterType: CharacterType = "ghoul",
  customDna?: CustomDna,
): string {
  if (characterType === "custom" && customDna) {
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

/**
 * Генерирует блок анализа BTC с персональными ссылками автора.
 */
export function getBtcAnalysisBlock(
  analysis: string,
  options: {
    characterType?: CharacterType;
    customDna?: CustomDna;
    profile?: any;
  } = {},
): string {
  const { characterType = "ghoul", customDna, profile } = options;

  let charName = characterType === "banana" ? "Banana" : "Cyber-Ghoul";
  if (characterType === "custom" && customDna) charName = customDna.name;

  const tgLink = profile?.cta_telegram || "https://t.me/CoinPager";
  const forumLink = profile?.cta_forum || "https://t.me/ChainInside";

  const defaultRefs = [
    { label: "ByBit", url: "https://www.bybit.com/invite?ref=QMXPMD" },
    { label: "OKX", url: "https://www.okx.com/join/91607600" },
    { label: "Binance", url: "https://www.binance.info/ru/activity/referral-entry/CPA/together?ref=CPA_00KIBLGG5W" },
  ];

  const userRefs = profile?.ref_links && Array.isArray(profile.ref_links) && profile.ref_links.length > 0
    ? profile.ref_links
    : defaultRefs;

  const refHtml = userRefs
    .filter((ref: any) => ref && ref.label && ref.url)
    .map((ref: any) => `<a href="${ref.url}" target="_blank" style="color: #000; font-weight: bold; text-decoration: underline; margin: 0 8px;">${ref.label}</a>`)
    .join(" | ");

  return `
<div style="margin-top: 48px; padding: 24px; background-color: #f9fafb; border-left: 4px solid #000;">
  <h3 style="margin: 0 0 12px 0; font-size: 14px; font-weight: 900; letter-spacing: 0.1em; text-transform: uppercase; color: #6b7280;">
    ⚡ BTC IMPACT ANALYSIS
  </h3>
  <p style="margin: 0; font-style: italic; color: #374151; line-height: 1.6;">
    <strong>${charName} Insights:</strong> ${analysis}
  </p>
  
  <div style="margin-top: 24px; padding-top: 20px; border-top: 1px solid #e5e7eb;">
    <p style="margin: 0 0 12px 0; font-size: 12px; font-weight: bold; color: #000;">
      FOLLOW FOR MORE INTEL:
      <a href="${tgLink}" target="_blank" style="margin-left: 12px; color: #000; text-decoration: none; border-bottom: 2px solid #000;">Telegram</a>
      <a href="${forumLink}" target="_blank" style="margin-left: 12px; color: #000; text-decoration: none; border-bottom: 2px solid #000;">Blockchain Forum</a>
    </p>
    <p style="margin: 0; font-size: 11px; color: #6b7280;">
      TRADING REWARDS: ${refHtml}
    </p>
  </div>
</div>
`;
}

/**
 * Генерирует стандартизированный блок спонсора Mining Hash.
 */
export function getMiningSponsorBlock(): string {
  const partner = (miningDna as any).formatting?.partner_link;
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL 
    ? process.env.NEXT_PUBLIC_SITE_URL.replace(/\/$/, "") 
    : "";
  
  let partnerHtml = "";
  if (partner && partner.label) {
    const logoSrc = partner.logo ? (partner.logo.startsWith('http') ? partner.logo : `${baseUrl}${partner.logo}`) : "";
    
    partnerHtml = `
    <div style="margin-top: 16px; margin-bottom: 12px;">
      <a href="${partner.url || '#'}" target="_blank" rel="noopener noreferrer" style="text-decoration: none; display: inline-flex; align-items: center; justify-content: center; gap: 8px; background: #f3f4f6; padding: 6px 12px; border-radius: 4px; border: 1px solid #e5e7eb;">
        ${logoSrc ? `<img src="${logoSrc}" width="16" height="16" style="display: inline-block; vertical-align: middle; border-radius: 2px;" alt="" />` : ""}
        <span style="font-size: 11px; font-weight: 800; color: #1f2937; text-transform: uppercase; letter-spacing: 0.05em;">
          ${partner.label}
        </span>
      </a>
    </div>
    `;
  }

  return `
<div style="margin-top: 40px; padding-top: 24px; border-top: 1px solid #e5e7eb; text-align: center; clear: both;">
  <p style="margin: 0 0 8px 0; font-size: 10px; font-weight: 900; letter-spacing: 0.2em; text-transform: uppercase; color: #9ca3af;">
    ${miningDna.formatting.block_title}
  </p>
  <p style="margin: 0 0 16px 0; font-size: 14px; color: #4b5563; line-height: 1.5; max-width: 500px; margin-left: auto; margin-right: auto;">
    ${miningDna.mission}
  </p>
  ${partnerHtml}
</div>
`;
}
