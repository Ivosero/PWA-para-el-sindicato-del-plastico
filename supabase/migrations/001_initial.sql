-- Apply once to a new Supabase project. The first administrator is provisioned manually.
begin;
create extension if not exists btree_gist;
create type public.app_role as enum ('delegado','secretario','admin');
create table public.profiles (
 id uuid primary key references auth.users(id) on delete cascade,
 name text not null check(length(trim(name)) between 2 and 250), role public.app_role not null default 'delegado',
 building text not null default '', start_time time not null default '08:00', end_time time not null default '15:00',
 phone text not null default '', active boolean not null default false
);
create table public.members (
 id uuid primary key default gen_random_uuid(), first_name text not null check(length(trim(first_name))>0),last_name text not null check(length(trim(last_name))>0),
 file_number text not null unique check(length(trim(file_number))>0), building text not null,area text not null,position text not null,management text not null,
 start_time time not null,end_time time not null,phone text not null
);
create table public.events (
 id uuid primary key default gen_random_uuid(),title text not null check(length(trim(title)) between 3 and 250),description text not null check(length(description)<=5000),
 date timestamptz not null,location text not null,category text not null,urgent boolean not null default false
);
create table public.responses (
 id uuid primary key default gen_random_uuid(),event_id uuid not null references public.events on delete cascade,user_id uuid not null references public.profiles on delete cascade,
 status text not null check(status in ('yes','no')),reason text not null default '',unique(event_id,user_id),
 check(status <> 'no' or length(trim(reason)) between 10 and 1500)
);
create table public.vacations (
 id uuid primary key default gen_random_uuid(),user_id uuid not null references public.profiles on delete cascade,
 start_date date not null,end_date date not null,check(end_date>=start_date),
 exclude using gist (user_id with =, daterange(start_date,end_date,'[]') with &&)
);
create table public.benefits (id uuid primary key default gen_random_uuid(),category text not null,title text not null,description text not null,detail text not null,contact text not null default '');
create table public.settings (id text primary key check(id='general'),name text not null,subtitle text not null,contact text not null);
insert into public.settings values ('general','Plástico','Espacio de delegados','Secretaría gremial');
create table public.notifications (id uuid primary key default gen_random_uuid(),user_id uuid not null references public.profiles on delete cascade,event_id uuid not null references public.events on delete cascade,title text not null,read boolean not null default false);
create table public.push_subscriptions (id uuid primary key default gen_random_uuid(),user_id uuid not null references public.profiles on delete cascade,endpoint text not null unique,subscription jsonb not null);
create table public.push_jobs (id uuid primary key default gen_random_uuid(),notification_id uuid not null references public.notifications on delete cascade,user_id uuid not null references public.profiles on delete cascade,attempts int not null default 0,available_at timestamptz not null default now(),completed_at timestamptz,last_error text);
create table public.audit_log (id bigint generated always as identity primary key,actor uuid,table_name text not null,record_id text not null,operation text not null,created_at timestamptz not null default now());
create index notifications_user_idx on public.notifications(user_id);
create index responses_user_idx on public.responses(user_id);
create index push_jobs_pending_idx on public.push_jobs(available_at) where completed_at is null;
create index members_name_idx on public.members(last_name,first_name);
create index events_date_idx on public.events(date);

create function public.current_role() returns public.app_role language sql stable security definer set search_path='' as $$ select role from public.profiles where id=auth.uid() and active $$;
revoke all on function public.current_role() from public;
grant execute on function public.current_role() to authenticated;
create function public.is_manager() returns boolean language sql stable security definer set search_path='' as $$ select coalesce(public.current_role() in ('secretario','admin'),false) $$;
revoke all on function public.is_manager() from public;
grant execute on function public.is_manager() to authenticated;

-- Authentication creates an INACTIVE delegate; metadata can never set privileges.
create function public.on_signup() returns trigger language plpgsql security definer set search_path='' as $$ begin
 insert into public.profiles(id,name) values(new.id,coalesce(nullif(left(new.raw_user_meta_data->>'name',250),''),'Nueva cuenta'));return new;end $$;
create trigger signup_profile after insert on auth.users for each row execute function public.on_signup();

-- Column protection complements RLS: people may edit their schedule, never their role or activation.
create function public.protect_profile() returns trigger language plpgsql security definer set search_path='' as $$ begin
 if auth.uid() is not null and public.current_role() is distinct from 'admin'::public.app_role and (new.role is distinct from old.role or new.active is distinct from old.active or new.id<>old.id) then raise exception 'No se permite modificar permisos';end if;
 if old.role='admin' and old.active and (new.role<>'admin' or not new.active) then
 perform pg_advisory_xact_lock(723819);
 if not exists(select 1 from public.profiles where role='admin' and active and id<>old.id) then raise exception 'Debe existir al menos un administrador activo';end if;end if;
 return new;end $$;
create trigger protect_profile_update before update on public.profiles for each row execute function public.protect_profile();

