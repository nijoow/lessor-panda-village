# 전체 코드 검토 및 개선 결과

검토·수정일: 2026-10-03. 기준 커밋: `5c2c0e3`.

검토 기준은 코드 품질, 추상화 수준, 캡슐화, 응집도, 결합도, SSOT, 비동기 상태 일관성, 리소스 소유권과 신뢰 경계다. 변경 파일에 한정하지 않고 기존 `src` 텍스트 소스 64개, 스크립트 19개, SQL 마이그레이션 18개와 설정·문서를 읽고, 발견한 문제를 책임별로 수정·검증·커밋했다. 아래 내용은 초기 권장 목록을 실제 구현 결과로 갱신한 보고서다.

최종 검토 범위는 `src` 텍스트 파일 102개(TS/TSX 100개, CSS 1개, JSON 1개), 스크립트 30개, SQL 마이그레이션 19개와 설정·문서다. TS 파일 수에는 생성된 Database 타입 1개가 포함된다. 외부 의존성 내부·바이너리 에셋은 수작업 소스 리뷰 대상에서 제외했다. 잠금 파일은 의존성·버전 설정을 확인했고, 에셋은 파서·런타임 디코드·전체 재생성으로 별도 검사했다.

## 전체 판단

기존 월드 배치 데이터, R3F 프레임 루프, Zustand와 익명 인증 구조를 유지하면서 **의사결정, 상태 변경, 외부 효과의 소유자**를 분리했다. 초기 검토의 10개 개선 항목은 모두 구현에 반영했다. 이 범위에서 재현하거나 확인한 코드 문제는 수정했고, 수정한 경계에는 의미 있는 회귀 검증을 추가했다.

플레이어 제어는 순수 도메인 모듈, 렌더링·오디오·store 반영은 어댑터, 방명록 요청 수명은 session, SDK 접근은 repository, 프레임 데이터와 캐시는 각각 명시적인 변경 API를 사용한다. 전체 로컬 정적 import/export 그래프의 130개 모듈에서 순환 의존은 발견하지 않았다. 이는 런타임의 모든 동작을 보증하는 결과는 아니며, 실제 서버·기기 검증의 한계는 아래에 기록했다.

## 관점별 검토와 해결

| 관점 | 발견한 문제 | 최종 변경·소유자 |
| --- | --- | --- |
| 추상화 수준 | Player 프레임 콜백에 입력·충돌·상호작용·표현·전송·카메라가 혼재 | `PlayerController`가 pose·이벤트를 계산하고 `usePlayerController`가 외부 효과를 적용. 카메라·전송은 별도 훅 |
| 응집도 | Environment에 배치·기하·인스턴싱·culling·리소스 생성이 집중 | `environment`의 placements, geometry, instanceData, Structures, BambooField, CulledInstances, StaticScenery로 책임 분리 |
| 캡슐화 | 여러 store의 프레임 필드와 수확 Set을 소비자가 직접 변경 | `worldFrameState`의 읽기 전용 뷰·변경 API, 수확 store의 비공개 Set·조회 함수·revision, 오디오의 읽기 전용 muted getter |
| 결합도 | 도메인 규칙이 React·SDK·store 내부 표현에 의존 | 중립 `src/domain`과 명시적인 world·repository·cache ports. collision은 수확 조회 함수를 주입하고 앱 어댑터에서 연결 |
| SSOT | 상호작용 우선순위·벤치 치수·에셋 경로·문자 수·fog 판정이 여러 곳에 복제 | 공통 선택 함수, `BENCH_SPEC`, `assets.json`, `domain/text`, 공통 fog culling 사용 |
| 상태 일관성 | 방명록 목록·게시판·캐시 수동 동기화와 오래된 비동기 조회 | `GuestbookSession`의 조회 세대·재시도와 boardState의 확인된 mutation·snapshot 적용 경계 |
| 권한 경계 | 인증 상태와 Realtime 준비 상태를 같은 기능 권한처럼 취급 | `useVillageSession`이 DB 쓰기·채팅·원격 이동 capability를 각각 도출 |
| 외부 계약 | 무타입 DB client·검증되지 않은 공개 DTO·payload 작성자 신뢰 | 생성 Database 타입, 허용 컬럼으로 좁힌 client 타입, unknown decoder, 사용자별 인증 topic |
| 리소스 수명 | 일부 자체 생성 geometry·texture·오디오 타이머에 해제 경로 없음 | 생성 소유자에 dispose·cleanup 추가. 공유 GLTF 캐시와 자신이 소유한 복제 리소스의 수명 구분 |
| 검증·가독성 | 판단 로직이 훅 내부에 있고 긴 JSX·표현식이 변경 확인을 어렵게 함 | 순수 제어기·품질 판단과 실제 소스 회귀 검사, 전체 소스·도구 포맷 정돈, 실제 DOM 수명에 연결한 대화상자 포커스 |

