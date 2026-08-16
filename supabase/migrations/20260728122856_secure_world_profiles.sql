revoke all on table public.world_profiles from anon, authenticated;

grant select on table public.world_profiles to authenticated;
grant insert (user_id, nickname, updated_at)
  on table public.world_profiles to authenticated;
grant update (nickname, updated_at)
  on table public.world_profiles to authenticated;

create policy "world visitors can read profiles"
on public.world_profiles
for select
to authenticated
using (true);

create policy "world visitors can create their own profile"
on public.world_profiles
for insert
to authenticated
with check (user_id = (select auth.uid()));

create policy "world visitors can update their own profile"
on public.world_profiles
for update
to authenticated
using (user_id = (select auth.uid()))
with check (user_id = (select auth.uid()));
