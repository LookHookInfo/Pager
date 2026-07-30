import { NextResponse } from "next/server";
import { getTokenByAddress, getTokenCandles, searchToken, calculateSMA, calculateRSI } from "@/lib/dexscreener";

export const maxDuration = 30;
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const address = searchParams.get("address");
    const q = searchParams.get("q");
    const candles = searchParams.get("candles") === "1";

    if (!address && !q) {
      return NextResponse.json({ error: "address or q required" }, { status: 400 });
    }

    if (q) {
      const results = await searchToken(q);
      return NextResponse.json({ tokens: results });
    }

    const token = await getTokenByAddress(address!);
    if (!token) {
      return NextResponse.json({ error: "Token not found" }, { status: 404 });
    }

    let candleData = null;
    let indicators = null;

    if (candles && token.pairAddress) {
      candleData = await getTokenCandles(token.pairAddress);

      if (candleData.length > 0) {
        const closes = candleData.map((c) => c.close);
        indicators = {
          sma20: calculateSMA(closes, 20),
          sma50: calculateSMA(closes, 50),
          rsi: calculateRSI(closes, 14),
        };
      }
    }

    return NextResponse.json({ token, candles: candleData, indicators });
  } catch (error: any) {
    console.error("Token API error:", error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