### 1. 플레이어 제어·상호작용·표현

`src/domain/player`의 이동·수직 운동·근접 탐색·애니메이션 정책은 React, Three.js, Supabase, store를 import하지 않는다. `PlayerController.step`은 프레임 입력·명시적인 월드 조회에서 읽기 전용 pose·근접 결과·이벤트를 반환하며 내부 경로·좌석·키 경계·명령 카운터를 소유한다. 이 읽기 전용 결과는 프레임용 재사용 뷰이므로 장기 저장하는 어댑터는 필요한 값을 복사한다.

`Player`는 렌더 조합을 담당하고, R3F 어댑터가 store·zone·오디오·방명록·수확에 이벤트를 반영한다. `useFollowPlayer`는 카메라, `usePlayerBroadcast`는 변경된 pose의 최대 10fps 전송과 최초 발행을 관리한다. 쓰지 않던 imperative ref와 상위 컴포넌트 연결은 제거했다.

프롬프트와 E 키는 같은 `chooseInteraction` 우선순위를 사용한다. 입력 차단 중 명령과 키 경계는 소비하여 해제 후 재생하지 않는다. 클릭 경로 탐색·대각선 이동·경로 단축은 같은 충돌 정책을 사용한다. 실제 이동 거리로 발소리를 계산하며 막힌 경로는 종료한다. 추가 검토에서 발견한 대각선 모서리 진입은 X 이동을 반영한 목적지에서 Z 충돌을 검사하도록 수정했다.

### 2. 방명록 데이터와 요청 수명

기존 단일 `lib/guestbook.ts`와 큰 훅을 다음 경계로 나눴다.

- `repository`: typed SDK 조회·작성·삭제, 실제 반환 행 확인, 중복 요청의 작성자·장소·본문 일치 확인.
- `codec`: unknown 응답에서 쪽지 모델·공개 표시 DTO로 변환. UUID·본문·시각·이름·색상과 목록 크기를 검증.
- `cache`: 버전·7일 수명·저장 형식과 동일 decoder에 의한 읽기·쓰기.
- `boardState`: 게시판 projection·캐시·상태의 snapshot 및 확인된 작성·삭제 적용.
- `GuestbookSession`: 페이지·필터·커서·조회 세대·submit 상태·재시도 요청 ID.
- `useGuestbook`: React 외부 store 구독, 활성 수명과 재조회 신호 연결.

삭제나 작성이 확인되면 이전 조회를 무효화하고 게시판·캐시에 반영한다. 후속 조회가 실패해도 확인된 삭제를 복원하지 않는다. 네트워크 결과가 불명확한 작성 재시도는 같은 요청 ID를 사용하고, 성공 확인 후 죽순을 한 번 차감한다. 동시에 제출하는 호출은 차단한다.

게시판의 최근 쪽지와 패널의 내 쪽지·다음 페이지는 용도가 다른 projection으로 유지한다. 내 쪽지 필터가 공용 게시판의 원본을 덮어쓰지 않도록 별도 조회한다. 작성 당시 닉네임·색상 snapshot도 계정 삭제 후 보존 요구를 위해 유지한다.

### 3. 프레임 상태·수확 상태의 변경 경계

`zoneStore.playerPos/playerPose`와 `graphicsStore.runtime`에 흩어진 프레임 상태를 `runtime/worldFrameState`로 이동했다. 안정된 읽기 전용 뷰를 제공하며 `publishPlayer`, `invalidateShadows`, `resetPlayer`로만 갱신한다. 프레임마다 React 상태를 갱신하지 않는 방식은 유지한다.

수확 store의 충돌용 Set은 비공개이며 소비자는 `isHarvested`로 조회한다. 렌더링은 불변 배열, 그림자 신호는 revision을 구독한다. 수확·재생성의 시각 상태와 충돌 상태는 같은 소유자에서 변경한다. 중복 수확과 잘못된 죽순 차감 값도 거부한다.

