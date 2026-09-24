-- Rodar uma vez no SQL Editor do Supabase (depois do migracao-rifas.sql). Não apaga dados.
-- Reserva na hora de pagar: os números ficam presos para quem está pagando (15 min),
-- em vez de só no envio do comprovante. Assim dois compradores nunca pagam pelo mesmo número.

-- 1. Novos status: awaiting = reservado esperando o PIX; expired = reserva venceu sem pagamento
alter table public.raffle_orders add column if not exists expires_at timestamptz;
alter table public.raffle_orders drop constraint if exists raffle_orders_status_check;
alter table public.raffle_orders add constraint raffle_orders_status_check
  check (status in ('awaiting', 'pending', 'approved', 'rejected', 'expired'));

-- 2. Libera as reservas vencidas de uma rifa (chamada antes de mostrar/reservar números)
create or replace function public.raffle_expire_holds(p_raffle uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  with vencidas as (
    update public.raffle_orders set status = 'expired'
     where raffle_id = p_raffle and status = 'awaiting' and expires_at < now()
    returning id
  )
  delete from public.raffle_numbers where order_id in (select id from vencidas);
end; $$;

-- 3. Reservar (sem comprovante ainda). Uma reserva aberta por pessoa em cada rifa.
drop function if exists public.raffle_reserve(uuid, text, integer[], text[]);
create or replace function public.raffle_reserve(p_raffle uuid, p_username text, p_numbers integer[], p_hold_minutes integer)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  r      public.raffles%rowtype;
  v_nums integer[];
  v_bad  integer[];
  v_id   uuid;
  v_user text := lower(p_username);
begin
  select * into r from public.raffles where id = p_raffle for update; -- compras da mesma rifa entram em fila
  if not found then raise exception 'RAFFLE_NOT_FOUND'; end if;
  if r.status <> 'open' then raise exception 'RAFFLE_CLOSED'; end if;

  perform public.raffle_expire_holds(p_raffle);

  -- reserva anterior desta pessoa nesta rifa (que ainda não pagou) é liberada
  with antigas as (
    update public.raffle_orders set status = 'expired'
     where raffle_id = p_raffle and username = v_user and status = 'awaiting'
    returning id
  )
  delete from public.raffle_numbers where order_id in (select id from antigas);

  v_nums := array(select distinct n from unnest(p_numbers) as n order by n);
  if coalesce(cardinality(v_nums), 0) = 0 then raise exception 'NO_NUMBERS'; end if;
  if exists (select 1 from unnest(v_nums) as n where n < 1 or n > r.total_numbers) then raise exception 'INVALID_NUMBER'; end if;

  select array_agg(number order by number) into v_bad
    from public.raffle_numbers where raffle_id = p_raffle and number = any (v_nums);
  if v_bad is not null then raise exception 'TAKEN:%', array_to_string(v_bad, ','); end if;

  insert into public.raffle_orders (raffle_id, username, numbers, total_cents, status, expires_at)
    values (p_raffle, v_user, v_nums, cardinality(v_nums) * r.price_cents, 'awaiting', now() + make_interval(mins => p_hold_minutes))
    returning id into v_id;
  insert into public.raffle_numbers (raffle_id, number, order_id, status)
    select p_raffle, n, v_id, 'pending' from unnest(v_nums) as n;
  return v_id;
end; $$;

-- 4. Enviar o comprovante. Se a reserva venceu mas os números seguem livres, a compra entra mesmo assim.
create or replace function public.raffle_submit_proof(p_order uuid, p_username text, p_proofs text[])
returns void language plpgsql security definer set search_path = public as $$
declare
  o     public.raffle_orders%rowtype;
  v_bad integer[];
begin
  select * into o from public.raffle_orders where id = p_order for update;
  if not found or o.username <> lower(p_username) then raise exception 'ORDER_NOT_FOUND'; end if;
  if o.status = 'pending' then raise exception 'ALREADY_SENT'; end if;
  if o.status not in ('awaiting', 'expired') then raise exception 'ORDER_CLOSED'; end if;

  perform 1 from public.raffles where id = o.raffle_id for update; -- mesma fila das reservas

  -- números que já não são desta compra (reserva venceu e alguém pegou)
  select array_agg(number order by number) into v_bad
    from public.raffle_numbers
   where raffle_id = o.raffle_id and number = any (o.numbers) and order_id <> o.id;
  if v_bad is not null then raise exception 'TAKEN:%', array_to_string(v_bad, ','); end if;

  -- reserva vencida: prende os números de novo
  insert into public.raffle_numbers (raffle_id, number, order_id, status)
    select o.raffle_id, n, o.id, 'pending' from unnest(o.numbers) as n
    on conflict (raffle_id, number) do nothing;

  update public.raffle_orders set status = 'pending', proof_paths = p_proofs, expires_at = null where id = o.id;
end; $$;

-- 5. Cancelar a própria reserva (antes de pagar)
create or replace function public.raffle_release(p_order uuid, p_username text)
returns void language plpgsql security definer set search_path = public as $$
begin
  with cancelada as (
    update public.raffle_orders set status = 'expired'
     where id = p_order and username = lower(p_username) and status = 'awaiting'
    returning id
  )
  delete from public.raffle_numbers where order_id in (select id from cancelada);
end; $$;

-- 6. Aprovar / recusar: compra sem comprovante não pode ser aprovada
create or replace function public.raffle_set_order_status(p_order uuid, p_status text)
returns void language plpgsql security definer set search_path = public as $$
declare o public.raffle_orders%rowtype;
begin
  select * into o from public.raffle_orders where id = p_order for update;
  if not found then raise exception 'ORDER_NOT_FOUND'; end if;
  if o.status in ('rejected', 'expired') and p_status <> 'rejected' then raise exception 'ORDER_REJECTED'; end if;
  if o.status = 'awaiting' and p_status <> 'rejected' then raise exception 'ORDER_NOT_PAID'; end if;

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
end; $$;

-- Só o servidor do site chama as funções
revoke execute on function public.raffle_expire_holds(uuid) from public, anon, authenticated;
revoke execute on function public.raffle_reserve(uuid, text, integer[], integer) from public, anon, authenticated;
revoke execute on function public.raffle_submit_proof(uuid, text, text[]) from public, anon, authenticated;
revoke execute on function public.raffle_release(uuid, text) from public, anon, authenticated;
revoke execute on function public.raffle_set_order_status(uuid, text) from public, anon, authenticated;
grant execute on function public.raffle_expire_holds(uuid) to service_role;
grant execute on function public.raffle_reserve(uuid, text, integer[], integer) to service_role;
grant execute on function public.raffle_submit_proof(uuid, text, text[]) to service_role;
grant execute on function public.raffle_release(uuid, text) to service_role;
grant execute on function public.raffle_set_order_status(uuid, text) to service_role;
