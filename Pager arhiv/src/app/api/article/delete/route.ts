import { NextResponse } from 'next/server';
import { getSupabaseServer } from '@/lib/supabase';

export async function POST(req: Request) {
  try {
    const { articleId, authorAddress } = await req.json();

    if (!articleId || !authorAddress) {
      return NextResponse.json({ error: 'Missing articleId or authorAddress' }, { status: 400 });
    }

    const supabaseServer = getSupabaseServer();

    // Удаляем статью, только если автор совпадает (защита на стороне сервера)
    const { error } = await supabaseServer
      .from('articles')
      .delete()
      .eq('id', articleId)
      .eq('author_address', authorAddress.toLowerCase());

    if (error) {
      console.error("❌ [API Delete] Error:", error.message);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