### 4. 도메인 계약·배치·표시 정책의 SSOT

월드 ID, 게시판 ID, 닉네임·채팅·쪽지 길이, 쪽지 비용·페이지 크기, 플레이어 운동 상수와 중립 타입을 도메인에서 정의한다. 페이지는 임의의 첫 게시판 fallback을 복제하지 않고 같은 게시판 ID를 사용한다.

벤치 렌더링·충돌·좌석·일어서기·접근 범위는 `BENCH_SPEC`을 읽는다. 입자·나비 위치는 월드의 랜드마크 배치에서 도출한다. fog의 거리·구 경계 판정은 공유 helper를 사용해 정적 경관과 원격 플레이어의 서로 다른 hardcoded 판정을 없앴다.

문자 길이는 PostgreSQL `char_length`와 일치하도록 Unicode code point로 통일했다. 닉네임·쪽지·채팅의 검증, 표시 카운터와 절단에 같은 helper를 사용하며 UTF-16 surrogate를 자르지 않는다. 이는 grapheme cluster 수가 아니므로 결합 문자·복합 이모지는 여러 글자로 센다.

### 5. 경관 렌더링·리소스 소유권

Environment를 책임별 모듈로 분리하고 인스턴싱·거리 culling·품질별 업데이트 제한을 유지했다. 화면 가장자리에 걸친 구의 fog 판정도 공유 view-space 규칙을 사용한다.

Ground가 복제한 texture, River가 생성한 geometry·flow texture, StaticScenery와 BambooField의 자체 geometry·material, WebAudio context·연속 음원·예약 타이머에는 명시적인 정리 경로를 추가했다. `useGLTF`의 공유 에셋을 소비자 cleanup에서 해제하지 않으며, 캐릭터 스켈레톤·가림 material의 복제와 복구는 기존 소유권을 유지한다.

`FrameQualityMonitor`는 순수 클래스로 분리했다. 숨긴 탭에서 경과한 시간을 품질 판단에 넣지 않고 지속된 가시 샘플로 조정한다. 목표 GPU 성능은 실제 장비에서 추가 측정해야 한다.

### 6. Realtime 작성자 신뢰·채널 수명

Supabase Realtime의 `realtime.messages` RLS는 JOIN 권한 검사에 사용되고 권한이 연결에 캐시된다. 매 payload의 `id`를 확인하는 정책만으로 발신자를 인증할 수 없으므로 전송 계약을 변경했다.

공유 `world:panda-village` 채널은 presence 후보 탐색과 방명록 무효화에만 사용한다. 이동·채팅은 비공개 `world:panda-village:player:<auth.uid()>` 채널로 발행한다. 새 INSERT 정책은 자기 ID의 topic만 허용하며 수신자는 구독한 topic의 ID를 사용한다. payload의 작성자 ID는 사용하지 않는다.

presence는 인증된 캐릭터 정보가 아니다. 후보 발견에만 사용하며, 해당 인증 topic에서 검증된 이동을 받기 전에는 캐릭터·접속 인원에 추가하지 않는다. UUID 후보 구독은 최대 64개로 제한한다. 전체 presence meta로 사용자 퇴장을 판단해 여러 탭 중 하나가 닫혀도 나머지 탭의 캐릭터를 제거하지 않는다.

`WorldTransport`는 실제 세션 ID 확인·setAuth·채널·2초 heartbeat·오래된 콜백 무효화·정리를 소유한다. 공유 채널과 자기 발행 채널이 준비되고 track이 성공해야 연결 완료로 표시한다. 마지막 pose는 복사하여 heartbeat와 늦게 접속한 상대에게 전달한다. payload의 좌표·회전·애니메이션·텍스트는 unknown decoder에서 검증한다.

새 SQL 파일은 CLI로 생성한 뒤 실제 적용 버전에 맞춰 이름을 정리한 `supabase/migrations/20261004172615_authorize_player_realtime_topics.sql`이다. **2026-10-05(KST) 실제 Supabase 프로젝트에 적용했다.** 기존 18개를 포함해 총 19개 이력이 일치하고 운영 DB의 실제 정책식 7가지 경우·14개 판정을 확인했다. 배포 순서는 DB 적용 후 클라이언트이며 이전 프로토콜과 새 프로토콜의 이동·채팅은 호환되지 않으므로 배포 후 기존 클라이언트 새로고침이 필요하다. 기존 공유 채널 정책은 탐색과 이전 클라이언트 호환을 위해 유지한다.

