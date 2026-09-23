-- Rodar uma vez no SQL Editor do Supabase (não apaga dados).

-- 1. Permite a mesma pessoa ter mais de uma entrada no mesmo sorteio.
--    (No sorteio diário a entrada repetida pelo chat continua bloqueada pelo site.)
alter table public.participants drop constraint if exists participants_giveaway_id_twitch_username_key;

-- O unique também servia de índice: recria para as buscas por sorteio continuarem rápidas
create index if not exists participants_giveaway on public.participants (giveaway_id, twitch_username);

-- 2. Imagem própria do vencedor para o Hall da Fama (editável no painel)
alter table public.winners add column if not exists image_url text;

-- 3. Índice do Hall da Fama (a home filtra por in_hall_of_fame e ordena por data)
create index if not exists winners_hall on public.winners (in_hall_of_fame, won_at desc);
