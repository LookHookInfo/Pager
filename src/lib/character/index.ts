import btcDna from "./btc_dna.json";
import miningDna from "./mining_dna.json";
import { MOOD_ATMOSPHERES, MOOD_EXPRESSIONS } from "@/lib/moods";

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

// Atmosphere visual descriptors for image generation
// ALL styles share a caricature foundation — exaggerated cartoon proportions, bold thick outlines, expressive features
const ATMOSPHERE_VISUALS: Record<string, string> = {
  Surrealism: "CARICATURE SURREAL CARTOON: EXAGGERATED rubber hose caricature proportions, wildly distorted cartoon anatomy, giant oversized heads and tiny bodies, bulging crazy eyes, massive goofy grins. Adult swim hand-drawn caricature aesthetic with rough sketchy lineart, cel-shaded flat colors. Mind-bending impossible caricature scenes — giant melting clocks bigger than buildings, characters stretched like taffy, portals with eyeballs. Vibrant toxic color palettes, mad scientist laboratory vibe, interdimensional portal aesthetic. Messy expressive brushstrokes, dynamic smear frames, grotesque yet hilarious character distortions. EVERYTHING IS A CARICATURE — no realistic proportions allowed.",
  "Pixel Art": "CARICATURE PIXEL ART SCENE: A richly detailed retro 16-bit pixel art illustration that tells a clear story. The scene is densely packed with RECOGNIZABLE objects directly from the article — specific technology, buildings, characters, devices, charts, tokens, weapons, vehicles — all rendered in detailed pixel art with at least 32 colors. The mascot character is prominently positioned interacting with these article-specific elements. Background is a full detailed environment (not empty) — a cityscape, office, trading floor, server room, or landscape matching the article topic. Dynamic pixel lighting, parallax depth layers, detailed pixel textures on every surface. Think modern indie pixel art games (Hyper Light Drifter, Celeste) — detailed, colorful, storytelling through environmental detail. The scene must immediately communicate WHAT the article is about through its visual elements.",
  "Brick Style": "CARICATURE LEGO BRICK: Everything is built from MASSIVE oversized LEGO bricks with VISIBLE gigantic studs on every surface. Exaggerated caricature proportions — characters have giant blocky LEGO heads with classic yellow plastic skin, huge cylindrical LEGO hands, oversized brick-built features. Giant chunky bricks stacked in comically impossible ways, primary colors (bright red, yellow, blue, green) with bold plastic sheen. Every surface shows large visible LEGO studs, clutch power gaps between bricks, exaggerated modular construction. Characters stand on giant LEGO baseplates, buildings are massive brick towers defying physics. The entire world is CARICATURE LEGO — think LEGO Movie meets cartoon exaggeration with gigantic chunky bricks, oversized stud details, and toy-like volumetric build. PLASTIC TEXTURE visible everywhere with bold cartoon lighting.",
  "Anime Style": "CARICATURE ANIME: EXTREME over-the-top caricature anime — SUPER-DEFORMED (SD/chibi) proportions with ENORMOUS shiny eyes (60% of face), tiny noses, giant expressive mouths with visible teeth grit. Huge dramatic sweatdrops, massive angular action lines, comically oversized hair spikes defying gravity, exaggerated speed lines everywhere. THICK dynamic cel-shaded lineart with vibrant gradient explosions, dramatic lens flares, excessive sakura petals, over-the-top aura effects (flames, lightning, sparkle backgrounds). Characters strike extreme dramatic poses with giant exaggerated emotion faces — HUGE teary eyes, massive angry veins popping, enormous happy grins showing all teeth. Full cinematic anime composition with caricature distortion — characters can stretch, squash, and deform for comedic effect while staying in anime aesthetic.",
  "Graffiti": "CARICATURE GRAFFITI MURAL: EXTREME caricature graffiti illustration — massively oversized spray-painted features, wildly exaggerated wildstyle proportions, huge dripping aerosol drips, giant bold cartoon outlines like comic book borders. The mascot character is a vibrant caricature graffiti piece — enormous wide eyes painted with drip effects, comically oversized spray cans, exaggerated urban proportions (huge heads, baggy clothes drawn in spray paint). Bold wide aerosol outlines, dripping paint fills, stencil textures, paint splatters, giant tags in background. The character and environment form a seamless cohesive graffiti mural on brick wall canvas. Vibrant street color palette with exaggerated neon pops, all rendered as one unified caricature graffiti artwork with maximum hip-hop attitude.",
  Comics: "CARICATURE COMIC BOOK PANEL: Bold thick ink outlines, halftone dot shading, Ben Day dots texture, dramatic dynamic panel composition. The scene is structured like a comic book page with visible panel borders, action lines, and impact effects (POW! BAM! ZOOM!). The mascot character is drawn in a bold Western comic style — strong jawline, expressive eyes, dynamic action pose with speed lines. Background features detailed ink crosshatching, dramatic shadows with stark black/white contrast, and speech bubble-style thought elements. Color palette: bold primary colors with cel-shading, high contrast, dramatic rim lighting. Think Marvel/DC meets caricature — exaggerated superhero proportions, over-the-top action composition, every element tells part of the story through visual sequencing. Article-specific objects are integrated as comic props — coins as shields, charts as prophecy scrolls, contracts as ancient manuscripts.",
};

