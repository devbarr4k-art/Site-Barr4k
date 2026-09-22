-- =====================================================================
-- BARR4K — esquema completo do banco (recria tudo do zero)
-- Rodar no Supabase: Dashboard > SQL Editor > New query > colar > Run
--
-- ATENÇÃO: o passo 0 APAGA as tabelas e todos os dados atuais
-- (sorteios, participantes, vencedores). Depois é só recriar os
-- sorteios pelo painel admin.
-- =====================================================================


-- 0. Limpa o que existe hoje ------------------------------------------
drop table if exists public.winners cascade;
drop table if exists public.participants cascade;
drop table if exists public.giveaways cascade;


-- 1. Sorteios ---------------------------------------------------------
create table public.giveaways (
  id                 uuid primary key default gen_random_uuid(),
  title              text not null,               -- use "|" para quebrar em duas linhas: BAIONETA | FOREST DDPAT
  description        text,
  highlight_text     text,                        -- balão no card da home (ex: CSGOBIG)
  highlight_color    text,
  subtitle           text,                        -- segundo balão / linha fina (ex: FACTORY-NEW)
  prize_label        text,                        -- texto de ENTRADA no card (ex: Gratuito)
  prize_value        text,                        -- valor exibido (ex: 1.364,35)
  shipping_text      text,                        -- ex: 100% grátis · Enviado direto via Steam Trade
  login_text         text,                        -- texto abaixo do botão QUERO PARTICIPAR
  coins_cost         integer not null default 0 check (coins_cost >= 0),
  image_url          text,                        -- imagem da capa (base64 webp)
  detail_image_url   text,                        -- imagem da página do sorteio (base64 webp)
  draw_date          timestamptz,                 -- encerramento / cronômetro
  type               text not null default 'monthly' check (type in ('monthly', 'featured', 'daily')),
  status             text not null default 'active' check (status in ('active', 'completed')),
  is_daily_highlight boolean not null default false, -- sorteio que o bot da live está captando
  response_seconds   integer not null default 60 check (response_seconds > 0), -- tempo p/ o vencedor do diário responder
  created_at         timestamptz not null default now()
);

-- Só um sorteio em destaque (popup da home) e só um diário ativo por vez
create unique index giveaways_one_featured on public.giveaways (type) where type = 'featured';
create unique index giveaways_one_daily    on public.giveaways (is_daily_highlight) where is_daily_highlight;
create index giveaways_status_created on public.giveaways (status, created_at desc);


-- 2. Participantes ----------------------------------------------------
create table public.participants (
  id              uuid primary key default gen_random_uuid(),
  giveaway_id     uuid not null references public.giveaways (id) on delete cascade,
  twitch_username text not null check (twitch_username = lower(twitch_username)), -- login da Twitch
  coins_used      integer not null default 0 check (coins_used >= 0), -- no diário = número de chances
  casa_id         text,                           -- ID do usuário na casa parceira
  proof_url       text,                           -- comprovante (base64)
  status          text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  created_at      timestamptz not null default now(),
  unique (giveaway_id, twitch_username)           -- uma participação por usuário
);

create index participants_username on public.participants (twitch_username, created_at desc);


-- 3. Vencedores -------------------------------------------------------
create table public.winners (
  id              uuid primary key default gen_random_uuid(),
  giveaway_id     uuid references public.giveaways (id) on delete set null, -- mantém o histórico se o sorteio for apagado
  twitch_username text not null check (twitch_username = lower(twitch_username)),
  prize           text not null,
  in_hall_of_fame boolean not null default false,
  won_at          timestamptz not null default now()
);

create index winners_giveaway on public.winners (giveaway_id);
create index winners_won_at   on public.winners (won_at desc);


-- 4. Segurança (RLS) --------------------------------------------------
-- O site grava tudo pelas rotas /api com a service role (que ignora o RLS).
-- A chave pública só pode LER sorteios e vencedores; participantes ficam fechados.
alter table public.giveaways    enable row level security;
alter table public.participants enable row level security;
alter table public.winners      enable row level security;

create policy "leitura publica de sorteios" on public.giveaways
  for select to anon, authenticated using (true);

create policy "leitura publica de vencedores" on public.winners
  for select to anon, authenticated using (true);