### 7. 인증·연결 capability

익명 인증·프로필은 `useGlobalWorld`와 worldAccess, 전송 상태는 WorldTransport가 소유하고 `useVillageSession`이 조율한다. DB에 인증되어 쪽지를 쓸 수 있는 상태와 채팅 채널이 준비된 상태는 각각 판단한다. UI가 연결 여부를 직접 조합하거나 모든 기능을 동일한 online flag로 묶지 않는다.

인증 실패 시 로컬 산책과 공개 스냅샷·캐시 읽기 경로는 유지한다. Supabase와 캐시가 모두 없으면 쪽지 목록을 제공할 수 없으며 인터넷 없는 최초 실행을 보장하지 않는다.

### 8. DB 타입·외부 응답 계약

읽기 전용으로 현재 프로젝트의 Database 타입을 생성해 client에 연결했다. 쓰기 타입은 실제 컬럼 권한에 맞게 좁혀 trigger가 채우는 snapshot 필드 등을 클라이언트가 입력하지 않게 한다. 도메인 모델은 SDK row 타입을 직접 사용하지 않는다.

공개 snapshot API는 unknown RPC 결과를 검증하고 표시용 5개 필드만 반환한다. 캐시·공개 API·DB 응답은 같은 쪽지 변환 계약을 사용한다. SQL의 RLS·컬럼 권한·서버 trigger는 신뢰 경계의 최종 강제로 유지하며, UI 검증과 서버 검증은 각각 필요하므로 단순 중복으로 제거하지 않았다.

### 9. 에셋 GLB 계약·검증 후 게시

`assets.json`이 원본 경로·런타임 URL·플레이어 메시/재질/scale을 정의하고 렌더러와 모든 도구가 읽는다. 공통 GLB reader/writer는 헤더·길이·chunk·정렬·buffer/accessor 경계를 확인하며 stride를 반영한다. 미지원 sparse·압축·외부 buffer 입력을 잘못된 float 배열로 해석하지 않는다. quaternion 연산과 LOD 계약도 공유한다.

과거 가중치·꼬리 수리 도구는 수정할 비압축 원본 경로를 필수 인자로 받는다. 예상 component type·packed·비정규화·비압축 레이아웃과 가중치·본 범위를 확인하고, 사후 검증까지 메모리에서 마친 뒤 파일을 교체한다. 압축·양자화된 런타임 파일을 기본 입력으로 쓰지 않는다.

재생성·경관 최적화는 임시 public 루트에서 전체 결과를 생성·검증한다. 모든 게시 파일을 대상 파일시스템에 준비한 뒤 교체하므로 서로 다른 마운트의 rename 실패를 피한다. 게시 중 오류는 이전 파일 세트로 rollback하며 복구 실패 시 backup 경로를 남긴다. 단일 파일 교체는 atomic rename이지만 여러 파일의 동시 배포 트랜잭션은 아니다. 운영 배포는 검증된 전체 디렉터리를 배포 시스템으로 전환한다.

`--check`로 실제 전체 생성·검증을 실행했고 게시는 생략했다. 플레이어 기본 모델·클립과 두 LOD의 본 순서·휴식 변환·속성·가중치·인덱스, 경관 Meshopt 디코드·geometry·bbox가 통과했다. 원본과 배포 바이너리는 변경하지 않았다.

### 10. UI·검증 경계·가독성

전체 TS/TSX·스크립트의 긴 JSX와 표현식을 정돈했다. 목적이 다른 UI를 하나의 범용 컴포넌트로 묶는 추상화는 도입하지 않았다. 채팅은 store의 20개 제한을 그대로 사용하고 접힌 상태의 최근 3개만 UI에서 선택한다.

브라우저에서 확인한 방명록 포커스 누락은 AnimatePresence가 실제 DOM을 연결하는 시점에 포커스 제어가 설치되지 않은 문제였다. `useDialogFocus`가 callback ref로 전달된 DOM 노드를 소유하고 노드·열림 상태의 수명에 맞춰 focus·Tab trap·Escape·복원을 설치·해제한다. 데스크톱과 모바일 viewport에서 확인했다. 로딩 이미지에도 실제 표시 크기와 맞는 responsive sizes를 추가했다.

