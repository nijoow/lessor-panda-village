-- 방명록 쪽지에 작성자 닉네임을 함께 읽기 위한 관계 추가.
--
-- world_traces.author_id와 world_profiles.user_id는 둘 다 auth.users(id)를
-- 참조하지만 서로 직접적인 관계가 없어, PostgREST가 한 번의 요청으로
-- 쪽지와 작성자 닉네임을 함께 가져오지 못한다. 두 테이블 사이에 명시적인
-- 외래 키를 추가해 임베딩(world_profiles(nickname))을 가능하게 한다.
--
-- 입장 흐름이 프로필을 먼저 upsert하므로 기존 행에도 위배가 없다.

alter table public.world_traces
  add constraint world_traces_author_profile_fk
  foreign key (author_id)
  references public.world_profiles(user_id)
  on delete cascade;

-- 외래 키 컬럼 인덱스 (Performance Advisor의 unindexed foreign key 대응 +
-- "내가 남긴 쪽지" 조회 경로)
create index world_traces_author_idx
on public.world_traces (author_id);
