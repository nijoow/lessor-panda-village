# 코드 구조

- `src/domain`: 이동·충돌·상호작용 규칙, 입력값 검증
- `src/components/world`: 캐릭터·마을 렌더링
- `src/constants/world`: 건물·벤치·대나무 배치. 렌더링·충돌·미니맵에서 함께 사용
- `src/runtime/worldFrameState.ts`: 프레임마다 바뀌는 위치·자세
- `src/stores`: 그래픽 설정·채팅·수확 등 화면 상태
- `src/lib/guestbook`: 쪽지 조회·작성·삭제, 캐시와 재시도
- `src/lib/multiplayer`: 채널 연결과 이동·채팅 전송
- `supabase/migrations`: DB 스키마와 접근 권한

## 플레이어와 실시간 통신

- `PlayerController`가 입력에 따라 위치·자세·상호작용을 계산하고, 훅에서 화면과 오디오에 반영
- 공유 채널 `world:panda-village`는 접속자 탐색과 쪽지 갱신 알림에 사용
- 이동·채팅은 `world:panda-village:player:<auth.uid()>` 비공개 채널로 전송
- 발신자는 메시지 본문이 아닌 구독 채널의 사용자 ID로 확인
- 연결이 끊겨도 불러온 마을은 산책 가능. 채팅·쪽지 작성에는 서버 연결 필요

## 쪽지

- Supabase 익명 인증 사용. 본인 프로필·쪽지만 수정 가능
- 작성 요청 ID로 중복 저장 방지, 작성 간격은 5초
- 작성 당시 닉네임·색상은 쪽지에 저장. 계정 삭제 후에도 쪽지 내용 유지
- 죽순 수확은 로컬 상태이며 새로고침하면 초기화

## 3D 에셋

- 원본 파일은 `assets/`, 배포 파일은 `public/`, 공통 경로는 `src/constants/assets.json`에서 관리합니다.
- `pnpm player:rebuild`: 플레이어 모델, 애니메이션, LOD 생성 및 검증
- `pnpm scenery:optimize`: 경관 모델 최적화 및 검증
