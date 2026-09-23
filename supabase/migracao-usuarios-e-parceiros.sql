-- Rodar uma vez no SQL Editor do Supabase (não apaga dados).

-- 1. Cadastro de quem entra no site com a Twitch (painel > Usuários)
--    Dados pessoais: sem leitura pública, só o servidor (service role) acessa.
create table if not exists public.site_users (
  twitch_username text primary key check (twitch_username = lower(twitch_username)),
  whatsapp        text not null,
  email           text not null,
  avatar_url      text,
  created_at      timestamptz not null default now(),
  last_seen_at    timestamptz not null default now(), -- último acesso logado
  visits          integer not null default 1          -- quantas vezes entrou (uma por sessão)
);

create index if not exists site_users_created on public.site_users (created_at desc);
alter table public.site_users enable row level security;


-- 2. Parceiros (cards da seção "Nossos Parceiros", editáveis no painel)
create table if not exists public.partners (
  id         uuid primary key default gen_random_uuid(),
  name       text not null,
  image_url  text not null,
  link_url   text not null,
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists partners_order on public.partners (sort_order, created_at);
alter table public.partners enable row level security;

drop policy if exists "leitura publica de parceiros" on public.partners;
create policy "leitura publica de parceiros" on public.partners
  for select to anon, authenticated using (true);

-- Começa com os três parceiros que já estão no site
insert into public.partners (name, image_url, link_url, sort_order)
select * from (values
  ('CSGOROLL',     '/parceiro1.png', 'https://www.csgoroll.com/r/BARRAK', 1),
  ('CSGOBIG',      '/parceiro2.png', 'https://csgobig.com/#!/r/barr4k',  2),
  ('Fallen Store', '/parceiro3.png', 'https://www.fallenstore.com.br/',  3)
) as v(name, image_url, link_url, sort_order)
where not exists (select 1 from public.partners);
