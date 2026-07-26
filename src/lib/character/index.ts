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
 * Generates a visual prompt for image generation engines.
 * Priority: article meaning → emotional feeling → concrete details → style.
 */
export function getCharacterVisualPrompt(
  scene: string,
  mood: string = "neutral",
  articleTitle?: string,
  atmosphere: string = "Cinematic Digital Art",
  activeDna?: CustomDna,
  articleContext?: string,
): string {
  const moodKey = mood.toLowerCase();
  const visualMood = MOOD_ATMOSPHERES[moodKey] || MOOD_ATMOSPHERES.neutral;

  if (!activeDna) throw new Error("DNA Protocol missing.");

  return `
    TASK: Create a 16:9 editorial illustration that instantly communicates the CORE MEANING of this article.

    [WHAT THIS ARTICLE IS ABOUT — THIS IS THE MOST CRITICAL SECTION]
    The scene must tell a clear visual story. A viewer who knows nothing about crypto must understand the topic just by looking.
    - CORE SUBJECT: ${scene}
    - ARTICLE DETAILS: ${articleContext || scene}
    - EMOTIONAL CORE: What feeling does this article carry? Use this mood: ${visualMood}

    [SCENE COMPOSITION]
    - Set the mascot character ${activeDna.name} (${activeDna.physical_description}) INTO the scene as a participant, not a decoration.
    - The mascot interacts with REAL objects from the article: coins, charts, contracts, servers, logos, documents, buildings.
    - Background must show the article's setting: trading floor, server room, courtroom, DeFi vault, mining farm, etc.
    - Every object in the scene must relate to the article's content. No random props.

    [VISUAL STYLE: ${atmosphere}]
    ${getAtmosphereVisual(atmosphere)}
    - Render in "${atmosphere}" art style throughout — character and background unified.
    - Expression: ${MOOD_EXPRESSIONS[moodKey] || MOOD_EXPRESSIONS.neutral}.
    - Lighting: ${visualMood}.

    [RULES]
    1. MEANING FIRST: The image must clearly answer "What is this article about?" through visual elements alone.
    2. CONCRETE OBJECTS: Show specific things from the article — Bitcoin logos, smart contract code, trading charts with actual numbers, specific protocol symbols, government buildings, ASIC rigs.
    3. LOGICAL SCENE: The composition must make physical sense. Characters stand on ground, objects obey gravity, cause and effect visible.
    4. MASCOT INTEGRATION: ${activeDna.name} participates in the scene (analyzing a chart, inspecting code, pointing at data) — not just standing in front of a random background.
    5. EMOTIONAL CLARITY: The mood and lighting reinforce the article's message — bullish = green/gold energy, bearish = red/storm, hack = red alert/broken vaults.
    6. NO TEXT OR LETTERS in the image.

    ${articleTitle ? `Article: "${articleTitle.toUpperCase()}"` : ""}
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