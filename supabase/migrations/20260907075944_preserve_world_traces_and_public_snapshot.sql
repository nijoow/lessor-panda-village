-- Keep public traces after anonymous accounts or profiles are cleaned up.
alter table public.world_traces
  add column author_nickname text,
  add column author_color_key uuid;

update public.world_traces as trace
set author_nickname = profile.nickname,
    author_color_key = trace.author_id
from public.world_profiles as profile
where profile.user_id = trace.author_id;

alter table public.world_traces
  alter column author_nickname set not null,
  alter column author_color_key set not null,
  add constraint world_traces_author_nickname_length
    check (char_length(btrim(author_nickname)) between 1 and 10),
  alter column author_id drop not null,
  drop constraint world_traces_author_id_fkey,
  drop constraint world_traces_author_profile_fk,
  add constraint world_traces_author_id_fkey
    foreign key (author_id) references auth.users(id) on delete set null,
  add constraint world_traces_author_profile_fk
    foreign key (author_id) references public.world_profiles(user_id) on delete set null;

-- Do not grant INSERT/UPDATE on snapshot fields. The invoker trigger reads the
-- visitor's own profile and traces using the existing SELECT/RLS permissions.
create or replace function public.prepare_world_trace()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
declare
  visitor uuid := auth.uid();
begin
  if visitor is null or new.author_id is distinct from visitor then
    raise exception 'world_trace_author_invalid' using errcode = '42501';
  end if;
  if new.place_id is distinct from 'village:guestbook' then
    raise exception 'world_trace_place_invalid' using errcode = '22023';
  end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(visitor::text, 731));
  -- A committed retry must reach the unique constraint even inside the cooldown.
  -- The client checks the saved request's author, place and body before success.
  if not exists (
    select 1 from public.world_traces
    where author_id = visitor and client_request_id = new.client_request_id
  ) and exists (
    select 1 from public.world_traces
    where author_id = visitor
      and created_at > pg_catalog.clock_timestamp() - interval '5 seconds'
  ) then
    raise exception 'world_traces_rate_limit' using errcode = 'P0001';
  end if;
  select nickname into new.author_nickname
    from public.world_profiles where user_id = visitor;
  if new.author_nickname is null then
    raise exception 'world_profile_required' using errcode = '42501';
  end if;
  new.author_color_key := visitor;
  new.created_at := pg_catalog.clock_timestamp();
  return new;
end;
$$;
revoke all on function public.prepare_world_trace() from public, anon, authenticated;
create trigger prepare_world_trace_before_insert
before insert on public.world_traces
for each row execute function public.prepare_world_trace();

create index world_traces_author_created_idx
on public.world_traces (author_id, created_at desc);

-- This deliberately public, bounded projection supports reading real traces
-- before Auth is available. Base tables remain inaccessible to the anon role.
create schema if not exists world_private;
revoke all on schema world_private from public, anon, authenticated;
grant usage on schema world_private to anon, authenticated;

-- Matches getNicknameColor's signed 32-bit JS hash without exposing the UUID.
create function world_private.trace_color_index(color_key uuid)
returns integer
language plpgsql
immutable strict
security invoker
set search_path = ''
as $$
declare
  value bigint := 0;
  source text := color_key::text;
  position integer;
begin
  for position in 1..pg_catalog.length(source) loop
    value := (value * 31 + pg_catalog.ascii(pg_catalog.substr(source, position, 1))) % 4294967296;
  end loop;
  if value >= 2147483648 then value := value - 4294967296; end if;
  return (pg_catalog.abs(value) % 10)::integer;
end;
$$;
revoke all on function world_private.trace_color_index(uuid) from public, anon, authenticated;

-- SECURITY DEFINER is restricted to this fixed public projection. It accepts no
-- identifiers, cannot mutate anything, and does not expose deleted rows/UIDs.
create function world_private.read_world_snapshot()
returns table (id uuid, body text, created_at timestamptz, author_nickname text, author_color_index integer)
language sql
stable
security definer
set search_path = ''
as $$
  select trace.id, trace.body, trace.created_at, trace.author_nickname,
    world_private.trace_color_index(trace.author_color_key)
  from public.world_traces as trace
  where trace.world_key = 'panda-village'
    and trace.place_id = 'village:guestbook'
    and trace.deleted_at is null
  order by trace.created_at desc, trace.id desc
  limit 50;
$$;
revoke all on function world_private.read_world_snapshot() from public, anon, authenticated;
grant execute on function world_private.read_world_snapshot() to anon, authenticated;

create function public.read_world_snapshot()
returns table (id uuid, body text, created_at timestamptz, author_nickname text, author_color_index integer)
language sql
stable
security invoker
set search_path = ''
as $$ select * from world_private.read_world_snapshot(); $$;
revoke all on function public.read_world_snapshot() from public, anon, authenticated;
grant execute on function public.read_world_snapshot() to anon, authenticated;
