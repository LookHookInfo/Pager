/**
 * Pager Distribution Engine
 * Handles cross-posting to external platforms like Binance Square and Telegram.
 */

export interface BinanceAccount {
  label: string;
  apiKey: string;
}

const HASH_TOKEN_LINK = "https://web3.binance.com/en/token/base/0xa9b631abcc4fd0bc766d7c0c8fcbf866e2bb0445";

/**
 * Strips HTML tags and formats content for plain-text platforms like Binance Square.
 */
function formatForBinance(title: string, html: string, articleId: string): string {
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://pager.lookhook.info';
  const articleUrl = `${baseUrl}/article/${articleId}`;

  // Process special blocks first
  let text = html
    .replace(/<h3.*?>⚡ BTC IMPACT ANALYSIS<\/h3>/gi, '\n⚡ BTC IMPACT ANALYSIS')
    .replace(/<p.*?><strong>(.*?) Insights:<\/strong>(.*?)<\/p>/gi, '$1 Insights: $2')
    .replace(/<p.*?>POWERED BY MINING HASH<\/p>/gi, '\n────────────────────\nPOWERED BY MINING HASH')
    .replace(/<code.*?>(.*?)<\/code>/gi, '$1');

  // Standard cleanup
  text = text.replace(/<\/p>/g, '\n\n');
  text = text.replace(/<[^>]*>?/gm, '');
  text = text.replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>');
  
  // Add HASH anchor mention (Binance Square doesn't support HTML anchors, so we use URL)
  const finalContent = `${title.toUpperCase()}\n\n${text.trim()}\n\nSource: ${articleUrl}\n$HASH: ${HASH_TOKEN_LINK}`;
  return finalContent;
}

/**
 * Formats content for Telegram using HTML support.
 * Optimized for 1024 character limit (captions).
 */
function formatForTelegram(title: string, html: string, articleId: string, authorInfo?: string): string {
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://pager.lookhook.info';
  const articleUrl = `${baseUrl}/article/${articleId}`;

  // 1. Extract First Paragraph only
  const paragraphs = html.split(/<\/p>/i);
  const firstParagraph = paragraphs[0]?.replace(/<p.*?>/gi, '') || "";

  // 2. Process special blocks
  const btcBlock = html.match(/<h3.*?>⚡ BTC IMPACT ANALYSIS<\/h3>.*?<\/p>/gi)?.[0] || "";
  const miningBlock = html.match(/<p.*?>POWERED BY MINING HASH<\/p>.*?<code>.*?<\/code>/gi)?.[0] || "";

  let formattedFirstPara = firstParagraph.replace(/<[^>]*>?/gm, '').trim();

  // 3. Stylize blocks
  const cleanBtc = btcBlock
    .replace(/<h3.*?>⚡ BTC IMPACT ANALYSIS<\/h3>/gi, '<b>⚡ BTC IMPACT ANALYSIS</b>\n')
    .replace(/<p.*?><strong>(.*?) Insights:<\/strong>(.*?)<\/p>/gi, '<i>$1 Insights:</i> $2')
    .replace(/<[^>]*>?/gm, '');

  const cleanMining = miningBlock
    .replace(/<p.*?>POWERED BY MINING HASH<\/p>/gi, '────────────────────\n<b>POWERED BY MINING HASH</b>\n')
    .replace(/<code.*?>(.*?)<\/code>/gi, '<code>$1</code>')
    .replace(/<[^>]*>?/gm, '');

  const footer = `\n\n🔗 <a href="${articleUrl}">Read full story on Pager</a>\n💎 <a href="${HASH_TOKEN_LINK}">Get $HASH</a>`;

  // Construct message
  const authorLine = authorInfo ? `✍️ <b>Author:</b> ${authorInfo}\n\n` : "";
  let message = `${authorLine}<b>${title.toUpperCase()}</b>\n\n${formattedFirstPara}...\n\n${cleanBtc}\n\n${cleanMining}${footer}`;

  // 4. Final safety truncate if still too long (Telegram caption limit is 1024)
  if (message.length > 1000) {
    message = `${authorLine}<b>${title.toUpperCase()}</b>\n\n${formattedFirstPara.slice(0, 300)}...\n\n🔗 <a href="${articleUrl}">Read full story on Pager</a>\n💎 <a href="${HASH_TOKEN_LINK}">Get $HASH</a>`;
  }

  return message;
}

/**
 * Posts an article to Binance Square via OpenAPI.
 */
