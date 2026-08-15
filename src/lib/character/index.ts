import { MOOD_ATMOSPHERES, MOOD_EXPRESSIONS, MOOD_WRITING_GUIDES } from "@/lib/moods";
import { BTC_ANALYSIS_RULES } from "./blocks";

export { getBtcAnalysisBlock, getMiningSponsorBlock } from "./blocks";

export interface CustomDna {
  name: string;
  personality: string;
  voice: string;
  physical_description: string;
  image_url: string;
}

// Atmosphere visual descriptors for image generation.
// Each style renders the MASCOT ITSELF in the chosen aesthetic (like the old
// archive version did) — the mascot is painted as the central piece of the
// style, not just placed in front of a styled background.
const ATMOSPHERE_VISUALS: Record<string, string> = {
  Surrealism: "Surrealist editorial illustration: the mascot is rendered in melting, dreamlike surrealist style — distorted flowing shapes, painterly textures, uncanny proportion shifts; surreal objects and impossible scenes around it, vibrant unnatural color palettes, soft volumetric light.",
  "Pixel Art": "Detailed 16-bit pixel art: the mascot is rendered as a chunky crisp pixel-art sprite with dithering and CRT glow, integrated into a richly detailed pixel environment; cinematic pixel lighting, deep color depth, carefully composed scene.",
  "Brick Style": "Toy-like blocky construction illustration: the mascot is built from giant glossy brick blocks with visible studs and plastic sheen; modular building aesthetic, primary colors, playful volumetric build, soft studio lighting.",
  "Anime Style": "Bright cel-shaded anime illustration: the mascot drawn in clean anime style with large glossy expressive eyes, sharp lineart, vibrant cel-shading with soft gradients. BRIGHT DAYLIGHT scene: clear blue sky, white fluffy clouds, vivid pastel color palette, soft sunny glow — no dark backgrounds, no night scenes, no heavy shadows, no silhouettes.",
  Graffiti: "Graffiti street art mural: the mascot is painted as the central graffiti character — bold wide aerosol outlines, spray-painted fills with dripping paint effects, stencil textures, paint splatters; the whole scene is one cohesive graffiti mural on an urban brick wall canvas, vibrant street colors with neon pops, bold hip-hop attitude.",
  Comics: "Bold comic book panel: the mascot drawn in dynamic comic ink style with thick outlines, halftone dots and Ben Day textures, strong jawline, expressive eyes and an action pose with speed lines; dramatic panel composition, bold primary colors, high contrast.",
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
  return "CARICATURE CARTOON ANIMATION STYLE: exaggerated cartoon proportions, giant expressive heads, thick bold outlines, vibrant cel-shaded colors, rubbery physics, big googly eyes, over-the-top action poses. Everything stylized as one cohesive caricature cartoon artwork.";
}

