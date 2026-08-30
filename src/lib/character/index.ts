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
// These describe HOW to render — the art style, camera, colour grading,
// textures, and structural rules. They do NOT describe WHAT to draw (scene
// content, mascot pose, specific objects) — that comes from the article's
// banner_description injected by getCharacterVisualPrompt(). This separation
// ensures every banner is unique even within the same atmosphere.
const ATMOSPHERE_VISUALS: Record<string, string> = {
  Surrealism:
    "RENDER STYLE: Surrealist editorial illustration. " +
    "Textures melt, warp, and flow — nothing has a fixed shape. Surfaces " +
    "shift between organic and impossible: wood grain runs like liquid, metal " +
    "bends like rubber, glass breathes and pulses. Spatial logic is broken — " +
    "staircases loop into themselves, doorways open into cosmic voids, depth " +
    "is ambiguous. Colour palette is acid-saturated: neon green, electric purple, " +
    "toxic pink, bile yellow against deep indigo backgrounds. Soft volumetric " +
    "god-rays pierce through fractal clouds. Background ripples like water " +
    "viewed from below. Every surface has a different impossible texture. " +
    "The mascot's proportions are slightly warped to fit the distorted space. " +
    "Camera: dreamlike, floating, no fixed perspective. " +
    "Overall feel: a fever dream painted by a master — beautiful chaos.",

  "Pixel Art":
    "RENDER STYLE: Detailed 16-bit pixel art — SEGA Genesis / NES aesthetic. " +
    "Hard pixel grid: every element locked to a crisp grid, zero anti-aliasing. " +
    "Limited palette of exactly 16 colours per region with dithering gradients " +
    "(checkerboard pixel patterns between two tones). CRT scanline glow on " +
    "bright edges, subtle phosphor bleed on saturated colours. Camera angle: " +
    "side-scroller perspective or three-quarter isometric from above-left. " +
    "All objects are distinct sprites with black outlines and 2-3 highlight shades. " +
    "No smooth curves — everything is stepped and chunky. UI elements (health bars, " +
    "score counters, minimaps) float in corners as decorative framing. " +
    "Background: layered parallax depth. " +
    "Overall feel: a frozen frame from a premium retro game cutscene.",

  "Brick Style":
    "RENDER STYLE: Toy-like 3D construction in LEGO brick aesthetic. " +
    "Every element is built from giant glossy plastic brick blocks — visible studs " +
    "on top, seam lines between bricks, reflective plastic sheen on every surface. " +
    "Characters and objects are assembled from coloured modular pieces — hinge-plates, " +
    "round bricks, transparent support rods. Primary colours dominate: bright red, " +
    "royal blue, sunshine yellow, grass green against clean white or light grey. " +
    "Deep depth of field — foreground sharp, background bricks softly blurred. " +
    "Soft diffused studio lighting from above-left with gentle shadows under each brick. " +
    "Everything has a playful diorama feel — like a photographed LEGO set. " +
    "Camera: slightly above eye level, showing the build from a viewer's perspective. " +
    "Overall feel: everything CLICKS together — modular, tactile, constructed.",

  "Anime Style":
    "RENDER STYLE: Bright cel-shaded anime — shonen manga page / title screen aesthetic. " +
    "Frame divided into 1-2 dynamic panels of the same scene, separated by a thin " +
    "speed-line gutter — a filmic beat that reads left to right (or a single " +
    "wide panel if only one). Each panel shows a beat of the same dramatic moment, " +
    "like a manga spread. " +
    "Clean sharp lineart with consistent weight, vibrant cel-shading — flat colour " +
    "blocks with one hard shadow edge and a specular highlight. " +
    "BRIGHT DAYLIGHT ONLY: clear blue sky, fluffy cumulus clouds, sunlight from " +
    "upper-right with visible god-rays, vivid pastel palette. " +
    "NO dark backgrounds, NO night scenes, NO heavy shadows, NO silhouettes. " +
    "Camera: dramatic — fish-eye lens distortion or epic low-angle looking up. " +
    "Heavy bloom glow on brightest areas, lens flare from the sun, floating " +
    "sakura petals or energy particles in the air. Background simplified into " +
    "geometric shapes with speed lines radiating from centre. " +
    "Overall feel: the single most dramatic moment of an anime frozen in 1-2 cinematic panel(s).",

  Graffiti:
    "RENDER STYLE: Graffiti street art mural on a weathered urban surface. " +
    "The canvas is a concrete wall with visible cracks, water stains, and layers " +
    "of old torn posters and faded tags underneath the new piece. Central character " +
    "painted in bold wide aerosol outlines with spray-painted fills showing gradient " +
    "overspray at edges. Dripping paint runs down from the bottom of letters and " +
    "shapes — wet paint still sliding. Stencil texture overlays in some areas. " +
    "Paint splatters and flick marks radiate outward like an explosion of colour. " +
    "Perspective: eye-level view from across a narrow alley — cracked asphalt below, " +
    "a discarded spray can on the ground with paint pooling around its nozzle. " +
    "Colours: vibrant street palette against grey-brown concrete. Neon accent pops " +
    "where fresh paint catches light. Old tags peek through where new paint chipped. " +
    "Overall feel: raw, layered, rebellious — the wall has history.",

  Comics:
    "RENDER STYLE: Bold comic book panel layout as a single widescreen banner. " +
    "Frame divided into 3-5 rectangular panels separated by thick black gutters. " +
    "Each panel shows a sequential beat of the same scene — cinematic breakdown. " +
    "Ink style: thick confident outlines, cross-hatching for shadows, halftone " +
    "Ben Day dot textures on all backgrounds and mid-tones. Bold primary colours " +
    "(red, blue, yellow) with heavy black shadows. Oval thought bubbles and jagged " +
    "speech balloon outlines as decorative elements. Impact words embedded in the " +
    "art (CRASH, BOOM, ZAP) rendered as part of the illustration in explosive " +
    "hand-lettered style with motion lines. " +
    "Camera: varies per panel — extreme close-up, wide shot, bird's eye. " +
    "Overall feel: a page from a premium graphic novel — vivid, visual, sequential.",

  "GTA Style":
    "RENDER STYLE: GTA VI Vice City loading screen. " +
    "SETTINGS (pick one that fits the article's theme): " +
    "sun-bleached boardwalk with neon strip malls, " +
    "moonlit beach with police boats on the horizon, " +
    "underground parking garage with flickering fluorescents, " +
    "rooftop overlooking the Vice Beach skyline at golden hour, " +
    "narrow alley between Art Deco hotels with dumpsters and graffiti. " +
    "KEY PROPS (mix 2-3 per banner, randomised): " +
    "wide-body muscle car with chrome bumper reflections, " +
    "police cruiser with flashing red-blue light bar, " +
    "lowrider with hydraulic bounce frozen mid-hop, " +
    "armoured truck with rear doors hanging open, " +
    "speed boat cutting through turquoise water. " +
    "MASCOT DETAILS (pick 1-2 per banner, randomised): " +
    "half-face bandana or ski mask pulled below chin, " +
    "chrome gadget held low at hip level, " +
    "crowbar resting on shoulder, " +
    "sunglasses reflecting neon signs, " +
    "hoodie up with shadow over eyes, " +
    "gold chain catching sunset light. " +
    "ATMOSPHERE: hot pink neon, teal ocean, orange sunset, deep purple sky. " +
    "Teal-and-orange blockbuster colour grading. Lens flare from setting sun. " +
    "Palm tree silhouettes. Flamingo motifs. Heat shimmer on asphalt. " +
    "Police light reflections streaking across chrome and wet surfaces. " +
    "Vignette darkens corners. " +
    "TITLE TREATMENT: place the article headline as an iconic Vice City loading " +
    "screen title — retro GTA-style angled block lettering, thick outlined caps, " +
    "shadowed, hot pink or sunset-orange fill on a subtle dark band at the top " +
    "or bottom edge. Font reads like the classic GTA title screen. " +
    "NO offices, NO desks, NO computer screens, NO charts, NO indoor settings. " +
    "Overall: dangerous Miami summer evening — beautiful, volatile, one push from chaos.",

  Origami:
    "RENDER STYLE: Delicate folded-paper origami diorama. " +
    "Every surface is crisp origami paper with sharp fold creases, visible " +
    "geometric facets, and a subtle soft matte paper grain. Objects are built " +
    "from folded polygons that lock together — no curves, only clean angular " +
    "planes meeting at defined creases. Paper edges catch a gentle rim light. " +
    "Palette: warm natural papers (cream, kraft, soft white, gentle pastels) " +
    "with a few bold accent sheets (vermillion red, deep indigo, gold). " +
    "Lighting: airy studio light from above with long soft shadows, a faint " +
    "paper-thin depth of field. The scene sits on a clean pale tabletop that " +
    "fades to a minimal seamless background. " +
    "Composition: each element is a distinct folded unit (cranes, cubes, " +
    "geometric shapes) staged in a balanced still-life arrangement. " +
    "Camera: straight-on slightly above, calm and meditative. " +
    "Overall feel: quiet, precise, handcrafted — structure born from a single " +
    "uncut sheet. Minimal, elegant, tactile.",

  Minecraft:
    "RENDER STYLE: Blocky voxel world in the classic sandbox game aesthetic. " +
    "Everything is built from chunky 1-meter cubes on a hard voxel grid — " +
    "characters, terrain, props, and landscape. Each face is a flat texture " +
    "with subtle per-pixel noise and visible pixel resolution; edges are hard " +
    "90-degree corners, zero curves or smooth slopes. " +
    "Palette: earthy, saturated — grass greens, dirt browns, oak wood tans, " +
    "deep stone grey, cobblestone, sand, and bright accent blocks (red, gold, " +
    "deep blue wool). Daytime clear sky with blocky flat-bottomed clouds. " +
    "Lighting: bright sun direction shadows, light rays streaming between blocks. " +
    "Landscape: rolling voxel hills, trees made of stacked trunk blocks and " +
    "flat leaf canopies, a sturdy cube-built cabin or tower in the scene. " +
    "Camera: dramatic low-angle hero shot looking up at a big build, or an " +
    "isometric view showing depth. " +
    "Overall feel: a defiant hand-built survival base at golden hour — cozy, " +
    "gameplay-real, unmistakably Minecraft.",

  "Yarn Style":
    "RENDER STYLE: Handmade knitted/crocheted textile illustration. " +
    "Every surface is soft yarn with visible knit or crochet stitches — a " +
    "dense loop texture of individual threads, plush and tactile. Edges are " +
    "loose fringes and chain-stitch borders. Details are embroidered: " +
    "cross-stitch flowers, chain-stitch outlines, satin-stitch patches, and " +
    "running-stitch shading; every cloth and object carries stitched ornaments. " +
    "Use visible sewing elements — buttons with thread, patchwork pieces, " +
    "needle-and-thread motifs, little woven labels. " +
    "Palette: warm cozy wool tones — cream, dusty rose, sage, mustard, berry, " +
    "soft teal — with high-contrast embroidery accents. " +
    "Lighting: warm golden-hour glow and gentle domestic light, soft shadows. " +
    "Composition: the scene rendered like a charming quilt panel or a framed " +
    "embroidered scene, with a plush soft depth and no sharp mechanical edges. " +
    "Camera: centred, warm, inviting, slightly close. " +
    "Overall feel: handmade, lovingly stitched, warm and comforting — a story " +
    "told in wool and thread.",
};

