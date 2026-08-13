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

    const maskChatId = (id: string) => {
      if (!id) return id;
      if (id.startsWith('-100')) return '-100' + '•'.repeat(Math.max(0, id.length - 7)) + id.slice(-3);
      if (id.startsWith('-')) return '-' + '•'.repeat(Math.max(0, id.length - 4)) + id.slice(-3);
      return id;
    };

    const safeProfile = {
      ...data,
      ai_credits: data.ai_credits || 0,
      ai_api_key: data.ai_api_key ? maskKey(data.ai_api_key) : "",
      binance_accounts: (data.binance_accounts || []).map((acc: any) => ({
        ...acc,
        apiKey: acc.apiKey ? maskKey(acc.apiKey) : ""
      })),
      telegram_channels: (data.telegram_channels || []).map((ch: any) => ({
        ...ch,
        chatId: ch.chatId?.startsWith('-') ? maskChatId(ch.chatId) : ch.chatId
      })),
      cta_links: (data.cta_links || []).map((link: any) => ({
        ...link,
        url: link.url?.includes('t.me/') && link.url.match(/\/-?\d+/) ? link.url.replace(/\/-?\d+/, '/' + maskChatId(link.url.match(/\/-?\d+/)![0].slice(1))) : link.url
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
    const { address, name, bio, website,
      avatar_url, ai_image_model,
      ai_api_key,
      ai_nft_token_id,
      gemfun_token,
      binance_accounts, telegram_channels, telegram_chat_id,
      cta_links, ref_links, cmc_username,
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
    if (message !== expectedMessage) {
       return NextResponse.json({ error: 'Invalid auth message' }, { status: 401 });
    }

    const isAuthorized = await verifySignature(message, signature, normalizedAddress);
    if (!isAuthorized) {
      return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
    }

    // 1.5 НОРМАЛИЗАЦИЯ GEMFUN-ТОКЕНА (адрес мем-токена с лаунчпада)
    const isToken = (v: any) => !!v && /^0x[a-fA-F0-9]{40}$/.test(String(v).trim());
    const finalGemfunToken = isToken(gemfun_token) ? String(gemfun_token).trim().toLowerCase() : null;

    const supabaseServer = getSupabaseServer();

    // 2. ОБРАБОТКА И ШИФРОВАНИЕ КЛЮЧЕЙ BINANCE И AI
    const { data: currentProfile } = await supabaseServer
      .from('profiles')
      .select('binance_accounts, ai_api_key')
      .eq('address', normalizedAddress)
      .maybeSingle();

    const finalBinanceAccounts = (binance_accounts || []).map((acc: any, idx: number) => {
      const currentAcc = currentProfile?.binance_accounts?.[idx];
      // Маска (••• или xxx...yyy) означает «ключ не менялся» — берём текущий.
      const isMaskedKey = (v: string) => !!v && (v.includes('•') || v.includes('...'));
      let finalKey = acc.apiKey;

      if (isMaskedKey(acc.apiKey)) {
        finalKey = currentAcc?.apiKey || "";
      } else if (acc.apiKey && !isEncrypted(acc.apiKey)) {
        finalKey = encryptData(acc.apiKey);
      }

      return { ...acc, apiKey: finalKey };
    });

    // AI API key: keep existing if masked/empty, otherwise encrypt the new value
    const isMaskedKey = (v: string) => !!v && (v.includes('...') || v.includes('•'));
    let finalAiApiKey: string | null | undefined;
    if (!ai_api_key || isMaskedKey(ai_api_key) || ai_api_key === currentProfile?.ai_api_key) {
      finalAiApiKey = currentProfile?.ai_api_key || null;
    } else if (isEncrypted(ai_api_key)) {
      finalAiApiKey = ai_api_key;
    } else {
      try {
        finalAiApiKey = encryptData(ai_api_key);
      } catch (e: any) {
        console.warn("⚠️ [Profile] Failed to encrypt AI key, storing raw:", e.message);
        finalAiApiKey = ai_api_key;
      }
    }

    const { data, error } = await supabaseServer
      .from('profiles')
      .upsert({ 
        address: normalizedAddress,
        name, 
        bio, 
        website,
        avatar_url,
        ai_image_model,
        ai_api_key: finalAiApiKey,
        ai_nft_token_id,
        gemfun_token: finalGemfunToken,
        binance_accounts: finalBinanceAccounts,
        telegram_channels,
        telegram_chat_id,
        cta_links,
        ref_links,
        cmc_username
      }, { onConflict: 'address' })
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message || "Database error" }, { status: 500 });
    }

    const maskChatId = (id: string) => {
      if (!id) return id;
      if (id.startsWith('-100')) return '-100' + '•'.repeat(Math.max(0, id.length - 7)) + id.slice(-3);
      if (id.startsWith('-')) return '-' + '•'.repeat(Math.max(0, id.length - 4)) + id.slice(-3);
      return id;
    };

    const safeProfile = {
      ...data,
      ai_api_key: data.ai_api_key ? maskKey(data.ai_api_key) : "",
      binance_accounts: (data.binance_accounts || []).map((acc: any) => ({
        ...acc,
        apiKey: acc.apiKey ? maskKey(acc.apiKey) : ""
      })),
      telegram_channels: (data.telegram_channels || []).map((ch: any) => ({
        ...ch,
        chatId: ch.chatId?.startsWith('-') ? maskChatId(ch.chatId) : ch.chatId
      })),
      cta_links: (data.cta_links || []).map((link: any) => ({
        ...link,
        url: link.url?.includes('t.me/') && link.url.match(/\/-?\d+/) ? link.url.replace(/\/-?\d+/, '/' + maskChatId(link.url.match(/\/-?\d+/)![0].slice(1))) : link.url
      }))
    };

    const response = NextResponse.json({ success: true, profile: safeProfile });
    response.headers.set('Cache-Control', 'no-store, max-age=0');
    return response;
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
