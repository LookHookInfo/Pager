import { chatAnyModelJson } from "@/lib/anymodel";
import { ANYMODEL_FALLBACK_TEXT_MODEL } from "@/lib/ai-models";
import { stripHtml } from "@/lib/utils";
import { ipfsGatewayVariants, normalizeIpfs } from "@/lib/ipfs";
import { getSiteUrl } from "@/lib/site";
import { detectCommunities, cleanHashtag } from "@/lib/tweet-entities";
import type { BinanceAccount, TelegramChannel } from "@/types";

const HASH_TOKEN_LINK = "https://coinpaprika.com/coin/hash-hash-coin";

const IMAGE_FETCH_TIMEOUT_MS = 10000;

interface ImageBytes {
  buffer: Buffer;
  mime: string;
}

/**
 * Download the banner ourselves, rotating across IPFS gateways, so a fresh
 * CID or a slow Pinata gateway can't stop the photo from being posted.
 */
async function fetchImageBytes(imageUrl: string): Promise<ImageBytes | null> {
  if (imageUrl.startsWith("data:image/")) {
    const comma = imageUrl.indexOf(",");
    if (comma === -1) return null;
    const mime = imageUrl.slice(0, comma).match(/^data:([^;]+)/)?.[1] || "image/webp";
    try {
      const buffer = Buffer.from(imageUrl.slice(comma + 1), "base64");
      return buffer.length ? { buffer, mime } : null;
    } catch { return null; }
  }

  for (const candidate of ipfsGatewayVariants(imageUrl)) {
    try {
      const res = await fetch(candidate, { signal: AbortSignal.timeout(IMAGE_FETCH_TIMEOUT_MS) });
      if (!res.ok) continue;
      const mime = res.headers.get("content-type")?.split(";")[0]?.trim() || "image/webp";
      const buffer = Buffer.from(await res.arrayBuffer());
      if (!buffer.length) continue;
      return { buffer, mime };
    } catch { continue; }
  }
  return null;
}

/**
 * Known crypto token names -> $TICKER tags. Used to enrich Binance posts with
 * cashtags of the coins actually mentioned in the article so posts surface on
 * the corresponding token pages.
 */
const CRYPTO_TICKERS: Record<string, string> = {
  bitcoin: "BTC",
  ethereum: "ETH",
  solana: "SOL",
  monero: "XMR",
  binancecoin: "BNB",
  "binance coin": "BNB",
  bnb: "BNB",
  tether: "USDT",
  usdt: "USDT",
  ripple: "XRP",
  xrp: "XRP",
  cardano: "ADA",
  dogecoin: "DOGE",
  polkadot: "DOT",
  chainlink: "LINK",
  polygon: "MATIC",
  matic: "MATIC",
  arb: "ARB",
  arbitrum: "ARB",
  op: "OP",
  optimism: "OP",
  aave: "AAVE",
  worldcoin: "WLD",
  wld: "WLD",
  thorchain: "RUNE",
  rune: "RUNE",
  aptos: "APT",
  near: "NEAR",
  toncoin: "TON",
  "the open network": "TON",
  litecoin: "LTC",
  avalanche: "AVAX",
  shiba: "SHIB",
  "shiba inu": "SHIB",
  pepe: "PEPE",
  tron: "TRX",
  cosmos: "ATOM",
  uniswap: "UNI",
  render: "RNDR",
  stx: "STX",
  stacks: "STX",
  sui: "SUI",
  link: "LINK",
  innit: "INIT",
  init: "INIT",
  hash: "HASH",
};

/** Extract $TICKER cashtags of coins actually mentioned in the text (incl. title). */
function extractCashtags(title: string, content: string): string[] {
  const source = `${title}\n${content}`;
  const found: string[] = [];

  // Inline $CASHTAGS already present in the article text.
  const inline = source.match(/\$[A-Z][A-Z0-9]{1,10}\b/g) || [];
  for (const t of inline) found.push(t.toUpperCase());

  // Known coin names -> $TICKER.
  for (const [name, ticker] of Object.entries(CRYPTO_TICKERS)) {
    if (new RegExp(`\\b${name}\\b`, "i").test(source)) {
      found.push(`$${ticker.toUpperCase()}`);
    }
  }

  return [...new Set(found)].slice(0, 6);
}

