-- Loja de skins do streamer. Rodar uma vez no SQL Editor do Supabase (não apaga nada).

create table if not exists public.skins (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,                 -- ex: Bayonet | Forest DDPAT
  wear        text,                          -- desgaste: Factory New, Field-Tested...
  tag         text,                          -- etiqueta do card, ex: CSGO-SKINS
  float_value text,                          -- ex: 0.0712
  price       text,                          -- ex: 1.364,35
  image_url   text,
  buy_url     text,                          -- link para comprar (WhatsApp, Steam, Instagram...)
  status      text not null default 'available' check (status in ('available', 'sold')),
  created_at  timestamptz not null default now()
);

create index if not exists skins_status_created on public.skins (status, created_at desc);

-- Público só lê; o painel grava pelo servidor (service role)
alter table public.skins enable row level security;
drop policy if exists "leitura publica de skins" on public.skins;
create policy "leitura publica de skins" on public.skins
  for select to anon, authenticated using (true);
