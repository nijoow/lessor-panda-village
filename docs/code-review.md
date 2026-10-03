# 전체 코드 검토

검토 기준: 코드 품질, 추상화 수준, 캡슐화, 응집도, 결합도, SSOT, 비동기 상태 일관성, 리소스 소유권, 신뢰 경계.

검토 대상은 `src`의 텍스트 소스 64개, 기존 스크립트 19개, SQL 마이그레이션 18개 및 프로젝트 설정·문서다. 새 클라이언트 회귀 테스트도 검토·실행했다. 변경된 파일에 한정하지 않고 전체 수작업 코드를 읽었다. 의존성 내부와 바이너리 에셋은 소스 리뷰 범위에서 제외했으며, 에셋은 기존 검증기로 별도 확인했다. 파일 목록은 끝에 기록했다.

## 판단

기능별 디렉터리와 월드 배치 데이터의 분리는 적절하다. 가장 큰 개선 지점은 **상태를 누가 소유하고 어떤 경로로 변경하는가**다. `Player`에는 여러 기능의 의사결정이 집중되어 있고, 방명록과 프레임 상태는 여러 소비자가 내부 표현을 알아야 갱신할 수 있다. 이번에 수정한 삭제 경쟁 조건과 그림자 구독 오류는 이 경계가 약할 때 생기는 실제 사례다.

3~4명 규모의 WebGL 월드에 맞춰 현재의 프레임 루프와 Zustand를 유지하면서 책임과 변경 API를 분리하는 방향을 권한다. 아래 설계 개선은 후속 작업이다. 이번 변경은 재현된 버그 4건과 회귀 테스트에 집중했다.

## 이번에 수정한 오류

| 오류 | 원인과 수정 | 회귀 검사 |
| --- | --- | --- |
| 삭제한 쪽지가 다시 나타남 | `useGuestbook.remove`가 진행 중인 조회를 무효화하지 않았다. 삭제 확인 후 조회 토큰을 갱신하고, 목록·전역 상태·캐시에서 제거한 뒤 다시 조회한다. | 이전 조회의 성공·실패, 삭제 실패, 삭제 후 재조회 실패 |
| 화면 밖에서 이동한 상대가 오래된 위치부터 보간됨 | `RemotePlayer`가 보이지 않을 때 초기화 여부를 유지했다. 숨김·데이터 소실 후 다시 보이면 최신 위치와 회전에 바로 맞추고 이후 보간한다. | 화면 재진입, 데이터 복구, 계속 보이는 상대의 보간 유지 |
| ±π 경계에서 먼 방향으로 회전함 | JavaScript의 음수 나머지를 정규화하지 않았다. `lerpAngle`의 차이를 양수 나머지로 정규화한 후 최단 호를 선택한다. | 양방향 경계 통과와 누적 회전 |
| 죽순 수확·재생성 후 그림자가 갱신되지 않음 | 그림자 구독이 내부에서 직접 변경하는 동일한 `Set` 참조를 비교했다. 불변 갱신되는 `harvestedIds`를 구독 기준으로 사용한다. | 실제 수확 store의 수확·재생성 모두 그림자 revision 증가 |

삭제 후 재조회는 패널의 페이지를 첫 페이지로 갱신한다. 재조회가 실패해도 확인된 삭제를 되돌리지 않고, 수정한 캐시를 유지하면서 조회 오류를 표시한다.

## 개선 우선순위

### 1. Player의 제어·상호작용·표현 책임 분리 — 높음

근거: `src/components/world/Player.tsx:245`, `src/components/ui/InteractionPrompt.tsx:24`, `src/utils/collision.ts:14`.

`Player`는 입력, 클릭 경로, 좌석 선택, 점프·이동·충돌, 방명록·수확, 애니메이션, 소리, 존·미니맵 상태, 그림자, 네트워크 전송, 카메라 추적을 함께 처리한다. 로컬 모듈 13개와 store 6개에 직접 의존한다. 고수준의 “무엇을 할 것인가”와 Three.js·네트워크·저장소의 “어떻게 반영하는가”가 같은 프레임 콜백에 있다.

상호작용 우선순위도 프롬프트와 제어기에 각각 있다. 규칙을 변경하면 표시 버튼과 E 키 동작을 함께 확인해야 한다. 클릭 이동과 이모트는 입력 차단 중 요청을 소비하는 방식도 서로 다르므로, 요청을 보류할지 폐기할지 정책을 명시해야 한다.

