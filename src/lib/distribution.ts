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

export async function adaptContent(title: string, html: string, language: string, style: string, userApiKey: string, platform: 'telegram' | 'binance') {
  // Use system key primarily for autoposting to ensure top quality
  const activeKey = process.env.OPENROUTER_API_KEY || userApiKey;
  if (!activeKey) return { title, teaser: html, og_title: title };

  const targetLanguage = language || 'English';
  try {
    const prompt = `
      ACT AS A PROFESSIONAL SMM MANAGER AND CONTENT EDITOR. 
      TASK: Create a localized, unique "TEASER" version of this article for ${platform.toUpperCase()}.
      
      STRICT TARGET LANGUAGE: ${targetLanguage.toUpperCase()}
      TARGET STYLE: ${style || 'Engaging and professional'}
      
      RULES:
      1. VALUE: Highlight the most important insight of the article.
      2. STRUCTURE: Teaser should be 2-3 short, punchy paragraphs. Use emojis where appropriate for the style.
      3. CALL TO ACTION: The tone should be inviting but professional.
      4. OG TITLE: Create a powerful headline for social media preview.
      
      ORIGINAL CONTENT:
      Title: ${title}
      Article Content: ${html.replace(/<[^>]*>?/gm, '').slice(0, 5000)}
      
      RETURN ONLY VALID JSON: 
      { 
        "title": "Social headline in ${targetLanguage}", 
        "teaser": "Post content with paragraphs in ${targetLanguage}", 
        "og_title": "SEO preview title in ${targetLanguage}" 
      }
    `;

    const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: { 
        "Authorization": `Bearer ${activeKey}`, 
        "Content-Type": "application/json",
        "HTTP-Referer": "https://pager.sh",
        "X-Title": "Pager Protocol"
      },
      body: JSON.stringify({ 
        model: "google/gemini-2.5-flash", 
        messages: [{ role: "user", content: prompt }], 
        response_format: { type: "json_object" }, 
        temperature: 0.8 
      })
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
