# 운영 적용 기록

적용일: 2026-10-05(KST). 아래는 코드 검토·리팩터링 이후 실제 DB 적용과 운영 배포를 확인한 기록이다.

## Supabase

- 프로젝트: `panda-village` (`xxhwenfhlawztpsfvuzi`), `ACTIVE_HEALTHY`.
- 기존 18개 마이그레이션은 모두 적용되어 있었고 `authorize_player_realtime_topics` 1개를 추가 적용했다.
- 실제 서버 적용 버전: `20261004172615`. 로컬 SQL 파일명도 이 버전으로 맞췄다.
- 로컬과 실제 서버의 마이그레이션 19개 이름·버전이 모두 일치한다.
- `realtime.messages`의 RLS가 활성화되어 있고 기존 공유 채널 정책과 새 사용자별 채널 정책을 확인했다.
- 운영 DB에 설치된 실제 USING/WITH CHECK 식을 역할·JWT sub·topic·extension별로 평가했다. 자기 채널 발행, 상대 채널 수신, 상대 채널 발행 거부, 잘못된 topic 거부, 사용자 채널 presence 거부, 공유 채널 presence 허용, anon 거부 등 7개 시나리오·14개 판정이 통과했다.
- 적용 버전 정리 후 격리 PGlite 검사도 32/32 통과했다. 검증용 영구 쪽지·Auth 계정은 생성하지 않았다.

운영 DB에 직접 삽입·rollback하는 첫 Realtime probe는 현재 날짜의 messages partition이 없어 실행되지 않았다. 데이터는 남지 않았고 서비스 소유 partition을 수동 변경하지 않았다. Supabase Realtime의 tenant 연결 초기화는 messages partition을 준비하므로, SQL 연결에서 정책식만 확인한 결과와 실제 Realtime JOIN·웹소켓 검증은 구분한다. 실제 다중 접속·재연결 검증은 아직 수행하지 않았다.

## Vercel

- 기존 프로젝트: `lessor-panda-village` (`prj_OEK2isUQucEfJXDemC7mHIHFz3mc`).
- 팀: `nijoows-projects`. 기존 GitHub `nijoow/lessor-panda-village`의 `main` 운영 연결을 사용했다.
- 검토·리팩터링 커밋과 DB 이력 정리 커밋을 `main`으로 fast-forward push했다.
- 검증한 코드 커밋: `9171fb8e529d12a4d0247d6dc9495cda2be3c519`.
- 운영 배포: `dpl_6bNa4jw3GB3BqtBxbq4GBaZB3dFP`, `READY`, production, alias 오류 없음.
- 운영 URL: [lessor-panda-village.vercel.app](https://lessor-panda-village.vercel.app/).
- [배포 상세](https://vercel.com/nijoows-projects/lessor-panda-village/6bNa4jw3GB3BqtBxbq4GBaZB3dFP).
- `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`가 운영 대상에 설정된 것을 확인했다. 값은 기록하지 않는다.

Vercel 연결 도구를 통해 운영 도메인의 메인 페이지와 `/api/world-snapshot`에서 200 응답을 확인했다. API는 검증된 공개 표시 필드 5개와 snapshot 시각을 반환했고, `public, max-age=30` 캐시 계약을 유지했다. 새 배포에 한정한 최근 15분의 운영 5xx 집계는 비어 있었다. 이 검사는 Vercel 인증을 지원하는 도구를 사용했으며, 브라우저의 인증·전체 WebGL·웹소켓 상호작용 검사는 아니다. 기존 배포 보호 설정은 유지했다.

이 문서 기록 이후에는 앱 코드 변경 없이 문서 커밋이 추가될 수 있다. 기록한 배포는 위 코드 커밋의 동작을 검증한 배포다.

## Advisor 점검

새 DDL 이후 security·performance advisor를 실행했다. 오류 등급 항목은 없었다. 익명 로그인 접근 경고는 이 앱의 익명 인증 요구에 해당하며 자기 프로필·쪽지·발행 topic의 소유권 조건은 유지한다. 비밀번호 유출 방지 비활성 경고는 기존 설정이고 현재 앱은 비밀번호 로그인을 사용하지 않는다. 사용 이력이 없는 쪽지 조회 인덱스 3개도 정보 등급으로 보고되었으며, 조회 계약에 필요한 인덱스를 사용 통계만으로 제거하지 않았다.

- [익명 로그인 정책 점검 설명](https://supabase.com/docs/guides/database/database-advisors?queryGroups=lint&lint=0012_auth_allow_anonymous_sign_ins)
- [비밀번호 유출 방지 설정](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection)
- [미사용 인덱스 점검 설명](https://supabase.com/docs/guides/database/database-linter?lint=0005_unused_index)

## 클라이언트 갱신과 추가 확인

사용자별 Realtime topic migration을 클라이언트 배포 전에 적용했다. 이전 공유 채널의 이동·채팅 프로토콜과 새 클라이언트는 호환되지 않으므로 기존 탭은 새로고침해야 한다.

실서버 3~4인 접속·재연결과 실제 모바일 입력·목표 GPU 성능의 남은 범위는 [architecture.md](architecture.md)에 기록되어 있다. 필요한 DB 적용이나 운영 코드 배포가 미완료 상태라는 의미는 아니다.
