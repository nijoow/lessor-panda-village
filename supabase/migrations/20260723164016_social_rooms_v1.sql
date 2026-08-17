create table public.social_rooms (
  id uuid primary key,
  invite_code text not null unique
    constraint social_rooms_invite_code_format check (invite_code ~ '^[A-F0-9]{8}$'),
  created_by uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  max_members smallint not null default 4
    constraint social_rooms_max_members_v1 check (max_members = 4),
  schema_version smallint not null default 1
    constraint social_rooms_schema_version_v1 check (schema_version = 1)
);

create table public.room_members (
  room_id uuid not null references public.social_rooms(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  nickname text not null
    constraint room_members_nickname_length check (char_length(nickname) between 1 and 10),
  role text not null default 'member'
    constraint room_members_role check (role in ('owner', 'member')),
  joined_at timestamptz not null default now(),
  primary key (room_id, user_id)
);

create index room_members_user_id_idx on public.room_members(user_id);

comment on table public.social_rooms is 'Invite-only social rooms. V1 is capped at four persistent members.';
comment on table public.room_members is 'Authenticated room membership and room-scoped display nickname.';

alter table public.social_rooms enable row level security;
alter table public.room_members enable row level security;

revoke all on table public.social_rooms from anon;
revoke all on table public.room_members from anon;
revoke all on table public.social_rooms from authenticated;
revoke all on table public.room_members from authenticated;
grant select on table public.social_rooms to authenticated;
grant select on table public.room_members to authenticated;
grant update (nickname) on table public.room_members to authenticated;

create policy "members can read their rooms"
on public.social_rooms
for select
to authenticated
using (
  exists (
    select 1
    from public.room_members membership
    where membership.room_id = social_rooms.id
      and membership.user_id = (select auth.uid())
  )
);

create policy "members can read their own memberships"
on public.room_members
for select
to authenticated
using (user_id = (select auth.uid()));

create policy "members can update their own nickname"
on public.room_members
for update
to authenticated
using (user_id = (select auth.uid()))
with check (user_id = (select auth.uid()));

create or replace function public.create_social_room(
  p_room_id uuid,
  p_nickname text
)
returns table (
  room_id uuid,
  invite_code text,
  nickname text,
  member_count integer,
  max_members integer
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_nickname text := btrim(p_nickname);
  v_existing public.social_rooms%rowtype;
  v_invite_code text;
begin
  if v_user_id is null then
    raise exception 'authentication_required' using errcode = '42501';
  end if;
  if p_room_id is null then
    raise exception 'room_id_required' using errcode = '22023';
  end if;
  if char_length(v_nickname) not between 1 and 10 then
    raise exception 'nickname_invalid' using errcode = '22023';
  end if;

  select room.* into v_existing
  from public.social_rooms room
  where room.id = p_room_id;

  if found then
    if v_existing.created_by <> v_user_id then
      raise exception 'room_id_conflict' using errcode = '23505';
    end if;

    insert into public.room_members (room_id, user_id, nickname, role)
    values (v_existing.id, v_user_id, v_nickname, 'owner')
    on conflict (room_id, user_id)
    do update set nickname = excluded.nickname;

    return query
    select
      v_existing.id,
      v_existing.invite_code,
      v_nickname,
      (select count(*)::integer from public.room_members m where m.room_id = v_existing.id),
      v_existing.max_members::integer;
    return;
  end if;

  loop
    v_invite_code := upper(encode(extensions.gen_random_bytes(4), 'hex'));
    begin
      insert into public.social_rooms (id, invite_code, created_by)
      values (p_room_id, v_invite_code, v_user_id)
      returning * into v_existing;
      exit;
    exception when unique_violation then
      if exists (select 1 from public.social_rooms room where room.id = p_room_id) then
        raise exception 'room_id_conflict' using errcode = '23505';
      end if;
    end;
  end loop;

  insert into public.room_members (room_id, user_id, nickname, role)
  values (v_existing.id, v_user_id, v_nickname, 'owner');

  return query
  select v_existing.id, v_existing.invite_code, v_nickname, 1, v_existing.max_members::integer;
end;
$$;

create or replace function public.join_social_room(
  p_invite_code text,
  p_nickname text
)
returns table (
  room_id uuid,
  invite_code text,
  nickname text,
  member_count integer,
  max_members integer
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_nickname text := btrim(p_nickname);
  v_code text := upper(btrim(p_invite_code));
  v_room public.social_rooms%rowtype;
  v_member_count integer;
begin
  if v_user_id is null then
    raise exception 'authentication_required' using errcode = '42501';
  end if;
  if v_code !~ '^[A-F0-9]{8}$' then
    raise exception 'invite_code_invalid' using errcode = '22023';
  end if;
  if char_length(v_nickname) not between 1 and 10 then
    raise exception 'nickname_invalid' using errcode = '22023';
  end if;

  select room.* into v_room
  from public.social_rooms room
  where room.invite_code = v_code
  for update;

  if not found then
    raise exception 'room_not_found' using errcode = 'P0002';
  end if;

  if exists (
    select 1 from public.room_members membership
    where membership.room_id = v_room.id
      and membership.user_id = v_user_id
  ) then
    update public.room_members
    set nickname = v_nickname
    where room_id = v_room.id and user_id = v_user_id;
  else
    select count(*)::integer into v_member_count
    from public.room_members membership
    where membership.room_id = v_room.id;

    if v_member_count >= v_room.max_members then
      raise exception 'room_full' using errcode = 'P0001';
    end if;

    insert into public.room_members (room_id, user_id, nickname, role)
    values (v_room.id, v_user_id, v_nickname, 'member');
  end if;

  select count(*)::integer into v_member_count
  from public.room_members membership
  where membership.room_id = v_room.id;

  return query
  select v_room.id, v_room.invite_code, v_nickname, v_member_count, v_room.max_members::integer;
end;
$$;

revoke all on function public.create_social_room(uuid, text) from public, anon;
revoke all on function public.join_social_room(text, text) from public, anon;
grant execute on function public.create_social_room(uuid, text) to authenticated;
grant execute on function public.join_social_room(text, text) to authenticated;

create policy "room members can receive realtime"
on realtime.messages
for select
to authenticated
using (
  realtime.messages.extension in ('broadcast', 'presence')
  and exists (
    select 1
    from public.room_members membership
    where membership.user_id = (select auth.uid())
      and ('room:' || membership.room_id::text) = (select realtime.topic())
  )
);

create policy "room members can send realtime"
on realtime.messages
for insert
to authenticated
with check (
  realtime.messages.extension in ('broadcast', 'presence')
  and exists (
    select 1
    from public.room_members membership
    where membership.user_id = (select auth.uid())
      and ('room:' || membership.room_id::text) = (select realtime.topic())
  )
);
