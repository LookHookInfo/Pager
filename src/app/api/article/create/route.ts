import { NextResponse } from 'next/server';
import { getSupabaseServer } from '@/lib/supabase';
import { verifySession } from '@/lib/auth';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { title, content, image_url, source_url, author_address, signature, message } = body;

    if (!title || !content || !author_address) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    // ВЕРИФИКАЦИЯ ПОДПИСИ
    if (!signature || !message) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    const authError = await verifySession(author_address, signature, message, "publish article");
    if (authError) return authError;

    const supabaseServer = getSupabaseServer();

    // Генерируем ID вручную, так как база данных сама его не ставит автоматически
    const articleId = crypto.randomUUID();

    // Вставляем через серверный клиент (Service Role) для обхода RLS
    const { data, error } = await supabaseServer
      .from('articles')
      .insert([{
        id: articleId,
        title,
        content,
        image_url: image_url || null,
        source_url: source_url || null,
        author_address: author_address.toLowerCase(),
        likes: 0
      }])
      .select()
      .single();

    if (error) {
      console.error("❌ [API Create Article] Supabase Error:", error.message);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    console.log("✅ [API Create Article] Article created:", data.id);

    // Прогреваем OG-картинку прямо при публикации: холодный старт роута занимает
    // ~15 c (fetch + sharp + резка), а Twitter-бот сдаётся раньше и показывает
    // пустой баннер до повторного ретрая. Рендерим заранее и кладём ответ
    // в CDN-кэш (s-maxage), чтобы первый запрос бота был быстрым.
    try {
      const ogUrl = new URL(`/api/og?id=${articleId}`, req.url).toString();
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 25000);
      try {
        await fetch(ogUrl, { signal: controller.signal, cache: "no-store" });
      } finally {
        clearTimeout(timer);
      }
    } catch {
      // Не критично: боты в итоге сами сделают рендер, кэш соберётся с первого успешного ответа.
    }

    // Fetch user profile to return distribution targets to the client
    let distributionTargets: any = null;
    try {
      const { data: profile } = await supabaseServer
        .from('profiles')
        .select('address, binance_accounts, telegram_channels, telegram_chat_id')
        .eq('address', author_address.toLowerCase())
        .single();

      if (profile) {
        distributionTargets = {
          binance: profile.binance_accounts || [],
          telegram: profile.telegram_channels || [],
          global: !!process.env.NEXT_PUBLIC_GLOBAL_TELEGRAM_CHANNEL
        };

        // Legacy support: if channels is empty but legacy ID exists, add it as a target
        if (distributionTargets.telegram.length === 0 && profile.telegram_chat_id) {
          distributionTargets.telegram.push({
            label: "Telegram (Legacy)",
            chatId: profile.telegram_chat_id
          });
        }
      }
    } catch (e: any) {
      console.warn("⚠️ [API Create Article] Profile fetch failed for distribution:", e.message);
    }

    return NextResponse.json({ 
      success: true, 
      article: data,
      distributionTargets
    });
  } catch (e: any) {
    console.error("❌ [API Create Article] Critical Error:", e.message);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