const ATMOSPHERE_TEXT_INSTRUCTIONS: Record<string, string> = {
  Surrealism: "CARICATURE SURREAL NARRATOR: Adult swim cartoon logic with extreme exaggeration — interdimensional absurdity, mad scientist energy, reality-bending metaphors. Write like a deranged cartoon narrator on acid — chaotic, funny, mind-bending, burping through the fourth wall. Exaggerate everything. Every sentence must feel cartoonishly distorted.",
  "Pixel Art": "CARICATURE 16-BIT NARRATOR: Write as a detailed retro game narrator describing a richly illustrated scene. Use specific visual descriptions — name the objects, the setting, the characters' positions. Short punchy sentences mixed with detailed environmental descriptions. Think game manual meets news analysis. Every paragraph should paint a specific pixel-art frame: who is where, what objects surround them, what is happening in the scene.",
  "Brick Style": "CARICATURE BRICK NARRATOR: Describe everything as modular, BUILT, CONSTRUCTED from gigantic chunky bricks. Use engineering and assembly metaphors pushed to cartoon extremes. Every concept is a brick being stacked, every idea clicks into place with an audible CLICK sound effect. Structured, systematic, blueprint-like thinking but in a cartoonishly exaggerated LEGO universe where everything is plastic, primary-colored, and studded.",
  "Anime Style": "CARICATURE ANIME NARRATOR: EXTREME over-the-top dramatic narration, emotional intensity cranked to 11, protagonist energy overflowing. Use training arc, power-up transformation, and arch-rival metaphors. Scream words in ALL CAPS for emphasis. Talk about aura, spirit energy, limit breaks. Maximum dramatic caricature — every event is the most important moment in the universe, every market move is a final boss battle. Nothing is subtle, everything is SUPER.",
  "Graffiti": "CARICATURE GRAFFITI NARRATOR: Raw street energy with cartoon exaggeration, underground vibe, rebellious tone pushed to comic extremes. Use urban metaphors, graffiti culture references, spray-paint attitude. Exaggerate every statement like a massive colorful tag on a wall. Keep it edgy, loud, and authentically caricature. Every sentence drips like fresh paint — bold, messy, impossible to ignore.",
  Comics:
    "CARICATURE COMIC NARRATOR: Bold panel-to-panel storytelling with dramatic " +
    "narration boxes and punchy one-liners. Every paragraph is a comic panel — vivid, " +
    "visual, sequential. Use comic book conventions: dramatic reveals ('MEANWHILE, " +
    "IN THE MEME CONTINENT...'), impact words (CRASH! BOOM! ZAP! KABOOM!), narrator " +
    "boxes for internal monologue ('Meanwhile, the whale thought to itself...'). " +
    "Describe scenes like a comic artist would draw them: specific camera angles " +
    "(EXTREME CLOSE-UP, WIDE SHOT, BIRD'S EYE), foreground/background layering, " +
    "action sequences with motion lines. Mix dramatic exposition with snappy " +
    "one-liners. Every paragraph ends on a cliffhanger that the next paragraph resolves. " +
    "Sound effects ARE the punctuation.",

  "GTA Style":
    "CARICATURE GTA VI NARRATOR: Cynical, dry, sunburned, darkly funny — like a " +
    "Vice Beach nightlife owner who reads on-chain data between poker hands. " +
    "Low-angle narration from pavement level: everything is described standing next " +
    "to a candy-red muscle car on hot boardwalk asphalt. Beach-and-neon metaphors: " +
    "'this pump hit like a sunset over Vice Beach — beautiful and then GONE', " +
    "'the chart has more curves than Ocean Drive', ' liquidity deeper than the " +
    " Atlantic at midnight'. Reference missions, wanted stars, heist setups: " +
    "'MISSION: Don\'t get liquidated. WANTED LEVEL: 5 stars from the SEC.' " +
    "Mention the heat — Vice Beach summer heat that melts stop signs, the way chrome " +
    "blinds you off a lowrider hood at golden hour, the bass thumping from a beach " +
    "club at 2 AM. Narrator sounds like they're calling in from a balcony overlooking " +
    "the strip — palm fronds in frame, neon reflecting in their sunglasses. " +
    "Casually dangerous tone: everything is one traffic stop from chaos. " +
    "Sunset-lit sentences that start smooth and end with sirens.",

  Origami:
    "CARICATURE ORIGAMI NARRATOR: Calm, precise, meditative carton-folder energy — " +
    "like a patient master explaining origami while folding a crane. Frame every " +
    "idea as a FOLD, a CREASE, a fold sequence: markets unfold step by step, " +
    "positions are folded into place and can be unfolded at any moment. " +
    "Emphasize patience, precision, and engineering-by-hand metaphors. " +
    'PATTERNS: "First, a mountain fold...", "Unfold what no longer works.", ' +
    "'Everything starts as one flat sheet of paper.', 'Fold the thesis, keep " +
    "the crease line.', 'You can only fold so far before the paper thins.' " +
    "Clean, crisp sentences with a silent folding logic — every paragraph " +
    "snaps shut like a finished fold. Minimal ornament, maximum purpose.",

  Minecraft:
    "CARICATURE MINECRAFT NARRATOR: A veteran block-head survival engineer who " +
    "sees everything as raw materials to mine, craft, and place. Describe market " +
    "moves as mining veins, building platforms, and sprawling block bases. " +
    "Break concepts into component blocks that snap into place on a voxel grid. " +
    "PATTERNS: \"First, mine the fundamentals.\", \"Stack up the gains before it " +
    "gets dark.\", \"Every position is a block you placed — trust your build.\", " +
    "\"Don't dig straight down.\", \"That chart needs more cobblestone.\" " +
    "Use crafting-table logic and inventory metaphors: liquidity is a chest, " +
    "a rally is a diamond vein you found, a dip is a hole you can jump out of. " +
    "Brave, resourceful, quietly confident — the tone of someone who has survived " +
    "many nights by building smart. Block by block.",

  "Yarn Style":
    "CARICATURE YARN NARRATOR: A warm, cozy, hand-feeling grandma-knitter who " +
    "stitches every sentence together like a sweater. Describe market activity " +
    "as knitting, crocheting, and embroidery: charts are woven, volatility is " +
    "stretched yarn, a portfolio is a patchwork quilt, a pattern is a stitch " +
    "repeating. Use soft domestic metaphors — 'don't drop a stitch', " +
    "'tuck in your loose ends', 'every knot is a hard lesson sewn in', 'this " +
    "rally is knitted from hope and wool'. " +
    "PATTERNS: \"Let's unravel this thread.\", 'Purl one, buy two.', 'The market " +
    "unwinds before it re-knits.', 'Every blanket starts with a single looping " +
    "stitch.', 'Store your gains in a mended drawer.' " +
    "Gentle, reassuring, and quietly wise — the tone of someone whose hands " +
    "always know the next move. Warm, comforting, stitched with care.",
};

