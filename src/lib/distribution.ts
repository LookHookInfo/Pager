import { chatAnyModelJson, ANYMODEL_FALLBACK_TEXT_MODEL } from "@/lib/anymodel";
import { stripHtml } from "@/lib/utils";

export interface BinanceAccount {
  label: string;
  apiKey: string;
  language?: string;
  style?: string;
}

export interface TelegramChannel {
  label: string;
  chatId: string;
  topicId?: string;
  language?: string;
  style?: string;
}

const HASH_TOKEN_LINK = "https://www.cryptocompare.com/coins/hashcoin";

function resolveIpfs(url: string | undefined): string {
  if (!url) return "";
  if (url.startsWith('ipfs://')) {
    return url.replace('ipfs://', 'https://gateway.ipn.io/ipfs/');
  }
  return url;
}

function formatForBinance(title: string, content: string, articleId: string, index: number = 0): string {
  const rawBaseUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://pager.lookhook.info';
  const baseUrl = rawBaseUrl.replace(/\/$/, '');
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
  const baseUrl = (process.env.NEXT_PUBLIC_SITE_URL || 'https://pager.lookhook.info').replace(/\/$/, '');
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

  // Primary (fast) model is tried first — its internal retry already alternates
  // to the fallback model on HTTP/network failures. If it still fails (e.g. it
  // returns non-JSON for this task), one more shot with the stable model.
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

    const resolvedImageUrl = resolveIpfs(imageUrl);
    if (resolvedImageUrl) {
      const res = await fetch(`https://api.telegram.org/bot${token}/sendPhoto`, { 
        method: 'POST', 
        headers: { 'Content-Type': 'application/json' }, 
        body: JSON.stringify({ 
            chat_id: targetChatId, 
            photo: resolvedImageUrl, 
            caption: message, 
            parse_mode: 'HTML', 
            message_thread_id: messageThreadId 
        }) 
      });
      const data = await res.json();
      if (data.ok) return { success: true };
      console.warn("⚠️ [Telegram] sendPhoto failed, falling back to message:", data.description);
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
