import { NextResponse } from 'next/server';
import { getSupabaseServer } from '@/lib/supabase';
import { verifySignature, getAuthMessage } from '@/lib/auth';
import { encryptData, maskKey, isEncrypted } from '@/lib/security';

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const address = searchParams.get('address');

    if (!address) {
      return NextResponse.json({ error: 'Address is required' }, { status: 400 });
    }

    const supabaseServer = getSupabaseServer();
    const { data, error } = await supabaseServer
      .from('profiles')
      .select('*')
      .eq('address', address.toLowerCase())
      .maybeSingle();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    if (!data) {
      return NextResponse.json({ profile: null });
    }

    // МАСКИРОВАНИЕ КЛЮЧЕЙ
    const safeProfile = {
      ...data,
      ai_credits: data.ai_credits || 0,
      ai_api_key: data.ai_api_key ? maskKey(data.ai_api_key) : "",
      binance_accounts: (data.binance_accounts || []).map((acc: any) => ({
        ...acc,
        apiKey: acc.apiKey ? maskKey(acc.apiKey) : ""
      }))
    };

    const response = NextResponse.json({ profile: safeProfile });
    response.headers.set('Cache-Control', 'no-store, max-age=0');
    return response;
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { 
      address, name, bio, website, 
      avatar_url, ai_api_key, ai_image_model, ai_atmosphere,
      ai_nft_token_id,
      binance_accounts, telegram_channels, telegram_chat_id,
      cta_telegram, cta_forum, ref_links,
      signature, message
    } = body;

    if (!address) {
      return NextResponse.json({ error: 'Address is required' }, { status: 400 });
    }

    const normalizedAddress = address.toLowerCase();

    // 1. ВЕРИФИКАЦИЯ ПОДПИСИ
    if (!signature || !message) {
      return NextResponse.json({ error: 'Authentication required (signature missing)' }, { status: 401 });
    }

    const expectedMessage = getAuthMessage("update Pager profile", normalizedAddress);
    // Проверяем, что сообщение соответствует ожидаемому (защита от подмены действий)
    if (message !== expectedMessage) {
       return NextResponse.json({ error: 'Invalid auth message' }, { status: 401 });
    }

    const isAuthorized = await verifySignature(message, signature, normalizedAddress);
    if (!isAuthorized) {
      return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
    }

    console.log("🛠 [API Profile] Upserting profile for:", normalizedAddress);
    
    const supabaseServer = getSupabaseServer();

    // 2. ОБРАБОТКА И ШИФРОВАНИЕ КЛЮЧЕЙ
    // Получаем текущий профиль, чтобы не перезаписать зашифрованные ключи масками
    const { data: currentProfile } = await supabaseServer
      .from('profiles')
      .select('ai_api_key, binance_accounts')
      .eq('address', normalizedAddress)
      .maybeSingle();

    let finalAiKey = ai_api_key;
    // Если пришла маска или пусто, и у нас есть старый ключ - сохраняем старый
    if ((!ai_api_key || ai_api_key.includes('...')) && currentProfile?.ai_api_key) {
      finalAiKey = currentProfile.ai_api_key;
    } else if (ai_api_key && !ai_api_key.includes('...') && !isEncrypted(ai_api_key)) {
      // Если пришел новый чистый ключ - шифруем его
      finalAiKey = encryptData(ai_api_key);
    }

    // Обработка ключей Binance
    const finalBinanceAccounts = (binance_accounts || []).map((acc: any, idx: number) => {
      const currentAcc = currentProfile?.binance_accounts?.[idx];
      let finalKey = acc.apiKey;
      
      if ((!acc.apiKey || acc.apiKey.includes('...')) && currentAcc?.apiKey) {
        finalKey = currentAcc.apiKey;
      } else if (acc.apiKey && !acc.apiKey.includes('...') && !isEncrypted(acc.apiKey)) {
        finalKey = encryptData(acc.apiKey);
      }
      
      return { ...acc, apiKey: finalKey };
    });

    const { data, error } = await supabaseServer
      .from('profiles')
      .upsert({ 
        address: normalizedAddress,
        name, 
        bio, 
        website,
        avatar_url,
        ai_api_key: finalAiKey,
        ai_image_model,
        ai_atmosphere,
        ai_nft_token_id,
        binance_accounts: finalBinanceAccounts,
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

    // 3. МАСКИРОВАНИЕ КЛЮЧЕЙ ПЕРЕД ОТВЕТОМ
    const safeProfile = {
      ...data,
      ai_api_key: data.ai_api_key ? maskKey(data.ai_api_key) : "",
      binance_accounts: (data.binance_accounts || []).map((acc: any) => ({
        ...acc,
        apiKey: acc.apiKey ? maskKey(acc.apiKey) : ""
      }))
    };

    const response = NextResponse.json({ success: true, profile: safeProfile });
    response.headers.set('Cache-Control', 'no-store, max-age=0');
    return response;
  } catch (e: any) {
    console.error("❌ [API Profile] Critical Error:", e.message);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
