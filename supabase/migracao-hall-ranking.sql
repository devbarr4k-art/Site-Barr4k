-- Rodar uma vez no SQL Editor do Supabase (não apaga dados).
-- Hall da Fama em ranking: cada vitória passa a ter um valor em coins (preenchido pelo painel).
alter table public.winners add column if not exists coins integer not null default 0 check (coins >= 0);

-- "Últimos Vencedores" mostra todo mundo: vencedor novo já entra visível (o painel pode ocultar)
alter table public.winners alter column in_hall_of_fame set default true;