function getAtmosphereTextInstruction(atmosphere: string): string {
  const known = ATMOSPHERE_TEXT_INSTRUCTIONS[atmosphere];
  if (known) return known;
  const clean = atmosphere.replace(/["'`]/g, "").trim().slice(0, 60);
  if (!clean) return "Match the narrative style precisely. Use vivid descriptions aligned with the atmosphere.";
  return `CARICATURE CARTOON NARRATOR (мультипликация): Write entirely within the "${clean}" cartoon universe — every metaphor, reference, and description must be exaggerated caricature in ${clean} style. Think animated cartoon logic: everything is bigger, louder, more dramatic than reality. Use cartoon sound effects (BOOM! CRASH! ZAP!), exaggerated descriptions, rubbery physics metaphors. Stay authentic to ${clean} lore and aesthetic but with MAXIMUM CARTOON EXAGGERATION.`;
}

/**
 * Extracts the mascot's APPEARANCE core from its DNA physical_description.
 * Keeps the full character part (proportions, face, gear) — like the old
 * archive version, which used the complete physical_description — but drops
 * the trailing environment/style sections (ENVIRONMENT DNA, STYLE SIGNATURE,
 * BACKGROUND) that would fight the user-selected atmosphere. Capped and
 * cleaned so arbitrary NFT metadata can never break the prompt or trip
 * moderation; the route-level sanitizer (sanitizeBannerPrompt) runs on top.
 */
function getMascotAppearance(dna: CustomDna): string {
  let raw = (dna.physical_description || "")
    .replace(/[\u0000-\u001F\u007F-\u009F]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  // Drop leading boilerplate headers so the character core (not a style note)
  // fills the budget.
  raw = raw.replace(/^(visual style|visual|style|description|character)\s*:\s*/i, "");
  if (!raw) {
    return "A stylized cartoon mascot with exaggerated proportions, oversized head, big expressive eyes, bold outlines, and vibrant colors.";
  }
  // Drop environment/style tail sections — they describe a pre-set background
  // that conflicts with the chosen atmosphere. Everything before them is the
  // mascot itself and is kept IN FULL for maximum character fidelity.
  raw = raw.replace(/\s*(environment dna|background dna|setting|environment|style signature)\s*:.*$/i, "");
  const MAX = 2000;
  let s = raw.slice(0, MAX);
  const lastSpace = s.lastIndexOf(" ");
  if (lastSpace > 400) s = s.slice(0, lastSpace);
  return s.trim() || raw.slice(0, MAX);
}

/**
 * Generates a visual prompt for image generation engines.
 * The article's CORE MEANING (the safe, LLM-generated banner_description) sets
 * the scene and the mascot is placed INTO it as a participant — the structure
 * that produced the best mascot fidelity. Raw user article text is deliberately
 * NOT included (image models hard-block arbitrary user text); the mascot
 * reference image is passed separately as the AnyModel input image, and the
 * whole prompt is sanitized by sanitizeBannerPrompt() at the call site.
 */
export function getCharacterVisualPrompt(
  mood: string = "neutral",
  atmosphere: string = "Cinematic Digital Art",
  activeDna?: CustomDna,
  scene?: string,
  articleTitle?: string,
): string {
  const moodKey = mood.toLowerCase();
  const visualMood = MOOD_ATMOSPHERES[moodKey] || MOOD_ATMOSPHERES.neutral;

  if (!activeDna) throw new Error("DNA Protocol missing.");

  const cleanScene = (scene || "")
    .replace(/<[^>]*>/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 200);

  const cleanTitle = (articleTitle || "")
    .replace(/<[^>]*>/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 120);

  return `
    TASK: Create a 16:9 editorial illustration that instantly communicates the CORE MEANING of this article.

    [WHAT THIS ARTICLE IS ABOUT — THIS IS THE MOST CRITICAL SECTION]
    The scene must tell a clear visual story. A viewer who knows nothing about crypto must understand the topic just by looking.
    - CORE SUBJECT: ${cleanScene || cleanTitle || "The latest crypto news"}
    - EMOTIONAL CORE: What feeling does this article carry? Use this mood: ${visualMood}

    [SCENE COMPOSITION]
    - Set the mascot character ${activeDna.name} (${getMascotAppearance(activeDna)}) INTO the scene as a participant, not a decoration.
    - The mascot interacts with REAL objects from the article: coins, charts, contracts, servers, logos, documents, buildings.
    - Background must show the article's setting: trading floor, server room, courtroom, DeFi vault, mining farm, etc.
    - Every object in the scene must relate to the article's content. No random props.

    [VISUAL STYLE: ${atmosphere}]
    ${getAtmosphereVisual(atmosphere)}
    - Render in "${atmosphere}" art style throughout — character and background unified.
    - Expression: ${MOOD_EXPRESSIONS[moodKey] || MOOD_EXPRESSIONS.neutral}.
    - Lighting: ${visualMood}.

    [RENDER QUALITY — MAXIMUM VISUAL RICHNESS]
    - High visual impact: bold saturated colors, rich gradients, crisp clean edges, premium editorial illustration finish.
    - Dense detail and texture: layered depth, volumetric light, glossy highlights, soft reflections, painterly brushwork.
    - Strong composition: cinematic framing, clear focal point on the mascot, dynamic perspective, balanced negative space.
    - No flat areas, no washed-out tones, no empty background — every part of the frame is visually interesting.

    [RULES]
    1. MEANING FIRST: The image must clearly answer "What is this article about?" through visual elements alone.
    2. CONCRETE OBJECTS: Show specific things from the article — Bitcoin logos, smart contract code, trading charts with actual numbers, specific protocol symbols, government buildings, ASIC rigs.
    3. LOGICAL SCENE: The composition must make physical sense. Characters stand on ground, objects obey gravity, cause and effect visible.
    4. MASCOT INTEGRATION: ${activeDna.name} participates in the scene (analyzing a chart, inspecting code, pointing at data) — not just standing in front of a random background.
    5. EMOTIONAL CLARITY: The mood and lighting reinforce the article's message — bullish = green/gold energy, bearish = red/storm, hack = red alert/broken vaults.
    6. NO TEXT OR LETTERS in the image.

    ${cleanTitle ? `Article: "${cleanTitle.toUpperCase()}"` : ""}
  `.trim();
}

/**
 * Generates the system prompt for the LLM rewriter.
 */
export function getCharacterSystemPrompt(
  mood: string = "neutral",
  activeDna?: CustomDna,
  atmosphere: string = "Modern Web3"
): string {
  if (!activeDna) throw new Error("Identity Protocol missing.");

  const moodKey = mood.toLowerCase();
  const moodGuide = MOOD_WRITING_GUIDES[moodKey] || MOOD_WRITING_GUIDES.neutral;

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
    - MOOD WRITING INSTRUCTIONS: ${moodGuide}
    - Role: You are a professional Web3 analyst and commentator.
    
    ## CORE DIRECTIVES
    1. VOICE CONSISTENCY: Use your unique vocabulary and sentence structure. If you are aggressive, stay aggressive. If you are technical, use jargon.
    2. MOOD APPLICATION: Follow the MOOD WRITING INSTRUCTIONS above. Every paragraph must reflect this emotional state.
    3. CONTENT INTEGRITY: Do NOT change the facts or the main subject of the input text. If the article is about Bitcoin, keep it about Bitcoin.
    4. ATMOSPHERE INTEGRATION: Weave the atmosphere naturally into your narrative without breaking character.
    5. MARKET LOGIC: Apply these Market Analysis rules: ${JSON.stringify(BTC_ANALYSIS_RULES)}
    
    ## FORMATTING
    - Transform input text into your unique voice.
    - Keep the core news value intact.
  `.trim();
}