const ATMOSPHERE_TEXT_INSTRUCTIONS: Record<string, string> = {
  Surrealism: "CARICATURE SURREAL NARRATOR: Adult swim cartoon logic with extreme exaggeration — interdimensional absurdity, mad scientist energy, reality-bending metaphors. Write like a deranged cartoon narrator on acid — chaotic, funny, mind-bending, burping through the fourth wall. Exaggerate everything. Every sentence must feel cartoonishly distorted.",
  "Pixel Art": "CARICATURE 16-BIT NARRATOR: Write as a detailed retro game narrator describing a richly illustrated scene. Use specific visual descriptions — name the objects, the setting, the characters' positions. Short punchy sentences mixed with detailed environmental descriptions. Think game manual meets news analysis. Every paragraph should paint a specific pixel-art frame: who is where, what objects surround them, what is happening in the scene.",
  "Brick Style": "CARICATURE BRICK NARRATOR: Describe everything as modular, BUILT, CONSTRUCTED from gigantic chunky bricks. Use engineering and assembly metaphors pushed to cartoon extremes. Every concept is a brick being stacked, every idea clicks into place with an audible CLICK sound effect. Structured, systematic, blueprint-like thinking but in a cartoonishly exaggerated LEGO universe where everything is plastic, primary-colored, and studded.",
  "Anime Style": "CARICATURE ANIME NARRATOR: EXTREME over-the-top dramatic narration, emotional intensity cranked to 11, protagonist energy overflowing. Use training arc, power-up transformation, and arch-rival metaphors. Scream words in ALL CAPS for emphasis. Talk about aura, spirit energy, limit breaks. Maximum dramatic caricature — every event is the most important moment in the universe, every market move is a final boss battle. Nothing is subtle, everything is SUPER.",
  "Graffiti": "CARICATURE GRAFFITI NARRATOR: Raw street energy with cartoon exaggeration, underground vibe, rebellious tone pushed to comic extremes. Use urban metaphors, graffiti culture references, spray-paint attitude. Exaggerate every statement like a massive colorful tag on a wall. Keep it edgy, loud, and authentically caricature. Every sentence drips like fresh paint — bold, messy, impossible to ignore.",
  Comics: "CARICATURE COMIC NARRATOR: Bold panel-to-panel storytelling with dramatic narration boxes and punchy dialogue. Use comic book conventions — dramatic reveals ('MEANWHILE...'), impact words (CRASH! BOOM! ZAP!), narrator boxes for internal monologue. Describe scenes like a comic artist would draw them: specific camera angles, foreground/background elements, action sequences. Every paragraph is a panel — vivid, visual, sequential. Mix dramatic exposition with snappy one-liners.",
};

