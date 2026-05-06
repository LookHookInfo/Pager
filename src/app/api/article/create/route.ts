import { NextResponse } from 'next/server';
import { getSupabaseServer } from '@/lib/supabase';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { title, content, image_url, author_address, lang } = body;

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
    return NextResponse.json({ success: true, article: data });
  } catch (e: any) {
    console.error("❌ [API Create Article] Critical Error:", e.message);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
