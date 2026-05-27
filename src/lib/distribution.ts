/**
 * Pager Distribution Engine
 * Handles cross-posting to external platforms like Binance Square and Telegram.
 * Optimized for sequential delivery with localized teasers and custom OG previews.
 */

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

const HASH_TOKEN_LINK = "https://web3.binance.com/en/token/base/0xa9b631abcc4fd0bc766d7c0c8fcbf866e2bb0445";

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

/**
 * Resolves IPFS URLs to HTTP gateway URLs for external platform compatibility.
 */
function resolveIpfs(url: string | undefined): string {
  if (!url) return "";
  if (url.startsWith('ipfs://')) {
    return url.replace('ipfs://', 'https://gateway.ipn.io/ipfs/');
  }
  return url;
}

/**
 * Strips HTML tags and formats content for Binance Square.
 * Focused on short "Post" format (max 700-1000 chars for PGC, but we aim for safe 800).
 */
function formatForBinance(title: string, content: string, articleId: string, index: number = 0): string {
  const rawBaseUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://pager.lookhook.info';
  const baseUrl = rawBaseUrl.replace(/\/$/, '');
  const articleUrl = `${baseUrl}/article/${articleId}`;

  // Clean HTML
  let text = content
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/g, '\n\n')
    .replace(/<[^>]*>?/gm, '');

  // Remove any hashtags AI might have generated to avoid exceeding limits
  text = text.replace(/#\w+/g, '');

  // Resolve HTML entities
  text = text
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");

  const header = `🔥 ${title.toUpperCase()}\n\n`;
  // Minimal set of hashtags (Binance Square is sensitive to counts > 3-5)
  const footer = `\n\n🔗 Full story: ${articleUrl}\n💎 $HASH: ${HASH_TOKEN_LINK}\n\n#Base #HASH #BinanceSquare`;
  
  // Binance PGC posts actually support up to 2000-5000 chars, but short "Feed" posts 
  // are best around 500-800 chars. Let's aim for 700 total.
  const maxBodyLength = 700 - header.length - footer.length - 20;
  
  let cleanBody = text.trim();
  if (cleanBody.length > maxBodyLength) {
    cleanBody = cleanBody.slice(0, maxBodyLength) + "...";
  }

  // Add random variation to avoid duplicate content blocks
  const variations = ["🚀", "📈", "⚡", "💎", "✨", "🌐", "🔥", "🛰️", "🛸", "🦾"];
  const randomEmoji = variations[(Math.floor(Math.random() * variations.length) + index) % variations.length];
  
  return header + cleanBody.trim() + footer + " " + randomEmoji;
}

/**
 * Formats content for Telegram using HTML support.
 */
function formatForTelegram(title: string, content: string, articleId: string, authorInfo?: string): string {
  const baseUrl = (process.env.NEXT_PUBLIC_SITE_URL || 'https://pager.lookhook.info').replace(/\/$/, '');
  const articleUrl = `${baseUrl}/article/${articleId}`;

  const escapeHtml = (str: string) => str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');

  let cleanText = content.replace(/<[^>]*>?/gm, '').trim();
  
  const escapedTitle = escapeHtml(title.toUpperCase());
  const escapedText = escapeHtml(cleanText);
  const escapedAuthor = authorInfo ? escapeHtml(authorInfo) : "";

  const footer = `\n\n🔗 <a href="${articleUrl}">Read full story on Pager</a>\n💎 <a href="${HASH_TOKEN_LINK}">Get $HASH</a>`;
  const authorLine = escapedAuthor ? `✍️ <b>Author:</b> ${escapedAuthor}\n\n` : "";
  
  let fullMessage = `${authorLine}<b>${escapedTitle}</b>\n\n${escapedText}${footer}`;

  // If too long for a caption (1024 chars), trim the body
  if (fullMessage.length > 1000) {
    const overhead = authorLine.length + escapedTitle.length + footer.length + 20;
    const maxBody = 1000 - overhead;
    fullMessage = `${authorLine}<b>${escapedTitle}</b>\n\n${escapedText.slice(0, maxBody)}...${footer}`;
  }
  
  return fullMessage;
}

/**
 * AI Content Adaptation.
 * Dynamically creates localized and stylized versions of the article.
 */
export async function adaptContent(title: string, html: string, language: string, style: string, apiKey: string, platform: 'telegram' | 'binance') {
  if (!apiKey) return { title, teaser: html, og_title: title };

  // Explicitly force the target language in the prompt
  const targetLanguage = language || 'English';

  try {
    const prompt = `
      ACT AS A PROFESSIONAL SMM MANAGER AND CONTENT EDITOR.
      Original Title: ${title}
      Article Content: ${html.replace(/<[^>]*>?/gm, '').slice(0, 3000)}

      TASK: Create a localized, unique "TEASER" version of this article for ${platform.toUpperCase()}.
      STRICT TARGET LANGUAGE: ${targetLanguage.toUpperCase()}
      TARGET STYLE: ${style || 'Engaging and professional'}

      CRITICAL RULES:
      1. YOU MUST WRITE EVERYTHING IN ${targetLanguage.toUpperCase()}. DO NOT USE ENGLISH UNLESS THE TARGET IS ENGLISH.
      2. The "teaser" MUST be between 500 and 700 characters. Be detailed, provocative and hook the reader.
      3. Use emojis appropriate for ${platform} and ${targetLanguage} culture.
      4. DO NOT USE HASHTAGS (#) IN THE TEASER TEXT.
      5. Make it unique from the original content while preserving the facts.
      6. "og_title" should be a very short, explosive version of the title (max 40 chars) IN ${targetLanguage.toUpperCase()}.
      7. Return ONLY valid JSON: { "title": "...", "teaser": "...", "og_title": "..." }
    `;

    const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        "HTTP-Referer": "https://pager.lookhook.info"
      },
      body: JSON.stringify({
        model: "google/gemini-2.0-flash-001",
        messages: [{ role: "user", content: prompt }],
        response_format: { type: "json_object" },
        temperature: 0.85
      })
    });

    const data = await res.json();
    if (!res.ok) throw new Error(data.error?.message || "OpenRouter error");
    
    const contentText = data.choices[0]?.message?.content || "{}";
    const result = JSON.parse(contentText);
    
    return {
      title: result.title || title,
      teaser: result.teaser || html,
      og_title: result.og_title || result.title || title
    };
  } catch (e: any) {
    console.error(`⚠️ [Distribution] Adaptation error for ${targetLanguage}:`, e.message);
    return { title, teaser: html, og_title: title };
  }
}

