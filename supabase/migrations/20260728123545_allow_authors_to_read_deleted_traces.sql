drop policy "world visitors can read active traces"
on public.world_traces;

create policy "world visitors can read visible traces"
on public.world_traces
for select
to authenticated
using (
  world_key = 'panda-village'
  and (
    deleted_at is null
    or author_id = (select auth.uid())
  )
);