테스트는 실제 프로젝트 소스를 실행하지만 모든 React/R3F·SDK 환경을 그대로 실행하는 것은 아니다. 순수 정책·요청 수명·권한·실패 시 파일 보존처럼 필요한 계약을 검증하고, UI 수명은 별도 실제 브라우저 검사로 보완했다.

## 재현된 오류와 회귀 검증

| 오류 | 수정 | 검증 |
| --- | --- | --- |
| 삭제한 쪽지가 늦은 조회로 다시 나타남 | 확인된 삭제 후 조회 세대 무효화·목록/게시판/캐시 적용 | 오래된 조회 성공·실패, 삭제 실패, 후속 조회 실패 |
| 화면 밖에서 이동한 상대가 이전 pose부터 보간됨 | 숨김·데이터 소실 시 초기화 해제, 복귀 시 최신 pose 적용 | 재진입·데이터 복구·가시 상태의 보간 유지 |
| ±π 경계에서 긴 방향으로 회전 | 음수 나머지를 정규화한 최단 호 계산 | 양방향 경계·누적 회전 |
| 수확·재생성 시 그림자 갱신 누락 | 수확 소유자의 변경 revision 구독 | 실제 store의 수확·재생성 |
| 축별 충돌은 통과하지만 합친 대각선이 장애물 안으로 진입 | 수용된 X 위치로 Z 목적지 검사 | 수정 전 실패 재현, 수정 후 반복 이동 및 실제 게시판 경로 통과 |
| 입력 차단 중 요청이 나중에 실행되거나 막혀도 발소리 발생 | 명령·키 경계 소비와 실제 이동 거리 사용 | 잠금 해제·벽 충돌·클릭 이동 |
| 닉네임·쪽지·채팅의 이모지 길이가 SQL과 불일치 | Unicode code point 계산·절단 통일 | 클라이언트·SQL 80개 이모지, 닉네임 10개·채팅 100개 제한 |
| Realtime payload가 다른 사용자를 사칭할 수 있음 | 자기 JWT topic 발행과 topic 기반 수신자 식별 | 위조 payload ID·presence, 채널 실패·재연결·여러 탭, RLS 역할별 topic 권한 |
| GLB 사후 검사·다중 파일 게시 실패가 원본을 변경 | 검증 후 쓰기·전체 세트 준비·rollback | 실제 수리 검사 실패, 게시 전 검사 실패, 주입한 게시 실패에서 원본 보존 |
| 방명록이 열려도 키보드 포커스가 밖에 남음 | 실제 DOM 연결에 포커스 수명 결속 | 데스크톱·390×844에서 Tab/Shift+Tab·Escape·포커스 복원 |

초기 4건의 동일 회귀 테스트는 수정 전 HEAD로 구성한 임시 환경에서 3개 통과·8개 실패했고, 첫 수정 뒤 11개 모두 통과했다. 이후 구조 변경과 추가 문제에 맞춰 45개로 확장했으며 최종 전체 검사가 통과했다.

## 실행한 검증과 한계

| 검사 | 최종 결과 | 범위 |
| --- | --- | --- |
| `node node_modules/eslint/bin/eslint.js .` | 통과 | 전체 프로젝트 lint |
| `node node_modules/typescript/bin/tsc --noEmit --incremental false` | 통과 | 전체 타입 검사 |
| `node node_modules/next/dist/bin/next build` | 통과 | Next.js 16.3.4 production 컴파일·정적 생성·route |
| `node --test scripts/tests/*.test.mjs` | 45/45 통과 | 기존 클라이언트 11·도메인 4·방명록 7·전송 8·플레이어 9·에셋 6 |
| `node scripts/tests/world-rls.mjs` | 32/32 통과 | 격리 PostgreSQL의 RLS·컬럼/trigger·snapshot·Unicode·Realtime topic 권한 |
| `node scripts/validate-player-model.mjs` | 통과 | 기본 rig·클립·가중치와 두 LOD 계약 |
| `node scripts/validate-scenery-glb.mjs` | 통과 | 실제 런타임 decoder 경관 geometry·bbox |
| `node scripts/rebuild-player-model.mjs --check` | 통과 | 원본부터 전체 플레이어 생성·최적화·LOD·검증, 게시 생략 |
| `node scripts/optimize-scenery-glb.mjs --check` | 통과 | 전체 경관 생성·최적화·디코드 검증, 게시 생략 |
| 로컬 정적 import/export 그래프 | 순환 0개 | src TS/TSX 100개·scripts MJS 30개, 외부 의존성 제외 |
| Chromium WebGL 실제 브라우저 | 통과 | 입장·캐릭터/경관·WASD·게시판 이동·입력 잠금·읽기 전용 채팅·캐시 쪽지·설정·반응형·포커스 |

