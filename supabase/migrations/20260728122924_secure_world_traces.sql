revoke all on table public.world_traces from anon, authenticated;

grant select on table public.world_traces to authenticated;
grant insert (id, world_key, place_id, author_id, body, client_request_id)
  on table public.world_traces to authenticated;
grant update (deleted_at)
  on table public.world_traces to authenticated;

create policy "world visitors can read active traces"
on public.world_traces
for select
to authenticated
using (
  world_key = 'panda-village'
  and deleted_at is null
);

create policy "world visitors can create their own traces"
on public.world_traces
for insert
to authenticated
with check (
  author_id = (select auth.uid())
  and world_key = 'panda-village'
  and deleted_at is null
);

create policy "world visitors can soft delete their own traces"
on public.world_traces
for update
to authenticated
using (
  author_id = (select auth.uid())
  and world_key = 'panda-village'
  and deleted_at is null
)
with check (
  author_id = (select auth.uid())
  and world_key = 'panda-village'
  and deleted_at is not null
);
