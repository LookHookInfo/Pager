import { chatAnyModelJson } from "@/lib/anymodel";
import { ANYMODEL_FALLBACK_TEXT_MODEL } from "@/lib/ai-models";
import { stripHtml } from "@/lib/utils";
import { ipfsGatewayVariants, normalizeIpfs } from "@/lib/ipfs";
import { getSiteUrl } from "@/lib/site";
import type { BinanceAccount, TelegramChannel } from "@/types";

const HASH_TOKEN_LINK = "https://www.cryptocompare.com/coins/hashcoin";

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

function formatForBinance(title: string, content: string, articleId: string, index: number = 0): string {
  const baseUrl = getSiteUrl();
  const articleUrl = `${baseUrl}/article/${articleId}`;

  let text = content.replace(/<br\s*\/?>/gi, '\n').replace(/<\/p>/g, '\n\n').replace(/<[^>]*>?/gm, '').replace(/#\w+/g, '');
  text = text.replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'");

  const header = `🔥 ${title.toUpperCase()}\n\n`;
  const footer = `\n\n🔗 Full story: ${articleUrl}\n💎 $HASH: ${HASH_TOKEN_LINK}\n\n#Base #HASH #BinanceSquare`;
  
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

export async function postToBinance(account: BinanceAccount, title: string, content: string, articleId: string, index: number = 0) {
  try {
    const plainText = formatForBinance(title, content, articleId, index);
    const res = await fetch('https://www.binance.com/bapi/composite/v1/public/pgc/openApi/content/add', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Square-OpenAPI-Key': account.apiKey, 'clienttype': 'binanceSkill', 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, Gecko) Chrome/120.0.0.0 Safari/537.36' },
      body: JSON.stringify({ bodyTextOnly: plainText })
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