권장 변경:

- 이동·점프 계산, 상호작용 선택, 애니메이션 선택을 순수 함수로 분리한다.
- 제어기는 프레임 입력과 월드 상태를 받아 pose 및 발생한 이벤트를 반환한다.
- React/R3F 어댑터에서 store·오디오·브로드캐스트에 이벤트를 반영하고 카메라 추적은 별도 훅에 둔다.
- `InteractionPrompt`도 동일한 상호작용 선택 결과를 소비한다.
- 충돌 함수는 수확 여부를 store에서 직접 읽기보다 명시적인 조회 함수나 월드 상태 인자를 받게 한다.

프레임마다 React 상태를 갱신할 필요는 없다. 현재 scratch 객체와 ref 재사용, 변경된 pose만 제한된 주기로 전송하는 최적화는 유지할 가치가 있다.

### 2. 방명록 데이터 갱신의 소유자 명확화 — 높음

근거: `src/hooks/useGuestbook.ts:28`, `src/hooks/useGuestbook.ts:38`, `src/hooks/useGuestbook.ts:103`, `src/stores/guestbookStore.ts:43`, `src/lib/guestbook.ts`.

훅 하나가 DB 조회, 공개 스냅샷, 캐시, 페이지 커서, 내 쪽지 필터, 요청 중복 방지, 죽순 차감, 상대 알림, UI 오류를 처리한다. 같은 쪽지에 대한 갱신이 `visibleNotes`, 전역 `notes`, localStorage에 수동으로 전파된다. 삭제 오류를 수정해도 다른 mutation을 추가할 때 같은 동기화 규칙을 다시 지켜야 한다.

게시판의 최근 쪽지와 패널의 필터·페이지 목록은 목적이 다른 projection이다. 이를 무조건 하나의 배열로 합치는 것보다 원본 데이터와 query 결과의 소유자를 명확히 하는 것이 중요하다.

권장 변경:

- Supabase 조회·mutation을 repository 함수로, localStorage 읽기·쓰기를 cache 모듈로 분리한다.
- 쪽지 snapshot과 mutation의 적용을 한 경계에서 처리한다. `applySnapshot`, `confirmDeletion`처럼 의도를 드러내는 API로 쪽지·상태·캐시 시각을 함께 갱신한다.
- 패널 페이지·필터는 query 상태로 유지하고, 게시판은 최근 쪽지 projection을 읽는다.
- 조회 무효화와 idempotency 규칙은 해당 경계에서 관리하고 훅은 UI 흐름을 조율한다.

### 3. 프레임 상태의 내부 표현 숨기기 — 높음

근거: `src/stores/zoneStore.ts:17`, `src/stores/graphicsStore.ts:25`, `src/stores/harvestStore.ts:18`, `src/components/world/Player.tsx:560`, `src/components/Scene.tsx:138`.

플레이어 위치·회전은 zone store, 높이는 graphics store, 이모트 여부는 다시 zone store에 있다. 쓰는 쪽과 읽는 쪽 모두 여러 store의 내부 구조를 알아야 한다. `runtime.shadowRevision += 1`도 여러 렌더링 컴포넌트에서 직접 실행한다.

수확 store의 불변 배열과 가변 Set은 렌더 구독과 O(1) 충돌 조회라는 서로 다른 요구를 충족한다. 그러나 외부 코드가 표현 차이를 알아야 정확히 구독할 수 있고, 실제로 이번 그림자 오류가 발생했다.

권장 변경은 플레이어 프레임 상태의 소유자를 하나로 정하고 `publishPose`, `readPose`, `invalidateShadows`, `isHarvested`, 수확 revision 같은 API를 제공하는 것이다. 비반응형 객체는 계속 사용할 수 있지만 외부에서 필드를 직접 변경하는 경로는 제한한다. 존 배너 상태와 그래픽 설정은 각 기능의 store에 남긴다.

### 4. Realtime 발신자와 payload ID의 신뢰 경계 — 높음

근거: `src/hooks/useMultiplayer.ts:178`, `src/hooks/useMultiplayer.ts:204`, `supabase/migrations/20260728122935_authorize_global_world_realtime.sql:10`.

