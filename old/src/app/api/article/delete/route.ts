import { NextResponse } from 'next/server';
import { getSupabaseServer } from '@/lib/supabase';
import { verifySignature, getAuthMessage } from '@/lib/auth';

export async function POST(req: Request) {
  try {
    const { articleId, authorAddress, signature, message } = await req.json();

    if (!articleId || !authorAddress) {
      return NextResponse.json({ error: 'Missing articleId or authorAddress' }, { status: 400 });
    }

    const normalizedAddress = authorAddress.toLowerCase();

    // 1. ВЕРИФИКАЦИЯ ПОДПИСИ
    if (!signature || !message) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    const expectedMessage = getAuthMessage("delete article", normalizedAddress);
    if (message !== expectedMessage) {
      return NextResponse.json({ error: 'Invalid auth message' }, { status: 401 });
    }

    const isAuthorized = await verifySignature(message, signature, normalizedAddress);
    if (!isAuthorized) {
      return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
    }

    const supabaseServer = getSupabaseServer();

    // Удаляем статью, только если автор совпадает
    const { error } = await supabaseServer
      .from('articles')
      .delete()
      .eq('id', articleId)
      .eq('author_address', normalizedAddress);

    if (error) {
      console.error("❌ [API Delete] Error:", error.message);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
