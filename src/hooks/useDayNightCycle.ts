"use client";

import { useSyncExternalStore } from "react";

/**
 * 낮/밤 각각의 지속 시간 (낮 60초 + 밤 60초 = 전체 2분).
 *
 * 방문자 체류 시간이 짧아 밤을 아예 못 보면 안 되고, 너무 짧으면 세계가
 * 깜빡이는 데모처럼 보인다. 2분이면 접속 후 최대 60초 안에 전환을 반드시
 * 한 번 보게 된다.
 */
const DAY_NIGHT_CYCLE_MS = 60000;
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