수신자는 `payload.id`가 presence 목록에 있는지만 확인한다. 현재 SQL 정책은 인증 사용자가 지정된 topic에 접속·전송하도록 허용하지만 payload의 ID를 실제 JWT 사용자와 묶지 않는다. 따라서 이 코드의 검증만으로는 다른 접속자의 ID·닉네임을 넣은 채팅이나 이동 메시지를 구분할 수 없다. presence key도 클라이언트가 지정한다.

좌표·길이·애니메이션 검증은 좋은 입력 방어지만 작성자 인증과는 별개다. 공개 접속에서 작성자 신뢰가 필요하다면 서버가 인증한 발신자 정보를 수신자가 검증할 수 있는 전송 경계를 마련해야 한다. 채팅은 인증된 서버 경유 전송을 검토하고, 이동·presence도 동일한 신뢰 요구를 명시해야 한다. 클라이언트에서 ID를 한 번 더 비교하는 것만으로 해결되지 않는다.

이는 정적 검토에서 확인한 프로토콜 한계이며 실서버 공격 검증은 수행하지 않았다. 이번 변경에서는 서버·프로토콜을 변경하지 않았다. 방명록은 알림 payload의 내용을 믿지 않고 RLS가 적용된 DB에서 다시 읽으므로 이 문제와 경계가 다르다.

### 5. 도메인 상수·타입과 배치 데이터의 SSOT 정리 — 중간

근거: `src/hooks/useGlobalWorld.ts:7`, `src/components/ui/GuestbookPanel.tsx:6`, `src/stores/guestbookStore.ts:4`, `src/components/world/Player.tsx:31`, `src/types/multiplayer.ts:16`, `src/constants/world/index.ts:91`, `src/components/world/Particles.tsx:15`.

`GLOBAL_WORLD_KEY`는 인증 훅에, 쪽지 타입·비용·표시 슬롯 수는 Zustand store에, 키보드 Controls는 렌더 컴포넌트에 있다. UI가 글자 수 상수를 얻으려고 데이터 조회 훅을 import한다. `lib/guestbook`도 타입을 store에서 가져온다. 타입 전용 import는 런타임 결합을 만들지는 않지만 도메인 계약의 위치가 저장 구현에 종속된다.

중립적인 도메인 모듈에 타입·정책 상수를 두고 UI·훅·store가 함께 읽게 한다. pose는 `Player` prop과 `PlayerState`에 중복된 형태 대신 공통 타입을 쓰고, 내부 애니메이션 값에는 `PlayerAnimType`을 사용하면 오타를 컴파일 단계에서 잡을 수 있다.

월드 배치에서 collision과 minimap을 도출하는 현재 구조는 좋은 SSOT다. 다만 아래 값은 별도로 관리한다.

- 마을 고목 배치는 `(-1, 6)`이지만 꽃잎 중심과 고목 주석이 붙은 나비 앵커는 `(-6, 5)`다. 효과 중심이 나무 배치를 따를 의도라면 배치에서 도출해야 한다.
- 벤치 시각 치수, 충돌 반폭·반깊이, 좌석 오프셋이 각 파일에 있다. 관련 규격을 한 정의에서 도출하면 크기 변경 시 상호작용을 함께 맞출 수 있다.
- 집·게시판의 수동 충돌 박스는 위치·크기와의 관계를 검증할 계약이 필요하다. 시각 bbox와 충돌 범위가 의도적으로 다를 수 있으므로 무조건 동일하게 만들 필요는 없다.
- 모델 URL·노드 이름·scale과 스크립트의 입출력 경로는 공통 에셋 manifest 후보다.
- 그래픽 preset의 `shadows`와 별도의 low 품질 분기, 서버 route의 `50`과 `NOTE_PAGE_SIZE`는 변경 시 함께 점검해야 한다.

SQL과 프런트엔드의 세계 ID·장소 ID·길이 제한은 언어 경계를 넘어 공유되는 계약이다. 적용된 migration을 다시 편집하지 말고 현재 계약을 문서화·검증하는 테스트로 차이를 잡는다. 경계마다 수행하는 입력 검증은 유지한다.

### 6. Environment의 추상화 수준과 렌더링 정책 분리 — 중간