브라우저 검사는 Supabase 공개 환경 변수를 비운 명시적인 로컬 모드로 실행했다. 설정 없는 snapshot API의 503과 캐시 fallback은 예상한 경로이며 페이지 JavaScript 오류는 없었다. WebGL은 소프트웨어 렌더러를 사용했다. 로딩 이미지 sizes 경고는 수정했으며 Three.js dependency의 Clock deprecation 경고는 남아 있다. 실제 서버 인증·쓰기·웹소켓을 검사했다는 의미는 아니다.

PGlite는 실제 PostgreSQL 정책을 실행하지만 hosted Auth/PostgREST/Realtime 서비스, 여러 DB 연결의 advisory-lock 경쟁이나 폐기된 room migration을 포함한 전체 이력 재생을 대신하지 않는다. Realtime SQL 검사는 JOIN 권한의 로컬 계약을 확인하며 실제 서비스의 연결·권한 캐시 동작은 별도 확인해야 한다. 자동 테스트 수는 전체 코드의 완전한 커버리지 수치가 아니다.

## 운영에서 남은 확인

1. 실제 Supabase의 사용자별 topic migration 적용은 2026-10-05(KST) 완료했다. 클라이언트 배포 후 기존 클라이언트는 새로고침해야 한다.
2. 배포 환경에서 3~4인 접속, 늦은 입장, 여러 탭 퇴장, 네트워크 단절·재연결, 인증 갱신과 쪽지 교환을 확인한다. 계정·데이터를 생성하는 `world:verify`는 별도 테스트 환경에서 실행한다.
3. 실제 모바일의 한글 조합·가상 키보드, 여러 카메라 시점의 벤치·캐릭터 간섭을 확인한다. viewport 검사는 실제 전화기 입력을 대신하지 않는다.
4. Quadro P400 2GB에서 1080p·30fps, 낮밤·대숲·여러 캐릭터와 실제 내부 렌더 해상도를 측정한다. 소프트웨어 WebGL로 목표 장비 성능을 보증하지 않는다.

이 항목들은 이번 소스 리팩터링의 미완료 권장 목록이 아니라 배포 순서와 실제 환경에서 확인할 범위다.

## 유지한 설계

- 월드 배치를 중심으로 렌더링·collision·minimap을 도출하는 구조.
- 프레임 객체 재사용, 공간 해시, 변경된 pose 전송 제한과 거리·품질별 애니메이션 갱신.
- GLTF 스켈레톤 복제·mixer 정리와 카메라 가림용 material의 복제·복구·해제.
- 방명록 알림은 무효화 신호로만 사용하고 내용은 DB에서 조회하는 경계.
- 작성 당시 닉네임·색상 snapshot과 계정·프로필 삭제 뒤 쪽지 보존.
- 서버의 RLS·컬럼 권한·trigger와 입력 경계의 검증.
- 인증 실패 시 로컬 월드, 읽기 전용 공개 스냅샷·캐시 fallback.

## 파일별 최종 검토 범위

아래는 소스 검토의 파일 목록이다. 개별 파일의 무결성 증명이나 테스트 커버리지 목록은 아니다. 새로 생성된 Database 타입은 SDK 연결·허용 컬럼 계약을 확인했다.

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

### scripts/lib — 5개

- `scripts/lib/assets.mjs`
- `scripts/lib/clip-gen.mjs`
- `scripts/lib/glb.mjs`
- `scripts/lib/player-lod.mjs`
- `scripts/lib/publish-assets.mjs`

### scripts/tests — 7개

- `scripts/tests/assets.test.mjs`
- `scripts/tests/client-state.test.mjs`
- `scripts/tests/domain.test.mjs`
- `scripts/tests/guestbook.test.mjs`
- `scripts/tests/multiplayer.test.mjs`
- `scripts/tests/player.test.mjs`
- `scripts/tests/world-rls.mjs`

