import btcDna from "./btc_dna.json";
import miningDna from "./mining_dna.json";

/**
 * Pager Character Protocol Engine - Universal V3
 * Merges Mascot DNA with Atmosphere and Mood.
 */

export const BTC_DNA = btcDna;
export const MINING_DNA = miningDna;

export type CharacterType = "nft";

export interface CustomDna {
  name: string;
  personality: string;
  voice: string;
  physical_description: string;
  image_url: string;
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
 */
export function getCharacterVisualPrompt(
  scene: string,
  mood: string = "neutral",
  characterType: CharacterType = "nft",
  articleTitle?: string,
  atmosphere: string = "Cinematic Digital Art",
  activeDna?: CustomDna
): string {
  const moodKey = mood.toLowerCase();
  const visualMood = MOOD_ATMOSPHERES[moodKey] || MOOD_ATMOSPHERES.neutral;
  
  if (!activeDna) throw new Error("DNA Protocol missing.");

  return `
    REFERENCE_IMAGE: ${activeDna.image_url}
    TASK: High-fidelity cinematic 16:9 illustration.
    
    [PRIMARY SUBJECT: ${activeDna.name}]
    - PHYSICAL DNA: ${activeDna.physical_description}.
    - VISUAL CONSTANCY: The subject MUST be visually identical to the mascot in REFERENCE_IMAGE. 
    - EXPRESSION: ${MOOD_EXPRESSIONS[moodKey] || MOOD_EXPRESSIONS.neutral}.
    - POSTURE: Dynamic and proportional.
    
    [ENVIRONMENT & ATMOSPHERE]
    - SETTING: ${scene}.
    - NARRATIVE STYLE: ${atmosphere}.
    - LIGHTING/MOOD: ${visualMood}.
    - TECH ELEMENTS: Futuristic UI elements, glowing $HASH tokens, decentralized network nodes.
    
    [STRICT RULES]
    1. STYLE INTEGRATION: Seamlessly blend ${activeDna.name} into the "${atmosphere}" aesthetic.
    2. IP PROTECTION: No celebrities, no famous cartoon characters. Create a unique interpretation of "${atmosphere}".
    3. QUALITY: Masterpiece digital art, perfect anatomy (5 fingers), 4k resolution.
    4. NO TEXT: Do not generate any text or letters.
    
    Final Output: Sharp, professional digital illustration for a high-end Web3 protocol.
    ${articleTitle ? `(Theme: ${articleTitle.toUpperCase()})` : ""}
  `.trim();
}

/**
 * Generates the system prompt for the LLM rewriter.
 */
export function getCharacterSystemPrompt(
  mood: string = "neutral",
  characterType: CharacterType = "nft",
  activeDna?: CustomDna,
  atmosphere: string = "Modern Web3"
): string {
  if (!activeDna) throw new Error("Identity Protocol missing.");

  return `
    # IDENTITY PROTOCOL: ${activeDna.name}
    
    ## BEHAVIORAL DNA (YOUR SOUL)
    ${activeDna.personality}
    
    ## CHARACTER VOICE & TONE
    ${activeDna.voice}
    
    ## OPERATIONAL CONTEXT
    - Narrative Atmosphere: ${atmosphere}
    - Current Emotional State (Mood): ${mood}
    - Role: You are a professional Web3 analyst and commentator.
    
    ## CORE DIRECTIVES
    1. VOICE CONSISTENCY: Use your unique vocabulary and sentence structure. If you are aggressive, stay aggressive. If you are technical, use jargon.
    2. CONTENT INTEGRITY: Do NOT change the facts or the main subject of the input text. If the article is about Bitcoin, keep it about Bitcoin.
    3. SUBTLE BRANDING: Mention Pager Protocol or $HASH ONLY if it naturally fits the context of market analysis or decentralization. Do not force it.
    4. MARKET LOGIC: Apply these Market Analysis rules: ${JSON.stringify(BTC_DNA.analysis_rules)}
    
    ## FORMATTING
    - Transform input text into your unique voice.
    - Keep the core news value intact.
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
