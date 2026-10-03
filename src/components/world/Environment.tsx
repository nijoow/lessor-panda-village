"use client";

import { DistanceCulledGroup } from "./DistanceCulledGroup";
import { LANTERNS } from "@/constants/world";
import { Lantern } from "./environment/Structures";
import { BAMBOO_CULL_BOUNDS, BambooField } from "./environment/BambooField";
import { StaticScenery } from "./environment/StaticScenery";

// ---------- 메인 환경 컴포넌트 ----------
export const Environment = ({ isNight = false }: { isNight?: boolean }) => {
  return (
    <group>
      {/* 안개는 Scene의 선형 fog가 낮밤 진행도와 함께 관리한다 */}
      <StaticScenery />
      <DistanceCulledGroup
        center={BAMBOO_CULL_BOUNDS.center}
        radius={BAMBOO_CULL_BOUNDS.radius}
      >
        <BambooField />
      </DistanceCulledGroup>

      {/* 석등만 isNight에 반응 */}
      {LANTERNS.map((l, i) => (
        <Lantern key={i} position={[l.x, 0, l.z]} isNight={isNight} />
      ))}
    </group>
  );
};
