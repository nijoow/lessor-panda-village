-- Realtime caches these permissions at join. Authenticate the publication topic,
-- not a client-controlled body/presence key. The client binds the sender to the
-- subscribed topic and uses the shared world topic for discovery/invalidation.
create policy "world visitors can receive player broadcasts"
on realtime.messages
for select
to authenticated
using (
  realtime.messages.extension = 'broadcast'
  and (select realtime.topic()) ~ '^world:panda-village:player:[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
);

create policy "world visitors can send own player broadcasts"
on realtime.messages
for insert
to authenticated
with check (
  realtime.messages.extension = 'broadcast'
  and (select realtime.topic()) = 'world:panda-village:player:' || (select auth.uid())::text
);
