-- Projeção relacional do documento versionado na mesma transação.
-- Datas em DATE, dinheiro em BIGINT, taxas em NUMERIC nullable.
create table public.profiles(user_id uuid primary key references auth.users(id) on delete cascade, name text not null default '', timezone text not null default 'America/Sao_Paulo');
create table public.accounts(user_id uuid not null references profiles(user_id) on delete cascade,id text not null,name text not null,opening bigint not null,opening_date date not null,reserve boolean not null,archived boolean not null,primary key(user_id,id));
create table public.categories(user_id uuid not null references profiles(user_id) on delete cascade,id text not null,primary key(user_id,id));
create table public.activities(user_id uuid not null references profiles(user_id) on delete cascade,id text not null,name text not null,platform_net boolean not null,costs_complete boolean not null,primary key(user_id,id));
create table public.debts(user_id uuid not null references profiles(user_id) on delete cascade,id text not null,creditor text not null,balance bigint not null check(balance>=0),base_date date not null,installment bigint not null check(installment>=0),remaining int not null check(remaining>=0),monthly_rate numeric null check(monthly_rate>=0),annual_cet numeric null check(annual_cet>=0),due_date date not null,payroll boolean not null,overdue boolean not null,details jsonb not null,primary key(user_id,id));
create table public.import_batches(user_id uuid not null references profiles(user_id) on delete cascade,id text not null,file_hash text not null,account_id text not null,undone boolean not null,primary key(user_id,id),foreign key(user_id,account_id) references accounts(user_id,id) deferrable initially deferred);
create table public.recurrences(user_id uuid not null references profiles(user_id) on delete cascade,id text not null,account_id text not null,amount bigint not null check(amount>0),start_date date not null,end_date date,details jsonb not null,primary key(user_id,id),foreign key(user_id,account_id) references accounts(user_id,id) deferrable initially deferred);
create table public.contracts(user_id uuid not null references profiles(user_id) on delete cascade,id text not null,total bigint not null check(total>0),start_date date not null,end_date date not null,description text not null,primary key(user_id,id),check(end_date>=start_date));
create table public.transfers(user_id uuid not null references profiles(user_id) on delete cascade,id text not null,primary key(user_id,id));
create table public.movements(user_id uuid not null references profiles(user_id) on delete cascade,id text not null,account_id text not null,category_id text not null,amount bigint not null check(amount>0),cash_date date not null,competence date,status text not null check(status in ('realizado','previsto','provavel')),financial_type text not null check(financial_type in ('income','expense','transfer-in','transfer-out','loan','refund','adjustment','adjustment-out')),description text not null,transfer_id text,original_id text,debt_id text,batch_id text,occurrence_id text,details jsonb not null,primary key(user_id,id),foreign key(user_id,account_id) references accounts(user_id,id) deferrable initially deferred,foreign key(user_id,category_id) references categories(user_id,id) deferrable initially deferred,foreign key(user_id,transfer_id) references transfers(user_id,id) deferrable initially deferred,foreign key(user_id,original_id) references movements(user_id,id) deferrable initially deferred,foreign key(user_id,debt_id) references debts(user_id,id) deferrable initially deferred,foreign key(user_id,batch_id) references import_batches(user_id,id) deferrable initially deferred);
create table public.occurrences(user_id uuid not null references profiles(user_id) on delete cascade,id text not null,recurrence_id text not null,due_date date not null,amount bigint not null check(amount>0),payment_id text,cancelled boolean not null,primary key(user_id,id),unique(user_id,recurrence_id,due_date),unique(user_id,payment_id),foreign key(user_id,recurrence_id) references recurrences(user_id,id) deferrable initially deferred,foreign key(user_id,payment_id) references movements(user_id,id) deferrable initially deferred);
alter table public.movements add constraint own_occurrence foreign key(user_id,occurrence_id) references occurrences(user_id,id) deferrable initially deferred;
create unique index one_payment_per_occurrence on public.movements(user_id,occurrence_id) where occurrence_id is not null;
create table public.receipts(user_id uuid not null references profiles(user_id) on delete cascade,id text not null,contract_id text not null,account_id text not null,cash_date date not null,amount bigint not null check(amount>=0),status text not null,payment_id text,primary key(user_id,id),foreign key(user_id,contract_id) references contracts(user_id,id) deferrable initially deferred,foreign key(user_id,account_id) references accounts(user_id,id) deferrable initially deferred,foreign key(user_id,payment_id) references movements(user_id,id) deferrable initially deferred);
create table public.tasks(user_id uuid not null references profiles(user_id) on delete cascade,id text not null,title text not null,due_date date not null,status text not null,potential bigint not null check(potential>=0),confirmed bigint not null check(confirmed>=0),effect_date date,primary key(user_id,id),check(confirmed=0 or effect_date is not null));
create table public.card_details(user_id uuid not null references profiles(user_id) on delete cascade,id text not null,payment_id text not null,category_id text not null,amount bigint not null check(amount>0),primary key(user_id,id),foreign key(user_id,payment_id) references movements(user_id,id) deferrable initially deferred,foreign key(user_id,category_id) references categories(user_id,id) deferrable initially deferred);
create index movements_cash on movements(user_id,cash_date);
create index occurrences_due on occurrences(user_id,due_date);
create index batch_hash on import_batches(user_id,account_id,file_hash);
do $$declare tbl text;begin
 foreach tbl in array array['profiles','accounts','categories','activities','debts','import_batches','recurrences','contracts','transfers','movements','occurrences','receipts','tasks','card_details'] loop
 execute format('alter table public.%I enable row level security',tbl);
 execute format('create policy own_select on public.%I for select to authenticated using ((select auth.uid())=user_id)',tbl);
 execute format('create policy own_insert on public.%I for insert to authenticated with check ((select auth.uid())=user_id)',tbl);
 execute format('create policy own_update on public.%I for update to authenticated using ((select auth.uid())=user_id) with check ((select auth.uid())=user_id)',tbl);
 execute format('create policy own_delete on public.%I for delete to authenticated using ((select auth.uid())=user_id)',tbl);
 execute format('revoke all on public.%I from anon,authenticated',tbl);
 execute format('grant select on public.%I to authenticated',tbl);
 end loop;
