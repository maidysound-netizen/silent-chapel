// 성호 긋기: 오른손이 이마 → 가슴 → 왼쪽 어깨 → 오른쪽 어깨 → 가슴(손 모음) 순서로 움직입니다.
// 위치는 '머리 중심' 기준 상대 좌표(m)이고, 아바타 정면은 -Z, 아바타의 왼쪽은 -X 입니다.

export const CROSS_MS = 3000;

type Key = { t: number; p: readonly [number, number, number] };

const REST: readonly [number, number, number] = [0.05, -0.5, -0.2]; // 가슴 앞 모은 손 근처
const FOREHEAD: readonly [number, number, number] = [0, 0.04, -0.15];
const CHEST: readonly [number, number, number] = [0, -0.38, -0.2];
const LEFT_SHOULDER: readonly [number, number, number] = [-0.18, -0.19, -0.12];
const RIGHT_SHOULDER: readonly [number, number, number] = [0.18, -0.19, -0.12];

/** 시각(초)별 손 위치. 사이사이 잠깐 멈춰 또박또박 긋도록 같은 위치를 두 번 둡니다 */
export const CROSS_KEYS: readonly Key[] = [
  { t: 0, p: REST },
  { t: 0.45, p: FOREHEAD },
  { t: 0.7, p: FOREHEAD },
  { t: 1.15, p: CHEST },
  { t: 1.35, p: CHEST },
  { t: 1.75, p: LEFT_SHOULDER },
  { t: 1.9, p: LEFT_SHOULDER },
  { t: 2.3, p: RIGHT_SHOULDER },
  { t: 2.5, p: RIGHT_SHOULDER },
  { t: 3.0, p: REST },
];

const smooth = (x: number) => x * x * (3 - 2 * x);

/** 성호 긋는 중이면 오른손 위치, 아니면 null */
export function crossHandOffset(at: number, now: number): [number, number, number] | null {
  const e = (now - at) / 1000;
  if (at <= 0 || e < 0 || e >= CROSS_MS / 1000) return null;
  for (let i = 1; i < CROSS_KEYS.length; i++) {
    const a = CROSS_KEYS[i - 1];
    const b = CROSS_KEYS[i];
    if (e <= b.t) {
      const k = smooth((e - a.t) / (b.t - a.t));
      return [a.p[0] + (b.p[0] - a.p[0]) * k, a.p[1] + (b.p[1] - a.p[1]) * k, a.p[2] + (b.p[2] - a.p[2]) * k];
    }
  }
  return null;
}

export const CROSS_POINTS = { FOREHEAD, CHEST, LEFT_SHOULDER, RIGHT_SHOULDER };
