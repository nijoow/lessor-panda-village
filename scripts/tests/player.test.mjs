import assert from "node:assert/strict";
import { test } from "node:test";
import * as THREE from "three";
import { loadSource } from "./helpers/load-source.mjs";

const { PlayerController, EMPTY_PLAYER_KEYS } = loadSource("src/domain/player/controller.ts");
const { PLAYER_ANIM } = loadSource("src/constants/playerAnimations.ts");

function playerHarness(world = {}) {
  const controller = new PlayerController({ benches: [], bamboo: [], boards: [], isHarvested: () => false, collision: () => false, findPath: (_start, end) => [{ x: end.x, z: end.z }], ...world });
  const input = { delta: 1 / 60, camera: { x: 0, z: 1000 }, keys: { ...EMPTY_PLAYER_KEYS }, disabled: false, commands: { move: null, sit: 0, harvest: 0, emote: null } };
  return { controller, input, tick: () => controller.step(input) };
}

test("walking follows camera orientation with normalized diagonal speed", () => {
  const straight = playerHarness(); straight.input.keys.forward = true;
  const diagonal = playerHarness(); diagonal.input.keys.forward = true; diagonal.input.keys.right = true;
  let a, b;
  for (let i = 0; i < 60; i++) { a = straight.tick(); b = diagonal.tick(); }
  assert.ok(a.pose.z < -4 && Math.abs(a.pose.x) < 1e-10);
  assert.ok(Math.abs(Math.hypot(a.pose.x, a.pose.z) - Math.hypot(b.pose.x, b.pose.z)) < 0.02);
  const rotated = playerHarness(); rotated.input.camera = { x: 1000, z: 0 }; rotated.input.keys.forward = true;
  let result; for (let i = 0; i < 60; i++) result = rotated.tick();
  assert.ok(result.pose.x < -4 && Math.abs(result.pose.z) < 1e-10);
});

test("jumping emits one launch and landing and never sinks below the ground", () => {
  const player = playerHarness(); player.input.keys.jump = true;
  const events = [];
  let peak = 0;
  for (let i = 0; i < 100; i++) {
    const frame = player.tick(); events.push(...frame.events);
    peak = Math.max(peak, frame.pose.y);
    assert.ok(frame.pose.y >= 0);
    player.input.keys.jump = false;
  }
  assert.ok(peak > 1);
  assert.equal(events.filter((event) => event.kind === "jump").length, 1);
  assert.equal(events.filter((event) => event.kind === "land").length, 1);
});

test("blocked motion does not produce footsteps", () => {
  const player = playerHarness({ collision: () => true }); player.input.keys.forward = true;
  for (let i = 0; i < 200; i++) {
    const result = player.tick();
    assert.equal(result.pose.x, 0); assert.equal(result.pose.z, 0);
    assert.equal(result.events.filter((event) => event.kind === "footstep").length, 0);
  }
});

test("commands consumed during input lock do not replay when it opens", () => {
  let paths = 0;
  const player = playerHarness({ findPath: (_start, end) => { paths++; return [end]; } });
  player.input.disabled = true;
  player.input.commands.move = { x: 5, z: 0, requestId: 1 };
  player.input.commands.emote = { anim: PLAYER_ANIM.WAVE, requestId: 1 };
  player.tick(); player.input.disabled = false;
  for (let i = 0; i < 20; i++) { const frame = player.tick(); assert.equal(frame.pose.x, 0); assert.equal(frame.emoting, false); }
  assert.equal(paths, 0);
  player.input.commands.move = { x: 5, z: 0, requestId: 2 };
  for (let i = 0; i < 20; i++) player.tick();
  assert.equal(paths, 1);
});

test("bench priority and click-to-stand share the physical seat specification", () => {
  let start;
  const player = playerHarness({ benches: [{ x: 0, z: 0, rotation: Math.PI / 2 }], boards: [{ x: 0, z: 0, range: 3 }], findPath: (from, end) => { start = { ...from }; return [end]; } });
  player.input.commands.sit = 1;
  const sitting = player.tick();
  assert.equal(sitting.sitting, true);
  assert.equal(sitting.events.filter((event) => event.kind === "guestbook").length, 0);
  player.tick();
  player.input.commands.move = { x: 5, z: 5, requestId: 1 };
  assert.equal(player.tick().sitting, false);
  assert.ok(Math.abs(start.x - 0.9) < 1e-10);
  assert.ok(Math.abs(start.z - 0.55) < 1e-10);
});

test("network pose publication stays bounded and ignores unchanged frames", () => {
  const frames = [], effects = [], sent = [];
  const { usePlayerBroadcast: runBroadcast } = loadSource("src/hooks/usePlayerBroadcast.ts", {
    react: { useRef: (current) => ({ current }), useEffect: (fn) => effects.push(fn) },
    "@react-three/fiber": { useFrame: (fn) => frames.push(fn) },
  });
  const object = new THREE.Group();
  runBroadcast({ current: object }, () => PLAYER_ANIM.IDLE, (pose) => sent.push(pose));
  effects.forEach((fn) => fn());
  for (let i = 0; i < 600; i++) frames[0]({}, 1 / 60);
  assert.equal(sent.length, 2);
  object.position.x = 3;
  for (let i = 0; i < 60; i++) frames[0]({}, 1 / 60);
  assert.equal(sent.length, 3);
  assert.equal(sent.at(-1).x, 3);
});

test("quality decisions discard hidden-tab time and require sustained visible samples", () => {
  const { FrameQualityMonitor } = loadSource("src/domain/rendering/FrameQualityMonitor.ts");
  const monitor = new FrameQualityMonitor();
  let directions = [];
  for (let i = 0; i < 60 * 20; i++) { const sample = monitor.sample(1 / 60, true); if (sample) directions.push(sample.direction); }
  assert.ok(directions.every((direction) => direction === 0));
  monitor.sample(60, false);
  directions = [];
  for (let i = 0; i < 60 * 20; i++) { const sample = monitor.sample(1 / 60, true); if (sample) directions.push(sample.direction); }
  assert.ok(directions.every((direction) => direction === 0));
  monitor.reset(0);
  for (let i = 0; i < 200; i++) { const sample = monitor.sample(0.05, true); if (sample) directions.push(sample.direction); }
  assert.ok(directions.includes(-1));
});
