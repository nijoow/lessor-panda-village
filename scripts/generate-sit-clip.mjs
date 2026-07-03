/**
 * base.glb의 스켈레톤에 네이티브로 맞는 "sit" 애니메이션 클립 GLB를 생성합니다.
 * 방식 설명은 scripts/lib/clip-gen.mjs 참고.
 *
 * 사용법: node scripts/generate-sit-clip.mjs
 * 출력:   public/models/player/sitting.glb
 */
import {
  loadRig,
  solveClip,
  writeClipGlb,
  printPose,
  qmul,
  axisAngle,
  X,
  Y,
  Z,
} from "./lib/clip-gen.mjs";

const OUT_PATH = "public/models/player/sitting.glb";

// ---------- 앉기 포즈 (월드 프레임 델타, 캐릭터는 +Z를 바라봄) ----------
// 월드 X축 음수 회전 = 해당 부위가 앞(+Z)으로 접힘
const SIT_POSE = {
  Hips: axisAngle(X, -8), // 골반 살짝 뒤로 기울여 기대는 느낌
  LeftUpLeg: axisAngle(X, -86), // 허벅지를 앞으로 접기
  RightUpLeg: axisAngle(X, -86),
  LeftLeg: axisAngle(X, -12), // 정강이는 거의 수직, 살짝 앞으로 대롱
  RightLeg: axisAngle(X, -12),
  Spine02: axisAngle(X, 7), // 척추는 앞으로 살짝 말아 편안한 슬라우치
  Spine01: axisAngle(X, 5),
  Spine: axisAngle(X, 3),
  neck: axisAngle(X, -6), // 고개는 들어서 정면 유지
  Head: axisAngle(X, -9),
  LeftArm: axisAngle(Z, -34), // 팔을 몸쪽으로 내림
  RightArm: axisAngle(Z, 34),
  LeftForeArm: qmul(axisAngle(X, -48), axisAngle(Z, -10)), // 손을 무릎 위로
  RightForeArm: qmul(axisAngle(X, -48), axisAngle(Z, 10)),
  // 꼬리는 등받이를 뚫지 않도록 좌석 면을 따라 몸 옆으로 낮게 휘감음
  // (레서판다가 앉을 때 꼬리를 몸에 두르는 시그니처 포즈)
  Tail1: qmul(axisAngle(Y, 75), axisAngle(X, -6)),
  Tail2: qmul(axisAngle(Y, 115), axisAngle(X, -12)),
  Tail3: qmul(axisAngle(Y, 150), axisAngle(X, -14)),
  Tail4: qmul(axisAngle(Y, 178), axisAngle(X, -14)),
};

// 앉은 높이: 엉덩이를 휴식 높이에서 살짝 내려 좌석에 밀착 (cm 단위)
const HIPS_SIT_Y_OFFSET = -7;

// 호흡 모션: 진폭이 작아 슬러프 보간으로 자연스럽게 이어짐
const breathDelta = (boneName, phase) => {
  const breath = Math.sin(phase * Math.PI * 2);
  switch (boneName) {
    case "Spine02":
      return axisAngle(X, breath * 2.2);
    case "Spine":
      return axisAngle(X, breath * 1.2);
    case "Head":
      // 호흡과 살짝 어긋난 위상으로 고개가 미세하게 끄덕임
      return axisAngle(X, Math.sin(phase * Math.PI * 2 - 0.6) * 2.0);
    case "LeftArm":
      return axisAngle(Z, breath * -1.5);
    case "RightArm":
      return axisAngle(Z, breath * 1.5);
    // 꼬리 끝이 호흡에 맞춰 잔잔하게 살랑임
    case "Tail3":
      return axisAngle(Y, breath * 2);
    case "Tail4":
      return axisAngle(Y, Math.sin(phase * Math.PI * 2 - 0.5) * 3.5);
    default:
      return null;
  }
};

const rig = loadRig("public/models/player/base.glb");

const clip = solveClip(rig, {
  name: "sit",
  duration: 3.2,
  keyCount: 9,
  delta: (boneName, phase) => {
    const pose = SIT_POSE[boneName];
    const breath = breathDelta(boneName, phase);
    if (pose && breath) return qmul(breath, pose);
    return breath ?? pose ?? null;
  },
  hipsTranslation: (_phase, restT) => [
    restT[0],
    restT[1] + HIPS_SIT_Y_OFFSET,
    restT[2],
  ],
});

printPose(rig, clip, [
  "Hips",
  "LeftUpLeg",
  "LeftLeg",
  "LeftFoot",
  "LeftToeBase",
  "Spine",
  "Head",
  "LeftHand",
  "RightHand",
  "Tail1",
  "Tail2",
  "Tail3",
  "Tail4",
]);

writeClipGlb(OUT_PATH, rig, [clip]);
console.log(`\n✅ ${OUT_PATH} 생성 완료`);
