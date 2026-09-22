-- Rodar uma vez no Supabase: Dashboard > SQL Editor > New query > colar e Run.
--
-- O site agora grava e lê dados sensíveis só pelas rotas /api (service role),
-- então a chave pública (anon) passa a poder apenas LER sorteios e vencedores.
-- Participantes (comprovantes, ID na casa) ficam fechados para o público.

-- 1. Padroniza os nomes já salvos para o login da Twitch em minúsculas
update public.participants set twitch_username = lower(twitch_username)
where twitch_username <> lower(twitch_username);

update public.winners set twitch_username = lower(twitch_username)
where twitch_username <> lower(twitch_username);

-- 2. Liga o RLS e apaga as políticas antigas dessas tabelas
alter table public.giveaways enable row level security;
alter table public.participants enable row level security;
alter table public.winners enable row level security;

do $$
declare pol record;
begin
  for pol in
    select policyname, tablename from pg_policies
    where schemaname = 'public' and tablename in ('giveaways', 'participants', 'winners')
  loop
    execute format('drop policy %I on public.%I', pol.policyname, pol.tablename);
  end loop;
end $$;

-- 3. Público só lê sorteios e vencedores. Nenhuma escrita pela chave anon.
create policy "leitura publica de sorteios" on public.giveaways
  for select to anon, authenticated using (true);

create policy "leitura publica de vencedores" on public.winners
  for select to anon, authenticated using (true);

-- participants: sem política = anon não lê nem escreve (a service role ignora o RLS)