### scripts/tests/helpers — 1개

- `scripts/tests/helpers/load-source.mjs`

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

### src/components/world/environment — 7개

- `src/components/world/environment/BambooField.tsx`
- `src/components/world/environment/CulledInstances.tsx`
- `src/components/world/environment/StaticScenery.tsx`
- `src/components/world/environment/Structures.tsx`
- `src/components/world/environment/geometry.ts`
- `src/components/world/environment/instanceData.ts`
- `src/components/world/environment/placements.ts`

### src/constants — 3개

- `src/constants/assets.json`
- `src/constants/playerAnimations.ts`
- `src/constants/rendering.ts`

### src/constants/world — 9개

- `src/constants/world/bambooGrove.ts`
- `src/constants/world/bounds.ts`
- `src/constants/world/index.ts`
- `src/constants/world/objects.ts`
- `src/constants/world/riverside.ts`
- `src/constants/world/southField.ts`
- `src/constants/world/types.ts`
- `src/constants/world/village.ts`
- `src/constants/world/wilds.ts`

### src/domain — 6개

- `src/domain/capabilities.ts`
- `src/domain/guestbook.ts`
- `src/domain/interaction.ts`
- `src/domain/player.ts`
- `src/domain/text.ts`
- `src/domain/world.ts`

### src/domain/player — 4개

- `src/domain/player/animation.ts`
- `src/domain/player/controller.ts`
- `src/domain/player/movement.ts`
- `src/domain/player/proximity.ts`

### src/domain/rendering — 1개

- `src/domain/rendering/FrameQualityMonitor.ts`

### src/hooks — 13개

- `src/hooks/useCameraOccluder.ts`
- `src/hooks/useDayNightCycle.ts`
- `src/hooks/useDialogFocus.ts`
- `src/hooks/useFollowPlayer.ts`
- `src/hooks/useGlobalWorld.ts`
- `src/hooks/useGraphicsMonitor.ts`
- `src/hooks/useGuestbook.ts`
- `src/hooks/useMultiplayer.ts`
- `src/hooks/usePlayerBroadcast.ts`
- `src/hooks/usePlayerController.ts`
- `src/hooks/useViewportHeight.ts`
- `src/hooks/useVillageSession.ts`
- `src/hooks/useWorldShadowSignals.ts`

### src/lib — 4개

- `src/lib/audio.ts`
- `src/lib/supabase.ts`
- `src/lib/worldAccess.ts`
- `src/lib/worldCollision.ts`

### src/lib/guestbook — 5개

- `src/lib/guestbook/boardState.ts`
- `src/lib/guestbook/cache.ts`
- `src/lib/guestbook/codec.ts`
- `src/lib/guestbook/repository.ts`
- `src/lib/guestbook/session.ts`

### src/lib/multiplayer — 2개

- `src/lib/multiplayer/WorldTransport.ts`
- `src/lib/multiplayer/protocol.ts`

### src/lib/rendering — 1개

- `src/lib/rendering/culling.ts`

### src/runtime — 1개

- `src/runtime/worldFrameState.ts`

### src/stores — 7개

- `src/stores/chatStore.ts`
- `src/stores/graphicsStore.ts`
- `src/stores/guestbookStore.ts`
- `src/stores/harvestStore.ts`
- `src/stores/interactionStore.ts`
- `src/stores/moveTargetStore.ts`
- `src/stores/zoneStore.ts`

### src/types — 3개

- `src/types/clientDatabase.ts`
- `src/types/database.ts`
- `src/types/multiplayer.ts`

### src/utils — 4개

- `src/utils/collision.ts`
- `src/utils/color.ts`
- `src/utils/math.ts`
- `src/utils/pathfinder.ts`

### supabase/migrations — 19개

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
- `supabase/migrations/20261004172615_authorize_player_realtime_topics.sql`

### 설정·문서

- `.gitignore`
- `.vscode/settings.json`
- `package.json`
- `pnpm-lock.yaml`
- `tsconfig.json`
- `eslint.config.mjs`
- `next.config.ts`
- `postcss.config.mjs`
- `README.md`
- `docs/architecture.md`
- `docs/code-review.md`

로컬 `AGENTS.md`와 해당 Next.js 버전의 번들 문서도 확인했다. 의존성 소스·favicon 등 바이너리 파일과 에셋 자체는 위 수작업 코드 목록에 포함하지 않았다.
