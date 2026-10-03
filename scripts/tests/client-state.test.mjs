/** Isolated regression checks of the actual client code; no hosted services.
 * React hooks and frame scheduling are controlled here, not browser-rendered.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import vm from "node:vm";
import { test } from "node:test";
import { setImmediate } from "node:timers/promises";
import ts from "typescript";
import * as THREE from "three";

function loadSource(path, dependencies = {}, globals = {}) {
  const url = new URL(`../../${path}`, import.meta.url);
  const require = createRequire(url);
  const code = ts.transpileModule(readFileSync(url, "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX },
  }).outputText;
  const sourceModule = { exports: {} };
  vm.runInNewContext(code, {
    module: sourceModule, exports: sourceModule.exports, console, Date, AbortSignal, ...globals,
    require: (name) => Object.hasOwn(dependencies, name) ? dependencies[name] : require(name),
  }, { filename: fileURLToPath(url) });
  return sourceModule.exports;
}

function deferred() {
  let resolve;
  const promise = new Promise((done) => { resolve = done; });
  return { promise, resolve };
}

const guestbook = loadSource("src/lib/guestbook.ts");
const rawNote = {
  id: "11111111-1111-4111-8111-111111111111", body: "작은 마을의 쪽지",
  created_at: "2026-10-02T10:00:00Z",
  author_id: "22222222-2222-4222-8222-222222222222",
  author_nickname: "밤톨", author_color_key: "22222222-2222-4222-8222-222222222222",
};

function guestbookHarness(deletion = { data: [{ id: rawNote.id }], error: null }) {
  const note = guestbook.toGuestbookNote(rawNote);
  let cached = { notes: [note], savedAt: Date.now() };
  const reads = [];
  const query = (response) => new Proxy({}, {
    get: (_target, name) => name === "then" ? response.then.bind(response) : () => query(response),
  });
  const supabase = { from: () => ({
    select: () => {
      const request = deferred();
      reads.push(request);
      return query(request.promise);
    },
    update: () => query(Promise.resolve(deletion)),
  }) };
  const state = {
    isOpen: true, notes: [note], status: "ready", cachedAt: null,
    setNotes(notes) { this.notes = notes; },
    setStatus(status) { this.status = status; },
    setCachedAt(time) { this.cachedAt = time; },
  };
  const store = (selector) => selector(state);
  store.getState = () => state;
  const slots = [];
  let index = 0;
  const react = {
    useCallback: (fn) => fn, useEffect: () => {},
    useRef: (initial) => slots[index++] ?? (slots[index - 1] = { current: initial }),
    useState(initial) {
      const slot = index++;
      if (!(slot in slots)) slots[slot] = initial;
      return [slots[slot], (next) => { slots[slot] = typeof next === "function" ? next(slots[slot]) : next; }];
    },
  };
  const { useGuestbook: runGuestbookHook } = loadSource("src/hooks/useGuestbook.ts", {
    react, "@/lib/supabase": { supabase },
    "@/hooks/useGlobalWorld": { GLOBAL_WORLD_KEY: "panda-village" },
    "@/lib/guestbook": { ...guestbook, readNoteCache: () => cached, writeNoteCache: (_place, notes) => { cached = { notes, savedAt: Date.now() }; } },
    "@/stores/guestbookStore": { useGuestbookStore: store, NOTE_COST: 1 },
    "@/stores/harvestStore": {},
  });
  const render = () => {
    index = 0;
    return runGuestbookHook("village:guestbook", rawNote.author_id, 0, () => {});
  };
  return { render, reads, state, cache: () => cached };
}

for (const lateResult of [{ data: [rawNote], error: null }, { data: null, error: { message: "offline" } }]) {
  test(`confirmed deletion survives an older ${lateResult.error ? "failed" : "successful"} read`, async () => {
    const harness = guestbookHarness();
    const hook = harness.render();
    const oldRead = hook.refresh();
    const removal = hook.remove(rawNote.id);
    await setImmediate();
    assert.equal(harness.reads.length, 2, "deletion starts a fresh authoritative read");
    harness.reads[1].resolve({ data: [], error: null });
    await removal;
    harness.reads[0].resolve(lateResult);
    await oldRead;
    assert.equal(harness.state.notes.length, 0);
    assert.equal(harness.render().visibleNotes.length, 0);
    assert.equal(harness.cache().notes.length, 0);
    assert.equal(harness.state.status, "ready");
    assert.equal(harness.render().isLoadingMore, false);
  });
}

test("failed deletion keeps the note and allows the pending read to complete", async () => {
  const harness = guestbookHarness({ data: [], error: { message: "permission denied" } });
  const hook = harness.render();
  const reading = hook.refresh();
  await hook.remove(rawNote.id);
  harness.reads[0].resolve({ data: [rawNote], error: null });
  await reading;
  assert.equal(harness.state.notes.length, 1);
  assert.equal(harness.render().visibleNotes.length, 1);
  assert.ok(harness.render().deleteError);
});

test("failed reload after confirmed deletion retains the corrected cache", async () => {
  const harness = guestbookHarness();
  const removal = harness.render().remove(rawNote.id);
  await setImmediate();
  harness.reads[0].resolve({ data: null, error: { message: "offline" } });
  await removal;
  assert.equal(harness.state.notes.length, 0);
  assert.equal(harness.render().visibleNotes.length, 0);
  assert.equal(harness.cache().notes.length, 0);
  assert.equal(harness.render().deleteError, null);
  assert.equal(harness.state.status, "error");
});

function remotePlayerHarness() {
  const frames = [];
  const { RemotePlayer } = loadSource("src/components/world/RemotePlayer.tsx", {
    three: THREE,
    react: { useMemo: (fn) => fn(), useRef: (value) => ({ current: value }), memo: (fn) => fn, useState: (value) => [value, () => {}] },
    "@react-three/drei": { useGLTF: () => ({ nodes: {} }) },
    "@react-three/fiber": { useFrame: (fn) => frames.push(fn) },
    "@/utils/math": loadSource("src/utils/math.ts"),
    "./PandaModel": { usePandaModel: () => ({ nodes: {}, materials: {}, playAction() {} }), PandaBody() {}, PandaNameTag() {} },
  });
  let data = { x: -5, y: 0, z: 0, ry: 0, anim: "idle", nickname: "밤톨" };
  const tree = RemotePlayer({ id: "peer", getPlayerData: () => data });
  const group = tree.props.ref.current = new THREE.Group();
  tree.props.children[1].props.ref.current = new THREE.Group();
  const camera = new THREE.PerspectiveCamera(60, 1, 0.1, 200);
  camera.position.set(0, 10, 20);
  camera.lookAt(0, 0, 0);
  camera.updateMatrixWorld();
  const scene = new THREE.Scene();
  scene.fog = new THREE.Fog("white", 52, 105);
  return { group, frame: () => frames[0]({ camera, scene }, 1 / 60), setData: (next) => { data = next; }, pose: () => data };
}

test("peer reappears at its latest position and rotation after offscreen movement", () => {
  const peer = remotePlayerHarness();
  peer.frame();
  peer.setData({ ...peer.pose(), x: 100 });
  peer.frame();
  assert.equal(peer.group.visible, false);
  peer.setData({ ...peer.pose(), x: 5, ry: 2 });
  peer.frame();
  assert.equal(peer.group.visible, true);
  assert.equal(peer.group.position.x, 5);
  assert.equal(peer.group.rotation.y, 2);
});

test("visible peers retain smooth interpolation", () => {
  const peer = remotePlayerHarness();
  peer.frame();
  peer.setData({ ...peer.pose(), x: 5 });
  peer.frame();
  assert.ok(peer.group.position.x > -5 && peer.group.position.x < 5);
});

test("missing peer data resets the pose before visibility resumes", () => {
  const peer = remotePlayerHarness();
  peer.frame();
  peer.setData(undefined);
  peer.frame();
  assert.equal(peer.group.visible, false);
  peer.setData({ x: 5, y: 0, z: 0, ry: -2, anim: "idle", nickname: "밤톨" });
  peer.frame();
  assert.equal(peer.group.position.x, 5);
  assert.equal(peer.group.rotation.y, -2);
});

const { lerpAngle } = loadSource("src/utils/math.ts");
for (const [start, end, expected] of [[3, -3, Math.PI], [-3, 3, -Math.PI], [Math.PI * 4, 0.2, Math.PI * 4 + 0.1]]) {
  test(`angle interpolation takes the shortest arc from ${start} to ${end}`, () => {
    assert.ok(Math.abs(lerpAngle(start, end, 0.5) - expected) < 1e-10);
  });
}

test("harvesting and respawning bamboo both invalidate cached shadows", () => {
  const respawns = [];
  const { useHarvestStore } = loadSource("src/stores/harvestStore.ts", {}, {
    setTimeout: (callback) => { respawns.push(callback); },
  });
  const effects = [];
  const graphics = { quality: "high", runtime: { shadowRevision: 0 } };
  const useGraphicsStore = (selector) => selector(graphics);
  useGraphicsStore.getState = () => graphics;
  const { Player } = loadSource("src/components/world/Player.tsx", {
    react: { useRef: (value) => ({ current: value }), useCallback: (fn) => fn, forwardRef: (fn) => fn, useImperativeHandle() {}, useEffect: (fn) => effects.push(fn) },
    three: THREE,
    "@react-three/fiber": { useFrame() {} },
    "@react-three/drei": { useKeyboardControls: () => [null, () => ({})] },
    "@/constants/playerAnimations": { PLAYER_ANIM: { IDLE: "idle" } },
    "@/constants/world": { BENCHES: [], BAMBOO: [], NOTICE_BOARDS: [] },
    "@/utils/collision": {}, "@/utils/pathfinder": {},
    "@/utils/math": loadSource("src/utils/math.ts"),
    "@/stores/moveTargetStore": { useMoveTargetStore: (selector) => selector({ request: null }) },
    "@/stores/interactionStore": {}, "@/stores/zoneStore": {}, "@/stores/guestbookStore": {},
    "@/stores/harvestStore": { useHarvestStore }, "@/stores/graphicsStore": { useGraphicsStore },
    "@/lib/audio": {},
    "./PandaModel": { usePandaModel: () => ({ nodes: {}, materials: {}, playAction() {}, getCurrentAction() {} }), PandaBody() {}, PandaNameTag() {} },
  });
  Player({ id: "local", nickname: "밤톨" }, null);
  const cleanups = effects.map((effect) => effect());
  try {
    useHarvestStore.getState().harvest(0);
    assert.equal(graphics.runtime.shadowRevision, 1);
    respawns[0]();
    assert.equal(graphics.runtime.shadowRevision, 2);
  } finally {
    for (const cleanup of cleanups) cleanup?.();
  }
});