/**
 * Topic hashtags for the Binance footer. Built from communities detected in the
 * article (tweet-entities) plus a couple of always-on project tags. The default
 * set kicks in when no community is detected so the post never goes tagless.
 */
function extractTopicHashtags(title: string, content: string): string[] {
  const source = `${title}\n${content}`;
  const tags = new Set<string>();

  for (const c of detectCommunities(source)) {
    tags.add(`#${c.tag}`);
  }

  // Always-on Pager / ecosystem tags.
  tags.add("#HASH");
  tags.add("#CryptoNews");

  return [...tags].slice(0, 6);
}

function formatForBinance(title: string, content: string, articleId: string, index: number = 0): string {
  const baseUrl = getSiteUrl();
  const articleUrl = `${baseUrl}/article/${articleId}`;

  // Keep inline #hashtags (do NOT strip them) so the author's tags survive.
  let text = content.replace(/<br\s*\/?>/gi, '\n').replace(/<\/p>/g, '\n\n').replace(/<[^>]*>?/gm, '');
  text = text.replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'");

  const header = `🔥 ${title.toUpperCase()}\n\n`;

  const cashtags = extractCashtags(title, text);
  const hashtags = extractTopicHashtags(title, text);
  const tagLine = [...hashtags, ...cashtags].join(" ");
  const footer = `\n\n🔗 Full story: ${articleUrl}\n💎 $HASH: ${HASH_TOKEN_LINK}\n\n${tagLine}`;

  const maxBodyLength = 700 - header.length - footer.length - 20;
  let cleanBody = text.trim();
  if (cleanBody.length > maxBodyLength) cleanBody = cleanBody.slice(0, maxBodyLength) + "...";

  const variations = ["🚀", "📈", "⚡", "💎", "✨", "🌐", "🔥", "🛰️", "🛸", "🦾"];
  const randomEmoji = variations[(Math.floor(Math.random() * variations.length) + index) % variations.length];

  return header + cleanBody.trim() + footer + " " + randomEmoji;
}

function formatForTelegram(title: string, content: string, articleId: string, authorInfo?: string): string {
  const baseUrl = getSiteUrl();
  const articleUrl = `${baseUrl}/article/${articleId}`;
  const escapeHtml = (str: string) => str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  let cleanText = content.replace(/<[^>]*>?/gm, '').trim();
  
  const escapedTitle = escapeHtml(title.toUpperCase());
  const escapedText = escapeHtml(cleanText);
  const escapedAuthor = authorInfo ? escapeHtml(authorInfo) : "";
  const footer = `\n\n🔗 <a href="${articleUrl}">Read full story on Pager</a>\n💎 <a href="${HASH_TOKEN_LINK}">Get $HASH</a>`;
  const authorLine = escapedAuthor ? `✍️ <b>Author:</b> ${escapedAuthor}\n\n` : "";
  
  let fullMessage = `${authorLine}<b>${escapedTitle}</b>\n\n${escapedText}${footer}`;
  if (fullMessage.length > 1000) {
    const overhead = authorLine.length + escapedTitle.length + footer.length + 20;
    const maxBody = 1000 - overhead;
    fullMessage = `${authorLine}<b>${escapedTitle}</b>\n\n${escapedText.slice(0, maxBody)}...${footer}`;
  }
  return fullMessage;
}

