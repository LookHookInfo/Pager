import { NextResponse } from 'next/server';
import { getSupabaseServer } from '@/lib/supabase';
import { postToBinance, postToTelegram, adaptContent } from '@/lib/distribution';
import { decryptData } from '@/lib/security';
import { verifySignature, getAuthMessage } from '@/lib/auth';

export const maxDuration = 60;

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { articleId, channelType, account, profileAddress, signature, message } = body;

    console.log(`📡 [API Distribution] Request for ${channelType} (${account.label || 'N/A'})`);

    if (!articleId || !channelType || !account || !profileAddress) {
      console.error("❌ [API Distribution] Missing parameters:", { articleId, channelType, account, profileAddress });
      return NextResponse.json({ error: 'Missing parameters' }, { status: 400 });
    }

    const normalizedAddress = profileAddress.toLowerCase();

    // 1. ВЕРИФИКАЦИЯ ПОДПИСИ
    if (!signature || !message) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    const expectedMessage = getAuthMessage(`distribute to ${account.label || 'channel'}`, normalizedAddress);
    const sessionMessage = getAuthMessage("authorize session", normalizedAddress);
    
    // Пакетная дистрибуция может иметь разное количество каналов в сообщении
    // Поэтому проверяем на вхождение ключевой фразы или session signature
    const isBatchMsg = message.includes("distribute to") && message.includes("channels");

    if (message !== expectedMessage && message !== sessionMessage && !isBatchMsg) {
      return NextResponse.json({ error: 'Invalid auth message' }, { status: 401 });
    }

    const isAuthorized = await verifySignature(message, signature, normalizedAddress);
    if (!isAuthorized) {
      return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
    }

    const supabaseServer = getSupabaseServer();
    
    // 1. Fetch the article
    const { data: article, error: artError } = await supabaseServer
      .from('articles')
      .select('*')
      .eq('id', articleId)
      .single();
    
    if (artError || !article) {
        console.error("❌ [API Distribution] Article not found:", articleId);
        return NextResponse.json({ error: 'Article not found' }, { status: 404 });
    }

    // 2. Fetch profile for AI key
    const { data: profile } = await supabaseServer
      .from('profiles')
      .select('name, ai_api_key')
      .eq('address', profileAddress.toLowerCase())
      .single();

    // Расшифровываем OpenRouter ключ если он есть
    const aiKey = profile?.ai_api_key ? decryptData(profile.ai_api_key) : "";
    
    const authorDisplayName = profile?.name || `${profileAddress.slice(0, 6)}...`;
    const baseUrl = (process.env.NEXT_PUBLIC_SITE_URL || 'https://pager.lookhook.info').replace(/\/$/, '');

    let title = article.title;
    let content = article.content;
    let imageUrl = article.image_url;

    // 3. Adapt content if needed
    if (account.language || account.style) {
      console.log(`📡 [API Distribution] Adapting content for ${channelType}...`);
      const platform = channelType === 'binance' ? 'binance' : 'telegram';
      const adapted = await adaptContent(title, content, account.language || 'English', account.style || 'Professional', aiKey, platform);
      title = adapted.title;
      content = adapted.teaser;
      
      // For Telegram: if adaptation happened, we can use OG banner if original is missing
      // But we prefer the cinematic AI banner if it exists
      if (channelType === 'telegram' && !imageUrl) {
        imageUrl = `${baseUrl}/api/og?id=${articleId}&title=${encodeURIComponent(adapted.og_title)}`;
        console.log(`📡 [API Distribution] Localized OG URL: ${imageUrl}`);
      }
    }

    // 4. Publish
    let res: { success: boolean, error?: string } = { success: false };
    if (channelType === 'binance') {
      // Расшифровываем Binance API ключ
      const secureAccount = {
        ...account,
        apiKey: account.apiKey ? decryptData(account.apiKey) : ""
      };
      res = await postToBinance(secureAccount, title, content, articleId);
    } else if (channelType === 'telegram') {
      const targetChat = account.topicId ? `${account.chatId}/${account.topicId}` : account.chatId;
      console.log(`📡 [API Distribution] Posting to user Telegram: ${targetChat}`);
      res = await postToTelegram(targetChat, title, content, articleId, imageUrl, authorDisplayName);
    } else if (channelType === 'global') {
        const globalChannel = process.env.NEXT_PUBLIC_GLOBAL_TELEGRAM_CHANNEL;
        if (globalChannel) {
            console.log(`📡 [API Distribution] Posting to Global Feed: ${globalChannel}`);
            res = await postToTelegram(globalChannel, title, content, articleId, imageUrl, authorDisplayName);
        } else {
            console.warn("⚠️ [API Distribution] Global Telegram channel not configured in ENV");
            res = { success: false, error: "Global channel not configured" };
        }
    }

    if (!res.success) console.error(`❌ [API Distribution] Publication failed for ${channelType}:`, res.error);
    else console.log(`✅ [API Distribution] Publication success for ${channelType}`);

    return NextResponse.json(res);
  } catch (e: any) {
    console.error("❌ [API Distribution] Critical Error:", e.message);
    return NextResponse.json({ success: false, error: e.message }, { status: 500 });
  }
}
