-- Rodar uma vez no SQL Editor do Supabase (não apaga dados).

-- Vídeos e Shorts do YouTube da seção "Vídeos Recentes" da home (painel > Vídeos)
create table if not exists public.videos (
  id            uuid primary key default gen_random_uuid(),
  kind          text not null default 'video' check (kind in ('video', 'short')),
  youtube_id    text not null,
  title         text not null,
  thumbnail_url text not null,
  duration      text,                          -- ex: 4:41:51 (só vídeos)
  views         text,                          -- ex: 7K
  published_at  date not null default current_date,
  created_at    timestamptz not null default now()
);

create index if not exists videos_recent on public.videos (kind, published_at desc, created_at desc);
alter table public.videos enable row level security;

drop policy if exists "leitura publica de videos" on public.videos;
create policy "leitura publica de videos" on public.videos
  for select to anon, authenticated using (true);

-- Ordem escolhida no painel (arrastando os cards); vazio = ordem por visualizações
alter table public.videos add column if not exists sort_order integer;