export async function adaptContent(title: string, html: string, language: string, style: string, platform: 'telegram' | 'binance') {
  const targetLanguage = (language || 'English').trim();
  const targetStyle = (style || 'Engaging and professional').trim();
  const plain = stripHtml(html).trim();
  const system = [
    'You are a professional SMM manager and content editor.',
    `TASK: Create a localized teaser of this article for ${platform.toUpperCase()}.`,
    `HARD RULES:`,
    `1. Write the ENTIRE output ONLY in ${targetLanguage}. Every word must be in ${targetLanguage} — never use English or any other language.`,
    `2. The teaser must be 2-3 short, punchy paragraphs in ${targetLanguage}. Use emojis where appropriate.`,
    `3. Tone/style: ${targetStyle}.`,
    `4. Return ONLY a valid JSON object with exactly three keys: "title", "teaser", "og_title".`,
    `   - "title": social headline in ${targetLanguage}`,
    `   - "teaser": post content (2-3 paragraphs) in ${targetLanguage}`,
    `   - "og_title": SEO preview title in ${targetLanguage}`,
    `5. Be concise. Output the JSON object and nothing else — no reasoning, no comments, no code fences.`,
  ].join('\n');
  const user = `ARTICLE TITLE:\n${title}\n\nARTICLE CONTENT:\n${plain.slice(0, 5000)}\n\nREMINDER: respond ONLY in ${targetLanguage}.`;

  // Primary model first, then one explicit retry with the fallback model if
  // the first pass fails or returns non-JSON. No model chain — each call uses
  // exactly one model; chatAnyModel only swaps to its fallback on transient
  // upstream errors.
  const run = (model?: string) =>
    chatAnyModelJson({
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
      model,
      temperature: 0.7,
      maxTokens: 3000,
      timeoutMs: 30000,
    });

  const normalize = (result: any): { title: string; teaser: string; og_title: string } | null => {
    if (!result || typeof result !== "object") return null;
    const cleanTitle = typeof result.title === "string" && result.title.trim() ? result.title.trim() : "";
    const cleanTeaser = typeof result.teaser === "string" && result.teaser.trim() ? result.teaser.trim() : "";
    const cleanOg = typeof result.og_title === "string" && result.og_title.trim() ? result.og_title.trim() : cleanTitle;
    if (!cleanTitle && !cleanTeaser) return null;
    return { title: cleanTitle || title, teaser: cleanTeaser || plain, og_title: cleanOg || cleanTitle || title };
  };

  try {
    const result = normalize(await run());
    if (result) return { ...result, adapted: true };
    throw new Error("invalid JSON shape");
  } catch (e: any) {
    console.warn(`⚠️ [Distribution] adaptContent failed (${platform}, ${targetLanguage}): ${e.message}`);
    try {
      const result = normalize(await run(ANYMODEL_FALLBACK_TEXT_MODEL()));
      if (result) return { ...result, adapted: true };
      throw new Error("invalid JSON shape");
    } catch (e2: any) {
      console.warn(`⚠️ [Distribution] adaptContent retry failed (${platform}, ${targetLanguage}): ${e2.message}`);
      return { title, teaser: plain, og_title: title, adapted: false };
    }
  }
}

const BINANCE_OPENAPI_BASE = "https://www.binance.com/bapi/composite/v1/public/pgc/openApi";
const BINANCE_OPENAPI_BASE_V2 = "https://www.binance.com/bapi/composite/v2/public/pgc/openApi";

const BINANCE_POLL_INTERVAL_MS = 3000;
const BINANCE_MAX_POLL_RETRIES = 10;

function binanceHeaders(apiKey: string): Record<string, string> {
  return {
    "Content-Type": "application/json",
    "X-Square-OpenAPI-Key": apiKey,
    clienttype: "binanceSkill",
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, Gecko) Chrome/120.0.0.0 Safari/537.36",
  };
}

