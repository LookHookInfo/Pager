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
    const { 
      address, name, bio, website, 
      avatar_url, ai_image_model,
      ai_nft_token_id,
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

    const supabaseServer = getSupabaseServer();

    // 2. ОБРАБОТКА И ШИФРОВАНИЕ КЛЮЧЕЙ BINANCE
    const { data: currentProfile } = await supabaseServer
      .from('profiles')
      .select('binance_accounts')
      .eq('address', normalizedAddress)
      .maybeSingle();

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
        ai_image_model,
        ai_nft_token_id,
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
