import type {
  BenchPlacement,
  BambooPlacement,
  NoticeBoardPlacement,
} from "@/constants/world/types";
import { BENCH_SPEC } from "@/constants/world/objects";
import { PLAYER_MOTION } from "@/domain/player";

export interface PlayerWorld {
  benches: readonly BenchPlacement[];
  bamboo: readonly BambooPlacement[];
  boards: readonly NoticeBoardPlacement[];
  isHarvested: (index: number) => boolean;
}

export function nearbyObjects(world: PlayerWorld, x: number, z: number) {
  const nearest = (
    placements: readonly { x: number; z: number; range?: number }[],
    range: number,
    excluded: (index: number) => boolean = () => false,
  ) => {
    let best = Infinity,
      index: number | null = null;
    for (let i = 0; i < placements.length; i++) {
      if (excluded(i)) continue;
      const object = placements[i];
      const distance = (object.x - x) ** 2 + (object.z - z) ** 2;
      const limit = object.range ?? range;
      if (distance < limit * limit && distance < best) {
        best = distance;
        index = i;
      }
    }
    return index;
  };
  return {
    bench: nearest(world.benches, BENCH_SPEC.interactionRange),
    board: nearest(world.boards, Infinity),
    bamboo: nearest(
      world.bamboo,
      PLAYER_MOTION.harvestRange,
      world.isHarvested,
    ),
  };
}

export function nearestSeat(bench: BenchPlacement, x: number, z: number) {
  const cos = Math.cos(bench.rotation),
    sin = Math.sin(bench.rotation);
  const slot =
    (x - bench.x) * cos - (z - bench.z) * sin <= 0
      ? -BENCH_SPEC.seatOffset
      : BENCH_SPEC.seatOffset;
  return {
    x: bench.x + slot * cos,
    z: bench.z - slot * sin,
    ry: bench.rotation,
  };
}
