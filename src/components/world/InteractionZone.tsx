import { useFrame } from "@react-three/fiber";
import { useKeyboardControls } from "@react-three/drei";
import { useRef, useState } from "react";
import * as THREE from "three";
import { Controls } from "./Player";
import { InteractionPrompt } from "../ui/InteractionPrompt";
import { COLLISION_HOUSE } from "@/constants/collisionMap";

interface InteractionZoneProps {
  playerRef: React.RefObject<THREE.Group>;
  onInteract: () => void;
}

export const InteractionZone = ({
  playerRef,
  onInteract,
}: InteractionZoneProps) => {
  const [canInteract, setCanInteract] = useState(false);
  const [, getKeys] = useKeyboardControls<Controls>();
  const isCooldown = useRef(false);

  // 상호작용 지점 (집 문 근처)
  const INTERACT_POINT = new THREE.Vector3(0, 0, -4.5);
  const INTERACT_DISTANCE = 2.5;

  useFrame(() => {
    if (!playerRef.current) return;

    const playerPos = playerRef.current.position;
    const distance = playerPos.distanceTo(INTERACT_POINT);

    const isInRange = distance < INTERACT_DISTANCE;

    if (isInRange !== canInteract) {
      setCanInteract(isInRange);
    }

    if (isInRange) {
      const { interact } = getKeys();
      if (interact && !isCooldown.current) {
        onInteract();
        isCooldown.current = true;
        // 연속 입력 방지 쿨다운
        setTimeout(() => {
          isCooldown.current = false;
        }, 500);
      }
    }
  });

  return (
    <group position={[INTERACT_POINT.x, 0, INTERACT_POINT.z]}>
      <InteractionPrompt isVisible={canInteract} position={[0, 2.8, 0]} />
    </group>
  );
};
