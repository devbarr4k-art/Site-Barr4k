import { createClient } from "@supabase/supabase-js";

// Cliente com a service role: ignora o RLS. Só pode ser usado no servidor
// (rotas /api), depois de conferir quem está fazendo a requisição.
export const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } }
);
