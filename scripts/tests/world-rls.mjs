/**
 * Isolated PostgreSQL integration checks. Never reads .env or accepts a DB URL.
 *
 * Run: pnpm test:world-db
 *
 * PGlite executes real PostgreSQL in memory. This verifies SQL/RLS behavior,
 * not hosted Auth/PostgREST/Realtime or multi-connection advisory-lock races.
 */
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile, readdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { PGlite } from '@electric-sql/pglite';
import ts from 'typescript';

// Compile the actual frontend helper so this test also runs on Node 22
// versions without native TypeScript stripping. TypeScript is already dev-only.
const colorSource = await readFile(new URL('../../src/utils/color.ts', import.meta.url), 'utf8');
const colorModule = ts.transpileModule(colorSource, {
  compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
}).outputText;
const { getNicknameColor } = await import(`data:text/javascript;base64,${Buffer.from(colorModule).toString('base64')}`);
const db = new PGlite(); // Always ephemeral: no server address or persisted data.
const migrationsDirectory = fileURLToPath(new URL('../../supabase/migrations/', import.meta.url));
const migrationFiles = await readdir(migrationsDirectory);
// Match descriptive suffixes because Supabase assigns the authoritative timestamp
// when applying a migration; those timestamp-only renames must not break tests.
const migrations = [
  'create_world_profiles.sql',
  'secure_world_profiles.sql',
  'create_world_traces.sql',
  'secure_world_traces.sql',
  'allow_authors_to_read_deleted_traces.sql',
  'link_world_traces_to_profiles.sql',
  'allow_profile_upsert_conflict_target.sql',
  'preserve_world_traces_and_public_snapshot.sql',
  'preserve_snapshot_color_mapping.sql',
].map((suffix) => {
  const matches = migrationFiles.filter((file) => file.endsWith(`_${suffix}`));
  assert.equal(matches.length, 1, `Expected exactly one migration ending in ${suffix}`);
  return matches[0];
});
const baseMigrationCount = 7;
const A = '11111111-1111-4111-8111-111111111111';
const B = '22222222-2222-4222-8222-222222222222';
const legacyId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const deletedLegacyId = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const otherPlaceId = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';
let requestCounter = 0;
const requestId = () => `00000000-0000-4000-8000-${String(++requestCounter).padStart(12, '0')}`;
const results = [];

async function test(name, action) {
  try {
    await action();
    results.push({ name, passed: true });
    console.log(`PASS ${name}`);
  } catch (error) {
    results.push({ name, passed: false, code: error.code, error: error.message });
    console.error(`FAIL ${name}: ${error.code ?? ''} ${error.message}`);
  }
}

async function asRole(role, uid, action) {
  assert(['anon', 'authenticated'].includes(role));
  await db.exec(`set role ${role}`);
  try {
    await db.query("select set_config('request.jwt.claim.sub', $1, false)", [uid ?? '']);
    const { rows } = await db.query('select current_user as role');
    assert.equal(rows[0].role, role);
    return await action();
  } finally {
    await db.exec('reset role');
    await db.query("select set_config('request.jwt.claim.sub', '', false)");
  }
}
const asUser = (id, action) => asRole('authenticated', id, action);
const asAnon = (action) => asRole('anon', null, action);
async function rejects(action, code, message) {
  await assert.rejects(action, (error) => {
    assert.equal(error.code, code, error.message);
    if (message) assert.match(error.message, message);
    return true;
  });
}
const insertTrace = (author, request, body = '작은 마을에 왔어', place = 'village:guestbook') => db.query(
  `insert into public.world_traces (author_id, client_request_id, body, place_id)
   values ($1, $2, $3, $4) returning *`, [author, request, body, place],
);
const getTrace = async (id) => (await db.query('select * from public.world_traces where id = $1', [id])).rows[0];
function expectedColor(uuid) {
  let hash = 0;
  for (const char of uuid) hash = char.charCodeAt(0) + ((hash << 5) - hash);
  return Math.abs(hash) % 10;
}

