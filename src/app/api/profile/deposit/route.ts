import { NextResponse } from 'next/server';
import { getSupabaseServer } from '@/lib/supabase';
import { verifySignature, getAuthMessage } from '@/lib/auth';

/**
 * API для пополнения внутреннего баланса AI Credits за токены $HASH
 */
export async function POST(req: Request) {
  try {
    const { address, amount, txHash, signature, message } = await req.json();

    if (!address || !amount || !signature || !message) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const normalizedAddress = address.toLowerCase();

    // 1. ВЕРИФИКАЦИЯ ПОДПИСИ (Безопасность)
    const expectedMessage = getAuthMessage(`deposit ${amount} credits`, normalizedAddress);
    if (message !== expectedMessage) {
       return NextResponse.json({ error: 'Invalid auth message' }, { status: 401 });
    }

    const isAuthorized = await verifySignature(message, signature, normalizedAddress);
    if (!isAuthorized) {
      return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
    }

    // 2. TODO: Здесь можно добавить проверку txHash через провайдер (RPC), 
    // чтобы убедиться, что транзакция реально прошла в блокчейне на нужную сумму и адрес.
    // Пока доверяем клиенту после проверки подписи, но помечаем как "нужно проверить txHash".
    console.log(`💰 [Deposit] Request: ${amount} credits for ${normalizedAddress}. TX: ${txHash}`);

    const supabaseServer = getSupabaseServer();

    // 3. АТОМАРНОЕ ОБНОВЛЕНИЕ БАЛАНСА
    // Используем rpc функцию supabase или просто инкремент
    const { data, error } = await supabaseServer.rpc('increment_ai_credits', { 
      user_address: normalizedAddress, 
      inc_amount: parseInt(amount) 
    });

    // Если RPC не настроен, используем обычный подход (менее надежный, но рабочий для старта)
    if (error) {
      console.warn("⚠️ RPC increment_ai_credits failed, falling back to manual update");
      
      const { data: profile } = await supabaseServer
        .from('profiles')
        .select('ai_credits')
        .eq('address', normalizedAddress)
        .single();

      const newBalance = (profile?.ai_credits || 0) + parseInt(amount);

      const { error: updateError } = await supabaseServer
        .from('profiles')
        .update({ ai_credits: newBalance })
        .eq('address', normalizedAddress);

      if (updateError) throw updateError;
    }

    return NextResponse.json({ success: true, message: 'Balance updated' });
  } catch (e: any) {
    console.error("❌ [API Deposit] Error:", e.message);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