function getAtmosphereVisual(atmosphere: string): string {
  const known = ATMOSPHERE_VISUALS[atmosphere];
  if (known) return known;
  const clean = atmosphere.replace(/["'`]/g, "").trim().slice(0, 60);
  if (!clean) return "cinematic lighting, volumetric rays, deep colors, atmospheric depth";
  return `CARICATURE CARTOON ANIMATION STYLE: the entire image is a caricature illustration in "${clean}" cartoon aesthetic — exaggerated cartoon proportions, giant expressive heads, thick bold outlines, vibrant cel-shaded colors, rubbery physics, big googly eyes, over-the-top action poses. Everything is stylized caricature: ${clean} visual style with huge ${clean} details, giant ${clean} elements, bold ${clean} color palette, exaggerated ${clean} design language rendered as a cohesive caricature cartoon artwork. NO realism — pure cartoon exaggeration in ${clean} universe.`;
}

function getAtmosphereTextInstruction(atmosphere: string): string {
  const known = ATMOSPHERE_TEXT_INSTRUCTIONS[atmosphere];
  if (known) return known;
  const clean = atmosphere.replace(/["'`]/g, "").trim().slice(0, 60);
  if (!clean) return "Match the narrative style precisely. Use vivid descriptions aligned with the atmosphere.";
  return `CARICATURE CARTOON NARRATOR (мультипликация): Write entirely within the "${clean}" cartoon universe — every metaphor, reference, and description must be exaggerated caricature in ${clean} style. Think animated cartoon logic: everything is bigger, louder, more dramatic than reality. Use cartoon sound effects (BOOM! CRASH! ZAP!), exaggerated descriptions, rubbery physics metaphors. Stay authentic to ${clean} lore and aesthetic but with MAXIMUM CARTOON EXAGGERATION.`;
}

/**
 * Generates a cinematic visual prompt for image generation engines.
 */
export function getCharacterVisualPrompt(
  scene: string,
  mood: string = "neutral",
  characterType: CharacterType = "nft",
  articleTitle?: string,
  atmosphere: string = "Cinematic Digital Art",
  activeDna?: CustomDna,
  articleContext?: string,
): string {
  const moodKey = mood.toLowerCase();
  const visualMood = MOOD_ATMOSPHERES[moodKey] || MOOD_ATMOSPHERES.neutral;
  
  if (!activeDna) throw new Error("DNA Protocol missing.");

  return `
    REFERENCE_IMAGE: ${activeDna.image_url} (character reference only)
    TASK: High-fidelity 16:9 illustration in "${atmosphere}" style.
    
    [PRIMARY SUBJECT: ${activeDna.name}]
    - PHYSICAL DNA: ${activeDna.physical_description}.
    - CHARACTER IDENTITY: Keep the character's core identity (silhouette, color scheme, key traits) from REFERENCE_IMAGE, but fully render in "${atmosphere}" art style.
    - RENDERING: The character MUST be drawn as a ${atmosphere} illustration — not photorealistic, not default digital art.
    - EXPRESSION: ${MOOD_EXPRESSIONS[moodKey] || MOOD_EXPRESSIONS.neutral}.
    - POSTURE: Dynamic and proportional.
    
    [UNIFIED SCENE — THIS IS THE MOST IMPORTANT PART]
    - SETTING: ${scene}.
    - ARTICLE CONTEXT (these are the REAL-WORLD elements from the story that MUST be visually represented): ${articleContext || scene}.
    - VISUAL STORYTELLING: The banner must immediately communicate WHAT the article is about. Include recognizable objects, technology, symbols, and environmental details from the article context above. A viewer should understand the topic just by looking at the image.
    - FULL STYLE UNIFICATION: The entire image — character AND background — is a single cohesive "${atmosphere}" artwork. No realistic elements. Everything follows ${atmosphere} visual logic: ${getAtmosphereVisual(atmosphere)}.
    - LIGHTING/MOOD: ${visualMood}.
    
    [STRICT RULES]
    1. STYLE INTEGRATION: ${activeDna.name} and the environment must share the EXACT SAME "${atmosphere}" rendering. No mixing of art styles.
    2. CARICATURE MANDATORY: This is a CARICATURE / CARTOON illustration. Exaggerated proportions (big head, expressive face, dynamic squash-and-stretch poses), thick bold outlines, vibrant cel-shaded/flat colors. NO realism. NO photorealistic elements. EVERYTHING must look like a cartoon caricature.
    3. INFORMATIVE BANNER: The scene must contain specific visual elements from the article — not generic backgrounds. If the article mentions Bitcoin, show Bitcoin. If it mentions a specific protocol, show its symbols. If it mentions a hack, show broken code/vaults.
    4. IP PROTECTION: No celebrities, no famous cartoon characters. Create a unique interpretation of "${atmosphere}".
    5. QUALITY: Masterpiece quality caricature, clean visible outlines, high resolution.
    6. NO TEXT: Do not generate any text or letters.
    
    Final Output: Professional caricature illustration for a Web3 protocol in ${atmosphere} style.
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
    - Atmosphere Writing Guide: ${getAtmosphereTextInstruction(atmosphere)}
    - Current Emotional State (Mood): ${mood}
    - Role: You are a professional Web3 analyst and commentator.
    
    ## CORE DIRECTIVES
    1. VOICE CONSISTENCY: Use your unique vocabulary and sentence structure. If you are aggressive, stay aggressive. If you are technical, use jargon.
    2. CONTENT INTEGRITY: Do NOT change the facts or the main subject of the input text. If the article is about Bitcoin, keep it about Bitcoin.
    3. ATMOSPHERE INTEGRATION: Weave the atmosphere naturally into your narrative without breaking character.
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