import { NextResponse } from 'next/server';
import { getSupabaseServer } from '@/lib/supabase';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { address, name, bio, website, thirdweb_client_id, avatar_url } = body;

    if (!address) {
      return NextResponse.json({ error: 'Address is required' }, { status: 400 });
    }

    const normalizedAddress = address.toLowerCase();
    console.log("🛠 [API Profile] Upserting profile for:", normalizedAddress);
    
    // Используем серверный клиент с SERVICE_ROLE_KEY
    const supabaseServer = getSupabaseServer();

    // Выполняем UPSERT
    const { data, error } = await supabaseServer
      .from('profiles')
      .upsert({ 
        address: normalizedAddress,
        name, 
        bio, 
        website,
        thirdweb_client_id,
        avatar_url
      }, { onConflict: 'address' })
      .select()
      .single();

    if (error) {
      console.error("❌ [API Profile] Supabase Error:", error.message);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    console.log("✅ [API Profile] Profile synced successfully:", normalizedAddress);
    
    const response = NextResponse.json({ success: true, profile: data });
    
    // Заголовки против кэша
    response.headers.set('Cache-Control', 'no-store, max-age=0');
    
    return response;
  } catch (e: any) {
    console.error("❌ [API Profile] Critical Error:", e.message);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