function binanceMimeFromBytes(mime: string, buffer: Buffer): string {
  if (mime && /^image\//.test(mime)) return mime;
  // JPEG magic, else assume PNG/WebP — Binance accepts jpeg/png/webp.
  if (buffer.length > 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) return "image/jpeg";
  return "image/webp";
}

/**
 * Upload an image to Binance Square and return its processed imageUrl.
 * Uses the official presigned-url flow:
 *   1) POST /image/presignedUrl { imageName }           -> { presignedUrl, fileTicket }
 *   2) PUT  the image bytes to the S3 presignedUrl
 *   3) poll POST /image/imageStatus { fileTicket } until status === 1
 */
async function uploadBinanceImage(apiKey: string, image: ImageBytes): Promise<string> {
  // NOTE: Binance's /image/presignedUrl rejects some extensions (webp -> 20005
  // "Can't get presigned url"). jpg/png are universally accepted, so we always
  // request those. The actual bytes are uploaded as-is; Binance re-encodes and
  // returns a CDN url whose extension matches the requested name.
  let contentType = binanceMimeFromBytes(image.mime, image.buffer);
  const imageName = contentType.includes("jpeg") ? "banner.jpg" : "banner.png";

  let presignedUrl: string | undefined;
  let fileTicket: string | undefined;
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const presignedRes = await fetch(`${BINANCE_OPENAPI_BASE_V2}/image/presignedUrl`, {
        method: "POST",
        headers: binanceHeaders(apiKey),
        body: JSON.stringify({ imageName }),
      });
      const presigned = await presignedRes.json();
      if (presigned.code !== "000000") {
        if (attempt === 2) throw new Error(`presignedUrl [${presigned.code}]: ${presigned.message}`);
        console.warn(`[Binance] presigned transient (${presigned.code}), retry ${attempt + 1}`);
      } else {
        presignedUrl = presigned.data.presignedUrl;
        fileTicket = presigned.data.fileTicket;
        break;
      }
    } catch (e: any) {
      if (attempt === 2) throw e;
      console.warn(`[Binance] presigned call failed: ${e.message}, retry ${attempt + 1}`);
    }
    await new Promise((r) => setTimeout(r, 1500));
  }
  if (!presignedUrl || !fileTicket) throw new Error("presignedUrl not obtained");

  let uploaded = false;
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const upRes = await fetch(presignedUrl, {
        method: "PUT",
        headers: { "Content-Type": contentType },
        body: new Uint8Array(image.buffer),
      });
      if (upRes.ok) {
        uploaded = true;
        break;
      }
      if (attempt === 2) throw new Error(`S3 upload failed: ${upRes.status} ${upRes.statusText}`);
      console.warn(`[Binance] S3 PUT failed (${upRes.status}), retry ${attempt + 1}`);
    } catch (e: any) {
      if (attempt === 2) throw e;
      console.warn(`[Binance] S3 PUT error: ${e.message}, retry ${attempt + 1}`);
    }
    await new Promise((r) => setTimeout(r, 1500));
  }
  if (!uploaded) throw new Error("S3 upload failed after retries");

  for (let i = 0; i < BINANCE_MAX_POLL_RETRIES; i++) {
    const statusRes = await fetch(`${BINANCE_OPENAPI_BASE_V2}/image/imageStatus`, {
      method: "POST",
      headers: binanceHeaders(apiKey),
      body: JSON.stringify({ fileTicket }),
    });
    const status = await statusRes.json();
    if (status.code !== "000000") {
      throw new Error(`imageStatus [${status.code}]: ${status.message}`);
    }
    if (status.data?.status === 1) {
      return status.data.imageUrl;
    }
    if (status.data?.status === 2) {
      throw new Error(`Image processing failed: ${status.data.failedReason || "unknown"}`);
    }
    await new Promise((r) => setTimeout(r, BINANCE_POLL_INTERVAL_MS));
  }
  throw new Error(`Image processing timed out after ${BINANCE_MAX_POLL_RETRIES} retries`);
}