try {
  console.log((await db.query('select version()')).rows[0].version);
  await db.exec(`
    create role anon nologin nosuperuser nobypassrls;
    create role authenticated nologin nosuperuser nobypassrls;
    create schema auth;
    create table auth.users (id uuid primary key);
    create function auth.uid() returns uuid language sql stable security invoker
      set search_path = '' as $$
        select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid;
      $$;
    grant usage on schema public, auth to anon, authenticated;
    grant execute on function auth.uid() to anon, authenticated;
  `);
  await db.query('insert into auth.users values ($1), ($2)', [A, B]);
  for (const file of migrations.slice(0, baseMigrationCount)) {
    await db.exec(await readFile(resolve(migrationsDirectory, file), 'utf8'));
    console.log(`MIGRATED ${file}`);
  }

  // Existing deployment data, before the preservation migration. It exercises
  // backfill with active, deleted, and out-of-projection legacy records.
  await db.query('insert into public.world_profiles (user_id, nickname) values ($1, $2)', [A, '옛이름']);
  await db.query(`insert into public.world_traces
    (id, author_id, place_id, body, client_request_id, created_at, deleted_at)
    values ($1, $4, 'village:guestbook', '기존 기록', gen_random_uuid(), now()-interval '2 minutes', null),
           ($2, $4, 'village:guestbook', '삭제한 기존 기록', gen_random_uuid(), now()-interval '3 minutes', now()),
           ($3, $4, 'village:old-board', '다른 장소 기록', gen_random_uuid(), now()-interval '1 minute', null)`,
    [legacyId, deletedLegacyId, otherPlaceId, A]);
  await db.query(`insert into public.world_traces (author_id, place_id, body, client_request_id, created_at)
    select $1, 'village:guestbook', '예전 산책 ' || i, gen_random_uuid(), now()-interval '10 minutes'-i*interval '1 second'
    from generate_series(1, 51) as i`, [A]);
  for (const file of migrations.slice(baseMigrationCount)) {
    await db.exec(await readFile(resolve(migrationsDirectory, file), 'utf8'));
    console.log(`MIGRATED ${file}`);
  }

  await test('all migrations apply; legacy snapshot backfill preserves rows', async () => {
    const row = await getTrace(legacyId);
    assert.equal(row.author_nickname, '옛이름');
    assert.equal(row.author_color_key, A);
    assert.equal(row.author_id, A);
    assert.equal((await db.query('select count(*)::int as count from public.world_traces')).rows[0].count, 54);
  });
  await test('anon/authenticated are non-superuser roles without RLS bypass', async () => {
    const { rows } = await db.query("select rolname, rolsuper, rolbypassrls from pg_roles where rolname in ('anon', 'authenticated')");
    assert.equal(rows.length, 2);
    for (const row of rows) { assert.equal(row.rolsuper, false); assert.equal(row.rolbypassrls, false); }
    const tables = await db.query("select relrowsecurity from pg_class where oid in ('public.world_profiles'::regclass, 'public.world_traces'::regclass)");
    assert(tables.rows.every((row) => row.relrowsecurity));
  });
  await test('authenticated creates own profile and upserts its own conflict target', async () => {
    await asUser(B, () => db.query('insert into public.world_profiles (user_id,nickname) values ($1,$2)', [B, '밤톨판다']));
    await asUser(A, () => db.query(`insert into public.world_profiles (user_id,nickname,updated_at) values ($1,$2,now())
      on conflict (user_id) do update set user_id=excluded.user_id,nickname=excluded.nickname,updated_at=excluded.updated_at`, [A, '새봄판다']));
    assert.equal((await db.query('select nickname from public.world_profiles where user_id=$1', [A])).rows[0].nickname, '새봄판다');
    assert.equal((await getTrace(legacyId)).author_nickname, '옛이름');
  });
  await test('another user cannot change a profile: update affects zero rows', async () => {
    const result = await asUser(B, () => db.query('update public.world_profiles set nickname=$1 where user_id=$2 returning user_id', ['사칭', A]));
    assert.equal(result.rows.length, 0);
  });
  await test('profile ownership forgery is rejected by RLS', async () => {
    await rejects(() => asUser(B, () => db.query('insert into public.world_profiles (user_id,nickname) values ($1,$2)', [A, '사칭'])), '42501');
    await rejects(() => asUser(A, () => db.query('update public.world_profiles set user_id=$1 where user_id=$2', [B,A])), '42501');
  });

  let aTrace;
  let bTrace;
  const aRequest = requestId();
  await test('authenticated writes own trace; trigger sets trusted snapshot/time', async () => {
    const before = Date.now();
    aTrace = (await asUser(A, () => insertTrace(A, aRequest))).rows[0];
    assert.equal(aTrace.author_id, A);
    assert.equal(aTrace.author_nickname, '새봄판다');
    assert.equal(aTrace.author_color_key, A);
    assert(Date.parse(aTrace.created_at) >= before - 1000);
  });
  await test('committed retry reaches unique conflict within cooldown, without duplicate', async () => {
    await rejects(() => asUser(A, () => insertTrace(A, aRequest)), '23505');
    const { rows } = await asUser(A, () => db.query('select author_id, place_id, body from public.world_traces where client_request_id=$1', [aRequest]));
    assert.equal(rows.length, 1);
    assert.deepEqual(rows[0], { author_id: A, place_id: 'village:guestbook', body: '작은 마을에 왔어' });
    await rejects(() => asUser(A, () => insertTrace(A, aRequest, '다른 내용')), '23505');
    assert.equal((await getTrace(aTrace.id)).body, '작은 마을에 왔어');
  });
  await test('new request within five seconds is rate limited', async () => {
    await rejects(() => asUser(A, () => insertTrace(A, requestId())), 'P0001', /world_traces_rate_limit/);
  });
  await test('cooldown is per author; other user can write immediately', async () => {
    bTrace = (await asUser(B, () => insertTrace(B, requestId(), '밤톨의 인사'))).rows[0];
    assert.equal(bTrace.author_nickname, '밤톨판다');
  });
  await test('new request succeeds after the real five-second cooldown', async () => {
    await new Promise((resolveDelay) => setTimeout(resolveDelay, 5100));
    const row = (await asUser(A, () => insertTrace(A, requestId(), '다시 남기는 인사'))).rows[0];
    assert.equal(row.body, '다시 남기는 인사');
  });
  await test('another author cannot be impersonated', async () => {
    await rejects(() => asUser(B, () => insertTrace(A, requestId(), '명의 위조')), '42501', /world_trace_author_invalid/);
  });
  await test('unsupported place is rejected by the trigger', async () => {
    await rejects(() => asUser(A, () => insertTrace(A, requestId(), '다른 곳', 'village:other')), '22023', /world_trace_place_invalid/);
  });
  await test('client cannot write snapshot fields or spoof created_at', async () => {
    for (const [column, value] of [['author_nickname', '가짜'], ['author_color_key', B], ['created_at', '2000-01-01']]) {
      await rejects(() => asUser(A, () => db.query(`insert into public.world_traces
        (author_id, client_request_id, body, place_id, ${column}) values ($1,$2,$3,$4,$5)`,
        [A, requestId(), '위조', 'village:guestbook', value])), '42501');
    }
  });
  await test('body updates are denied, even to the author', async () => {
    await rejects(() => asUser(A, () => db.query('update public.world_traces set body=$1 where id=$2', ['바꿈', aTrace.id])), '42501');
  });
  await test('another user soft delete returns zero rows; physical delete denied', async () => {
    const result = await asUser(B, () => db.query('update public.world_traces set deleted_at=now() where id=$1 returning id', [aTrace.id]));
    assert.equal(result.rows.length, 0);
    assert.equal((await getTrace(aTrace.id)).deleted_at, null);
    await rejects(() => asUser(B, () => db.query('delete from public.world_traces where id=$1', [aTrace.id])), '42501');
  });
  await test('author soft delete succeeds and deleted row is only visible to author', async () => {
    const result = await asUser(A, () => db.query('update public.world_traces set deleted_at=now() where id=$1 returning id', [aTrace.id]));
    assert.equal(result.rows.length, 1);
    assert.equal((await asUser(A, () => db.query('select id from public.world_traces where id=$1', [aTrace.id]))).rows.length, 1);
    assert.equal((await asUser(B, () => db.query('select id from public.world_traces where id=$1', [aTrace.id]))).rows.length, 0);
    const retry = await asUser(A, () => db.query('update public.world_traces set deleted_at=now() where id=$1 returning id', [aTrace.id]));
    assert.equal(retry.rows.length, 0);
  });
  await test('anon cannot select either base table or insert traces', async () => {
    for (const table of ['world_profiles', 'world_traces']) {
      await rejects(() => asAnon(() => db.query(`select * from public.${table}`)), '42501');
    }
    await rejects(() => asAnon(() => insertTrace(A, requestId())), '42501');
  });
  await test('public RPC returns active guestbook projection only, at most 50 rows', async () => {
    const { rows } = await asAnon(() => db.query('select * from public.read_world_snapshot()'));
    assert.equal(rows.length, 50);
    assert.deepEqual(Object.keys(rows[0]).sort(), ['id','body','created_at','author_nickname','author_color_index'].sort());
    assert(!rows.some((row) => [aTrace.id, deletedLegacyId, otherPlaceId].includes(row.id)));
    assert(rows.every((row) => row.author_color_index >= 0 && row.author_color_index < 10));
    assert.equal(rows.find((row) => row.id === bTrace.id).author_color_index, expectedColor(B));
    for (let index = 1; index < rows.length; index++) assert(Date.parse(rows[index-1].created_at) >= Date.parse(rows[index].created_at));
    await rejects(() => asAnon(() => db.query('select world_private.trace_color_index($1)', [A])), '42501');
  });
  await test('SQL color projection matches actual frontend color for 132 UUIDs', async () => {
    const samples = [A, B, '00000000-0000-0000-0000-000000000000', 'ffffffff-ffff-ffff-ffff-ffffffffffff'];
    for (let index = 0; index < 128; index++) {
      const hex = createHash('sha256').update(`panda-color-${index}`).digest('hex').slice(0, 32);
      samples.push(`${hex.slice(0,8)}-${hex.slice(8,12)}-${hex.slice(12,16)}-${hex.slice(16,20)}-${hex.slice(20)}`);
    }
    for (const uid of samples) {
      const { rows } = await db.query('select world_private.trace_color_index($1) as index', [uid]);
      // Public snapshot parsing uses one character (d..m) to reuse the palette.
      assert.equal(getNicknameColor(String.fromCharCode(100 + rows[0].index)), getNicknameColor(uid), uid);
    }
  });
  await test('empty and oversized bodies are rejected by database constraints', async () => {
    for (const body of ['   ', '가'.repeat(81)]) {
      await rejects(() => asUser(B, () => insertTrace(B, requestId(), body)), '23514');
    }
  });
  await test('authenticated cannot delete own profile directly', async () => {
    await rejects(() => asUser(B, () => db.query('delete from public.world_profiles where user_id=$1', [B])), '42501');
  });
  await test('Auth user cleanup keeps traces with NULL author and immutable snapshot', async () => {
    const before = (await db.query('select count(*)::int as count from public.world_traces')).rows[0].count;
    await db.query('delete from auth.users where id=$1', [A]); // Fixture owner simulates Auth cleanup.
    const row = await getTrace(legacyId);
    assert.equal(row.author_id, null);
    assert.equal(row.author_nickname, '옛이름');
    assert.equal(row.author_color_key, A);
    assert.equal((await db.query('select count(*)::int as count from public.world_traces')).rows[0].count, before);
    assert.equal((await db.query('select * from public.world_profiles where user_id=$1', [A])).rows.length, 0);
    assert((await asAnon(() => db.query('select * from public.read_world_snapshot()'))).rows.some((item) => item.id === legacyId));
    const visible = await asAnon(() => db.query('select * from public.read_world_snapshot() where id=$1', [aTrace.id]));
    assert.equal(visible.rows.length, 0);
  });
  await test('profile cleanup alone keeps trace and snapshot while Auth user remains', async () => {
    await db.query('delete from public.world_profiles where user_id=$1', [B]);
    const row = await getTrace(bTrace.id);
    assert.equal(row.author_id, null);
    assert.equal(row.author_nickname, '밤톨판다');
    assert.equal(row.author_color_key, B);
    assert.equal((await db.query('select * from auth.users where id=$1', [B])).rows.length, 1);
    assert((await asAnon(() => db.query('select * from public.read_world_snapshot()'))).rows.some((item) => item.id === bTrace.id));
  });
  await test('a missing profile cannot create a new trace', async () => {
    await rejects(() => asUser(B, () => insertTrace(B, requestId())), '42501', /world_profile_required/);
  });
  await test('orphaned traces cannot be claimed or deleted by another visitor', async () => {
    const result = await asUser(B, () => db.query('update public.world_traces set deleted_at=now() where id=$1 returning id', [legacyId]));
    assert.equal(result.rows.length, 0);
    await rejects(() => asUser(B, () => db.query('update public.world_traces set author_id=$1 where id=$2', [B,legacyId])), '42501');
  });
} finally {
  await db.close();
}
const failed = results.filter((result) => !result.passed);
console.log(JSON.stringify({ total: results.length, passed: results.length-failed.length, failed: failed.length, failures: failed }, null, 2));
if (failed.length) process.exitCode = 1;
