'use client';

import { KeyboardControls, KeyboardControlsEntry } from '@react-three/drei';
import { Scene } from '@/components/Scene';
import { Ground } from '@/components/world/Ground';
import { Player, Controls } from '@/components/world/Player';
import { useMemo } from 'react';

export default function Home() {
  // 1. 키보드 컨트롤 매핑을 정의합니다. 
  // 어떤 키(key)를 눌렀을 때 어떤 액션(name)이 실행될지 결정합니다.
  const map = useMemo<KeyboardControlsEntry<Controls>[]>(() => [
    { name: Controls.forward, keys: ['ArrowUp', 'KeyW'] },
    { name: Controls.backward, keys: ['ArrowDown', 'KeyS'] },
    { name: Controls.left, keys: ['ArrowLeft', 'KeyA'] },
    { name: Controls.right, keys: ['ArrowRight', 'KeyD'] },
  ], []);

  return (
    <main className="w-full h-full relative">
      {/* 
        2. UI Layer: 화면 위에 떠 있는 정보를 표시합니다. 
           나중에 가구 선택창 등이 들어갈 자리입니다.
      */}
      <div className="absolute top-10 left-0 w-full z-10 flex flex-col items-center pointer-events-none">
        <h1 className="text-4xl font-bold text-sky-900 bg-white/50 px-6 py-2 rounded-full backdrop-blur-md">
          Panda Village 🐼
        </h1>
        <p className="mt-2 text-sky-800 font-medium">Use arrow keys or WASD to move</p>
      </div>

      {/* 
        3. KeyboardControls Wrapper: 
           해당 영역 안에서 발생하는 키보드 입력을 감지합니다.
      */}
      <KeyboardControls map={map}>
        <Scene>
          <Ground />
          <Player />
        </Scene>
      </KeyboardControls>
    </main>
  );
}
