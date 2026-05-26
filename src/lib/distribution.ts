/**
 * Pager Distribution Engine
 * Handles cross-posting to external platforms like Binance Square and Telegram.
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

/**
 * Strips HTML tags and formats content for Binance Square.
 * Optimized for "Read More" engagement.
 */
function formatForBinance(title: string, html: string, articleId: string): string {
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://pager.lookhook.info';
  const articleUrl = `${baseUrl}/article/${articleId}`;

  // Process special blocks
  let text = html
    .replace(/<h3.*?>⚡ BTC IMPACT ANALYSIS<\/h3>/gi, '\n\n⚡ BTC IMPACT ANALYSIS')
    .replace(/<p.*?>POWERED BY MINING HASH<\/p>/gi, '\n\n────────────────────\nPOWERED BY MINING HASH')
    .replace(/<code.*?>(.*?)<\/code>/gi, '$1');

  // Standard cleanup
  text = text.replace(/<\/p>/g, '\n\n');
  text = text.replace(/<[^>]*>?/gm, '');
  text = text.replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>');
  
  let finalContent = `🔥 ${title.toUpperCase()}\n\n${text.trim()}`;
  
  // Strict Binance Square Limit for "Teaser" posts
  const MAX_TEXT_LENGTH = 1000;
  if (finalContent.length > MAX_TEXT_LENGTH) {
    finalContent = finalContent.slice(0, MAX_TEXT_LENGTH) + "\n\n... [Read the full story on Pager]";
  }

  const footer = `\n\n🔗 Full story: ${articleUrl}\n💎 $HASH: ${HASH_TOKEN_LINK}\n\n#Base #HASH #Web3 #Crypto #BinanceSquare`;
  
  return finalContent + footer;
}

/**
 * Formats content for Telegram using HTML support.
 */
function formatForTelegram(title: string, html: string, articleId: string, authorInfo?: string): string {
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://pager.lookhook.info';
  const articleUrl = `${baseUrl}/article/${articleId}`;

  const paragraphs = html.split(/<\/p>/i);
  const firstParagraph = paragraphs[0]?.replace(/<p.*?>/gi, '') || "";

  const btcBlock = html.match(/<h3.*?>⚡ BTC IMPACT ANALYSIS<\/h3>.*?<\/p>/gi)?.[0] || "";
  const miningBlock = html.match(/<p.*?>POWERED BY MINING HASH<\/p>.*?<code>.*?<\/code>/gi)?.[0] || "";

  let formattedFirstPara = firstParagraph.replace(/<[^>]*>?/gm, '').trim();

  const cleanBtc = btcBlock
    .replace(/<h3.*?>⚡ BTC IMPACT ANALYSIS<\/h3>/gi, '<b>⚡ BTC IMPACT ANALYSIS</b>\n')
    .replace(/<p.*?><strong>(.*?) Insights:<\/strong>(.*?)<\/p>/gi, '<i>$1 Insights:</i> $2')
    .replace(/<[^>]*>?/gm, '');

  const cleanMining = miningBlock
    .replace(/<p.*?>POWERED BY MINING HASH<\/p>/gi, '────────────────────\n<b>POWERED BY MINING HASH</b>\n')
    .replace(/<code.*?>(.*?)<\/code>/gi, '<code>$1</code>')
    .replace(/<[^>]*>?/gm, '');

  const footer = `\n\n🔗 <a href="${articleUrl}">Read full story on Pager</a>\n💎 <a href="${HASH_TOKEN_LINK}">Get $HASH</a>`;

  const authorLine = authorInfo ? `✍️ <b>Author:</b> ${authorInfo}\n\n` : "";
  let message = `${authorLine}<b>${title.toUpperCase()}</b>\n\n${formattedFirstPara}...\n\n${cleanBtc}\n\n${cleanMining}${footer}`;

  if (message.length > 1000) {
    message = `${authorLine}<b>${title.toUpperCase()}</b>\n\n${formattedFirstPara.slice(0, 300)}...\n\n🔗 <a href="${articleUrl}">Read full story on Pager</a>\n💎 <a href="${HASH_TOKEN_LINK}">Get $HASH</a>`;
  }

  return message;
}

/**
 * AI Content Adaptation
 * Rewrites the article for a specific language and style.
 */