export async function postToBinance(account: BinanceAccount, title: string, content: string, articleId: string, index: number = 0, imageUrl?: string) {
  try {
    const plainText = formatForBinance(title, content, articleId, index);

    // Banner (IPFS gateway or data-URL) is uploaded and attached as the article cover.
    let coverUrl: string | undefined;
    if (imageUrl) {
      const image = await fetchImageBytes(imageUrl);
      if (image) {
        coverUrl = await uploadBinanceImage(account.apiKey, image);
      }
    }

    const body: Record<string, unknown> = coverUrl
      ? { contentType: 2, bodyTextOnly: plainText, title: (title || "").slice(0, 100), cover: coverUrl }
      : { contentType: 1, bodyTextOnly: plainText };

    const res = await fetch(`${BINANCE_OPENAPI_BASE}/content/add`, {
      method: 'POST',
      headers: binanceHeaders(account.apiKey),
      body: JSON.stringify(body),
    });
    const data = await res.json();
    return data.code === '000000' ? { success: true, id: data.data?.id } : { success: false, error: `${account.label} (${data.code}): ${data.message || data.messageDetail || 'Binance rejected the post'}` };
  } catch (e: any) { return { success: false, error: `${account.label}: ${e.message}` }; }
}

async function sendPhotoWithUrl(chatId: string, messageThreadId: number | undefined, photoUrl: string, caption: string, token: string): Promise<boolean> {
  try {
    const res = await fetch(`https://api.telegram.org/bot${token}/sendPhoto`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, photo: photoUrl, caption, parse_mode: 'HTML', message_thread_id: messageThreadId }),
    });
    const data = await res.json();
    if (data.ok) return true;
    console.warn("⚠️ [Telegram] sendPhoto (URL) failed:", data.description);
  } catch (e: any) {
    console.warn("⚠️ [Telegram] sendPhoto (URL) error:", e.message);
  }
  return false;
}

async function sendPhotoWithBytes(chatId: string, messageThreadId: number | undefined, image: ImageBytes, caption: string, token: string): Promise<boolean> {
  try {
    const formData = new FormData();
    formData.append("photo", new Blob([new Uint8Array(image.buffer)], { type: image.mime }), "banner.webp");
    formData.append("chat_id", chatId);
    formData.append("caption", caption);
    formData.append("parse_mode", "HTML");
    if (messageThreadId !== undefined) formData.append("message_thread_id", String(messageThreadId));
    const res = await fetch(`https://api.telegram.org/bot${token}/sendPhoto`, {
      method: 'POST',
      body: formData,
    });
    const data = await res.json();
    if (data.ok) return true;
    console.warn("⚠️ [Telegram] sendPhoto (upload) failed:", data.description);
  } catch (e: any) {
    console.warn("⚠️ [Telegram] sendPhoto (upload) error:", e.message);
  }
  return false;
}

export async function postToTelegram(chatId: string, title: string, content: string, articleId: string, imageUrl?: string, authorInfo?: string) {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) return { success: false, error: "Bot token missing" };
  try {
    const message = formatForTelegram(title, content, articleId, authorInfo);
    
    // Parse ID and Topic if provided in format "-1002126150260/154"
    let targetChatId = String(chatId);
    let messageThreadId: number | undefined = undefined;

    if (targetChatId.includes('/')) {
        const [id, topic] = targetChatId.split('/');
        targetChatId = id;
        messageThreadId = parseInt(topic);
    }

    const resolvedImageUrl = normalizeIpfs(imageUrl || "");
    if (resolvedImageUrl) {
      // 1) Cheapest: let Telegram fetch the photo by URL.
      if (await sendPhotoWithUrl(targetChatId, messageThreadId, resolvedImageUrl, message, token)) return { success: true };

      // 2) Reliable: download the banner ourselves (gateway rotation) and
      //    upload the bytes — a fresh CID or a slow Pinata gateway can't break it.
      const image = await fetchImageBytes(resolvedImageUrl);
      if (image && (await sendPhotoWithBytes(targetChatId, messageThreadId, image, message, token))) return { success: true };
    }

    const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, { 
        method: 'POST', 
        headers: { 'Content-Type': 'application/json' }, 
        body: JSON.stringify({ 
            chat_id: targetChatId, 
            text: message, 
            parse_mode: 'HTML', 
            message_thread_id: messageThreadId, 
            disable_web_page_preview: false 
        }) 
    });
    const data = await res.json();
    return data.ok ? { success: true } : { success: false, error: data.description };
  } catch (e: any) { return { success: false, error: e.message }; }
}
