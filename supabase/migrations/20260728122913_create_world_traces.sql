create table public.world_traces (
  id uuid primary key default gen_random_uuid(),
  world_key text not null default 'panda-village'
    constraint world_traces_world_key_v1
    check (world_key = 'panda-village'),
  place_id text not null
    constraint world_traces_place_id_format
    check (place_id ~ '^[a-z0-9][a-z0-9:_-]{0,63}$'),
  author_id uuid not null references auth.users(id) on delete cascade,
  body text not null
    constraint world_traces_body_length
    check (char_length(btrim(body)) between 1 and 80),
  client_request_id uuid not null,
  created_at timestamptz not null default now(),
  deleted_at timestamptz,
  schema_version smallint not null default 1
    constraint world_traces_schema_version_v1
    check (schema_version = 1),
  constraint world_traces_author_request_unique
    unique (author_id, client_request_id)
);

create index world_traces_active_place_created_idx
on public.world_traces (place_id, created_at desc)
where deleted_at is null;

alter table public.world_traces enable row level security;
