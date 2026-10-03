"use client";

import { useRef } from "react";
import { Group } from "three";
import type { PlayerPose } from "@/domain/player";
import { GRAPHICS_PRESETS } from "@/constants/rendering";
import { useGraphicsStore } from "@/stores/graphicsStore";
import { usePlayerController } from "@/hooks/usePlayerController";
import { usePlayerBroadcast } from "@/hooks/usePlayerBroadcast";
import { useFollowPlayer } from "@/hooks/useFollowPlayer";
import { usePandaModel, PandaBody, PandaNameTag } from "./PandaModel";

interface Props {
  id: string;
  nickname: string;
  onMove?: (pose: PlayerPose) => void;
  inputDisabled?: boolean;
}

export const Player = ({
  id,
  nickname,
  onMove,
  inputDisabled = false,
}: Props) => {
  const group = useRef<Group>(null!);
  const quality = useGraphicsStore((state) => state.quality);
  const model = usePandaModel(group);
  usePlayerController(group, inputDisabled, model);
  usePlayerBroadcast(group, model.getCurrentAction, onMove);
  useFollowPlayer(group);
  const shadows = GRAPHICS_PRESETS[quality].shadows;
  return (
    <group ref={group} dispose={null}>
      <PandaBody
        nodes={model.nodes}
        materials={model.materials}
        castShadow={shadows}
        fakeShadow={!shadows}
      />
      <PandaNameTag id={id} nickname={nickname} />
    </group>
  );
};
