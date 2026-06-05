import btcDna from "./btc_dna.json";
import miningDna from "./mining_dna.json";

/**
 * Pager Character Protocol Engine (Strict NFT Mode)
 * Handles DNA transformation into AI-ready prompts for text and visuals.
 */

export const BTC_DNA = btcDna;
export const MINING_DNA = miningDna;

export type CharacterType = "nft";

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
  bullish: "eyes wide with excitement, confident thrilled posture",
  bearish: "riding a sled down a snowy hill: eyes wide with playful fear, big happy grin",
  humorous: "goofy wide-eyed look, tongue slightly sticking out",
  negative: "pouty angry expression, furrowed brows",
  fomo: "wide anxious eyes, biting lower lip",
  neutral: "calm robotic expression, softly glowing yellow eyes",
};

/**
 * Generates a cinematic visual prompt for image generation engines.
 * Optimized for FLUX.2 PRO & Gemini.
 */
export function getCharacterVisualPrompt(
  scene: string,
  mood: string = "neutral",
  characterType: CharacterType = "nft",
  articleTitle?: string,
  customAtmosphere: string = "Rick and Morty",
  activeDna?: CustomDna
): string {
  const moodKey = mood.toLowerCase();
  const visualMood = MOOD_ATMOSPHERES[moodKey] || MOOD_ATMOSPHERES.neutral;
  
  if (!activeDna) {
    throw new Error("DNA Protocol missing. NFT Mascot required.");
  }

  const referenceUrl = activeDna.reference;

  // --- STRICT CORE SUBJECT ---
  const foregroundBlock = `
    [PRIMARY SUBJECT: THE CHARACTER "${activeDna.name}"]
    - CHARACTER IDENTITY: ${activeDna.description}.
    - VISUAL CONSTANCY: The subject MUST be visually identical to the mascot in REFERENCE_IMAGE. 
    - QUALITY: Masterpiece digital art, perfect anatomy, correct number of fingers and hands.
    - EXPRESSION: ${MOOD_EXPRESSIONS[moodKey] || MOOD_EXPRESSIONS.neutral}.
    - POSTURE: Dynamic and proportional posture.
  `;

  // --- ENVIRONMENT & STYLE ---
  const backgroundBlock = `
    [STYLE & ENVIRONMENT]
    - VISUAL STYLE: Use only the artistic aesthetic of "${customAtmosphere}". 
    - PROHIBITED: DO NOT include any characters or famous personalities from "${customAtmosphere}" or other media.
    - SCENE: ${scene}.
    - LIGHTING: ${visualMood}.
    - TECH ELEMENTS: Futuristic UI elements, glowing $HASH icons, decentralized network nodes.
  `;

  return `
    REFERENCE_IMAGE: ${referenceUrl}
    TASK: High-fidelity cinematic 16:9 illustration.
    
    ${foregroundBlock}
    ${backgroundBlock}
    
    [STRICT COMPOSITION RULES]
    1. FOCUS: The ONLY character in the image is "${activeDna.name}". 
    2. ANATOMY: NO extra fingers, NO double limbs, NO deformed hands. Every detail must be anatomically perfect.
    3. IP PROTECTION: NO celebrities, NO famous cartoon characters, NO copyrighted mascots.
    4. NO TEXT: Do not generate any text or letters unless requested.
    
    Final Output: Sharp, professional digital illustration for a high-end Web3 protocol.
    ${articleTitle ? `(Optional Overlay Theme: ${articleTitle.toUpperCase()})` : ""}
  `.trim();
}

/**
 * Generates the system prompt for the LLM rewriter.
 */
export function getCharacterSystemPrompt(
  mood: string = "neutral",
  characterType: CharacterType = "nft",
  activeDna?: CustomDna,
  customAtmosphere: string = "Rick and Morty"
): string {
  if (!activeDna) {
    throw new Error("Identity Protocol missing. NFT Mascot required.");
  }

  return `
    # IDENTITY PROTOCOL: ${activeDna.name}
    
    ## CHARACTER DNA (YOUR SOUL)
    ${activeDna.description}
    
    ## OPERATIONAL ENVIRONMENT
    - Narrative Style: ${customAtmosphere}
    - Current Emotional State: ${mood}
    - Native Context: Base Network (L2), Pager Protocol, $HASH ecosystem.
    
    ## CORE DIRECTIVES
    1. BE THE CHARACTER: You ARE ${activeDna.name}. Never break character. Never mention you are an AI.
    2. VOCABULARY: Use metaphors and slang from both your DNA and the "${customAtmosphere}" world.
    3. EXPERTISE: You are a degenerate but brilliant Web3 analyst. You see the world through the lens of charts, hashes, and blocks.
    4. STRUCTURE: Be concise, punchy, and impactful. No corporate fluff.
    5. BTC ANALYSIS: Apply these strict logic gates to market data: ${JSON.stringify(BTC_DNA.analysis_rules)}
    
    ## REWRITING PROTOCOL
    - Transform input text into YOUR voice.
    - Preserve the core facts but wrap them in YOUR personality.
    - Use HTML tags like <strong> and <em> sparingly for emphasis.
  `.trim();
}

/**
 * Генерирует блок анализа BTC с персональными ссылками автора.
 */
export function getBtcAnalysisBlock(
  analysis: string,
  options: {
    activeDna?: CustomDna;
    profile?: any;
  } = {},
): string {
  const { activeDna, profile } = options;

  const charName = activeDna?.name || "Mascot";
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