end $$;
create function public.project_financial_data() returns trigger language plpgsql security definer set search_path=public as $$
declare u uuid; p jsonb; x jsonb; c jsonb; i bigint;
begin
 if TG_OP='DELETE' then delete from profiles where user_id=old.user_id;return old;end if;
 u=new.user_id;p=new.data;
 delete from profiles where user_id=u;
 insert into profiles(user_id,name,timezone) values(u,coalesce(p->'profile'->>'name',''),'America/Sao_Paulo');
 for x in select * from jsonb_array_elements(p->'accounts') loop insert into accounts values(u,x->>'id',x->>'name',(x->>'opening')::bigint,(x->>'date')::date,(x->>'reserve')::boolean,(x->>'archived')::boolean);end loop;
 for x in select * from jsonb_array_elements(p->'categories') loop insert into categories values(u,x#>>'{}');end loop;
 for x in select * from jsonb_array_elements(p->'activities') loop insert into activities values(u,x->>'id',x->>'name',(x->>'platformNet')::boolean,(x->>'costsComplete')::boolean);end loop;
 for x in select * from jsonb_array_elements(p->'debts') loop insert into debts values(u,x->>'id',x->>'creditor',(x->>'balance')::bigint,(x->>'base')::date,(x->>'installment')::bigint,(x->>'remaining')::int,(x->>'rate')::numeric,nullif(replace(x->>'cet',',','.'),'')::numeric,(x->>'due')::date,(x->>'payroll')::boolean,(x->>'overdue')::boolean,x);end loop;
 for x in select * from jsonb_array_elements(p->'batches') loop insert into import_batches values(u,x->>'id',x->>'hash',x->>'account',(x->>'undone')::boolean);end loop;
 for x in select * from jsonb_array_elements(p->'rules') loop insert into recurrences values(u,x->>'id',x->>'account',(x->>'amount')::bigint,(x->>'start')::date,(x->>'end')::date,x);end loop;
 for x in select * from jsonb_array_elements(p->'contracts') loop insert into contracts values(u,x->>'id',(x->>'total')::bigint,(x->>'start')::date,(x->>'end')::date,x->>'description');end loop;
 insert into transfers select distinct u,m->>'pair' from jsonb_array_elements(p->'movements') m where m ? 'pair';
 for x in select * from jsonb_array_elements(p->'movements') loop insert into movements values(u,x->>'id',x->>'account',x->>'category',(x->>'amount')::bigint,(x->>'date')::date,(x->>'competence')::date,x->>'status',x->>'type',x->>'description',x->>'pair',x->>'original',x->>'debt',x->>'batch',x->>'occurrence',x);end loop;
 for x in select * from jsonb_array_elements(p->'occurrences') loop insert into occurrences values(u,x->>'id',x->>'rule',(x->>'date')::date,(x->>'amount')::bigint,x->>'paid',coalesce((x->>'cancelled')::boolean,false));end loop;
 for c in select * from jsonb_array_elements(p->'contracts') loop
 for x,i in select value,ordinality-1 from jsonb_array_elements(c->'receipts') with ordinality loop insert into receipts values(u,(c->>'id')||':'||i,c->>'id',x->>'account',(x->>'date')::date,(x->>'amount')::bigint,x->>'status',x->>'paid');end loop;end loop;
 for x in select * from jsonb_array_elements(p->'tasks') loop insert into tasks values(u,x->>'id',x->>'title',(x->>'due')::date,x->>'status',(x->>'potential')::bigint,(x->>'confirmed')::bigint,(x->>'effect')::date);end loop;
 for x in select * from jsonb_array_elements(p->'cardDetails') loop insert into card_details values(u,x->>'id',x->>'payment',x->>'category',(x->>'amount')::bigint);end loop;
 return new;
end $$;
create trigger project_aggregate after insert or update or delete on public.financial_data for each row execute function public.project_financial_data();
revoke all on function public.project_financial_data() from public,anon,authenticated;
