"use client";

import { useEffect, useRef, type RefObject } from "react";
import { useFrame } from "@react-three/fiber";
import { useKeyboardControls } from "@react-three/drei";
import type { Group } from "three";
import { Controls } from "@/domain/player";
import { PlayerController } from "@/domain/player/controller";
import type { PlayerAnimType } from "@/constants/playerAnimations";
import { BAMBOO, BENCHES, NOTICE_BOARDS, zoneAt } from "@/constants/world";
import { checkWorldCollision } from "@/lib/worldCollision";
import { findPath } from "@/utils/pathfinder";
import { audio } from "@/lib/audio";
import { worldFrameState } from "@/runtime/worldFrameState";
import { useMoveTargetStore } from "@/stores/moveTargetStore";
import { useInteractionStore } from "@/stores/interactionStore";
import { useGuestbookStore } from "@/stores/guestbookStore";
import { useHarvestStore } from "@/stores/harvestStore";
import { useZoneStore } from "@/stores/zoneStore";

interface AnimationAdapter {
  playAction(anim: PlayerAnimType, fade?: number): void;
  getCurrentAction(): PlayerAnimType;
}

/** Translates a domain frame result into the application's external effects. */
export function usePlayerController(
  group: RefObject<Group>,
  disabled: boolean,
  animation: AnimationAdapter,
) {
  const [, getKeys] = useKeyboardControls<Controls>();
  const controller = useRef<PlayerController | null>(null);
  if (controller.current === null)
    controller.current = new PlayerController({
      benches: BENCHES,
      bamboo: BAMBOO,
      boards: NOTICE_BOARDS,
      isHarvested: (index) => useHarvestStore.getState().isHarvested(index),
      collision: checkWorldCollision,
      findPath: (start, end) => findPath(start, end, checkWorldCollision),
    });
  useEffect(
    () => () => {
      worldFrameState.resetPlayer();
      useInteractionStore.getState().setSitting(false);
      useInteractionStore.getState().setNearbyBench(null);
      useHarvestStore.getState().setNearbyBamboo(null);
      useGuestbookStore.getState().setNearbyBoard(null);
    },
    [],
  );

  useFrame((state, delta) => {
    if (!group.current || !controller.current) return;
    const interactions = useInteractionStore.getState();
    const harvest = useHarvestStore.getState();
    const guestbook = useGuestbookStore.getState();
    const frame = controller.current.step({
      delta,
      camera: state.camera.position,
      keys: getKeys(),
      disabled,
      commands: {
        move: useMoveTargetStore.getState().request,
        sit: interactions.toggleSitRequestId,
        harvest: harvest.harvestRequestId,
        emote: interactions.emoteRequest,
      },
    });
    const { pose } = frame;
    group.current.position.set(pose.x, pose.y, pose.z);
    group.current.rotation.set(0, pose.ry, 0);
    group.current.updateMatrixWorld();
    animation.playAction(frame.animation.anim, frame.animation.fade);
    interactions.setSitting(frame.sitting);
    interactions.setNearbyBench(frame.nearby.bench);
    harvest.setNearbyBamboo(frame.nearby.bamboo);
    guestbook.setNearbyBoard(frame.nearby.board);
    const zone = zoneAt(pose.x, pose.z);
    useZoneStore.getState().setZone(zone?.id ?? null, zone?.name ?? null);
    worldFrameState.publishPlayer(
      pose,
      pose.ry,
      animation.getCurrentAction(),
      frame.emoting,
      state.clock.elapsedTime,
    );
    for (const event of frame.events) {
      switch (event.kind) {
        case "jump":
          audio.jump();
          break;
        case "land":
          audio.land();
          break;
        case "footstep":
          audio.footstep(event.running);
          break;
        case "harvest":
          harvest.harvest(event.index);
          audio.harvestPop();
          break;
        case "guestbook":
          guestbook.open();
          break;
      }
    }
  });
}
