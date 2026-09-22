-- Colunas do sorteio diário ao vivo. Rodar uma vez no SQL Editor do Supabase
-- (não apaga nada). O schema.sql já vem com elas para quem recriar do zero.

alter table public.giveaways
  add column if not exists capture_open boolean not null default false, -- captação do chat aberta
  add column if not exists bot_command  text,                           -- ex: !sorteio
  add column if not exists twitch_channel text,                         -- canal que o bot lê
  add column if not exists chance_t1 integer not null default 2 check (chance_t1 >= 1),
  add column if not exists chance_t2 integer not null default 3 check (chance_t2 >= 1),
  add column if not exists chance_t3 integer not null default 5 check (chance_t3 >= 1);

alter table public.participants
  add column if not exists sub_tier smallint not null default 0 check (sub_tier between 0 and 3), -- 0 = não é sub
  add column if not exists avatar_url text;                                                      -- foto da Twitch

alter table public.winners
  add column if not exists avatar_url text; -- foto da Twitch do ganhador
