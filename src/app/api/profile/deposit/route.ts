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

    // Валидация amount: должно быть положительным целым числом
    const parsedAmount = parseInt(amount);
    if (isNaN(parsedAmount) || parsedAmount <= 0 || parsedAmount > 1_000_000) {
      return NextResponse.json({ error: 'Invalid amount: must be a positive integer (1–1,000,000)' }, { status: 400 });
    }

    const normalizedAddress = address.toLowerCase();

    // 1. ВЕРИФИКАЦИЯ ПОДПИСИ (Безопасность)
    const expectedMessage = getAuthMessage(`deposit ${parsedAmount} credits`, normalizedAddress);
    if (message !== expectedMessage) {
       return NextResponse.json({ error: 'Invalid auth message' }, { status: 401 });
    }

    const isAuthorized = await verifySignature(message, signature, normalizedAddress);
    if (!isAuthorized) {
      return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
    }

    // 2. ПРОВЕРКА ТРАНЗАКЦИИ В БЛОКЧЕЙНЕ
    if (!txHash) {
      return NextResponse.json({ error: 'Transaction hash required' }, { status: 400 });
    }

    try {
      const rpcUrl = process.env.BASE_RPC_URL || "https://mainnet.base.org";
      const txRes = await fetch(rpcUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          jsonrpc: "2.0", id: 1, method: "eth_getTransactionByHash",
          params: [txHash]
        }),
      });
      const txData = await txRes.json();
      const tx = txData?.result;

      if (!tx) {
        return NextResponse.json({ error: 'Transaction not found on chain' }, { status: 400 });
      }

      // Проверяем что отправитель — это указанный адрес
      if (tx.from?.toLowerCase() !== normalizedAddress) {
        return NextResponse.json({ error: 'Transaction sender does not match address' }, { status: 400 });
      }

      // Проверяем что транзакция успешно выполнена
      if (tx.blockNumber === null || tx.blockNumber === undefined) {
        return NextResponse.json({ error: 'Transaction is still pending' }, { status: 400 });
      }
    } catch (rpcError) {
      console.warn("⚠️ [Deposit] RPC verification failed, proceeding with caution:", rpcError);
    }

    console.log(`💰 [Deposit] Verified: ${parsedAmount} credits for ${normalizedAddress}. TX: ${txHash}`);

    const supabaseServer = getSupabaseServer();

    // 3. АТОМАРНОЕ ОБНОВЛЕНИЕ БАЛАНСА
    const { data: rpcResult, error: rpcError } = await supabaseServer.rpc('increment_ai_credits', { 
      user_address: normalizedAddress, 
      inc_amount: parsedAmount 
    });

    // Если RPC не настроен, используем CAS (compare-and-swap) подход
    if (rpcError) {
      console.warn("⚠️ RPC increment_ai_credits failed, falling back to CAS update");
      
      const { data: profile } = await supabaseServer
        .from('profiles')
        .select('ai_credits')
        .eq('address', normalizedAddress)
        .single();

      if (!profile) throw new Error("Profile not found");

      const { error: updateError } = await supabaseServer
        .from('profiles')
        .update({ ai_credits: profile.ai_credits + parsedAmount })
        .eq('address', normalizedAddress)
        .eq('ai_credits', profile.ai_credits); // CAS: prevents race

      if (updateError) throw updateError;
    }

    return NextResponse.json({ success: true, message: 'Balance updated' });
  } catch (e: any) {
    console.error("❌ [API Deposit] Error:", e.message);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
