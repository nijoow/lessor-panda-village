# Panda Village

여러 방문자가 하나의 레서판다 마을에 접속해 산책하고 채팅하며, 장소에 남은 작은 흔적을 이어가는 데스크톱 웹 cozy game입니다.

현재 플레이 가능한 범위:

- 걷기, 달리기, 점프, 클릭 이동
- 인사·춤 이모트, 벤치 앉기
- 마을 게시판 방명록 — 죽순으로 쪽지를 걸고, 다시 와서 확인
- 대나무 수확과 낮밤 전환(2분 주기)
- Supabase 기반 익명 정체성
- 하나의 전역 월드에서 실시간 위치, 접속 상태, 채팅 공유
- 영속 프로필과 장소 기반 흔적을 위한 데이터 구조

## 로컬 실행

Node.js LTS와 pnpm이 필요합니다.

```bash
pnpm install
pnpm dev
```

브라우저에서 [http://localhost:3000](http://localhost:3000)을 엽니다.

## 환경 변수

루트의 `.env.local`에 다음 값을 설정합니다.

```dotenv
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
```

`NEXT_PUBLIC_SUPABASE_ANON_KEY`에는 Supabase의 publishable key를 사용할 수 있습니다. secret 또는 service-role key는 절대 넣지 않습니다.

Supabase Dashboard에서 `Authentication → Sign In / Providers → Anonymous Sign-Ins`도 활성화해야 합니다. 익명 로그인은 계정을 요구하지 않지만 브라우저 데이터를 지우거나 다른 기기를 쓰면 기존 사용자 정체성을 복구할 수 없습니다.

## 조작

- 이동: `WASD` 또는 방향키
- 달리기: `Shift`
- 점프: `Space`
- 상호작용(벤치 앉기 / 방명록 열기 / 대나무 수확): `E`
- 인사 / 춤: `1` / `2`
- 클릭 이동: 마우스 오른쪽 버튼
- 카메라: 드래그와 휠

## 검증

```bash
pnpm exec tsc --noEmit
pnpm lint
pnpm build
pnpm player:validate
pnpm scenery:validate
pnpm world:verify
```

`world:verify`는 앱과 같은 요청으로 Supabase 권한 경계를 확인합니다. 타입
검사와 빌드는 RLS·grant 문제를 잡지 못하므로, 데이터베이스 DDL을 바꾼 뒤에는
이 검사를 돌립니다. 실행할 때마다 익명 사용자가 하나 생깁니다.

3D 에셋은 원본이 `assets/`에 있고, 스크립트가 `public/models`로 런타임 버전을 굽습니다.

- 플레이어 GLB 재생성: `pnpm player:rebuild`
- 경관 GLB(집·고목) 재압축: `pnpm scenery:optimize`

경관 파이프라인은 지오메트리를 간소화하지 않고 meshopt 양자화와 webp
텍스처로만 줄입니다. `scenery:validate`가 압축 전후의 정점 수와 bbox를
비교해 품질 손실과 크기 변화를 잡아냅니다.

## 문서

- [아키텍처](./docs/architecture.md)
- [로드맵](./docs/roadmap.md)