async function adaptContent(title: string, html: string, language: string, style: string, apiKey: string) {
  if (!apiKey || (!language && !style)) return { title, html };

  try {
    console.log(`📡 [Distribution] Adapting content to: ${language}, ${style}`);
    
    const prompt = `
      ACT AS A PROFESSIONAL CONTENT TRANSLATOR AND EDITOR.
      Original Title: ${title}
      Article HTML: ${html.slice(0, 5000)}

      TASK: Rewrite and translate this article.
      STRICT TARGET LANGUAGE: ${language || 'Original'}
      TARGET STYLE: ${style || 'Keep as is'}

      RULES:
      1. YOU MUST TRANSLATE EVERYTHING TO ${language || 'THE ORIGINAL LANGUAGE'}.
      2. Keep the meaning but change the tone to ${style || 'normal'}.
      3. Maintain all important technical blocks like BTC IMPACT and POWERED BY MINING HASH.
      4. Return ONLY valid JSON: { "title": "...", "html": "..." }
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
        response_format: { type: "json_object" }
      })
    });

    const data = await res.json();
    const result = JSON.parse(data.choices[0]?.message?.content || "{}");
    
    return {
      title: result.title || title,
      html: result.html || html
    };
  } catch (e) {
    console.error("⚠️ [Distribution] Adaptation error:", e);
    return { title, html };
  }
}

/**
 * Posts to Binance Square.
 */
export async function postToBinance(account: BinanceAccount, title: string, content: string, articleId: string) {
  try {
    const plainText = formatForBinance(title, content, articleId);
    const res = await fetch('https://www.binance.com/bapi/composite/v1/public/pgc/openApi/content/add', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Square-OpenAPI-Key': account.apiKey,
        'clienttype': 'binanceSkill',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, Gecko) Chrome/120.0.0.0 Safari/537.36'
      },
      body: JSON.stringify({ bodyTextOnly: plainText })
    });
    const data = await res.json();
    if (!res.ok || data.code !== '000000') return { success: false, error: data.message || 'Binance Error' };
    return { success: true, id: data.data?.id };
  } catch (e: any) {
    return { success: false, error: e.message };
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

    let endpoint = `https://api.telegram.org/bot${token}/sendMessage`;
    let body: any = {
      chat_id: id,
      text: message,
      parse_mode: 'HTML',
      disable_web_page_preview: false
    };

    if (imageUrl) {
      endpoint = `https://api.telegram.org/bot${token}/sendPhoto`;
      body = {
        chat_id: id,
        photo: imageUrl,
        caption: message.slice(0, 1024),
        parse_mode: 'HTML'
      };
    }

    if (threadId) body.message_thread_id = parseInt(threadId);

    const res = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });

    const data = await res.json();
    if (!data.ok) return { success: false, error: data.description };

    return { success: true };
  } catch (e: any) {
    return { success: false, error: e.message };
  }
}

/**
 * Main orchestrator for distributing an article.
 */
export async function distributeArticle(profile: any, title: string, content: string, imageUrl: string | undefined, articleId: string) {
  const tasks: Promise<{ label: string, success: boolean, type: string, error?: string }>[] = [];
  const authorDisplayName = profile.name || `${profile.address.slice(0, 6)}...`;
  const aiKey = profile.ai_api_key;

  // 0. Global Feed (Original Language)
  const globalChannel = process.env.NEXT_PUBLIC_GLOBAL_TELEGRAM_CHANNEL;
  if (globalChannel) {
    tasks.push((async () => {
      const res = await postToTelegram(globalChannel, title, content, articleId, imageUrl, authorDisplayName);
      return { label: "Global Feed", success: res.success, type: 'global', error: res.error };
    })());
  }

  // 1. Binance Square Accounts
  if (profile.binance_accounts && Array.isArray(profile.binance_accounts)) {
    for (const acc of profile.binance_accounts) {
      tasks.push((async () => {
        let t = title, c = content;
        if (aiKey && (acc.language || acc.style)) {
          const adapted = await adaptContent(title, content, acc.language, acc.style, aiKey);
          t = adapted.title; c = adapted.html;
        }
        const res = await postToBinance(acc, t, c, articleId);
        return { label: acc.label, success: res.success, type: 'binance', error: res.error };
      })());
    }
  }

  // 2. Telegram Channels
  if (profile.telegram_channels && Array.isArray(profile.telegram_channels)) {
    for (const ch of profile.telegram_channels) {
      tasks.push((async () => {
        let t = title, c = content;
        if (aiKey && (ch.language || ch.style)) {
          const adapted = await adaptContent(title, content, ch.language, ch.style, aiKey);
          t = adapted.title; c = adapted.html;
        }
        const targetChat = ch.topicId ? `${ch.chatId}:${ch.topicId}` : ch.chatId;
        const res = await postToTelegram(targetChat, t, c, articleId, imageUrl);
        return { label: ch.label, success: res.success, type: 'telegram', error: res.error };
      })());
    }
  } else if (profile.telegram_chat_id) {
    // Legacy support
    tasks.push((async () => {
      const res = await postToTelegram(profile.telegram_chat_id, title, content, articleId, imageUrl);
      return { label: "Telegram (Legacy)", success: res.success, type: 'telegram', error: res.error };
    })());
  }

  const results = await Promise.all(tasks);
  console.log("📡 [Distribution] Finished. Results:", results);
  return results;
}