근거: `src/components/world/Environment.tsx:49`, `src/components/world/Environment.tsx:717`, `src/components/world/Environment.tsx:1024`, `src/components/world/DistanceCulledGroup.tsx:21`, `src/components/world/RemotePlayer.tsx:52`.

`Environment`는 도형 생성, 절차적 배치, 개별 시설물 표현, 정적 인스턴스 기록, GPU 데이터 압축, culling, 월드 조합을 함께 담는다. 파일 길이 자체보다 변경 이유가 다른 계층들이 섞여 있다는 점이 문제다.

공통 인스턴스 렌더링·culling, 식생, 시설물, 최상위 조합으로 책임을 나누는 것이 적절하다. 여러 culling 구현에서 사용하는 fog far·view-space depth·margin의 공통 계산은 공유할 수 있다. 정적 그룹·인스턴스·이동 캐릭터는 경계와 갱신 주기가 다르므로 모든 기능을 하나의 범용 훅으로 합칠 필요는 없다.

Three.js 리소스는 소유권도 함께 명시한다. GLTF에서 공유하는 geometry·material, 카메라 가림을 위해 복제한 material, 직접 생성한 texture는 수명이 다르다. `useCameraOccluder`의 복제·정리 패턴은 좋은 예다. `Ground`의 texture clone, `River`의 CanvasTexture, 전역 오디오 타이머·oscillator는 월드 재마운트 시 유지할지 해제할지 계약을 보강할 후보다. 현재 리뷰만으로 메모리 누수를 실측했다고 판단하지는 않는다.

### 7. 인증 상태와 연결 상태의 조율 책임 — 중간

근거: `src/hooks/useGlobalWorld.ts:10`, `src/hooks/useMultiplayer.ts:61`, `src/app/page.tsx:135`.

인증 훅은 세션·프로필·온라인/오프라인 모드를 관리하고 multiplayer 훅은 세션을 다시 읽어 Realtime 인증·연결·재시도를 관리한다. page는 두 결과와 재시도 키, 패널 상태로 각 기능의 허용 여부를 결정한다. 인증과 transport의 책임을 구분한 점은 좋지만 전이 규칙이 여러 곳에 분산되어 있다.

인증 성공과 Realtime 연결 성공은 서로 다른 상태다. DB 쓰기가 가능한데 채팅 연결은 끊길 수 있다. 하나의 `online` boolean으로 합치기보다, 조율 경계에서 `canWriteNotes`, `canChat`, `canMoveRemotely` 같은 capability를 도출하고 각 UI가 이를 사용하게 한다. transport는 연결·취소·heartbeat를 소유하고 인증은 세션·프로필을 소유하도록 유지한다.

### 8. DB 어댑터 타입과 외부 응답 검증 — 중간

근거: `src/lib/supabase.ts:10`, `src/hooks/useGuestbook.ts:10`, `src/app/api/world-snapshot/route.ts:17`, `src/lib/guestbook.ts`.

Supabase client가 생성된 Database 타입을 사용하지 않아 조회 컬럼·쓰기 응답과 migration의 계약이 컴파일 시 연결되지 않는다. 공개 snapshot route도 배열인지 확인한 뒤 원소의 구조는 그대로 읽는다. 반면 클라이언트의 `toGuestbookNote`는 unknown 응답을 표시 타입으로 바꾸는 좋은 경계다.

Database 타입과 명시적인 DB DTO를 어댑터에 두고 query의 컬럼 선택·변환을 한 곳에서 관리한다. 서버 공개 projection도 원소의 타입을 검증하면 DB 계약 변경이나 비정상 응답을 더 명확히 처리할 수 있다. 도메인 모델에서 Supabase row 타입을 직접 사용하지 않는 편이 변경 범위를 줄인다.

### 9. 에셋 스크립트의 공통 처리와 검증 후 게시 — 중간

근거: `scripts/lib/clip-gen.mjs:55`, `scripts/add-tail-rig.mjs:68`, `scripts/fix-skin-weights.mjs:134`, `scripts/fix-face-weights.mjs:97`, `scripts/fix-fallback-weights.mjs:212`, `scripts/add-tail-rig.mjs:270`, `scripts/rebuild-player-model.mjs:21`.

