import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://tnvlllanpuxvfudtqvwg.supabase.co';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRudmxsbGFucHV4dmZ1ZHRxdndnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTAwMTkzMzQsImV4cCI6MjEwNTU5NTMzNH0.xHA0-6zOZCeog-NCu-iqdVHLmVWOAoQVfhGRfhnlnRQ';

const TIMEOUT_MS = 8000;

// Se a conexão com o banco travar, desiste em 8s e tenta mais uma vez,
// em vez de deixar a página presa no "carregando" por até um minuto.
async function fetchWithTimeout(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  const attempt = () => {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
    init?.signal?.addEventListener('abort', () => controller.abort());
    return fetch(input, { ...init, signal: controller.signal }).finally(() => clearTimeout(timer));
  };
  try {
    return await attempt();
  } catch (err) {
    if (init?.signal?.aborted) throw err;
    return attempt();
  }
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  global: { fetch: fetchWithTimeout },
});
