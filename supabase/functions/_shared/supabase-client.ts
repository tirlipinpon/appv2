// Client Supabase pour les Edge Functions
import { createClient } from "jsr:@supabase/supabase-js@2";

const supabaseUrl = Deno.env.get("PROJECT_URL") || "";
const supabaseServiceRoleKey = Deno.env.get("SERVICE_ROLE_KEY") || "";

if (!supabaseUrl || !supabaseServiceRoleKey) {
  throw new Error("PROJECT_URL and SERVICE_ROLE_KEY must be set");
}

export const supabase = createClient(supabaseUrl, supabaseServiceRoleKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