GLB의 chunk 파싱, accessor 해석, padding·조립, quaternion 연산이 여러 스크립트에서 반복된다. `clip-gen`의 공통 수학·클립 생성기는 이미 유용한 경계다. 반면 과거의 가중치 수정 스크립트는 float 입력을 전제로 현재 배포 경로를 직접 수정하므로, 압축·양자화된 런타임 GLB에 적용하지 않도록 입력 형식을 분명히 제한해야 한다.

세 가지 weight 수정 스크립트와 tail rig 추가는 사후 검증보다 파일 쓰기가 먼저다. 검증이 실패하면 실패한 결과가 이미 파일에 남는다. rebuild도 런타임 디렉터리에서 여러 단계를 실행해 중간 실패 시 파일 세트가 부분 갱신될 수 있다. `optimize-base-glb`가 임시 결과를 검사하고 교체하는 방식은 더 안전하다.

공통 GLB reader/writer에서 component type·stride·normalized·압축 조건을 검증하고, 원본을 읽어 임시 출력 전체를 검증한 뒤 게시하는 흐름을 권한다. 과거 1회성 수리 도구와 반복 실행할 빌드 도구도 구분한다. 이 검토에서 에셋 재생성·쓰기 도구는 실행하지 않았다.

### 10. 테스트 경계와 작은 품질 개선 — 중간 / 낮음

근거: `scripts/tests/world-rls.mjs:29`, `scripts/tests/client-state.test.mjs`, `src/hooks/useGraphicsMonitor.ts:9`, `src/components/ui`.

DB 테스트는 권한·소유권·중복 재시도·공개 projection·계정 삭제 후 보존을 검증한다. 다만 선정한 현재 world migration과 후속 파일을 적용하며, 폐기된 room migration과 Realtime 서비스까지 포함한 전체 이력 재생은 아니다. 새 클라이언트 테스트도 실제 TypeScript 소스를 실행하지만 React 훅 스케줄링과 R3F 프레임은 제어한 모의 환경이다.

다음 검증 우선순위는 순수 제어기·상호작용 정책, 필터·페이지 조회와 mutation의 경쟁, 인증·transport 상태 전이, 실제 브라우저의 재연결·모바일 입력이다. `FrameQualityMonitor`처럼 순수 판단 로직은 React 모듈에서 분리하면 검증하기 쉽다. PGlite 테스트와 별도 서버 접근 검증 도구의 역할 구분은 유지한다.

UI의 작은 기능 컴포넌트들은 대체로 응집도가 높다. 방명록 패널의 포커스 처리, 채팅 입력의 한글 조합 처리도 확인했다. `EmoteBar`, `InventoryHUD`, 그래픽 설정 등의 긴 한 줄 JSX와 조밀한 조회 체인은 포맷을 풀어 리뷰·디버깅 가독성을 높일 수 있다. 공통 컴포넌트는 실제 반복되는 행동이 있을 때 추출하고, UI·훅·DB의 신뢰 경계 검증을 중복이라는 이유로 제거하지 않는다.

## 유지할 설계

- zone 배치를 중심으로 world 렌더링·collision·minimap 데이터를 도출하는 구조.
- 프레임 상태의 ref·scratch 객체 재사용, 공간 해시 충돌, 이동 상태 변화에 따른 전송 제한, 거리·품질에 따른 애니메이션 빈도 조절.
- GLTF 스켈레톤 복제와 mixer 정리, 카메라 가림용 material의 복제·복구·해제.
- 방명록 알림은 무효화 신호로만 사용하고 실제 내용은 DB에서 읽는 경계.
- 작성 당시 이름·색상의 불변 snapshot. 계정 삭제 후 쪽지를 보존하는 제품 요구를 충족하므로 프로필과의 중복을 무조건 정규화하지 않는다.
- RLS·컬럼 권한·서버 trigger로 소유권과 쓰기 계약을 강제하는 설계.
- 외부 설정이나 인증 실패 시 로컬 월드를 열고 읽기 전용 snapshot·캐시로 전환하는 경로.
- 정적 로컬 import 그래프에서 순환 의존을 발견하지 않았다. 순환이 없어도 의미적 결합과 변경 책임은 위 항목처럼 개선할 수 있다.

## 권장 작업 순서

