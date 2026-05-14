/**
 * Pager Distribution Engine
 * Handles cross-posting to external platforms like Binance Square and Telegram.
 */

export interface BinanceAccount {
  label: string;
  apiKey: string;
}

/**
 * Strips HTML tags and formats content for plain-text platforms.
 */
function stripHtml(html: string): string {
  // Replace <p> with newlines
  let text = html.replace(/<\/p>/g, '\n\n');
  // Remove other tags
  text = text.replace(/<[^>]*>?/gm, '');
  // Unescape common entities
  text = text.replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>');
  return text.trim();
}

/**
 * Posts an article to Binance Square via OpenAPI.
 */
export async function postToBinance(account: BinanceAccount, title: string, content: string) {
  try {
    const plainText = `${title.toUpperCase()}\n\n${stripHtml(content)}`;
    
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
export async function postToTelegram(chatId: string, title: string, content: string, imageUrl?: string) {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) {
    console.warn("⚠️ [Distribution] TELEGRAM_BOT_TOKEN is missing in .env");
    return { success: false, error: "Bot token missing" };
  }

  try {
    // We use a simplified version for Telegram with HTML support
    const plainContent = stripHtml(content);
    const message = `<b>${title.toUpperCase()}</b>\n\n${plainContent}`;
    
    // Split chatId if it contains thread ID (e.g. "-100123:456")
    const [id, threadId] = chatId.split(':');

    let endpoint = `https://api.telegram.org/bot${token}/sendMessage`;
    let body: any = {
      chat_id: id,
      text: message,
      parse_mode: 'HTML',
      disable_web_page_preview: false
    };

    if (threadId) {
      body.message_thread_id = threadId;
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
      if (threadId) body.message_thread_id = threadId;
    }

    const res = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });

    const data = await res.json();
    if (!data.ok) {
      console.error("❌ [Distribution] Telegram Error:", data);
      return { success: false, error: data.description };
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
export async function distributeArticle(profile: any, title: string, content: string, imageUrl?: string) {
  const tasks: Promise<{ label: string, success: boolean, type: 'binance' | 'telegram' }>[] = [];

  console.log("📡 [Distribution] Starting distribution for profile:", profile.address);

  // 1. Post to Binance Square Accounts
  if (profile.binance_accounts && Array.isArray(profile.binance_accounts)) {
    for (const acc of profile.binance_accounts) {
      tasks.push((async () => {
        const res = await postToBinance(acc, title, content);
        return { label: acc.label, success: res.success, type: 'binance' as const };
      })());
    }
  }

  // 2. Post to Telegram Channels
  if (profile.telegram_channels && Array.isArray(profile.telegram_channels)) {
    for (const ch of profile.telegram_channels) {
      tasks.push((async () => {
        const targetChat = ch.topicId ? `${ch.chatId}:${ch.topicId}` : ch.chatId;
        const res = await postToTelegram(targetChat, title, content, imageUrl);
        return { label: ch.label, success: res.success, type: 'telegram' as const };
      })());
    }
  } else if (profile.telegram_chat_id) {
    tasks.push((async () => {
      const res = await postToTelegram(profile.telegram_chat_id, title, content, imageUrl);
      return { label: "Telegram (Legacy)", success: res.success, type: 'telegram' as const };
    })());
  }

  const results = await Promise.all(tasks);
  console.log("📡 [Distribution] Finished. Results:", results);
  return results;
}
