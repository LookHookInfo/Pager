import { NextResponse } from 'next/server';
import { getSupabaseServer } from '@/lib/supabase';
import { distributeArticle } from '@/lib/distribution';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { title, content, image_url, author_address } = body;

    if (!title || !content || !author_address) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

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

    // --- AUTO-POSTING (DISTRIBUTION) ---
    let distributionResults: any[] = [];
    try {
      const { data: profile } = await supabaseServer
        .from('profiles')
        .select('address, binance_accounts, telegram_channels, telegram_chat_id')
        .eq('address', author_address.toLowerCase())
        .single();

      if (profile) {
        console.log("📡 [API Create Article] Initiating distribution for:", profile.address);
        // Ждем завершения дистрибуции, чтобы вернуть результаты клиенту
        distributionResults = await distributeArticle(profile, title, content, image_url, data.id);
      }
    } catch (distError) {
      console.error("⚠️ [API Create Article] Distribution process error:", distError);
    }

    return NextResponse.json({ 
      success: true, 
      article: data,
      distribution: distributionResults 
    });
  } catch (e: any) {
    console.error("❌ [API Create Article] Critical Error:", e.message);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
