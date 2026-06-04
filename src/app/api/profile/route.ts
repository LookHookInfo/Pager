import { NextResponse } from 'next/server';
import { getSupabaseServer } from '@/lib/supabase';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { 
      address, name, bio, website, 
      avatar_url, ai_api_key, ai_image_model, ai_atmosphere,
      ai_nft_token_id,
      binance_accounts, telegram_channels, telegram_chat_id,
      cta_telegram, cta_forum, ref_links
    } = body;

    if (!address) {
      return NextResponse.json({ error: 'Address is required' }, { status: 400 });
    }

    const normalizedAddress = address.toLowerCase();
    console.log("🛠 [API Profile] Upserting profile for:", normalizedAddress);
    
    const supabaseServer = getSupabaseServer();

    const { data, error } = await supabaseServer
      .from('profiles')
      .upsert({ 
        address: normalizedAddress,
        name, 
        bio, 
        website,
        avatar_url,
        ai_api_key,
        ai_image_model,
        ai_atmosphere,
        ai_nft_token_id,
        binance_accounts,
        telegram_channels,
        telegram_chat_id,
        cta_telegram,
        cta_forum,
        ref_links
      }, { onConflict: 'address' })
      .select()
      .single();

    if (error) {
      console.error("❌ [API Profile] Supabase Error:", JSON.stringify(error));
      return NextResponse.json({ error: error.message || "Database error" }, { status: 500 });
    }

    const response = NextResponse.json({ success: true, profile: data });
    response.headers.set('Cache-Control', 'no-store, max-age=0');
    return response;
  } catch (e: any) {
    console.error("❌ [API Profile] Critical Error:", e.message);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
