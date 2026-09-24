-- Rodar uma vez no SQL Editor do Supabase (depois do migracao-rifas-reserva.sql). Não apaga dados.
-- Permite desfazer uma recusa feita sem querer: a compra volta para "pendente" e prende os
-- números de novo, mas só se ninguém tiver pegado algum deles nesse meio tempo.

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

  -- Desfazer recusa: volta para pendente se os números ainda estiverem livres
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

revoke execute on function public.raffle_set_order_status(uuid, text) from public, anon, authenticated;
grant execute on function public.raffle_set_order_status(uuid, text) to service_role;
