/**
 * 공유 월드 권한 경계 검증.
 *
 * AGENTS.md의 "Supabase DDL 변경 시 RLS·권한 테스트"를 실행 가능한 형태로
 * 만든 것이다. 앱이 실제로 보내는 요청과 같은 순서·같은 형태로 REST API를
 * 호출해, 타입 검사나 빌드가 절대 잡아내지 못하는 권한 문제를 잡는다.
 *
 * 실제로 이 검사는 "프로필 upsert가 42501로 거부되어 아무도 입장할 수
 * 없던" 문제를 찾아냈다. PostgREST의 upsert는 on conflict do update의 set
 * 절에 페이로드의 모든 컬럼을 넣기 때문에, 충돌 대상 컬럼에도 update
 * 권한이 필요하다.
 *
 * 주의: 실행할 때마다 익명 사용자와 프로필이 하나씩 생긴다(익명 인증의
 * 성격상 지울 수 없다). 남기는 쪽지는 마지막에 소프트 삭제한다. 상시
 * 실행용이 아니라 DDL을 바꾼 뒤에 돌리는 용도다.
 *
 * 사용: pnpm world:verify
 */
import { readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { randomUUID } from "node:crypto";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const WORLD_KEY = "panda-village";
const PLACE_ID = "village:guestbook";

const readEnv = () => {
  const raw = readFileSync(join(ROOT, ".env.local"), "utf8");
  const pick = (key) =>
    raw
      .split("\n")
      .find((line) => line.startsWith(`${key}=`))
      ?.slice(key.length + 1)
      .trim()
      .replace(/^["']|["']$/g, "");

  const url = pick("NEXT_PUBLIC_SUPABASE_URL");
  const key = pick("NEXT_PUBLIC_SUPABASE_ANON_KEY");
  if (!url || !key) {
    throw new Error(".env.local에 Supabase URL과 publishable key가 필요합니다.");
  }
  return { url, key };
};

const { url, key } = readEnv();

let passed = 0;
let failed = 0;

const check = (label, condition, detail = "") => {
  if (condition) {
    console.log(`  ✔ ${label}`);
    passed++;
  } else {
    console.log(`  ✖ ${label}${detail ? ` — ${detail}` : ""}`);
    failed++;
  }
};

const rest = async (path, { token, method = "GET", body, prefer } = {}) => {
  const headers = { apikey: key, "Content-Type": "application/json" };
  if (token) headers.Authorization = `Bearer ${token}`;
  if (prefer) headers.Prefer = prefer;

  const response = await fetch(`${url}/rest/v1/${path}`, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  });

  const text = await response.text();
  let json = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = null;
  }
  return { status: response.status, json, text };
};

console.log("1. 익명 로그인");
const authResponse = await fetch(`${url}/auth/v1/signup`, {
  method: "POST",
  headers: { apikey: key, "Content-Type": "application/json" },
  body: "{}",
});
const auth = await authResponse.json();
const token = auth?.access_token;
const userId = auth?.user?.id;

if (!token || !userId) {
  console.log(
    `  ✖ 익명 로그인 실패 — Supabase의 Anonymous Sign-Ins가 켜져 있는지 확인하세요.`,
  );
  console.log(`    ${JSON.stringify(auth).slice(0, 300)}`);
  process.exit(1);
}
check(`익명 세션 발급 (${userId.slice(0, 8)}…)`, true);

console.log("\n2. 프로필 upsert (입장 흐름과 동일)");
const upsert = await rest("world_profiles?on_conflict=user_id", {
  token,
  method: "POST",
  prefer: "resolution=merge-duplicates",
  body: {
    user_id: userId,
    nickname: "검증판다",
    updated_at: new Date().toISOString(),
  },
});
check(
  "프로필 생성",
  upsert.status === 201 || upsert.status === 200,
  `HTTP ${upsert.status} ${upsert.json?.message ?? ""}`,
);

console.log("\n3. 닉네임 길이 제약");
const tooLong = await rest("world_profiles?on_conflict=user_id", {
  token,
  method: "POST",
  prefer: "resolution=merge-duplicates",
  body: { user_id: userId, nickname: "12345678901" },
});
check("11자 닉네임 거부", tooLong.status === 400, `HTTP ${tooLong.status}`);

console.log("\n4. 쪽지 작성");
const requestId = randomUUID();
const note = {
  world_key: WORLD_KEY,
  place_id: PLACE_ID,
  author_id: userId,
  body: "권한 검증용 쪽지",
  client_request_id: requestId,
};
const created = await rest("world_traces", {
  token,
  method: "POST",
  body: note,
});
check(
  "쪽지 생성",
  created.status === 201,
  `HTTP ${created.status} ${created.json?.message ?? ""}`,
);

console.log("\n5. 멱등성 — 같은 client_request_id 재시도");
const retry = await rest("world_traces", {
  token,
  method: "POST",
  body: { ...note, body: "중복이면 안 됨" },
});
check(
  "중복 거부 (앱은 409를 성공으로 처리)",
  retry.status === 409,
  `HTTP ${retry.status}`,
);

console.log("\n6. 타인 명의 위조 시도");
const forged = await rest("world_traces", {
  token,
  method: "POST",
  body: {
    ...note,
    author_id: "00000000-0000-0000-0000-000000000001",
    client_request_id: randomUUID(),
  },
});
check(
  "타인 명의 작성 거부",
  forged.status === 403 || forged.status === 409,
  `HTTP ${forged.status}`,
);

console.log("\n7. 앱과 동일한 조회 (작성자 닉네임 FK 임베드)");
const query = new URLSearchParams({
  select:
    "id,body,created_at,author_id,world_profiles!world_traces_author_profile_fk(nickname)",
  world_key: `eq.${WORLD_KEY}`,
  place_id: `eq.${PLACE_ID}`,
  deleted_at: "is.null",
  order: "created_at.desc",
  limit: "50",
});
const listed = await rest(`world_traces?${query}`, { token });
const mine = Array.isArray(listed.json)
  ? listed.json.find((row) => row.author_id === userId)
  : null;
check(
  "FK 임베드로 닉네임 조회",
  mine?.world_profiles?.nickname === "검증판다",
  `HTTP ${listed.status} ${JSON.stringify(listed.json).slice(0, 200)}`,
);

console.log("\n8. 본인 쪽지 소프트 삭제");
const removed = mine
  ? await rest(`world_traces?id=eq.${mine.id}`, {
      token,
      method: "PATCH",
      body: { deleted_at: new Date().toISOString() },
    })
  : { status: 0 };
check("소프트 삭제", removed.status === 204, `HTTP ${removed.status}`);

console.log("\n9. 삭제 후 활성 목록에서 제외");
const after = await rest(
  `world_traces?select=id&place_id=eq.${PLACE_ID}&deleted_at=is.null`,
  { token },
);
const stillThere =
  Array.isArray(after.json) && after.json.some((row) => row.id === mine?.id);
check("삭제한 쪽지가 목록에 없음", !stillThere);

console.log("\n10. 비로그인(anon) 접근 차단");
const anon = await rest("world_traces?select=id");
check(
  "비로그인 조회 차단",
  anon.status === 401 || anon.status === 403,
  `HTTP ${anon.status}`,
);

console.log("\n───────────────────────");
console.log(`통과 ${passed} / 실패 ${failed}`);

if (failed > 0) process.exit(1);
