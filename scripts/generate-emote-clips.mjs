/**
 * 이모트(wave 인사, dance 춤) 애니메이션 클립 GLB를 생성합니다.
 * 방식 설명은 scripts/lib/clip-gen.mjs 참고.
 *
 * 사용법: node scripts/generate-emote-clips.mjs
 * 출력:   public/models/player/emotes.glb (클립 2개 포함)
 */
import {
  loadRig,
  solveClip,
  writeClipGlb,
  printPose,
  qmul,
  axisAngle,
  X,
  Z,
} from "./lib/clip-gen.mjs";

const OUT_PATH = "public/models/player/emotes.glb";
const TWO_PI = Math.PI * 2;

const rig = loadRig("public/models/player/base.glb");

// ---------- wave: 오른팔 들고 좌우로 흔드는 인사 (1.6초 루프) ----------
// 캐릭터는 +Z를 바라봄. 오른팔 들기 = 월드 Z축 음수 회전 (좌우 비대칭 주의)
const waveClip = solveClip(rig, {
  name: "wave",
  duration: 1.6,
  keyCount: 17,
  delta: (boneName, phase) => {
    // 루프당 2회 흔들기 (phase 0/1에서 0이 되어 루프 이음새 없음)
    const swing = Math.sin(phase * TWO_PI * 2);
    switch (boneName) {
      case "RightShoulder":
        return axisAngle(Z, -12);
      case "RightArm":
        return axisAngle(Z, -115); // 팔을 위로 들기
      case "RightForeArm":
        return axisAngle(Z, -160 + swing * 18); // 손목 위로 + 좌우 스윙
      case "RightHand":
        return axisAngle(Z, swing * 10);
      case "Spine02":
        return axisAngle(Z, swing * 2);
      case "Head":
        return qmul(axisAngle(Z, 7), axisAngle(X, -4)); // 고개 살짝 기울이고 들기
      default:
        return null;
    }
  },
});

// ---------- dance: 좌우 스웨이 + 팔 펌핑 + 바운스 (2.4초 루프) ----------
const danceClip = solveClip(rig, {
  name: "dance",
  duration: 2.4,
  keyCount: 25,
  delta: (boneName, phase) => {
    const sway = Math.sin(phase * TWO_PI); // 좌우 1회 왕복
    const pump = Math.sin(phase * TWO_PI * 2); // 팔 2회 펌핑
    const bounce = (1 - Math.cos(phase * TWO_PI * 2)) / 2; // 0~1, 2회 바운스
    switch (boneName) {
      case "Hips":
        return axisAngle(Z, sway * 10);
      case "Spine02":
        return axisAngle(Z, sway * -6);
      case "Spine":
        return axisAngle(Z, sway * -3);
      case "LeftArm": // 왼팔 올리기 = +Z, 펌핑
        return axisAngle(Z, 70 + pump * 25);
      case "RightArm": // 오른팔은 반대 위상으로 펌핑
        return axisAngle(Z, -70 + pump * 25);
      case "LeftForeArm":
        return qmul(axisAngle(X, -25), axisAngle(Z, 30 + pump * 15));
      case "RightForeArm":
        return qmul(axisAngle(X, -25), axisAngle(Z, -30 + pump * 15));
      case "Head":
        return qmul(
          axisAngle(Z, sway * 6),
          axisAngle(X, Math.sin(phase * TWO_PI * 2 + 0.5) * 7), // 고개 끄덕임
        );
      // 바운스에 맞춰 무릎을 살짝 굽혔다 펴기 (발이 끌리지 않도록 반대 회전)
      case "LeftUpLeg":
      case "RightUpLeg":
        return axisAngle(X, bounce * -14);
      case "LeftLeg":
      case "RightLeg":
        return axisAngle(X, bounce * 10);
      default:
        return null;
    }
  },
  hipsTranslation: (phase, restT) => {
    const sway = Math.sin(phase * TWO_PI);
    const bounce = (1 - Math.cos(phase * TWO_PI * 2)) / 2;
    return [restT[0] + sway * 5, restT[1] - bounce * 6, restT[2]];
  },
});

// 검증: wave는 손이 머리 위로 올라갔는지, dance는 스웨이 극점 포즈 확인
printPose(rig, waveClip, ["RightArm", "RightForeArm", "RightHand", "Head"], 4);
console.log();
printPose(rig, danceClip, ["Hips", "LeftHand", "RightHand", "LeftFoot", "Head"], 6);

writeClipGlb(OUT_PATH, rig, [waveClip, danceClip]);
console.log(`\n✅ ${OUT_PATH} 생성 완료 (wave 1.6s, dance 2.4s)`);
