\set ON_ERROR_STOP on
begin;
insert into auth.users(id,raw_user_meta_data) values
 ('00000000-0000-4000-8000-000000000001','{"name":"Admin","role":"admin"}'),
 ('00000000-0000-4000-8000-000000000002','{"name":"Delegate A"}'),
 ('00000000-0000-4000-8000-000000000003','{"name":"Delegate B"}'),
 ('00000000-0000-4000-8000-000000000004','{"name":"Secretary"}');
do $$ begin if exists(select 1 from public.profiles where active or role<>'delegado') then raise exception 'Signup privilege escalation';end if;end $$;
update public.profiles set active=true;
update public.profiles set role='admin' where id='00000000-0000-4000-8000-000000000001';
update public.profiles set role='secretario' where id='00000000-0000-4000-8000-000000000004';
insert into public.vacations(user_id,start_date,end_date) values('00000000-0000-4000-8000-000000000003','2027-01-01','2027-01-15');
set local role authenticated;
set local request.jwt.claim.sub='00000000-0000-4000-8000-000000000002';
do $$ begin
 if (select count(*) from public.profiles)<>1 then raise exception 'Profile leakage';end if;
 if (select count(*) from public.vacations)<>0 then raise exception 'Vacation leakage';end if;
 begin update public.profiles set role='admin' where id=auth.uid();raise exception 'Self escalation allowed';exception when raise_exception then if SQLERRM='Self escalation allowed' then raise;end if;end;
 begin insert into public.events(title,description,date,location,category) values('Forbidden','x',now(),'x','Plenario');raise exception 'Delegate created event';exception when insufficient_privilege then null;end;
 begin insert into public.vacations(user_id,start_date,end_date) values('00000000-0000-4000-8000-000000000003','2027-02-01','2027-02-03');raise exception 'Delegate changed another vacation';exception when insufficient_privilege then null;end;
end $$;
update public.profiles set building='Edificio personal' where id=auth.uid();
insert into public.vacations(user_id,start_date,end_date) values(auth.uid(),'2027-03-01','2027-03-15');
do $$ begin begin insert into public.vacations(user_id,start_date,end_date) values(auth.uid(),'2027-03-10','2027-03-20');raise exception 'Overlap accepted';exception when exclusion_violation then null;end;end $$;
set local request.jwt.claim.sub='00000000-0000-4000-8000-000000000004';
do $$ begin if(select count(*) from public.vacations)<>2 then raise exception 'Secretary cannot read coverage';end if;end $$;
insert into public.events(id,title,description,date,location,category) values('00000000-0000-4000-8000-000000000005','Plenario de prueba','Test',now()+interval '1 day','Sede Central','Plenario');
do $$ begin begin insert into public.members(first_name,last_name,file_number,building,area,position,management,start_time,end_time,phone) values('Secretario','No autorizado','9','A','A','A','A','08:00','15:00','1');raise exception 'Secretary wrote member';exception when insufficient_privilege then null;end;end $$;
set local request.jwt.claim.sub='00000000-0000-4000-8000-000000000002';
do $$ begin
 if (select count(*) from public.notifications)<>1 then raise exception 'Notifications not scoped to user';end if;
 begin insert into public.responses(event_id,user_id,status,reason) values('00000000-0000-4000-8000-000000000005',auth.uid(),'no','');raise exception 'Empty rejection accepted';exception when check_violation then null;end;
end $$;
insert into public.responses(event_id,user_id,status,reason) values('00000000-0000-4000-8000-000000000005',auth.uid(),'no','Tengo un compromiso previo.');
update public.notifications set read=true where user_id=auth.uid();
set local request.jwt.claim.sub='00000000-0000-4000-8000-000000000001';
insert into public.members(first_name,last_name,file_number,building,area,position,management,start_time,end_time,phone) values('Afiliado','Prueba','1','A','A','A','A','08:00','15:00','1');
do $$ begin if(select count(*) from public.responses)<>1 then raise exception 'Admin cannot read attendance';end if;end $$;
reset role;
do $$ begin
 if(select count(*) from public.notifications)<>4 then raise exception 'Fanout failed';end if;
 if(select count(*) from public.push_jobs)<>4 then raise exception 'Push queue failed';end if;
 if(select count(*) from public.audit_log)=0 then raise exception 'Audit failed';end if;
end $$;
rollback;
select 'All database permission tests passed' as result;
