export const MOODS = [
  { id: "sarcastic", label: "Sarcastic", icon: "\u{1F5AD}" },
  { id: "bullish", label: "Bullish", icon: "\u{1F680}" },
  { id: "bearish", label: "Bearish", icon: "\u{1F4C9}" },
  { id: "humorous", label: "Humorous", icon: "\u{1F606}" },
  { id: "negative", label: "Negative", icon: "\u{1F480}" },
  { id: "fomo", label: "FOMO", icon: "\u{1F525}" },
  { id: "happy", label: "Happy", icon: "\u{1F60A}" },
  { id: "neutral", label: "Neutral", icon: "\u{1F610}" },
];

export const ATMOSPHERE_PRESETS = [
  "Surrealism", "Pixel Art", "Brick Style", "Anime Style", "Graffiti", "Comics",
];

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

export const MOOD_WRITING_GUIDES: Record<string, string> = {
  sarcastic:
    "MANDATORY: Every sentence drips with sarcasm and irony. Mock crypto absurdity with biting wit, exaggerated metaphors, and dry humor.\n" +
    "FORBIDDEN: Genuine optimism, neutral tone, plain news reporting.\n" +
    'PATTERNS: "Oh great, another...", rhetorical questions that mock, "Because nothing says revolution like...". Start bold, end with a punchline. Each paragraph must make the reader smirk.',
  bullish:
    "MANDATORY: Explosive optimism. Every paragraph is a rocket to the moon. Frame everything as a massive opportunity. Use rocket/moon/war metaphors relentlessly.\n" +
    "FORBIDDEN: Caution, doubt, bearish signals, hedging language like 'but', 'however', 'risks'.\n" +
    'PATTERNS: "This is massive.", "The writing is on the wall.", short punchy hype sentences. ALL CAPS for emphasis. Exclamation marks. Energy never drops.',
  bearish:
    "MANDATORY: Cautious pessimism with analytical backbone. Paint storm clouds over every rally. Use disaster/decline metaphors. Highlight risks, red flags, worst-case scenarios.\n" +
    "FORBIDDEN: Blind optimism, FOMO language, dismissing concerns.\n" +
    'PATTERNS: "But here\'s the catch...", "Don\'t be fooled.", "The clock is ticking." Build tension paragraph by paragraph. End every section with a warning.',
  humorous:
    "MANDATORY: Comedy first, information second. Absurd analogies, pop culture references, silly comparisons. The reader MUST laugh at least once per paragraph.\n" +
    "FORBIDDEN: Dry academic tone, humorless analysis, taking anything too seriously.\n" +
    'PATTERNS: "Imagine if...", talking to charts/coins as if they\'re people, exaggerated scenarios, meme energy. Punchy comedic timing — setup then punchline.',
  negative:
    "MANDATORY: Dark, grim, foreboding. Dystopian metaphors. Frame events as failures, collapses, threats. Heavy and serious but still factual.\n" +
    "FORBIDDEN: Hope, optimism, silver linings, cheerful words, any positive spin.\n" +
    'PATTERNS: "Another crack in the foundation.", "The inevitable decline.", "No one is coming to save you." Every sentence carries weight. No light at the end of the tunnel.',
  fomo:
    "MANDATORY: Maximum urgency. Scarcity language. Countdown energy. Frame everything as a once-in-a-lifetime opportunity slipping away RIGHT NOW.\n" +
    "FORBIDDEN: Calm analysis, patience, 'wait and see', any suggestion to slow down or think.\n" +
    'PATTERNS: "While you\'re reading this, others are already in.", "The window is closing.", "Last chance." Fast-paced, breathless, explosive short sentences.',
  happy:
    "MANDATORY: Genuine warmth and celebration. Uplifting metaphors. Focus on wins, good news, optimistic outcomes. Friendly and approachable.\n" +
    "FORBIDDEN: Cynicism, doom, harsh criticism, dark humor, negativity.\n" +
    'PATTERNS: "What a time to be alive!", "The future is bright.", celebrate every milestone, congratulate the reader. Text should feel like sunshine.',
  neutral:
    "MANDATORY: Write as a seasoned Bloomberg analyst delivering a morning briefing. Data-driven, factual, TWO-SIDED analysis — present arguments FOR and AGAINST.\n" +
    "FORBIDDEN: ANY humor, sarcasm, hype, emotional language, exclamation marks, ALL CAPS emphasis, metaphors about rockets/moons/crashes, first-person opinions.\n" +
    'PATTERNS: "On one hand... on the other hand...", "Data suggests...", "Key metrics indicate...", "The risk/reward profile shows...". Professional, measured, authoritative. Every claim backed by logic, not emotion.',
};
