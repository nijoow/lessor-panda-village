// 최단 경로로 각도 보간 (-PI ~ PI 래핑 처리)
export const lerpAngle = (start: number, end: number, t: number) => {
  const diff = ((end - start + Math.PI) % (Math.PI * 2)) - Math.PI;
  return start + diff * t;
};

// 60fps 기준 per-frame lerp 계수(t)를 실제 프레임 시간(delta)에 맞게 환산.
// 프레임레이트가 달라져도 동일한 감쇠 속도를 유지한다.
export const frameLerp = (t: number, delta: number) =>
  1 - Math.pow(1 - t, delta * 60);
