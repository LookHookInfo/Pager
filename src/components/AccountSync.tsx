"use client";

import { useActiveAccount } from "thirdweb/react";
import { useEffect, useRef } from "react";
import { supabase } from "@/lib/supabase";

export default function AccountSync() {
  const account = useActiveAccount();
  const lastSyncedAddress = useRef<string | null>(null);

  useEffect(() => {
    if (account?.address && account.address.toLowerCase() !== lastSyncedAddress.current) {
      console.log("🛠 [AccountSync] New address detected:", account.address);
      syncAccount(account.address);
      lastSyncedAddress.current = account.address.toLowerCase();
    }
  }, [account?.address]);

  async function syncAccount(address: string) {
    try {
      console.log("🛠 [AccountSync] Checking profile in database...");
      const normalizedAddress = address.toLowerCase();
      
      const { data, error } = await supabase
        .from('profiles')
        .select('address, name')
        .eq('address', normalizedAddress)
        .maybeSingle();

      if (error) {
        console.error("❌ [AccountSync] Supabase fetch error:", error.message);
        return;
      }

      // Если профиля нет — создаем его
      if (!data) {
        console.log("🛠 [AccountSync] Profile not found. Creating a new one...");
        const { error: insertError } = await supabase.from('profiles').insert([
          { 
            address: normalizedAddress, 
            name: `User ${address.slice(2, 6)}`,
            bio: "Web3 Explorer" 
          }
        ]);
        
        if (insertError) {
          console.error("❌ [AccountSync] Failed to create profile:", insertError.message);
        } else {
          console.log("✅ [AccountSync] Profile created successfully!");
        }
      } else {
        console.log("✅ [AccountSync] Profile already exists:", data.name);
        // Здесь мы НИЧЕГО не обновляем, чтобы не затереть ручные правки юзера
      }
    } catch (e) {
      console.error("❌ [AccountSync] Unexpected error during sync:", e);
    }
  }

  return null;
}
