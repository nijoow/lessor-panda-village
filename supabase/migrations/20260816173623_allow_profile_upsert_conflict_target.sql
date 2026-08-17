-- 입장이 불가능하던 문제를 고친다.
--
-- 앱은 프로필을 upsert하고, PostgREST는 이를
-- `insert ... on conflict (user_id) do update set user_id = ..., nickname = ..., updated_at = ...`
-- 로 번역한다. user_id에 update 권한이 없어 Postgres가 계획 단계에서
-- 42501(permission denied)로 거부했고, 충돌이 없는 첫 입장에서도 똑같이
-- 실패해 아무도 월드에 들어올 수 없었다.
--
-- RLS 정책이 using과 with check 양쪽에서 user_id = auth.uid()를 강제하므로,
-- 컬럼 권한을 넓혀도 자기 행을 타인 것으로 바꾸거나 타인 행을 수정할 수는
-- 없다. 실제 보안 경계는 계속 RLS가 담당한다.

grant update (user_id) on table public.world_profiles to authenticated;