function getAtmosphereVisual(atmosphere: string, articleConcept?: string): string {
  const known = ATMOSPHERE_VISUALS[atmosphere];
  if (known) return known;

  const clean = atmosphere.replace(/["'`]/g, "").trim().slice(0, 80);
  if (!clean) {
    return ATMOSPHERE_VISUALS.Surrealism;
  }
  return (
    `RENDER STYLE: Editorial illustration in "${clean}" art style. ` +
    `The mascot and all scene elements must be rendered entirely in this aesthetic — ` +
    `character and background unified, nothing out of style. ` +
    `Textures, patterns, and material rendering native to ${clean}: use the ` +
    `distinct surfaces, colour relationships, and compositional rules that define ` +
    `${clean} as a visual art form. Camera and lighting should match how ${clean} is ` +
    `traditionally composed. Bold saturated colours, rich gradients, crisp edges, ` +
    `premium editorial finish. The scene should read as if a master of ${clean} ` +
    `painted it — not a generic illustration with a label.`
  );
}

function getAtmosphereTextInstruction(atmosphere: string): string {
  const known = ATMOSPHERE_TEXT_INSTRUCTIONS[atmosphere];
  if (known) return known;

  const clean = atmosphere.replace(/["'`]/g, "").trim().slice(0, 60);
  if (!clean) {
    return ATMOSPHERE_TEXT_INSTRUCTIONS.Surrealism;
  }
  return (
    `CARICATURE NARRATOR IN "${clean.toUpperCase()}" UNIVERSE: ` +
    `Write entirely within the "${clean}" world — every metaphor, reference, ` +
    `and description must feel native to ${clean}. ` +
    `The narrator lives inside ${clean}: they see the world through its lens, ` +
    `use its vocabulary, follow its logic. If ${clean} has a visual style, the writing ` +
    `should PAINT that style — describe textures, colours, sounds, and movements ` +
    `that belong to ${clean}. Use ${clean}-specific analogies: compare market moves to ` +
    `${clean} concepts, describe protocols as if they exist inside ${clean}. ` +
    `Every sentence must carry the DNA of ${clean} — not just mention it, but BE it. ` +
    `The reader should feel transported into ${clean} from the first word to the last.`
  );
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
    .slice(0, 300);

  const cleanTitle = (articleTitle || "")
    .replace(/<[^>]*>/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 120);

  const articleConcept = cleanScene || cleanTitle || "The latest crypto news";

  // GTA STYLE is the only atmosphere that intentionally embeds the headline as
  // a Vice City title treatment in the image itself. Every other atmosphere
  // must keep the image free of text; for GTA the headline becomes the on-canvas
  // title block.
  const isGta = atmosphere.trim().toLowerCase().startsWith("gta");

  return `
    TASK: Create a 16:9 editorial illustration that instantly communicates the CORE MEANING of this article.

    [ARTICLE CONCEPT — WHAT THIS IS ABOUT]
    The image must clearly communicate this topic through visual elements alone.
    - TOPIC: ${articleConcept}
    - EMOTIONAL CORE: ${visualMood}
    - NOTE: This topic is the THEME of the image. The atmosphere determines WHERE and HOW it is shown.

    [MASCOT]
    - Character: ${activeDna.name} (${getMascotAppearance(activeDna)})
    - The mascot is the ONLY character — no other people, animals, or mascots.
    - Do NOT describe the mascot's clothes or appearance — only its action and gesture.
    - The mascot must carry or reference something symbolic of the article's topic.

    [ART STYLE: ${atmosphere}]
    ${getAtmosphereVisual(atmosphere)}
    - Render in "${atmosphere}" art style throughout — character and background unified.
    - Expression: ${MOOD_EXPRESSIONS[moodKey] || MOOD_EXPRESSIONS.neutral}.
    - Lighting: ${visualMood}.

    [RENDER QUALITY]
    - High visual impact: bold saturated colours, rich gradients, crisp edges, premium editorial finish.
    - Dense detail and texture: layered depth, volumetric light, glossy highlights.
    - Strong composition: cinematic framing, clear focal point on the mascot, dynamic perspective.
    - No flat areas, no washed-out tones, no empty background.

    [RULES]
    1. MEANING FIRST: A viewer must understand the article's topic just by looking.
    2. ATMOSPHERE IS KING: The setting, props, and mood come from the ATMOSPHERE section above. Do NOT default to offices, desks, computer screens, or trading floors unless the atmosphere explicitly includes them.
    3. LOGICAL SCENE: Objects obey gravity, cause and effect visible.
    4. MASCOT ACTION: ${activeDna.name} participates in the atmosphere's world — not just standing.
    5. EMOTIONAL CLARITY: Mood and lighting reinforce the article's message.
    ${isGta
      ? `6. TITLE TEXT ONLY FOR GTA: Render the headline "${cleanTitle.toUpperCase()}" as the Vice City style title block described in the ART STYLE section. No other text or letters anywhere in the image.`
      : `6. NO TEXT OR LETTERS in the image.`}

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