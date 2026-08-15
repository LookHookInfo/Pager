import type { CustomDna } from "./index";

const BTC_ANALYSIS_RULES = {
  correlation: "Always link the news to BTC's long-term cycle (Halving, ETF flows, Hashrate).",
  tone: "Sarcastic towards fiat, bullish on decentralization, 'smart-money' vibe.",
  key_metrics: ["Fear & Greed Index mention", "Liquidations impact", "On-chain accumulation"],
  conclusion_style: "Brief, punchy forecast on how this news affects the $BTC price action.",
};

const MINING_PROJECT = {
  block_title: "POWERED BY MINING HASH",
  mission: "Decentralizing media rewards through $HASH on Base.",
  partner: {
    label: "CryptoCompare",
    url: "https://www.cryptocompare.com/coins/hashcoin",
    logo: "/Cryptocompare.png",
  },
};

const DEFAULT_CTA_LINKS = [
  { label: "Telegram", url: "https://t.me/CoinPager" },
  { label: "Blockchain Forum", url: "https://t.me/ChainInside" },
];

const DEFAULT_REF_LINKS = [
  { label: "ByBit", url: "https://www.bybit.com/invite?ref=QMXPMD" },
  { label: "OKX", url: "https://www.okx.com/join/91607600" },
  { label: "Binance", url: "https://www.binance.info/ru/activity/referral-entry/CPA/together?ref=CPA_00KIBLGG5W" },
];

export { BTC_ANALYSIS_RULES, MINING_PROJECT };

export function getBtcAnalysisBlock(
  analysis: string,
  options: { activeDna?: CustomDna; profile?: any } = {},
): string {
  const charName = options.activeDna?.name || "Mascot";

  const ctaLinks = options.profile?.cta_links?.length > 0
    ? options.profile.cta_links
    : DEFAULT_CTA_LINKS;

  const ctaHtml = ctaLinks
    .filter((l: any) => l?.label && l?.url)
    .map((l: any) => `<a href="${l.url}" target="_blank" style="margin-left: 12px; color: #000; text-decoration: none; border-bottom: 2px solid #000;">${l.label}</a>`)
    .join(" ");

  const refLinks = options.profile?.ref_links?.length > 0
    ? options.profile.ref_links
    : DEFAULT_REF_LINKS;

  const refHtml = refLinks
    .filter((r: any) => r?.label && r?.url)
    .map((r: any) => `<a href="${r.url}" target="_blank" style="color: #000; font-weight: bold; text-decoration: underline; margin: 0 8px;">${r.label}</a>`)
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
      FOLLOW FOR MORE INTEL:${ctaHtml}
    </p>
    <p style="margin: 0; font-size: 11px; color: #6b7280;">
      TRADING REWARDS: ${refHtml}
    </p>
  </div>
</div>`;
}

export function getMiningSponsorBlock(): string {
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "") || "";
  const { partner } = MINING_PROJECT;
  const logoSrc = partner.logo
    ? (partner.logo.startsWith("http") ? partner.logo : `${baseUrl}${partner.logo}`)
    : "";

  return `
<div style="margin-top: 40px; padding-top: 24px; border-top: 1px solid #e5e7eb; text-align: center; clear: both;">
  <p style="margin: 0 0 8px 0; font-size: 10px; font-weight: 900; letter-spacing: 0.2em; text-transform: uppercase; color: #9ca3af;">
    ${MINING_PROJECT.block_title}
  </p>
  <p style="margin: 0 0 16px 0; font-size: 14px; color: #4b5563; line-height: 1.5; max-width: 500px; margin-left: auto; margin-right: auto;">
    ${MINING_PROJECT.mission}
  </p>
  <div style="margin-top: 16px; margin-bottom: 12px;">
    <a href="${partner.url}" target="_blank" rel="noopener noreferrer" style="text-decoration: none; display: inline-flex; align-items: center; justify-content: center; gap: 8px; background: #f3f4f6; padding: 6px 12px; border-radius: 4px; border: 1px solid #e5e7eb;">
      ${logoSrc ? `<img src="${logoSrc}" width="16" height="16" style="display: inline-block; vertical-align: middle; border-radius: 2px;" alt="" />` : ""}
      <span style="font-size: 11px; font-weight: 800; color: #1f2937; text-transform: uppercase; letter-spacing: 0.05em;">
        ${partner.label}
      </span>
    </a>
  </div>
</div>`;
}
