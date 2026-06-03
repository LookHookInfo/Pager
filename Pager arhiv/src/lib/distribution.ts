import { MINING_DNA } from "@/lib/character";

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

const HASH_TOKEN_LINK = MINING_DNA.ecosystem_details.buy_link;

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

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

export async function adaptContent(title: string, html: string, language: string, style: string, apiKey: string, platform: 'telegram' | 'binance') {
  if (!apiKey) return { title, teaser: html, og_title: title };
  const targetLanguage = language || 'English';
  try {
    const prompt = `ACT AS A PROFESSIONAL SMM MANAGER AND CONTENT EDITOR. Original Title: ${title}. Article Content: ${html.replace(/<[^>]*>?/gm, '').slice(0, 3000)}. TASK: Create a localized, unique "TEASER" version of this article for ${platform.toUpperCase()}. STRICT TARGET LANGUAGE: ${targetLanguage.toUpperCase()}. TARGET STYLE: ${style || 'Engaging and professional'}. Return ONLY valid JSON: { "title": "...", "teaser": "...", "og_title": "..." }`;
    const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: { "Authorization": `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({ model: "google/gemini-2.0-flash-001", messages: [{ role: "user", content: prompt }], response_format: { type: "json_object" }, temperature: 0.85 })
    });
    const data = await res.json();
    const result = JSON.parse(data.choices[0]?.message?.content || "{}");
    return { title: result.title || title, teaser: result.teaser || html, og_title: result.og_title || result.title || title };
  } catch (e: any) { return { title, teaser: html, og_title: title }; }
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
    return data.code === '000000' ? { success: true, id: data.data?.id } : { success: false, error: `${account.label}: ${data.message}` };
  } catch (e: any) { return { success: false, error: `${account.label}: ${e.message}` }; }
}

export async function postToTelegram(chatId: string, title: string, content: string, articleId: string, imageUrl?: string, authorInfo?: string) {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) return { success: false, error: "Bot token missing" };
  try {
    const message = formatForTelegram(title, content, articleId, authorInfo);
    const parts = String(chatId).split(':');
    const id = parts[0];
    const threadId = parts[1];
    const resolvedImageUrl = resolveIpfs(imageUrl);
    if (resolvedImageUrl) {
      const res = await fetch(`https://api.telegram.org/bot${token}/sendPhoto`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ chat_id: id, photo: resolvedImageUrl, caption: message, parse_mode: 'HTML', message_thread_id: threadId ? parseInt(threadId) : undefined }) });
      const data = await res.json();
      if (data.ok) return { success: true };
    }
    const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ chat_id: id, text: message, parse_mode: 'HTML', message_thread_id: threadId ? parseInt(threadId) : undefined, disable_web_page_preview: false }) });
    const data = await res.json();
    return data.ok ? { success: true } : { success: false, error: data.description };
  } catch (e: any) { return { success: false, error: e.message }; }
}

export async function distributeArticle(profile: any, title: string, content: string, imageUrl: string | undefined, articleId: string) {
  const results: any[] = [];
  const authorDisplayName = profile.name || `${profile.address.slice(0, 6)}...`;
  const aiKey = profile.ai_api_key;
  const globalChannel = process.env.NEXT_PUBLIC_GLOBAL_TELEGRAM_CHANNEL;
  if (globalChannel) {
    const res = await postToTelegram(globalChannel, title, content, articleId, imageUrl, authorDisplayName);
    results.push({ label: "Global Feed", success: res.success, type: 'global', error: res.error });
    await sleep(2000);
  }
  if (profile.binance_accounts) {
    let accIndex = 0;
    for (const acc of profile.binance_accounts) {
      const res = await postToBinance(acc, title, content, articleId, accIndex++);
      results.push({ label: acc.label, success: res.success, type: 'binance', error: res.error });
      await sleep(5000);
    }
  }
  if (profile.telegram_channels) {
    for (const ch of profile.telegram_channels) {
      const targetChat = ch.topicId ? `${ch.chatId}:${ch.topicId}` : ch.chatId;
      const res = await postToTelegram(targetChat, title, content, articleId, imageUrl, authorDisplayName);
      results.push({ label: ch.label, success: res.success, type: 'telegram', error: res.error });
      await sleep(5000);
    }
  }
  return results;
}
