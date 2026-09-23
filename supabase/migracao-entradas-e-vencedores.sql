-- Rodar uma vez no SQL Editor do Supabase (não apaga dados).

-- 1. Permite a mesma pessoa ter mais de uma entrada no mesmo sorteio.
--    (No sorteio diário a entrada repetida pelo chat continua bloqueada pelo site.)
alter table public.participants drop constraint if exists participants_giveaway_id_twitch_username_key;

-- 2. Imagem própria do vencedor para o Hall da Fama (editável no painel)
alter table public.winners add column if not exists image_url text;
