"use client";

import { useEffect, useRef, type RefObject } from "react";
import { useFrame } from "@react-three/fiber";
import type { Group } from "three";
import type { PlayerPose } from "@/domain/player";
import type { PlayerAnimType } from "@/constants/playerAnimations";

export function usePlayerBroadcast(group: RefObject<Group>, getAnimation: () => PlayerAnimType, onMove?: (pose: PlayerPose) => void) {
  const elapsed = useRef(0);
  const lastSent = useRef<PlayerPose | null>(null);
  useEffect(() => {
    const object = group.current;
    if (object) onMove?.({ x: object.position.x, y: object.position.y, z: object.position.z, ry: object.rotation.y, anim: getAnimation() });
  }, [group, getAnimation, onMove]);
  useFrame((_state, delta) => {
    const object = group.current;
    if (!object || !onMove || (elapsed.current += delta) <= 0.1) return;
    elapsed.current = 0;
    const position = object.position, ry = object.rotation.y, anim = getAnimation();
    const previous = lastSent.current;
    if (previous && Math.abs(previous.x - position.x) <= 0.01 && Math.abs(previous.y - position.y) <= 0.01 && Math.abs(previous.z - position.z) <= 0.01 && Math.abs(previous.ry - ry) <= 0.01 && previous.anim === anim) return;
    const pose = { x: position.x, y: position.y, z: position.z, ry, anim };
    lastSent.current = pose;
    onMove(pose);
  });
}
