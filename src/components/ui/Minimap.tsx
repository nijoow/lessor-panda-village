"use client";

import { useEffect, useRef } from "react";
import {
  GRASS_PATCHES,
  DIRT_PATCHES,
  COLLISION_PONDS,
  HOUSES,
  TREES,
  BAMBOO,
  FENCES,
  BRIDGES,
  WORLD_BOUNDS,
  WORLD_SIZE,
} from "@/constants/world";
import { useZoneStore } from "@/stores/zoneStore";

// 월드가 정사각형이 아니므로 캔버스도 같은 비율로 잡는다.
// 두 축의 축척이 같아야 거리와 방향이 왜곡되지 않는다.
const MAP_W = 148; // 캔버스 px
const SCALE = MAP_W / WORLD_SIZE.width; // px per world unit
const MAP_H = Math.round(WORLD_SIZE.depth * SCALE);

const toMapX = (x: number) => (x - WORLD_BOUNDS.minX) * SCALE;
const toMapZ = (z: number) => (z - WORLD_BOUNDS.minZ) * SCALE;
const toMapLen = (v: number) => v * SCALE;

// 존 데이터에서 정적 배경을 오프스크린 캔버스에 1회 렌더
const drawBackground = () => {
  const c = document.createElement("canvas");
  c.width = MAP_W;
  c.height = MAP_H;
  const ctx = c.getContext("2d")!;

  ctx.fillStyle = "#7cb956";
  ctx.fillRect(0, 0, MAP_W, MAP_H);

  for (const g of GRASS_PATCHES) {
    ctx.fillStyle = g.color;
    ctx.globalAlpha = g.opacity * 0.8;
    ctx.fillRect(
      toMapX(g.x - g.width / 2),
      toMapZ(g.z - g.depth / 2),
      toMapLen(g.width),
      toMapLen(g.depth),
    );
  }
  ctx.globalAlpha = 1;

  ctx.fillStyle = "#bda17a";
  for (const d of DIRT_PATCHES) {
    ctx.beginPath();
    ctx.arc(toMapX(d.x), toMapZ(d.z), Math.max(1.5, toMapLen(d.radius)), 0, 7);
    ctx.fill();
  }

  // 물 (연못 + 강 샘플 원)
  ctx.fillStyle = "#4fa8cf";
  for (const p of COLLISION_PONDS) {
    ctx.beginPath();
    ctx.arc(toMapX(p.x), toMapZ(p.z), Math.max(1.5, toMapLen(p.radius)), 0, 7);
    ctx.fill();
  }

  // 다리
  ctx.fillStyle = "#9a6f4b";
  for (const b of BRIDGES) {
    ctx.save();
    ctx.translate(toMapX(b.x), toMapZ(b.z));
    ctx.rotate(b.rotation);
    ctx.fillRect(
      -toMapLen(b.length / 2),
      -toMapLen(b.width / 2 + 0.6),
      toMapLen(b.length),
      toMapLen(b.width + 1.2),
    );
    ctx.restore();
  }

  // 울타리
  ctx.strokeStyle = "#c8a96a";
  ctx.lineWidth = 1;
  for (const f of FENCES) {
    const seg = (line: number[], axis: "x" | "z", at: number) => {
      if (!line.length) return;
      const from = Math.min(...line) - 1;
      const to = Math.max(...line) + 1;
      ctx.beginPath();
      if (axis === "z") {
        ctx.moveTo(toMapX(from), toMapZ(at));
        ctx.lineTo(toMapX(to), toMapZ(at));
      } else {
        ctx.moveTo(toMapX(at), toMapZ(from));
        ctx.lineTo(toMapX(at), toMapZ(to));
      }
      ctx.stroke();
    };
    seg(f.lines.south, "z", f.dist);
    seg(f.lines.north, "z", -f.dist);
    seg(f.lines.west, "x", -f.dist);
    seg(f.lines.east, "x", f.dist);
  }

  // 집
  ctx.fillStyle = "#8d6543";
  for (const h of HOUSES) {
    ctx.fillRect(
      toMapX(h.box.minX),
      toMapZ(h.box.minZ),
      toMapLen(h.box.maxX - h.box.minX),
      toMapLen(h.box.maxZ - h.box.minZ),
    );
  }

  // 나무·대나무 점
  ctx.fillStyle = "#3e7d3a";
  for (const t of TREES) {
    ctx.fillRect(toMapX(t.x) - 1, toMapZ(t.z) - 1, 2, 2);
  }
  ctx.fillStyle = "#4c9c45";
  for (const b of BAMBOO) {
    ctx.fillRect(toMapX(b.x) - 0.5, toMapZ(b.z) - 0.5, 1, 1);
  }

  return c;
};

/** 좌상단 실시간 미니맵 — 존 데이터에서 자동 생성 */
export const Minimap = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d")!;
    const bg = drawBackground();
    const playerPos = useZoneStore.getState().playerPos;
    let raf = 0;

    const render = () => {
      ctx.clearRect(0, 0, MAP_W, MAP_H);
      ctx.drawImage(bg, 0, 0);
      // 플레이어 방향 화살표
      ctx.save();
      ctx.translate(toMapX(playerPos.x), toMapZ(playerPos.z));
      // 월드 +z(ry=0 방향)가 맵에서는 아래쪽
      ctx.rotate(Math.PI - playerPos.ry);
      ctx.fillStyle = "#ff5252";
      ctx.strokeStyle = "#ffffff";
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.moveTo(0, -4.6);
      ctx.lineTo(3.4, 3.6);
      ctx.lineTo(0, 1.8);
      ctx.lineTo(-3.4, 3.6);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      ctx.restore();
      raf = requestAnimationFrame(render);
    };
    raf = requestAnimationFrame(render);
    return () => cancelAnimationFrame(raf);
  }, []);

  return (
    <div className="absolute top-4 left-4 z-40 pointer-events-none">
      <div className="glass-card rounded-2xl p-1.5 border-white/25 shadow-xl">
        <canvas
          ref={canvasRef}
          width={MAP_W}
          height={MAP_H}
          className="rounded-xl block"
          style={{ width: MAP_W, height: MAP_H }}
        />
      </div>
    </div>
  );
};
