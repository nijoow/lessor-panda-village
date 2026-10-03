/**
 * Isolated integration check. Never defaults to .env.local or a production URL.
 * Use local Supabase or a disposable branch with WORLD_VERIFY_URL,
 * WORLD_VERIFY_PUBLISHABLE_KEY and WORLD_VERIFY_SERVICE_ROLE_KEY.
 * Remote branches also need WORLD_VERIFY_DISPOSABLE_PROJECT=<project hostname>.
 * Creates two real Auth users, exercises REST/RLS, and removes its own fixtures.
 */
import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { setTimeout as delay } from "node:timers/promises";

const url = process.env.WORLD_VERIFY_URL?.replace(/\/$/, "");
const key = process.env.WORLD_VERIFY_PUBLISHABLE_KEY;
const adminKey = process.env.WORLD_VERIFY_SERVICE_ROLE_KEY;
if (!url || !key || !adminKey)
  throw new Error(
    "격리된 검증 환경의 WORLD_VERIFY_URL / PUBLISHABLE_KEY / SERVICE_ROLE_KEY가 필요합니다. 운영 .env.local은 자동으로 사용하지 않습니다.",
  );
const host = new URL(url).hostname;
const isLocal = ["127.0.0.1", "localhost", "::1", "[::1]"].includes(host);
if (!isLocal && process.env.WORLD_VERIFY_DISPOSABLE_PROJECT !== host)
  throw new Error(
    "원격 검증은 WORLD_VERIFY_DISPOSABLE_PROJECT에 폐기 가능한 검증 프로젝트 hostname을 명시해야 합니다.",
  );
let productionUrl;
try {
  productionUrl = readFileSync(
    new URL("../.env.local", import.meta.url),
    "utf8",
  ).match(/^NEXT_PUBLIC_SUPABASE_URL=["']?([^\s"']+)/m)?.[1];
} catch {
  /* No local environment file. */
}
if (!isLocal && productionUrl && new URL(productionUrl).hostname === host)
  throw new Error(
    "앱 .env.local 프로젝트에서는 fixture 작성 및 계정 삭제 검증을 실행하지 않습니다. 로컬 또는 별도 검증 branch를 사용하세요.",
  );

let passed = 0;
let failed = 0;
const users = [];
const traceIds = new Set();
const check = (label, condition, detail = "") => {
  console.log(
    `${condition ? "✔" : "✖"} ${label}${!condition && detail ? ` — ${detail}` : ""}`,
  );
  if (condition) passed++;
  else failed++;
};
const request = async (
  path,
  { token, admin = false, method = "GET", body, prefer } = {},
) => {
  const headers = {
    apikey: admin ? adminKey : key,
    "Content-Type": "application/json",
  };
  if (admin || token)
    headers.Authorization = `Bearer ${admin ? adminKey : token}`;
  if (prefer) headers.Prefer = prefer;
  const result = await fetch(`${url}/${path}`, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
    signal: AbortSignal.timeout(15000),
  });
  const text = await result.text();
  let data = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    /* Non-JSON is an error response. */
  }
  return { status: result.status, data };
};
const rest = (path, args) => request(`rest/v1/${path}`, args);
const signup = async (nickname) => {
  const auth = await request("auth/v1/signup", { method: "POST", body: {} });
  if (!auth.data?.access_token || !auth.data?.user?.id)
    throw new Error("격리 환경 익명 로그인 실패");
  const user = {
    id: auth.data.user.id,
    token: auth.data.access_token,
    nickname,
  };
  users.push(user);
  const profile = await rest("world_profiles?on_conflict=user_id", {
    token: user.token,
    method: "POST",
    prefer: "resolution=merge-duplicates",
    body: { user_id: user.id, nickname, updated_at: new Date().toISOString() },
  });
  if (![200, 201].includes(profile.status))
    throw new Error(`프로필 upsert 실패 HTTP ${profile.status}`);
  return user;
};
const makeNote = (user, body = "격리 검증 흔적") => {
  const id = randomUUID();
  traceIds.add(id);
  return {
    id,
    author_id: user.id,
    body,
    world_key: "panda-village",
    place_id: "village:guestbook",
    client_request_id: randomUUID(),
  };
};
const create = (user, note) =>
  rest("world_traces", {
    token: user.token,
    method: "POST",
    body: note,
    prefer: "return=representation",
  });

