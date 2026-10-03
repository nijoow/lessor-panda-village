"use client";

import { useRef, type RefObject } from "react";
import { useFrame } from "@react-three/fiber";
import { Group, Vector3 } from "three";
import { OrbitControls } from "three-stdlib";
import { PLAYER_MOTION } from "@/domain/player";
import { frameLerp } from "@/utils/math";

export function useFollowPlayer(group: RefObject<Group>) {
  const offset = useRef(new Vector3());
  useFrame((state, delta) => {
    const object = group.current,
      controls = state.controls;
    if (!object || !(controls instanceof OrbitControls)) return;
    offset.current
      .copy(object.position)
      .sub(controls.target)
      .multiplyScalar(frameLerp(0.1, Math.min(delta, PLAYER_MOTION.maxDelta)));
    controls.target.add(offset.current);
    state.camera.position.add(offset.current);
  });
}
