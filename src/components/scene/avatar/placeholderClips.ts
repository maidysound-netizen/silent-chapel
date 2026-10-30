// 임시 캐릭터용 Idle / Walk / Run 애니메이션 클립을 코드로 만듭니다 (키프레임 트랙).
// 대상 노드 이름: Body(전체 위아래), Hem(옷자락 흔들림), Upper(윗몸 기울기·비틀기), Head(고개).
// 모든 클립이 네 노드를 다 다뤄야 크로스페이드할 때 값이 튀지 않습니다.
import * as THREE from "three";

const q = (x: number, y = 0, z = 0) => new THREE.Quaternion().setFromEuler(new THREE.Euler(x, y, z)).toArray() as number[];

/** 한 바퀴 도는 동작: times(0..1 비율)와 값들을 duration에 맞춰 트랙으로 */
function loopClip(
  name: string,
  duration: number,
  times: number[],
  frames: { bodyY: number; hemZ: number; upper: [number, number, number]; head: number }[],
) {
  const t = times.map((x) => x * duration);
  return new THREE.AnimationClip(name, duration, [
    new THREE.VectorKeyframeTrack("Body.position", t, frames.flatMap((f) => [0, f.bodyY, 0])),
    new THREE.QuaternionKeyframeTrack("Hem.quaternion", t, frames.flatMap((f) => q(0, 0, f.hemZ))),
    new THREE.QuaternionKeyframeTrack("Upper.quaternion", t, frames.flatMap((f) => q(...f.upper))),
    new THREE.QuaternionKeyframeTrack("Head.quaternion", t, frames.flatMap((f) => q(f.head))),
  ]);
}

let cache: { idle: THREE.AnimationClip; walk: THREE.AnimationClip; run: THREE.AnimationClip } | null = null;

/** 모든 아바타가 같은 클립을 공유합니다 (믹서는 아바타마다 따로) */
export function placeholderClips() {
  if (cache) return cache;
  // 숨쉬기: 아주 조금 오르내리고 고개를 살짝 숙였다 듦
  const idle = loopClip("Idle", 4, [0, 0.5, 1], [
    { bodyY: 0, hemZ: 0, upper: [0, 0, 0], head: 0 },
    { bodyY: 0.008, hemZ: 0, upper: [-0.025, 0, 0], head: -0.05 },
    { bodyY: 0, hemZ: 0, upper: [0, 0, 0], head: 0 },
  ]);
  // 걷기 (두 걸음 1초): 걸음마다 오르내림, 옷자락 좌우, 윗몸 살짝 앞으로·비틀기
  const walk = loopClip("Walk", 1.0, [0, 0.25, 0.5, 0.75, 1], [
    { bodyY: 0, hemZ: 0.05, upper: [-0.06, 0.05, 0], head: 0.03 },
    { bodyY: 0.03, hemZ: 0, upper: [-0.06, 0, 0], head: 0.03 },
    { bodyY: 0, hemZ: -0.05, upper: [-0.06, -0.05, 0], head: 0.03 },
    { bodyY: 0.03, hemZ: 0, upper: [-0.06, 0, 0], head: 0.03 },
    { bodyY: 0, hemZ: 0.05, upper: [-0.06, 0.05, 0], head: 0.03 },
  ]);
  // 달리기 (두 걸음 0.6초): 더 크게 튀고, 윗몸을 앞으로 숙임
  const run = loopClip("Run", 0.6, [0, 0.25, 0.5, 0.75, 1], [
    { bodyY: 0, hemZ: 0.1, upper: [-0.24, 0.1, 0], head: 0.12 },
    { bodyY: 0.07, hemZ: 0, upper: [-0.26, 0, 0], head: 0.12 },
    { bodyY: 0, hemZ: -0.1, upper: [-0.24, -0.1, 0], head: 0.12 },
    { bodyY: 0.07, hemZ: 0, upper: [-0.26, 0, 0], head: 0.12 },
    { bodyY: 0, hemZ: 0.1, upper: [-0.24, 0.1, 0], head: 0.12 },
  ]);
  cache = { idle, walk, run };
  return cache;
}
