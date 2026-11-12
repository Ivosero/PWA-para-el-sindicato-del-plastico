-- Apply to the independent Plástico database after migrations 001 and 002.
begin;
alter table public.profiles add column whatsapp text not null default '';
alter table public.profiles add constraint profile_whatsapp_format check (
 whatsapp='' or (length(whatsapp)<=40 and regexp_replace(whatsapp,'[[:space:]().-]','','g') ~ '^\+[1-9][0-9]{7,14}$')
);
-- Existing profile RLS and guard_profile continue to govern visibility and edits.
commit;
