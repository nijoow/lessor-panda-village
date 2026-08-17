/**
 * 숨쉬기 idle 애니메이션 클립 GLB를 생성합니다.
 *
 * base.glb의 기본 idle(Armature|clip0|baselayer)은 회전 변화가 0인
 * 완전 정적 클립이라 가만히 있으면 동상처럼 보입니다. 가슴이 오르내리는
 * 호흡 + 어깨 들썩임 + 느린 고개 좌우 스웨이를 합성해 살아있는 느낌을
 * 줍니다. 모든 성분이 사인파라 루프 이음새가 없습니다.
 *
 * 방식 설명은 scripts/lib/clip-gen.mjs 참고.
 *
 * 사용법: node scripts/generate-idle-clip.mjs
 * 출력:   public/models/player/idle.glb
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

const OUT_PATH = "public/models/player/idle.glb";
const TWO_PI = Math.PI * 2;

const rig = loadRig("public/models/player/base.glb");

// 4초 루프: 호흡 2회(2초/회) + 고개 스웨이 1회
const idleClip = solveClip(rig, {
  name: "idle",
  duration: 4,
  keyCount: 33,
  delta: (boneName, phase) => {
    const breathe = Math.sin(phase * TWO_PI * 2); // 호흡 (2회/루프)
    const sway = Math.sin(phase * TWO_PI); // 고개 스웨이 (1회/루프)
    switch (boneName) {
      // 가슴 들숨/날숨 — 척추를 따라 점감
      case "Spine01":
        return axisAngle(X, breathe * -2.2);
      case "Spine02":
        return axisAngle(X, breathe * -1.0);
      case "Spine":
        return axisAngle(X, breathe * 1.4); // 상체 반작용으로 자연스럽게
      // 어깨가 호흡에 맞춰 살짝 들림 (진폭 과하면 얼굴까지 흔들려 보임)
      case "LeftShoulder":
        return axisAngle(Z, breathe * 1.0);
      case "RightShoulder":
        return axisAngle(Z, breathe * -1.0);
      // 느린 고개 갸웃 + 호흡 끄덕임
      case "Head":
        return qmul(axisAngle(Z, sway * 2.5), axisAngle(X, breathe * -1.2));
      // 꼬리가 고개 스웨이에 맞춰 반대 위상으로 잔잔하게 살랑임
      case "Tail1":
        return axisAngle(Y, sway * -2);
      case "Tail2":
        return axisAngle(Y, sway * -4);
      case "Tail3":
        return qmul(axisAngle(Y, sway * -6), axisAngle(X, breathe * 1.5));
      case "Tail4":
        return qmul(
          axisAngle(Y, Math.sin(phase * TWO_PI - 0.4) * -8),
          axisAngle(X, breathe * 2),
        );
      default:
        return null;
    }
  },
  // 호흡에 맞춘 아주 미세한 상하 바운스 (cm)
  hipsTranslation: (phase, restT) => {
    const breathe = Math.sin(phase * TWO_PI * 2);
    return [restT[0], restT[1] + breathe * 0.5, restT[2]];
  },
});

// 검증: 들숨 극점(phase 0.125 → key 4)에서 상체 포즈 확인
printPose(rig, idleClip, ["Hips", "Spine", "Head", "LeftShoulder"], 4);

writeClipGlb(OUT_PATH, rig, [idleClip]);
console.log(`\n✅ ${OUT_PATH} 생성 완료 (idle 4s 루프)`);