try {
  const a = await signup("검증판다A");
  const b = await signup("검증판다B");
  check("서로 다른 두 익명 Auth 사용자와 프로필 생성", a.id !== b.id);
  const profileUpdate = await rest(`world_profiles?user_id=eq.${b.id}`, {
    token: a.token,
    method: "PATCH",
    body: { nickname: "위조" },
    prefer: "return=representation",
  });
  check(
    "타인 프로필 변경 차단",
    profileUpdate.status === 403 ||
      (profileUpdate.status === 200 && profileUpdate.data?.length === 0),
  );
  const invalidName = await rest(`world_profiles?user_id=eq.${a.id}`, {
    token: a.token,
    method: "PATCH",
    body: { nickname: "12345678901" },
  });
  check("11자 닉네임 거부", invalidName.status === 400);

  const first = makeNote(a);
  const created = await create(a, first);
  check(
    "쪽지 작성 및 서버 nickname/color snapshot",
    created.status === 201 &&
      created.data?.[0]?.author_nickname === a.nickname &&
      created.data?.[0]?.author_color_key === a.id,
  );
  const spam = await create(a, makeNote(a));
  check(
    "5초 이내 연속 작성 거부",
    spam.data?.message === "world_traces_rate_limit",
  );
  const retry = await create(a, first);
  check(
    "동일 요청 즉시 재시도는 cooldown이 아닌 unique 충돌",
    retry.status === 409 && retry.data?.code === "23505",
  );
  const changedRetry = await create(a, { ...first, body: "본문 변경 위조" });
  const original = await rest(`world_traces?select=body&id=eq.${first.id}`, {
    token: a.token,
  });
  check(
    "같은 요청 키 다른 본문은 원문 보존",
    changedRetry.status === 409 && original.data?.[0]?.body === first.body,
  );
  const forge = await create(b, { ...makeNote(b), author_id: a.id });
  check("실제 타인 ID 명의 작성 거부", forge.status === 403);
  const forgedSnapshot = await create(b, {
    ...makeNote(b),
    author_nickname: "위조",
    author_color_key: a.id,
  });
  check(
    "클라이언트 snapshot 컬럼 위조 권한 차단",
    forgedSnapshot.status === 403,
  );
  const wrongPlace = await create(b, {
    ...makeNote(b),
    place_id: "invented:place",
  });
  check(
    "등록되지 않은 장소 쓰기 거부",
    wrongPlace.status === 400 &&
      wrongPlace.data?.message === "world_trace_place_invalid",
  );
  const oversized = await create(b, makeNote(b, "x".repeat(81)));
  check("81자 본문 거부", oversized.status === 400);

  const otherDelete = await rest(`world_traces?id=eq.${first.id}`, {
    token: b.token,
    method: "PATCH",
    body: { deleted_at: new Date().toISOString() },
    prefer: "return=representation",
  });
  check(
    "실제 타인 쪽지 삭제는 0행",
    otherDelete.status === 200 && otherDelete.data?.length === 0,
  );
  const hardDelete = await rest(`world_traces?id=eq.${first.id}`, {
    token: a.token,
    method: "DELETE",
  });
  check("본인 hard delete도 차단", [401, 403].includes(hardDelete.status));
  await delay(5100);
  const deleteTarget = makeNote(a);
  const deleteTargetCreated = await create(a, deleteTarget);
  check(
    "삭제후 cooldown 검증용 새 쪽지 작성",
    deleteTargetCreated.status === 201,
  );
  const softDelete = await rest(`world_traces?id=eq.${deleteTarget.id}`, {
    token: a.token,
    method: "PATCH",
    body: { deleted_at: new Date().toISOString() },
    prefer: "return=representation",
  });
  check(
    "본인 소프트 삭제는 정확히 1행",
    softDelete.status === 200 && softDelete.data?.length === 1,
  );
  const afterDelete = await create(a, makeNote(a));
  check(
    "소프트 삭제 직후에도 cooldown 유지",
    afterDelete.data?.message === "world_traces_rate_limit",
  );
  const hidden = await rest(`world_traces?select=id&id=eq.${deleteTarget.id}`, {
    token: b.token,
  });
  check(
    "타인은 소프트 삭제 행 읽기 불가",
    hidden.status === 200 && hidden.data?.length === 0,
  );

  const simultaneous = await Promise.all([
    create(b, makeNote(b)),
    create(b, makeNote(b)),
  ]);
  check(
    "동시 작성은 하나만 성공",
    simultaneous.filter((result) => result.status === 201).length === 1 &&
      simultaneous.filter(
        (result) => result.data?.message === "world_traces_rate_limit",
      ).length === 1,
  );
  const survivor = simultaneous.find((result) => result.status === 201)
    ?.data?.[0];
  if (!survivor) throw new Error("계정 삭제 보존 검증용 행 생성 실패");
  const anonRead = await rest("world_traces?select=id");
  const anonWrite = await rest("world_traces", {
    method: "POST",
    body: makeNote(a),
  });
  check(
    "anon 원본 테이블 읽기/쓰기 차단",
    [401, 403].includes(anonRead.status) &&
      [401, 403].includes(anonWrite.status),
  );
  const publicBefore = await rest("rpc/read_world_snapshot", {
    method: "POST",
    body: {},
  });
  const publicRow = publicBefore.data?.find?.((row) => row.id === survivor.id);
  check(
    "공개 snapshot에 실제 활성 쪽지와 최소 필드만 반환",
    publicBefore.status === 200 &&
      publicRow &&
      Object.keys(publicRow).sort().join() ===
        ["id", "body", "created_at", "author_nickname", "author_color_index"]
          .sort()
          .join(),
  );
  check(
    "공개 snapshot에서 삭제된 쪽지 제외",
    Array.isArray(publicBefore.data) &&
      !publicBefore.data.some((row) => row.id === deleteTarget.id),
  );
  const deletedAccount = await request(`auth/v1/admin/users/${b.id}`, {
    admin: true,
    method: "DELETE",
  });
  check("검증용 익명 계정 삭제", deletedAccount.status === 200);
  const preserved = await rest(
    `world_traces?select=id,body,author_id,author_nickname,author_color_key&id=eq.${survivor.id}`,
    { token: a.token },
  );
  check(
    "계정 삭제 후 흔적/닉네임/색상 보존, author 연결만 해제",
    preserved.data?.[0]?.author_id === null &&
      preserved.data[0].author_nickname === b.nickname &&
      preserved.data[0].author_color_key === b.id &&
      preserved.data[0].body === survivor.body,
  );
  const publicAfter = await rest("rpc/read_world_snapshot", {
    method: "POST",
    body: {},
  });
  check(
    "계정 삭제 후 공개 표시색 유지",
    publicAfter.data?.find?.((row) => row.id === survivor.id)
      ?.author_color_index === publicRow?.author_color_index,
  );
  await delay(5100);
  const afterCooldown = await create(a, makeNote(a));
  check("cooldown 이후 새 요청 작성 가능", afterCooldown.status === 201);
} finally {
  // Only fixture UUIDs generated by this process are removed, even after failure.
  for (const id of traceIds) {
    const result = await rest(`world_traces?id=eq.${id}`, {
      admin: true,
      method: "DELETE",
    });
    if (result.status !== 204)
      check("검증 흔적 정리", false, `HTTP ${result.status}`);
  }
  for (const user of users) {
    const result = await request(`auth/v1/admin/users/${user.id}`, {
      admin: true,
      method: "DELETE",
    });
    if (![200, 404].includes(result.status))
      check("검증 계정 정리", false, `HTTP ${result.status}`);
  }
  console.log(`통과 ${passed} / 실패 ${failed}`);
}
if (failed) process.exitCode = 1;