/**
 * Posts to Binance Square.
 */
export async function postToBinance(account: BinanceAccount, title: string, content: string, articleId: string, index: number = 0) {
  try {
    const plainText = formatForBinance(title, content, articleId, index);
    
    const payload = {
      bodyTextOnly: plainText
    };

    console.log(`📡 [Binance Square] Sending to ${account.label} (${account.language}). Key prefix: ${account.apiKey?.slice(0, 4)}...`);

    const res = await fetch('https://www.binance.com/bapi/composite/v1/public/pgc/openApi/content/add', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Square-OpenAPI-Key': account.apiKey,
        'clienttype': 'binanceSkill',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, Gecko) Chrome/120.0.0.0 Safari/537.36'
      },
      body: JSON.stringify(payload)
    });

    const data = await res.json();
    console.log(`📡 [Binance Square] Response for ${account.label}:`, data);

    if (data.code === '000000') return { success: true, id: data.data?.id };
    
    return { success: false, error: `${account.label}: ${data.message || `Code ${data.code}`}` };
  } catch (e: any) {
    console.error(`❌ [Binance Square] Critical Error (${account.label}):`, e.message);
    return { success: false, error: `${account.label}: ${e.message}` };
  }
}

/**
 * Posts to Telegram.
 */
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
      const res = await fetch(`https://api.telegram.org/bot${token}/sendPhoto`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: id,
          photo: resolvedImageUrl,
          caption: message,
          parse_mode: 'HTML',
          message_thread_id: threadId ? parseInt(threadId) : undefined
        })
      });
      const data = await res.json();
      if (data.ok) return { success: true };
    }

    const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: id,
        text: message,
        parse_mode: 'HTML',
        message_thread_id: threadId ? parseInt(threadId) : undefined,
        disable_web_page_preview: false
      })
    });

    const data = await res.json();
    if (!data.ok) return { success: false, error: data.description };

    return { success: true };
  } catch (e: any) {
    console.error("❌ [Telegram] Critical Error:", e.message);
    return { success: false, error: e.message };
  }
}

/**
 * Main orchestrator for distributing an article.
 */
export async function distributeArticle(profile: any, title: string, content: string, imageUrl: string | undefined, articleId: string) {
  const results: any[] = [];
  const authorDisplayName = profile.name || `${profile.address.slice(0, 6)}...`;
  const aiKey = profile.ai_api_key;
  const rawBaseUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://pager.lookhook.info';
  const baseUrl = rawBaseUrl.replace(/\/$/, '');

  console.log("🚀 [Distribution] Starting sequential distribution for article:", articleId);

  // 0. Global Feed
  const globalChannel = process.env.NEXT_PUBLIC_GLOBAL_TELEGRAM_CHANNEL;
  if (globalChannel) {
    const res = await postToTelegram(globalChannel, title, content, articleId, imageUrl, authorDisplayName);
    results.push({ label: "Global Feed", success: res.success, type: 'global', error: res.error });
    await sleep(2000);
  }

  // 1. Binance Square Accounts
  if (profile.binance_accounts && Array.isArray(profile.binance_accounts)) {
    let accIndex = 0;
    for (const acc of profile.binance_accounts) {
      try {
        let t = title, c = content;
        if (aiKey) {
          const adapted = await adaptContent(title, content, acc.language || 'English', acc.style || 'Professional', aiKey, 'binance');
          t = adapted.title;
          c = adapted.teaser;
        }
        const res = await postToBinance(acc, t, c, articleId, accIndex);
        results.push({ label: acc.label, success: res.success, type: 'binance', error: res.error });
      } catch (err: any) {
        results.push({ label: acc.label, success: false, type: 'binance', error: err.message });
      }
      accIndex++;
      await sleep(5000);
    }
  }

  // 2. Telegram Channels
  if (profile.telegram_channels && Array.isArray(profile.telegram_channels)) {
    for (const ch of profile.telegram_channels) {
      try {
        let t = title, c = content;
        let currentImageUrl = imageUrl;

        if (aiKey) {
          const targetLang = ch.language || 'English';
          const adapted = await adaptContent(title, content, targetLang, ch.style || 'Engaging', aiKey, 'telegram');
          t = adapted.title;
          c = adapted.teaser;
          if (!currentImageUrl) {
            currentImageUrl = `${baseUrl}/api/og?id=${articleId}&title=${encodeURIComponent(adapted.og_title)}`;
          }
        }
        
        const targetChat = ch.topicId ? `${ch.chatId}:${ch.topicId}` : ch.chatId;
        const res = await postToTelegram(targetChat, t, c, articleId, currentImageUrl, authorDisplayName);
        results.push({ label: ch.label, success: res.success, type: 'telegram', error: res.error });
      } catch (err: any) {
        results.push({ label: ch.label, success: false, type: 'telegram', error: err.message });
      }
      await sleep(5000);
    }
  }

  console.log("🏁 [Distribution] Finished. Results:", results);
  return results;
}
