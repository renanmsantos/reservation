import { createClient, type SupabaseClient } from "@supabase/supabase-js";

let browserClient: SupabaseClient | null = null;

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const createSupabaseClient = (key: string) => {
  if (!supabaseUrl || !key) {
    throw new Error("As variáveis de ambiente do Supabase não estão configuradas.");
  }

  return createClient(supabaseUrl, key, {
    auth: {
      persistSession: false,
    },
  });
};

export const getBrowserSupabaseClient = () => {
  if (!browserClient) {
    if (!supabaseAnonKey) {
      throw new Error("NEXT_PUBLIC_SUPABASE_ANON_KEY não está definida.");
    }
    browserClient = createSupabaseClient(supabaseAnonKey);
  }

  return browserClient;
};

export const createServiceRoleClient = () => {
  if (!serviceRoleKey) {
    throw new Error("SUPABASE_SERVICE_ROLE_KEY não está definida.");
  }

  return createSupabaseClient(serviceRoleKey);
};
