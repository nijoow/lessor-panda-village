"use client";

import { useSyncExternalStore } from "react";

// 낮/밤 전환 주기 (낮 30초 + 밤 30초 = 전체 60초)
const DAY_NIGHT_CYCLE_MS = 30000;
const POLL_INTERVAL_MS = 1000;

// 벽시계 기반 결정적 계산 - 모든 클라이언트가 동일한 낮/밤을 공유
const getIsNight = () => Math.floor(Date.now() / DAY_NIGHT_CYCLE_MS) % 2 === 1;

// 1초마다 스냅샷을 확인해 값이 바뀔 때만 리렌더
const subscribe = (onChange: () => void) => {
  const interval = setInterval(onChange, POLL_INTERVAL_MS);
  return () => clearInterval(interval);
};

/** 접속 시점과 무관하게 전 클라이언트가 동기화되는 낮/밤 상태 */
export const useDayNightCycle = () =>
  useSyncExternalStore(subscribe, getIsNight, () => false);
