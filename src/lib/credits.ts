import { getSupabaseServer } from "@/lib/supabase";

export async function atomicDebitCredits(
  address: string,
  amount: number,
): Promise<boolean> {
  const supabase = getSupabaseServer();
  // Try RPC first (PostgreSQL function — atomic, needs SQL migration)
  const { data: rpcResult, error: rpcErr } = await supabase
    .rpc("decrement_ai_credits", { user_address: address, dec_amount: amount });

  if (!rpcErr && rpcResult !== null && rpcResult !== undefined) {
    return true;
  }

  // RPC not available — use read-CAS-write (service_role bypasses RLS)
  const { data, error: readErr } = await supabase
    .from("profiles")
    .select("ai_credits")
    .eq("address", address)
    .single();

  if (readErr || !data) return false;
  if (data.ai_credits < amount) return false;

  const newBalance = data.ai_credits - amount;
  const { error: updateErr } = await supabase
    .from("profiles")
    .update({ ai_credits: newBalance })
    .eq("address", address)
    .eq("ai_credits", data.ai_credits);

  return !updateErr;
}

export async function atomicRefundCredits(
  address: string,
  amount: number,
): Promise<void> {
  const supabase = getSupabaseServer();
  const { error } = await supabase
    .rpc("increment_ai_credits", { user_address: address, inc_amount: amount });

  if (!error) return;

  const { data } = await supabase
    .from("profiles")
    .select("ai_credits")
    .eq("address", address)
    .single();

  if (!data) return;
  await supabase
    .from("profiles")
    .update({ ai_credits: data.ai_credits + amount })
    .eq("address", address)
    .eq("ai_credits", data.ai_credits);
}
