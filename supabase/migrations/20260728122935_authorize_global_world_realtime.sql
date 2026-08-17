create policy "world visitors can receive realtime"
on realtime.messages
for select
to authenticated
using (
  realtime.messages.extension in ('broadcast', 'presence')
  and (select realtime.topic()) = 'world:panda-village'
);

create policy "world visitors can send realtime"
on realtime.messages
for insert
to authenticated
with check (
  realtime.messages.extension in ('broadcast', 'presence')
  and (select realtime.topic()) = 'world:panda-village'
);
