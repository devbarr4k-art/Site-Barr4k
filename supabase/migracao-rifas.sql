-- Rodar uma vez no SQL Editor do Supabase (não apaga dados).
-- Rifas: tudo passa pelas rotas /api do site (service role). Nenhuma tabela tem leitura pública.

-- 1. Rifas (criadas e editadas no painel)
create table if not exists public.raffles (
  id            uuid primary key default gen_random_uuid(),
  title         text not null,
  subtitle      text,
  image_url     text,
  price_cents   integer not null check (price_cents > 0),            -- preço de cada número, em centavos
  total_numbers integer not null check (total_numbers between 1 and 10000),
  draw_date     timestamptz,
  pix_key       text,
  pix_name      text,
  qr_image_url  text,                                                -- QR code fixo do PIX do streamer
  status        text not null default 'open' check (status in ('open', 'closed')),
  created_at    timestamptz not null default now()
);

-- 2. Compras (pedido de números + comprovantes, aprovadas à mão pelo streamer)
create table if not exists public.raffle_orders (
  id          uuid primary key default gen_random_uuid(),
  raffle_id   uuid not null references public.raffles (id) on delete cascade,
  username    text not null,                                          -- login da Twitch
  numbers     integer[] not null,
  total_cents integer not null,                                       -- calculado no banco, nunca pelo navegador
  proof_paths text[] not null default '{}',                           -- comprovantes no bucket privado "proofs"
  status      text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  created_at  timestamptz not null default now(),
  decided_at  timestamptz
);
create index if not exists raffle_orders_list on public.raffle_orders (raffle_id, status, created_at desc);
create index if not exists raffle_orders_user on public.raffle_orders (username, created_at desc);

-- 3. Números ocupados: UM registro por número. A chave primária (rifa, número) é o que
--    impede duas pessoas de ficarem com o mesmo número, mesmo comprando no mesmo instante.
create table if not exists public.raffle_numbers (
  raffle_id uuid not null references public.raffles (id) on delete cascade,
  number    integer not null,
  order_id  uuid not null references public.raffle_orders (id) on delete cascade,
  status    text not null check (status in ('pending', 'approved')),
  primary key (raffle_id, number)
);
create index if not exists raffle_numbers_order on public.raffle_numbers (order_id);

alter table public.raffles        enable row level security;
alter table public.raffle_orders  enable row level security;
alter table public.raffle_numbers enable row level security;

-- 4. Compra atômica: confere a rifa, valida os números, cria o pedido e reserva tudo
--    numa transação só. Se algum número já tiver dono, nada é gravado.
create or replace function public.raffle_reserve(p_raffle uuid, p_username text, p_numbers integer[], p_proofs text[])
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  r      public.raffles%rowtype;
  v_nums integer[];
  v_bad  integer[];
  v_id   uuid;
begin
  -- trava a rifa durante a compra: compras simultâneas da mesma rifa entram em fila
  select * into r from public.raffles where id = p_raffle for update;
  if not found then raise exception 'RAFFLE_NOT_FOUND'; end if;
  if r.status <> 'open' then raise exception 'RAFFLE_CLOSED'; end if;

  v_nums := array(select distinct n from unnest(p_numbers) as n order by n);
  if coalesce(cardinality(v_nums), 0) = 0 then raise exception 'NO_NUMBERS'; end if;
  if exists (select 1 from unnest(v_nums) as n where n < 1 or n > r.total_numbers) then
    raise exception 'INVALID_NUMBER';
  end if;

  select array_agg(number order by number) into v_bad
    from public.raffle_numbers where raffle_id = p_raffle and number = any (v_nums);
  if v_bad is not null then raise exception 'TAKEN:%', array_to_string(v_bad, ','); end if;

  insert into public.raffle_orders (raffle_id, username, numbers, total_cents, proof_paths)
    values (p_raffle, lower(p_username), v_nums, cardinality(v_nums) * r.price_cents, coalesce(p_proofs, '{}'))
    returning id into v_id;

  insert into public.raffle_numbers (raffle_id, number, order_id, status)
    select p_raffle, n, v_id, 'pending' from unnest(v_nums) as n;

  return v_id;
end;
$$;

-- 5. Aprovar / recusar / voltar para pendente (recusar libera os números)
create or replace function public.raffle_set_order_status(p_order uuid, p_status text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare o public.raffle_orders%rowtype;
begin
  select * into o from public.raffle_orders where id = p_order for update;
  if not found then raise exception 'ORDER_NOT_FOUND'; end if;
  if o.status = 'rejected' and p_status <> 'rejected' then
    raise exception 'ORDER_REJECTED'; -- os números já podem ter outro dono
  end if;

  if p_status = 'rejected' then
    delete from public.raffle_numbers where order_id = p_order;
  elsif p_status in ('approved', 'pending') then
    update public.raffle_numbers set status = p_status where order_id = p_order;
  else
    raise exception 'INVALID_STATUS';
  end if;

  update public.raffle_orders
    set status = p_status, decided_at = case when p_status = 'pending' then null else now() end
    where id = p_order;
end;
$$;

-- Só o servidor do site (service role) pode chamar as funções; ninguém reserva direto pelo banco
revoke execute on function public.raffle_reserve(uuid, text, integer[], text[]) from public, anon, authenticated;
revoke execute on function public.raffle_set_order_status(uuid, text) from public, anon, authenticated;
grant execute on function public.raffle_reserve(uuid, text, integer[], text[]) to service_role;
grant execute on function public.raffle_set_order_status(uuid, text) to service_role;
