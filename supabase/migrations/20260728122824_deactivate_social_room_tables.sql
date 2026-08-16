drop policy if exists "members can read their rooms"
on public.social_rooms;

drop policy if exists "members can read their own memberships"
on public.room_members;

drop policy if exists "members can update their own nickname"
on public.room_members;

revoke all on table public.social_rooms from anon, authenticated;
revoke all on table public.room_members from anon, authenticated;

comment on table public.social_rooms is
  'Deprecated room data retained only as migration history.';
comment on table public.room_members is
  'Deprecated room data retained only as migration history.';