1. 프레임 상태 변경 API와 방명록 mutation 적용 경계를 먼저 정리한다. 이번 오류가 발생한 경계를 좁히는 작업이다.
2. 중립 도메인 타입·상수와 공통 상호작용 선택 함수를 분리한다.
3. 이동·상호작용 제어기를 순수 로직으로 옮기고 기존 어댑터에서 연결한다. 동작별 회귀 검증을 추가한다.
4. 외부 발신자 신뢰 요구를 정하고 Realtime 전송 계약을 보강한다. 공개 배포에서 작성자 인증이 필요하면 우선순위를 앞당긴다.
5. Environment와 GLB 도구를 책임별로 나누고 에셋 검증 후 게시를 적용한다.

## 실행한 검증

| 검사 | 결과 | 범위 |
| --- | --- | --- |
| ESLint | 통과 | 프로젝트 전체 |
| TypeScript `--noEmit --incremental false` | 통과 | 전체 타입 검사 |
| Next.js production build | 통과 | 컴파일·정적 생성·route 구성 |
| `test:client` | 11/11 통과 | 위 4건의 실제 소스에 대한 모의 클라이언트 회귀 검사 |
| `test:world-db` | 25/25 통과 | 격리된 PGlite의 DB 권한·정책·trigger·snapshot 계약 |
| `player:validate` | 통과 | 플레이어 rig·geometry·가중치 계약 |
| `scenery:validate` | 통과 | 경관 GLB 디코드·기하·bbox; 실제 텍스처 표시는 범위 밖 |

같은 클라이언트 회귀 테스트를 변경 전 HEAD 소스로 구성한 임시 환경에서도 실행했다. 변경 전에는 3개 통과·8개 실패했고, 수정 후에는 11개 모두 통과했다. 임시 환경은 검사 후 삭제했다.

실서버에 쓰는 `world:verify`, 실기기 브라우저·WebGL 시각 검사, 목표 GPU의 성능 측정은 실행하지 않았다. DB migration과 에셋은 변경하지 않았다.

## 파일별 검토 범위

아래 목록은 전체 코드 읽기의 범위다. 개별 파일에 문제가 없다는 증명이나 자동 테스트의 커버리지 목록은 아니다. 각 묶음의 결과는 위 개선 항목과 유지할 설계에 반영했다.

### src/app/api/world-snapshot — 1개

- `src/app/api/world-snapshot/route.ts`

### src/app — 3개

- `src/app/globals.css`
- `src/app/layout.tsx`
- `src/app/page.tsx`

### src/components — 1개

- `src/components/Scene.tsx`

### src/components/ui — 14개

- `src/components/ui/ChatHUD.tsx`
- `src/components/ui/EmoteBar.tsx`
- `src/components/ui/GraphicsSettings.tsx`
- `src/components/ui/GuestbookPanel.tsx`
- `src/components/ui/InteractionPrompt.tsx`
- `src/components/ui/InventoryHUD.tsx`
- `src/components/ui/LoadingScreen.tsx`
- `src/components/ui/Minimap.tsx`
- `src/components/ui/NicknameOverlay.tsx`
- `src/components/ui/SoundToggle.tsx`
- `src/components/ui/VillageHeader.tsx`
- `src/components/ui/WorldFallback.tsx`
- `src/components/ui/WorldHUD.tsx`
- `src/components/ui/ZoneBanner.tsx`

### src/components/world — 13개

- `src/components/world/ChatBubble.tsx`
- `src/components/world/DistanceCulledGroup.tsx`
- `src/components/world/Environment.tsx`
- `src/components/world/Ground.tsx`
- `src/components/world/House.tsx`
- `src/components/world/NoticeBoard.tsx`
- `src/components/world/PandaModel.tsx`
- `src/components/world/Particles.tsx`
- `src/components/world/Player.tsx`
- `src/components/world/Pond.tsx`
- `src/components/world/RemotePlayer.tsx`
- `src/components/world/River.tsx`
- `src/components/world/World.tsx`

### src/constants — 2개

- `src/constants/playerAnimations.ts`
- `src/constants/rendering.ts`

### src/constants/world — 8개

- `src/constants/world/bambooGrove.ts`
- `src/constants/world/bounds.ts`
- `src/constants/world/index.ts`
- `src/constants/world/riverside.ts`
- `src/constants/world/southField.ts`
- `src/constants/world/types.ts`
- `src/constants/world/village.ts`
- `src/constants/world/wilds.ts`

