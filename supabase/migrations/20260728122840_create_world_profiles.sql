create table public.world_profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  nickname text not null
    constraint world_profiles_nickname_length
    check (char_length(nickname) between 1 and 10),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  schema_version smallint not null default 1
    constraint world_profiles_schema_version_v1
    check (schema_version = 1)
);

alter table public.world_profiles enable row level security;
