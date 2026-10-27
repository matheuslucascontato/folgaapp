-- Agregado versionado por usuário: uma gravação atômica cobre transferências,
-- ocorrências e lotes, com compare-and-swap para impedir perda de atualização.
create table public.financial_data (
 user_id uuid primary key references auth.users(id) on delete cascade,
 data jsonb not null check (data->>'version' = '1'),
 revision bigint not null default 1 check(revision > 0),
 updated_at timestamptz not null default now(),
 check (jsonb_typeof(data->'accounts') = 'array'),
 check (jsonb_typeof(data->'movements') = 'array')
);
alter table public.financial_data enable row level security;
create policy own_select on public.financial_data for select to authenticated using ((select auth.uid())=user_id);
create policy own_insert on public.financial_data for insert to authenticated with check ((select auth.uid())=user_id);
create policy own_update on public.financial_data for update to authenticated using ((select auth.uid())=user_id) with check ((select auth.uid())=user_id);
create policy own_delete on public.financial_data for delete to authenticated using ((select auth.uid())=user_id);
create or replace function public.save_financial_data(payload jsonb, expected_revision bigint)
returns bigint language plpgsql security invoker set search_path=public as $$
declare result bigint;
begin
 if auth.uid() is null then raise exception 'Autenticação necessária'; end if;
 if payload->>'version' is distinct from '1' then raise exception 'Versão inválida'; end if;
 -- referências ficam dentro do agregado do próprio usuário, nunca entre agregados.
 if exists(select 1 from jsonb_array_elements(payload->'movements') m where not exists(select 1 from jsonb_array_elements(payload->'accounts') a where a->>'id'=m->>'account')) then raise exception 'Conta inválida'; end if;
 if expected_revision=0 then
 insert into financial_data(user_id,data,revision) values(auth.uid(),payload,1) returning revision into result;
 else
 update financial_data set data=payload,revision=revision+1,updated_at=now() where user_id=auth.uid() and revision=expected_revision returning revision into result;
 if result is null then raise exception 'Dados alterados em outra sessão. Recarregue antes de tentar novamente.'; end if;
 end if;
 return result;
end $$;
revoke all on function public.save_financial_data(jsonb,bigint) from public,anon;
grant execute on function public.save_financial_data(jsonb,bigint) to authenticated;

-- Também protege gravações diretas pela Data API, sem depender do frontend.
create function public.validate_financial_aggregate() returns trigger language plpgsql set search_path=public as $$
declare kind text; item jsonb; leg jsonb; cnt int;
begin
 foreach kind in array array['accounts','movements','rules','occurrences','debts','contracts','tasks','batches','cardDetails','activities'] loop
 if jsonb_typeof(new.data->kind) is distinct from 'array' then raise exception 'Coleção inválida: %',kind; end if;
 if exists(select 1 from jsonb_array_elements(new.data->kind) e group by e->>'id' having count(*)>1) then raise exception 'Identificador duplicado'; end if;
 end loop;
 if (new.data->>'reserve')::numeric < 0 or (new.data->>'reserve')::numeric <> trunc((new.data->>'reserve')::numeric) then raise exception 'Reserva inválida'; end if;
 for item in select * from jsonb_array_elements(new.data->'movements') loop
 if (item->>'amount')::numeric<=0 or (item->>'amount')::numeric<>trunc((item->>'amount')::numeric) then raise exception 'Use centavos inteiros positivos'; end if;
 if not exists(select 1 from jsonb_array_elements(new.data->'accounts') a where a->>'id'=item->>'account') then raise exception 'Conta inválida'; end if;
 if item ? 'debt' and not exists(select 1 from jsonb_array_elements(new.data->'debts') d where d->>'id'=item->>'debt') then raise exception 'Dívida inválida'; end if;
 if item ? 'original' and not exists(select 1 from jsonb_array_elements(new.data->'movements') m where m->>'id'=item->>'original' and m->>'type'='expense') then raise exception 'Estorno inválido'; end if;
 if item ? 'occurrence' and (select count(*) from jsonb_array_elements(new.data->'movements') m where m->>'occurrence'=item->>'occurrence')<>1 then raise exception 'Pagamento duplicado'; end if;
 if item->>'type' in ('transfer-in','transfer-out') then
 if not item ? 'pair' then raise exception 'Transferência sem par'; end if;
 select count(*) into cnt from jsonb_array_elements(new.data->'movements') m where m->>'pair'=item->>'pair';
 if cnt<>2 then raise exception 'Transferência incompleta'; end if;
 select m into leg from jsonb_array_elements(new.data->'movements') m where m->>'pair'=item->>'pair' and m->>'id'<>item->>'id';
 if leg->>'account'=item->>'account' or leg->>'amount'<>item->>'amount' or leg->>'date'<>item->>'date' or leg->>'status'<>item->>'status' or leg->>'type'=item->>'type' or leg->>'type' not in ('transfer-in','transfer-out') then raise exception 'Par de transferência inválido'; end if;
 end if;
 end loop;
 for item in select * from jsonb_array_elements(new.data->'rules') loop
 if not exists(select 1 from jsonb_array_elements(new.data->'accounts') a where a->>'id'=item->>'account') then raise exception 'Conta de recorrência inválida'; end if;
 end loop;
 for item in select * from jsonb_array_elements(new.data->'occurrences') loop
 if not exists(select 1 from jsonb_array_elements(new.data->'rules') r where r->>'id'=item->>'rule') then raise exception 'Recorrência inválida'; end if;
 if item ? 'paid' and not exists(select 1 from jsonb_array_elements(new.data->'movements') m where m->>'id'=item->>'paid' and m->>'occurrence'=item->>'id') then raise exception 'Vínculo de pagamento inválido'; end if;
 end loop;
 for item in select * from jsonb_array_elements(new.data->'cardDetails') loop
 if not exists(select 1 from jsonb_array_elements(new.data->'movements') m where m->>'id'=item->>'payment' and m->>'type'='expense') then raise exception 'Fatura inválida'; end if;
 if (select sum((d->>'amount')::bigint) from jsonb_array_elements(new.data->'cardDetails') d where d->>'payment'=item->>'payment') > (select (m->>'amount')::bigint from jsonb_array_elements(new.data->'movements') m where m->>'id'=item->>'payment') then raise exception 'Detalhes excedem fatura'; end if;
 end loop;
 return new;
end $$;
create trigger validate_aggregate before insert or update on public.financial_data for each row execute function public.validate_financial_aggregate();
grant select,insert,update,delete on public.financial_data to authenticated;
revoke all on public.financial_data from anon;