### src/hooks — 7개

- `src/hooks/useCameraOccluder.ts`
- `src/hooks/useDayNightCycle.ts`
- `src/hooks/useGlobalWorld.ts`
- `src/hooks/useGraphicsMonitor.ts`
- `src/hooks/useGuestbook.ts`
- `src/hooks/useMultiplayer.ts`
- `src/hooks/useViewportHeight.ts`

### src/lib — 3개

- `src/lib/audio.ts`
- `src/lib/guestbook.ts`
- `src/lib/supabase.ts`

### src/stores — 7개

- `src/stores/chatStore.ts`
- `src/stores/graphicsStore.ts`
- `src/stores/guestbookStore.ts`
- `src/stores/harvestStore.ts`
- `src/stores/interactionStore.ts`
- `src/stores/moveTargetStore.ts`
- `src/stores/zoneStore.ts`

### src/types — 1개

- `src/types/multiplayer.ts`

### src/utils — 4개

- `src/utils/collision.ts`
- `src/utils/color.ts`
- `src/utils/math.ts`
- `src/utils/pathfinder.ts`

### scripts — 17개

- `scripts/add-tail-rig.mjs`
- `scripts/extract-clip-glb.mjs`
- `scripts/fix-face-weights.mjs`
- `scripts/fix-fallback-weights.mjs`
- `scripts/fix-skin-weights.mjs`
- `scripts/generate-emote-clips.mjs`
- `scripts/generate-idle-clip.mjs`
- `scripts/generate-player-lods.mjs`
- `scripts/generate-sit-clip.mjs`
- `scripts/optimize-base-glb.mjs`
- `scripts/optimize-scenery-glb.mjs`
- `scripts/rebuild-player-model.mjs`
- `scripts/refine-locomotion-clips.mjs`
- `scripts/rigidify-tail-weights.mjs`
- `scripts/validate-player-model.mjs`
- `scripts/validate-scenery-glb.mjs`
- `scripts/verify-world-access.mjs`

### scripts/lib — 1개

- `scripts/lib/clip-gen.mjs`

### scripts/tests — 2개

- `scripts/tests/client-state.test.mjs`
- `scripts/tests/world-rls.mjs`

### supabase/migrations — 18개

- `supabase/migrations/20260723164016_social_rooms_v1.sql`
- `supabase/migrations/20260723164041_social_rooms_v1_advisor_fixes.sql`
- `supabase/migrations/20260728122656_remove_unused_room_index.sql`
- `supabase/migrations/20260728122727_remove_room_realtime_policies.sql`
- `supabase/migrations/20260728122750_remove_social_room_functions.sql`
- `supabase/migrations/20260728122824_deactivate_social_room_tables.sql`
- `supabase/migrations/20260728122840_create_world_profiles.sql`
- `supabase/migrations/20260728122856_secure_world_profiles.sql`
- `supabase/migrations/20260728122913_create_world_traces.sql`
- `supabase/migrations/20260728122924_secure_world_traces.sql`
- `supabase/migrations/20260728122935_authorize_global_world_realtime.sql`
- `supabase/migrations/20260728123115_drop_deprecated_room_members.sql`
- `supabase/migrations/20260728123133_drop_deprecated_social_rooms.sql`
- `supabase/migrations/20260728123545_allow_authors_to_read_deleted_traces.sql`
- `supabase/migrations/20260816171257_link_world_traces_to_profiles.sql`
- `supabase/migrations/20260816173623_allow_profile_upsert_conflict_target.sql`
- `supabase/migrations/20260907075944_preserve_world_traces_and_public_snapshot.sql`
- `supabase/migrations/20260907081511_preserve_snapshot_color_mapping.sql`

### 설정·문서

- `.gitignore`
- `package.json`
- `pnpm-lock.yaml`
- `tsconfig.json`
- `eslint.config.mjs`
- `next.config.ts`
- `postcss.config.mjs`
- `README.md`
- `docs/architecture.md`

잠금 파일은 의존성·버전 설정을 확인했으며 생성된 모든 항목을 수작업 코드처럼 검토한 것은 아니다. 로컬 `AGENTS.md`의 Next.js 지침과 에셋 원본 관련 문서도 확인했다.
