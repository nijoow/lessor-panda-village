/**
 * 카메라에서 이 거리까지는 원래 색을 유지하고, far에서 하늘색으로 완전히
 * 사라진다. OrbitControls의 최대 거리(40)보다 near가 커서 줌아웃해도
 * 플레이어 본체에는 안개가 끼지 않는다.
 */
export const WORLD_FOG = {
  day: { near: 52, far: 105 },
  night: { near: 42, far: 88 },
} as const;

/** 안개로 완전히 사라진 뒤 인스턴스를 제거해 팝인을 숨기는 여유 거리 */
export const SCENERY_CULL_MARGIN = 6;

/** 카메라가 이만큼 움직였을 때만 정적 인스턴스 목록을 다시 압축한다. */
export const SCENERY_CULL_UPDATE_DISTANCE = 2;

export type GraphicsQuality = "low" | "medium" | "high";
export type GraphicsMode = "auto" | GraphicsQuality;

export const GRAPHICS_PRESETS = {
  low: {
    dpr: 1,
    shadowMapSize: 1024,
    shadows: false,
    bloom: false,
    multisampling: 0,
    stars: 800,
    particleRatio: 0.35,
    remoteAnimationFps: 15,
  },
  medium: {
    dpr: 1,
    shadowMapSize: 1024,
    shadows: true,
    bloom: true,
    multisampling: 0,
    stars: 1800,
    particleRatio: 0.65,
    remoteAnimationFps: 24,
  },
  high: {
    dpr: 1.5,
    shadowMapSize: 2048,
    shadows: true,
    bloom: true,
    multisampling: 2,
    stars: 3000,
    particleRatio: 1,
    remoteAnimationFps: 30,
  },
} as const;