export async function postToBinance(account: BinanceAccount, title: string, content: string, articleId: string) {
  try {
    const plainText = formatForBinance(title, content, articleId);
    
    const res = await fetch('https://www.binance.com/bapi/composite/v1/public/pgc/openApi/content/add', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Square-OpenAPI-Key': account.apiKey,
        'clienttype': 'binanceSkill'
      },
      body: JSON.stringify({
        bodyTextOnly: plainText
      })
    });

    const data = await res.json();
    if (!res.ok) {
      console.error(`❌ [Distribution] Binance Error (${account.label}):`, data);
      return { success: false, error: data.message || 'Binance API error' };
    }

    console.log(`✅ [Distribution] Posted to Binance (${account.label}):`, data.data?.id);
    return { success: true, id: data.data?.id };
  } catch (e: any) {
    console.error(`❌ [Distribution] Binance Critical Error (${account.label}):`, e.message);
    return { success: false, error: e.message };
  }
}

/**
 * Posts an article to Telegram via Bot API.
 */
export async function postToTelegram(chatId: string, title: string, content: string, articleId: string, imageUrl?: string, authorInfo?: string) {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) {
    console.warn("⚠️ [Distribution] TELEGRAM_BOT_TOKEN is missing in .env");
    return { success: false, error: "Bot token missing" };
  }

  try {
    const message = formatForTelegram(title, content, articleId, authorInfo);
    
    // Split chatId if it contains thread ID (e.g. "-100123:456")
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

    if (threadId) {
      body.message_thread_id = parseInt(threadId); // Telegram expects integer for thread_id
    }

    // If we have an image, use sendPhoto instead
    if (imageUrl) {
      endpoint = `https://api.telegram.org/bot${token}/sendPhoto`;
      body = {
        chat_id: id,
        photo: imageUrl,
        caption: message.slice(0, 1024), // Telegram caption limit
        parse_mode: 'HTML'
      };
      if (threadId) {
        body.message_thread_id = parseInt(threadId);
      }
    }

    const res = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });

    const data = await res.json();
    if (!data.ok) {
      console.error("❌ [Distribution] Telegram Error Details:", JSON.stringify(data));
      // Return a more detailed error to the UI
      return { 
        success: false, 
        error: `TG Error: ${data.description}${data.parameters ? ' (Param: ' + JSON.stringify(data.parameters) + ')' : ''}` 
      };
    }

    console.log("✅ [Distribution] Posted to Telegram!");
    return { success: true };
  } catch (e: any) {
    console.error("❌ [Distribution] Telegram Critical Error:", e.message);
    return { success: false, error: e.message };
  }
}

/**
 * Main orchestrator for distributing an article.
 * Returns a list of results for the client UI.
 */
export async function distributeArticle(profile: any, title: string, content: string, imageUrl: string | undefined, articleId: string) {
  const tasks: Promise<{ label: string, success: boolean, type: 'binance' | 'telegram' | 'global' }>[] = [];

  console.log("📡 [Distribution] Starting distribution for profile:", profile.address);

  const authorDisplayName = profile.name || `${profile.address.slice(0, 6)}...${profile.address.slice(-4)}`;

  // 0. Post to GLOBAL Pager Feed (Bonus for all writers)
  const globalChannel = process.env.NEXT_PUBLIC_GLOBAL_TELEGRAM_CHANNEL;
  if (globalChannel) {
    tasks.push((async () => {
      console.log("📡 [Distribution] Posting to Global Feed...");
      const res = await postToTelegram(globalChannel, title, content, articleId, imageUrl, authorDisplayName);
      return { label: "Global Feed", success: res.success, type: 'global' as const };
    })());
  }

  // 1. Post to Binance Square Accounts
  if (profile.binance_accounts && Array.isArray(profile.binance_accounts)) {
    for (const acc of profile.binance_accounts) {
      tasks.push((async () => {
        const res = await postToBinance(acc, title, content, articleId);
        return { label: acc.label, success: res.success, type: 'binance' as const };
      })());
    }
  }

  // 2. Post to Telegram Channels
  if (profile.telegram_channels && Array.isArray(profile.telegram_channels)) {
    for (const ch of profile.telegram_channels) {
      tasks.push((async () => {
        const targetChat = ch.topicId ? `${ch.chatId}:${ch.topicId}` : ch.chatId;
        const res = await postToTelegram(targetChat, title, content, articleId, imageUrl);
        return { label: ch.label, success: res.success, type: 'telegram' as const };
      })());
    }
  } else if (profile.telegram_chat_id) {
    tasks.push((async () => {
      const res = await postToTelegram(profile.telegram_chat_id, title, content, articleId, imageUrl);
      return { label: "Telegram (Legacy)", success: res.success, type: 'telegram' as const };
    })());
  }

  const results = await Promise.all(tasks);
  console.log("📡 [Distribution] Finished. Results:", results);
  return results;
}
