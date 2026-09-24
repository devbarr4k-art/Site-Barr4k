-- Rodar uma vez no SQL Editor do Supabase (depois do migracao-rifas-reserva.sql). Não apaga dados.
-- Desfazer uma recusa feita sem querer.
--  * Números todos livres: a compra volta para "pendente" como estava.
--  * Algum número foi pego nesse meio tempo: o painel troca só esses por outros livres,
--    ou, com a rifa cheia, cria números extras além do limite (ex.: 101, 102...).
--  O valor pago não muda.

-- 1. Aprovar / recusar / voltar para pendente
create or replace function public.raffle_set_order_status(p_order uuid, p_status text)
returns void language plpgsql security definer set search_path = public as $$
declare
  o     public.raffle_orders%rowtype;
  v_bad integer[];
begin
  select * into o from public.raffle_orders where id = p_order for update;
  if not found then raise exception 'ORDER_NOT_FOUND'; end if;
  if o.status = 'expired' and p_status <> 'rejected' then raise exception 'ORDER_REJECTED'; end if;
  if o.status = 'awaiting' and p_status <> 'rejected' then raise exception 'ORDER_NOT_PAID'; end if;

  -- Desfazer recusa: só volta direto se nenhum número tiver sido pego
  if o.status = 'rejected' and p_status <> 'rejected' then
    if p_status <> 'pending' then raise exception 'INVALID_STATUS'; end if;
    perform 1 from public.raffles where id = o.raffle_id for update; -- mesma fila das compras
    select array_agg(number order by number) into v_bad
      from public.raffle_numbers where raffle_id = o.raffle_id and number = any (o.numbers);
    if v_bad is not null then raise exception 'TAKEN:%', array_to_string(v_bad, ','); end if;
    insert into public.raffle_numbers (raffle_id, number, order_id, status)
      select o.raffle_id, n, o.id, 'pending' from unnest(o.numbers) as n;
    update public.raffle_orders set status = 'pending', decided_at = null where id = p_order;
    return;
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
end; $$;

-- 2. Desfazer recusa trocando os números que foram pegos.
--    p_new_numbers: os substitutos escolhidos no painel (mesma quantidade dos perdidos).
--    p_extend = true: rifa cheia, cria números novos no fim (total + 1, total + 2...).
--    Devolve os números novos que a pessoa ganhou.
create or replace function public.raffle_restore_order(p_order uuid, p_new_numbers integer[], p_extend boolean)
returns integer[] language plpgsql security definer set search_path = public as $$
declare
  o       public.raffle_orders%rowtype;
  r       public.raffles%rowtype;
  v_lost  integer[];
  v_keep  integer[];
  v_new   integer[];
  v_bad   integer[];
  v_final integer[];
  k       integer;
begin
  select * into o from public.raffle_orders where id = p_order for update;
  if not found then raise exception 'ORDER_NOT_FOUND'; end if;
  if o.status <> 'rejected' then raise exception 'INVALID_STATUS'; end if;
  select * into r from public.raffles where id = o.raffle_id for update;

  -- números desta compra que agora são de outra pessoa
  select array_agg(number order by number) into v_lost
    from public.raffle_numbers where raffle_id = o.raffle_id and number = any (o.numbers);
  v_keep := array(select n from unnest(o.numbers) as n where not (n = any (coalesce(v_lost, '{}'))) order by n);
  k := coalesce(cardinality(v_lost), 0);

  if k = 0 then
    v_new := '{}';
  elsif p_extend then
    if r.total_numbers + k > 10000 then raise exception 'TOO_MANY'; end if;
    v_new := array(select generate_series(r.total_numbers + 1, r.total_numbers + k));
    update public.raffles set total_numbers = total_numbers + k where id = r.id;
  else
    v_new := array(select distinct n from unnest(coalesce(p_new_numbers, '{}')) as n order by n);
    if cardinality(v_new) <> k then raise exception 'WRONG_COUNT:%', k; end if;
    if exists (select 1 from unnest(v_new) as n where n < 1 or n > r.total_numbers or n = any (v_keep)) then
      raise exception 'INVALID_NUMBER';
    end if;
    select array_agg(number order by number) into v_bad
      from public.raffle_numbers where raffle_id = o.raffle_id and number = any (v_new);
    if v_bad is not null then raise exception 'TAKEN:%', array_to_string(v_bad, ','); end if;
  end if;

  v_final := array(select x from unnest(v_keep || v_new) as x order by x);
  insert into public.raffle_numbers (raffle_id, number, order_id, status)
    select o.raffle_id, n, o.id, 'pending' from unnest(v_final) as n;
  update public.raffle_orders set numbers = v_final, status = 'pending', decided_at = null where id = p_order;
  return v_new;
end; $$;

revoke execute on function public.raffle_set_order_status(uuid, text) from public, anon, authenticated;
revoke execute on function public.raffle_restore_order(uuid, integer[], boolean) from public, anon, authenticated;
grant execute on function public.raffle_set_order_status(uuid, text) to service_role;
grant execute on function public.raffle_restore_order(uuid, integer[], boolean) to service_role;
