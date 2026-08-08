import { NextResponse } from "next/server";
import { getCharacterSystemPrompt } from "@/lib/character";
import { resolveDna } from "@/lib/character/resolve";
import { verifySessionAnyAction } from "@/lib/auth";
import { finalFormat } from "@/lib/utils";
import { getTokenByAddress, getTokenCandles, calculateSMA, calculateRSI } from "@/lib/dexscreener";
import { chatAnyModelJson } from "@/lib/anymodel";

export const maxDuration = 60;
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { tokenAddress, mood = "neutral", atmosphere = "Surrealism", nftTokenId, userAddress, signature, message } = body;

    if (!userAddress) return NextResponse.json({ error: "User address required" }, { status: 400 });
    if (!tokenAddress) return NextResponse.json({ error: "Token address required" }, { status: 400 });
    if (!nftTokenId) return NextResponse.json({ error: "NFT Mascot required" }, { status: 400 });

    const normalizedAddress = userAddress.toLowerCase();

    const authError = await verifySessionAnyAction(normalizedAddress, signature, message);
    if (authError) return authError;

    const activeDna = await resolveDna(nftTokenId);
    if (!activeDna) return NextResponse.json({ error: `Mascot DNA not found for token #${nftTokenId}` }, { status: 404 });

    const tokenData = await getTokenByAddress(tokenAddress);
    if (!tokenData) return NextResponse.json({ error: "Token not found on DEXScreener" }, { status: 404 });

    let candleData = null;
    let indicators = null;
    if (tokenData.pairAddress) {
      candleData = await getTokenCandles(tokenData.pairAddress);
      if (candleData.length > 0) {
        const closes = candleData.map((c) => c.close);
        indicators = {
          sma20: calculateSMA(closes, 20),
          sma50: calculateSMA(closes, 50),
          rsi: calculateRSI(closes, 14),
        };
      }
    }

    const latestRsi = indicators?.rsi?.[indicators.rsi.length - 1] ?? null;
    const sma20Val = indicators?.sma20?.[indicators.sma20.length - 1] ?? null;
    const sma50Val = indicators?.sma50?.[indicators.sma50.length - 1] ?? null;

    const systemPrompt = getCharacterSystemPrompt(mood, activeDna, atmosphere);

    const dataSummary = `
EXACT TOKEN DATA (DO NOT fabricate numbers — use ONLY these values):
NAME: ${tokenData.name}
SYMBOL: ${tokenData.symbol}
CONTRACT: ${tokenData.address}
CHAIN: Base (DEX: ${tokenData.dex})
PAIR: ${tokenData.pairAddress}

PRICE: $${tokenData.priceUsd < 0.01 ? tokenData.priceUsd.toExponential(4) : tokenData.priceUsd.toFixed(6)}

CHANGE:
- 1H: ${tokenData.priceChange1h >= 0 ? "+" : ""}${tokenData.priceChange1h.toFixed(2)}%
- 6H: ${tokenData.priceChange6h >= 0 ? "+" : ""}${tokenData.priceChange6h.toFixed(2)}%
- 24H: ${tokenData.priceChange24h >= 0 ? "+" : ""}${tokenData.priceChange24h.toFixed(2)}%

VOLUME 24H: $${tokenData.volume24h >= 1e6 ? (tokenData.volume24h / 1e6).toFixed(2) + "M" : tokenData.volume24h >= 1e3 ? (tokenData.volume24h / 1e3).toFixed(1) + "K" : tokenData.volume24h.toFixed(0)}
LIQUIDITY: $${tokenData.liquidity >= 1e6 ? (tokenData.liquidity / 1e6).toFixed(2) + "M" : tokenData.liquidity >= 1e3 ? (tokenData.liquidity / 1e3).toFixed(1) + "K" : tokenData.liquidity.toFixed(0)}
FDV: $${tokenData.fdv >= 1e6 ? (tokenData.fdv / 1e6).toFixed(2) + "M" : tokenData.fdv >= 1e3 ? (tokenData.fdv / 1e3).toFixed(1) + "K" : tokenData.fdv.toFixed(0)}

MARKET METRICS:
- Volume/Liquidity ratio: ${tokenData.liquidity > 0 ? (tokenData.volume24h / tokenData.liquidity).toFixed(2) : "N/A"}
- ${tokenData.priceUsd > 0 ? `Price vs FDV ratio: active` : "Price data unavailable"}

${latestRsi != null ? `TECHNICAL INDICATORS:
- RSI(14): ${latestRsi.toFixed(1)}${latestRsi > 70 ? " — OVERBOUGHT territory" : latestRsi < 30 ? " — OVERSOLD territory" : " — neutral zone"}
${sma20Val !== null && sma20Val !== undefined ? `- SMA20: $${sma20Val.toFixed(8)}` : ""}
${sma50Val !== null && sma50Val !== undefined ? `- SMA50: $${sma50Val.toFixed(8)}` : ""}
${sma20Val !== null && sma20Val !== undefined && tokenData.priceUsd > 0 ? `- Price ${tokenData.priceUsd > sma20Val ? "ABOVE" : "BELOW"} SMA20 (${tokenData.priceUsd > sma20Val ? "bullish signal" : "bearish signal"})` : ""}
${sma20Val != null && sma50Val != null && sma20Val !== undefined && sma50Val !== undefined ? `- SMA20 vs SMA50: ${sma20Val > sma50Val ? "GOLDEN CROSS zone — bullish momentum" : "DEATH CROSS zone — bearish pressure"}` : ""}` : "TECHNICAL INDICATORS: No candle data available for this pair."}

LINKS:
- DEXScreener: https://dexscreener.com/base/${tokenData.pairAddress}
- Pager Token Page: https://pager.lookhook.info/token/${tokenData.address}
`.trim();

    const userPrompt = `
TASK: Write a sharp, data-driven token analysis for ${tokenData.symbol} as ${activeDna.name}.

CRITICAL RULES:
- DO NOT invent, round up, or estimate any numbers. Copy exact values from the data below.
- If RSI says 64.7, write "64.7" — not "around 65" or "in the 60s".
- If 24H change is +12.47%, write "+12.47%" — not "double digits" or "over 10%".
- Every claim MUST reference a specific number from the data.

TOKEN DATA:
${dataSummary}

WRITING RULES:
1. Write 3-5 paragraphs mixing technical analysis with your unique character voice.
2. Every paragraph must include at least ONE specific data point (price, percentage, ratio, RSI, SMA).
3. Include a clear verdict: bullish, bearish, or neutral — backed by the data.
4. Never break character. Use your DNA personality and mood style.
5. End with a one-line "Pager Signal" summary for ${tokenData.symbol}.

BRANDING:
- Mention "Pager" (https://pager.sh) as the source at least once naturally.
- Include link to DEXScreener: https://dexscreener.com/base/${tokenData.pairAddress}
- Include link to Pager Token Page: https://pager.lookhook.info/token/${tokenData.address}
- Keep branding natural, not spammy.

OUTPUT FORMAT: STRICT JSON
{
  "title": "Short catchy analysis title with ${tokenData.symbol}",
  "body": "The analysis with HTML tags (<strong>, <em>, <a href='...'>) — embed links where natural. Every data point must be wrapped in <strong> tags.",
  "banner_description": "A cinematic digital trading scene featuring the ${tokenData.symbol} token logo/coin prominently in the center, surrounded by holographic price tickers showing $${tokenData.priceUsd < 0.01 ? tokenData.priceUsd.toExponential(2) : tokenData.priceUsd.toFixed(6)}, green or red trading screens, candlestick charts, and financial data visualizations. Style: ${atmosphere}. Mood: ${mood}. Dark premium fintech aesthetic with neon accents."
}
`;

    const result = await chatAnyModelJson({
      messages: [{ role: "system", content: systemPrompt }, { role: "user", content: userPrompt }],
      temperature: 0.8,
      maxTokens: 4000,
      timeoutMs: 45000,
    });

    const finalTitle = (result.title || `${tokenData.symbol} Analysis`).replace(/["']/g, "").trim();
    let finalBody = finalFormat(result.body || "");
    if (!finalBody.includes("<p")) {
      finalBody = finalBody.split("\n\n").map((p: string) => `<p style="margin-bottom: 24px;">${p}</p>`).join("");
    }

    return NextResponse.json({
      title: finalTitle,
      content: finalBody,
      banner_description: result.banner_description || `${activeDna.name} analyzing ${tokenData.symbol} trading scene`,
      token_address: tokenData.address,
      token_symbol: tokenData.symbol,
      token: tokenData,
    });
  } catch (error: any) {
    console.error("Token commentary error:", error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