-- Publishing/editing a convocatoria atomically creates a notification and durable push job for every active account.
create function public.notify_event() returns trigger language plpgsql security definer set search_path='' as $$ begin
 with notices as (insert into public.notifications(user_id,event_id,title) select id,new.id,case when TG_OP='INSERT' then 'Nueva convocatoria: ' else 'Convocatoria actualizada: ' end ||new.title from public.profiles where active returning id,user_id)
 insert into public.push_jobs(notification_id,user_id) select id,user_id from notices;return new;end $$;
create trigger event_notification after insert or update on public.events for each row execute function public.notify_event();
create function public.protect_notice() returns trigger language plpgsql security definer set search_path='' as $$ begin
 if public.current_role() is distinct from 'admin'::public.app_role and (new.user_id<>old.user_id or new.event_id<>old.event_id or new.title<>old.title or new.id<>old.id) then raise exception 'Solo se puede cambiar el estado de lectura';end if;return new;end $$;
create trigger notice_read_only before update on public.notifications for each row execute function public.protect_notice();

do $$ declare t text;begin foreach t in array array['profiles','members','events','responses','vacations','benefits','settings','notifications','push_subscriptions','push_jobs','audit_log'] loop
 execute format('alter table public.%I enable row level security',t);
 execute format('revoke all on public.%I from anon, authenticated',t);
 end loop;end $$;
grant select,update on public.profiles to authenticated;
grant select,insert,update,delete on public.members,public.events,public.responses,public.vacations,public.benefits,public.settings,public.push_subscriptions to authenticated;
grant select,update on public.notifications to authenticated;
grant select on public.audit_log to authenticated;
grant all on public.profiles,public.members,public.events,public.responses,public.vacations,public.benefits,public.settings,public.notifications,public.push_subscriptions,public.push_jobs,public.audit_log to service_role;
grant usage,select on sequence public.audit_log_id_seq to service_role;

create policy profile_read on public.profiles for select to authenticated using(id=auth.uid() or public.is_manager());
create policy profile_write on public.profiles for update to authenticated using(public.current_role()='admin' or (id=auth.uid() and public.current_role() is not null)) with check(public.current_role()='admin' or id=auth.uid());
do $$ declare t text;begin foreach t in array array['members','benefits','settings'] loop
 execute format('create policy read_active on public.%I for select to authenticated using(public.current_role() is not null)',t);
 execute format('create policy admin_write on public.%I for all to authenticated using(public.current_role() = ''admin'') with check(public.current_role() = ''admin'')',t);
 end loop;end $$;
create policy events_read on public.events for select to authenticated using(public.current_role() is not null);
create policy events_write on public.events for all to authenticated using(public.is_manager()) with check(public.is_manager());
do $$ declare t text;begin foreach t in array array['responses','vacations'] loop
 execute format('create policy private_read on public.%I for select to authenticated using(public.is_manager() or (user_id=auth.uid() and public.current_role() is not null))',t);
 execute format('create policy own_write on public.%I for all to authenticated using(public.current_role() = ''admin'' or (user_id=auth.uid() and public.current_role() is not null)) with check(public.current_role() = ''admin'' or (user_id=auth.uid() and public.current_role() is not null))',t);
 end loop;end $$;
create policy notices_read on public.notifications for select to authenticated using(user_id=auth.uid() and public.current_role() is not null);
create policy notices_update on public.notifications for update to authenticated using(user_id=auth.uid() and public.current_role() is not null) with check(user_id=auth.uid() and public.current_role() is not null);
create policy push_own on public.push_subscriptions for all to authenticated using(user_id=auth.uid() and public.current_role() is not null) with check(user_id=auth.uid() and public.current_role() is not null);
create policy audit_admin on public.audit_log for select to authenticated using(public.current_role()='admin');

create function public.audit_change() returns trigger language plpgsql security definer set search_path='' as $$ begin
 insert into public.audit_log(actor,table_name,record_id,operation) values(auth.uid(),TG_TABLE_NAME,coalesce(new.id::text,old.id::text),TG_OP);return coalesce(new,old);end $$;
do $$ declare t text;begin foreach t in array array['profiles','members','events','responses','vacations','benefits','settings'] loop
 execute format('create trigger audit after insert or update or delete on public.%I for each row execute function public.audit_change()',t);end loop;end $$;

-- Worker-only claim uses SKIP LOCKED to avoid simultaneous deliveries.
create function public.claim_push_jobs() returns setof public.push_jobs language sql security definer set search_path='' as $$
 update public.push_jobs set attempts=attempts+1,available_at=now()+interval '5 minutes' where id in (select id from public.push_jobs where completed_at is null and attempts<5 and available_at<=now() order by available_at for update skip locked limit 50) returning *;
$$;
revoke all on function public.claim_push_jobs() from public,anon,authenticated;
grant execute on function public.claim_push_jobs() to service_role;
revoke all on function public.on_signup(),public.protect_profile(),public.notify_event(),public.protect_notice(),public.audit_change() from public,anon,authenticated;
alter publication supabase_realtime add table public.notifications;
commit;
