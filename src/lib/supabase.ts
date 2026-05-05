import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

// Клиент для браузера (использует анонимный ключ)
export const supabase = createClient(supabaseUrl, supabaseAnonKey);

// Клиент для сервера (использует service_role если есть, иначе анонимный)
export const getSupabaseServer = () => {
  if (!supabaseServiceKey) {
    console.warn("⚠️ [Supabase] Service Role Key is missing, using Anon Key for server operations.");
  }
  return createClient(supabaseUrl, supabaseServiceKey || supabaseAnonKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    }
  });
};
