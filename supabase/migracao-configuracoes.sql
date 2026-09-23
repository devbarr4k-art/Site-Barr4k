-- Rodar uma vez no SQL Editor do Supabase (não apaga dados).

-- Configurações do site editadas pelo painel (ex.: mostrar ou esconder Vídeos/Shorts na home)
create table if not exists public.site_settings (
  key        text primary key,
  value      jsonb not null,
  updated_at timestamptz not null default now()
);

alter table public.site_settings enable row level security;

drop policy if exists "leitura publica de configuracoes" on public.site_settings;
create policy "leitura publica de configuracoes" on public.site_settings
  for select to anon, authenticated using (true);
