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
