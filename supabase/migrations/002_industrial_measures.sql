-- Run after 001_initial.sql in the independent Plástico Supabase project.
-- Aggregate counts only. No individual list of adherents.
begin;
create table public.industrial_measures (
 id uuid primary key default gen_random_uuid(),
 title text not null check(length(trim(title)) between 3 and 250),
 date date not null,
 description text not null default '' check(length(description)<=3000),
 closed boolean not null default false,
 buildings jsonb not null check(jsonb_typeof(buildings)='array' and jsonb_array_length(buildings)>0)
);
create table public.adhesion_reports (
 id uuid primary key default gen_random_uuid(),
 measure_id uuid not null references public.industrial_measures(id),
 building text not null,
 total integer not null check(total between 1 and 1000000),
 adherents integer not null check(adherents between 0 and total),
 user_id uuid not null references public.profiles(id),
 updated_at timestamptz not null default now(),
 unique(measure_id,building)
);
create table public.adhesion_report_history (
 id uuid primary key default gen_random_uuid(),
 report_id uuid not null references public.adhesion_reports(id),
 actor_id uuid not null references public.profiles(id),
 recorded_at timestamptz not null default now(),
 previous_values jsonb,
 current_values jsonb not null
);
create function public.can_report_adhesion(target_measure uuid,target_building text) returns boolean
language sql stable security definer set search_path='' as $$
 select coalesce(public.current_role()='delegado' and exists(
  select 1 from public.industrial_measures m,
  lateral jsonb_array_elements(m.buildings) b
  where m.id=target_measure and b->>'name'=target_building
  and (b->'reporter_ids') ? auth.uid()::text
 ),false)
$$;
revoke all on function public.can_report_adhesion(uuid,text) from public;
grant execute on function public.can_report_adhesion(uuid,text) to authenticated;

create function public.guard_measure_scope() returns trigger
language plpgsql security definer set search_path='' as $$
declare b jsonb; reporter text;
begin
 if TG_OP='UPDATE' then
  if new.id<>old.id or new.title is distinct from old.title or new.date is distinct from old.date or new.description is distinct from old.description or new.buildings is distinct from old.buildings then
   raise exception 'Solo puede cerrarse la carga; el alcance de la medida es inmutable';
  end if;
  if old.closed and not new.closed then raise exception 'No se puede reabrir una medida cerrada'; end if;
 else
  if new.closed then raise exception 'La medida debe crearse abierta'; end if;
  if (select count(*)<>count(distinct trim(value->>'name')) from jsonb_array_elements(new.buildings)) then raise exception 'Edificios duplicados'; end if;
  for b in select value from jsonb_array_elements(new.buildings) loop
   if coalesce(length(trim(b->>'name')),0)=0 or jsonb_typeof(b->'reporter_ids') is distinct from 'array' then raise exception 'Alcance inválido'; end if;
   for reporter in select jsonb_array_elements_text(b->'reporter_ids') loop
    if not exists(select 1 from public.profiles p where p.id::text=reporter and p.active and p.role='delegado' and trim(p.building)=b->>'name') then raise exception 'Delegado no asignado al edificio'; end if;
   end loop;
  end loop;
 end if;
 return new;
end $$;
revoke all on function public.guard_measure_scope() from public;
create trigger measure_scope before insert or update on public.industrial_measures for each row execute function public.guard_measure_scope();

create function public.guard_adhesion_report() returns trigger
language plpgsql security definer set search_path='' as $$
declare is_closed boolean;
begin
 -- Row lock serializes report updates against closure of the same measure.
 select closed into is_closed from public.industrial_measures where id=new.measure_id for share;
 if not found or is_closed then raise exception 'La medida no admite nuevos partes'; end if;
 if auth.uid() is null or not public.can_report_adhesion(new.measure_id,new.building) then raise exception 'No tenés un edificio asignado en esta medida'; end if;
 if TG_OP='UPDATE' and (new.id<>old.id or new.measure_id<>old.measure_id or new.building<>old.building) then raise exception 'No se puede trasladar un parte a otro edificio o medida'; end if;
 new.user_id=auth.uid(); new.updated_at=clock_timestamp();
 return new;
end $$;
revoke all on function public.guard_adhesion_report() from public;
create trigger adhesion_guard before insert or update on public.adhesion_reports for each row execute function public.guard_adhesion_report();
create function public.audit_adhesion_report() returns trigger
language plpgsql security definer set search_path='' as $$
begin
 insert into public.adhesion_report_history(report_id,actor_id,previous_values,current_values)
 values(new.id,auth.uid(),case when TG_OP='UPDATE' then to_jsonb(old) else null end,to_jsonb(new));
 return new;
end $$;
revoke all on function public.audit_adhesion_report() from public;
create trigger adhesion_audit after insert or update on public.adhesion_reports for each row execute function public.audit_adhesion_report();

alter table public.industrial_measures enable row level security;
alter table public.adhesion_reports enable row level security;
alter table public.adhesion_report_history enable row level security;
revoke all on public.industrial_measures,public.adhesion_reports,public.adhesion_report_history from anon,authenticated;
grant select,insert,update on public.industrial_measures,public.adhesion_reports to authenticated;
grant select on public.adhesion_report_history to authenticated;
create policy measure_read on public.industrial_measures for select to authenticated using(public.current_role() is not null);
create policy measure_create on public.industrial_measures for insert to authenticated with check(public.is_manager());
create policy measure_close on public.industrial_measures for update to authenticated using(public.is_manager()) with check(public.is_manager());
create policy adhesion_read on public.adhesion_reports for select to authenticated using(public.is_manager() or public.can_report_adhesion(measure_id,building));
create policy adhesion_insert on public.adhesion_reports for insert to authenticated with check(public.can_report_adhesion(measure_id,building) and user_id=auth.uid());
create policy adhesion_update on public.adhesion_reports for update to authenticated using(public.can_report_adhesion(measure_id,building)) with check(public.can_report_adhesion(measure_id,building) and user_id=auth.uid());
create policy adhesion_history_read on public.adhesion_report_history for select to authenticated using(public.is_manager());
create index adhesion_reports_measure on public.adhesion_reports(measure_id);
commit;
