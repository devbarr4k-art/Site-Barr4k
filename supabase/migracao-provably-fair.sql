-- Rodar uma vez no SQL Editor do Supabase (não apaga dados).
-- Provably fair: cada giro de roleta (sorteio mensal, diário e rifa) fica registrado aqui.
--
-- Como o ganhador é escolhido (dá para qualquer pessoa refazer a conta na página /provably-fair):
--   1. A lista de participantes é congelada e gravada (com o hash SHA-256 dela) ANTES do número público existir.
--   2. O número público é uma rodada futura do drand (beacon aberto mantido por Cloudflare, Protocol Labs,
--      universidades etc.; ninguém, nem o site, sabe o valor antes de ele sair).
--   3. SHA-256(hash_da_lista:número_público) vira um bilhete entre 0 e o total de chances; o dono do bilhete ganha.
create table if not exists public.fair_draws (
  id               uuid primary key default gen_random_uuid(),
  kind             text not null check (kind in ('mensal', 'diario', 'rifa')),
  target_id        uuid not null,                       -- sorteio (giveaways) ou rifa (raffles)
  title            text not null,
  entries          jsonb not null,                      -- [{ "label": "fulano", "weight": 3 }, ...] na ordem usada
  total_weight     integer not null check (total_weight > 0),
  entries_hash     text not null,                       -- SHA-256 da lista (formato em src/lib/fair.ts)
  drand_round      bigint not null,                     -- rodada do drand escolhida na hora do congelamento
  drand_randomness text,                                -- preenchidos quando a rodada sai (segundos depois)
  drand_signature  text,
  ticket           text,                                -- bilhete sorteado (0 .. total_weight - 1)
  winner_label     text,                                -- item sorteado da lista (nome, ou número da rifa)
  winner_username  text,                                -- quem ganhou (na rifa, o dono do número)
  status           text not null default 'waiting' check (status in ('waiting', 'drawn', 'confirmed', 'skipped')),
  created_at       timestamptz not null default now(),
  drawn_at         timestamptz
);
create index if not exists fair_draws_target on public.fair_draws (target_id, created_at);
create index if not exists fair_draws_recent on public.fair_draws (created_at desc);

-- Leitura só pelas rotas /api do site (service role)
alter table public.fair_draws enable row level security;
