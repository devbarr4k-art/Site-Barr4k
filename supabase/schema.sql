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
  featured_image_url text,                        -- imagem do popup de destaque (base64 webp)
  detail_image_url   text,                        -- imagem da página do sorteio (base64 webp)
  draw_date          timestamptz,                 -- encerramento / cronômetro
  type               text not null default 'monthly' check (type in ('monthly', 'featured', 'daily')),
  status             text not null default 'active' check (status in ('active', 'completed')),
  is_daily_highlight boolean not null default false, -- sorteio que o bot da live está captando
  response_seconds   integer not null default 30 check (response_seconds > 0), -- tempo p/ o vencedor do diário responder
  capture_open       boolean not null default false, -- captação do chat aberta (diário)
  bot_command        text,                           -- ex: !sorteio
  twitch_channel     text,                           -- canal que o bot lê
  chance_t1          integer not null default 4 check (chance_t1 >= 1), -- chances de sub tier 1
  chance_t2          integer not null default 6 check (chance_t2 >= 1),
  chance_t3          integer not null default 10 check (chance_t3 >= 1),
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
  sub_tier        smallint not null default 0 check (sub_tier between 0 and 3), -- 0 = não é sub
  avatar_url      text,                           -- foto da Twitch (entradas do chat)
  proof_url       text,                           -- comprovante (base64)
  status          text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  created_at      timestamptz not null default now()
  -- sem unique: no sorteio mensal a mesma pessoa pode ter várias entradas;
  -- no diário o site impede a entrada repetida pelo chat
);

create index participants_giveaway on public.participants (giveaway_id, twitch_username);

create index participants_username on public.participants (twitch_username, created_at desc);


-- 3. Vencedores -------------------------------------------------------
create table public.winners (
  id              uuid primary key default gen_random_uuid(),
  giveaway_id     uuid references public.giveaways (id) on delete set null, -- mantém o histórico se o sorteio for apagado
  twitch_username text not null check (twitch_username = lower(twitch_username)),
  prize           text not null,
  avatar_url      text,                           -- foto da Twitch do ganhador
  image_url       text,                           -- imagem do prêmio no Hall da Fama (editável)
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


-- 5. Storage: imagens dos prêmios em qualidade original -------------
-- Bucket público "giveaways"; o painel envia por link assinado gerado no servidor.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('giveaways', 'giveaways', true, 20971520,
        array['image/png', 'image/jpeg', 'image/webp', 'image/gif', 'image/avif'])
on conflict (id) do nothing;
