import assert from "node:assert/strict";
import { test } from "node:test";
import { loadSource } from "./helpers/load-source.mjs";

const { chooseInteraction } = loadSource("src/domain/interaction.ts");

test("keyboard and UI share the interaction priority, including standing up", () => {
  const nearby = { sitting: false, bench: 0, board: 0, bamboo: 0 };
  assert.equal(chooseInteraction({ ...nearby, sitting: true }), "stand");
  assert.equal(chooseInteraction(nearby), "sit");
  assert.equal(chooseInteraction({ ...nearby, bench: null }), "guestbook");
  assert.equal(
    chooseInteraction({ ...nearby, bench: null, board: null }),
    "harvest",
  );
  assert.equal(
    chooseInteraction({
      sitting: false,
      bench: null,
      board: null,
      bamboo: null,
    }),
    null,
  );
});

test("frame consumers keep a stable, complete player view across publication and reset", () => {
  const { createWorldFrameState } = loadSource(
    "src/runtime/worldFrameState.ts",
  );
  const frame = createWorldFrameState();
  const player = frame.player;
  const shadows = frame.shadows;
  frame.publishPlayer({ x: 4, y: 2, z: 6 }, 1.5, "wave", true, 10);
  assert.equal(frame.player, player);
  assert.equal(frame.shadows, shadows);
  assert.equal(player.y, 2);
  assert.equal(player.emoting, true);
  assert.equal(shadows.animationUntil, 11.5);
  frame.publishPlayer({ x: 5, y: 0, z: 7 }, 2, "wave", true, 11);
  assert.equal(
    shadows.revision,
    1,
    "same animation does not restart its transition",
  );
  frame.invalidateShadows();
  assert.equal(shadows.revision, 2);
  frame.resetPlayer();
  assert.equal(player.x, 0);
  assert.equal(player.y, 0);
  assert.equal(player.emoting, false);
  assert.equal(player.anim, "idle");
  assert.equal(shadows.animationUntil, 0);
});

test("duplicate harvesting and respawning preserve both visual and collision state", () => {
  const timers = [];
  const { useHarvestStore } = loadSource(
    "src/stores/harvestStore.ts",
    {},
    { setTimeout: (fn) => timers.push(fn) },
  );
  const state = () => useHarvestStore.getState();
  state().harvest(2);
  state().harvest(2);
  assert.equal(state().bambooCount, 2);
  assert.equal(state().harvestedIds.length, 1);
  assert.equal(state().isHarvested(2), true);
  assert.equal(timers.length, 1);
  timers[0]();
  assert.equal(state().isHarvested(2), false);
  assert.equal(state().harvestedIds.length, 0);
  assert.equal(state().revision, 2);
  for (const amount of [NaN, Infinity, -1, 0, 0.5, 3])
    assert.equal(state().spendBamboo(amount), false);
  assert.equal(state().bambooCount, 2);
  assert.equal(state().spendBamboo(1), true);
  assert.equal(state().bambooCount, 1);
});

test("path finding and smoothing use the same supplied obstacle policy", () => {
  const { findPath, isPathClear } = loadSource("src/utils/pathfinder.ts");
  const blocked = (x, z) => Math.abs(x - 2) < 0.8 && Math.abs(z) < 0.8;
  const start = { x: 0, z: 0 };
  const end = { x: 4, z: 0 };
  const path = findPath(start, end, blocked);
  assert.ok(path.length > 1, "the obstacle requires a detour");
  let previous = start;
  for (const point of path) {
    assert.equal(blocked(point.x, point.z), false);
    assert.equal(isPathClear(previous, point, blocked), true);
    previous = point;
  }
  assert.equal(previous.x, end.x);
  assert.equal(previous.z, end.z);
  assert.equal(findPath(start, { x: 2, z: 0 }, blocked).length, 0);
});
