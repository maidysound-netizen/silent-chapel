// 시간에 따라 바뀌는 성당 조명 (한국 시간 기준).
//   밤(21:30~05:00): 어둑하고 촛불이 은은한 성당   새벽(05~08): 푸르스름하게 밝아짐
//   낮(08~16:30): 화사한 햇빛                     해 질 녘(16:30~20): 노을빛 → 저녁
// 시각 사이의 값은 부드럽게 섞습니다. 주소에 ?hour=21 처럼 붙이면 그 시각으로 볼 수 있습니다.

export interface LightMood {
  /** 배경·안개 색 */
  background: string;
  fog: string;
  /** 하늘빛(반구광) 위·아래 색과 세기 */
  sky: string;
  ground: string;
  hemi: number;
  ambient: number;
  /** 창으로 들어오는 해(달)빛 */
  sun: number;
  sunColor: string;
  /** 빛줄기 판 투명도 */
  shafts: number;
  /** 화면 노출 */
  exposure: number;
  /** 촛불(제단·봉헌 초·장미 제단) 밝기 배율 — 밤에 더 돋보이게 */
  candles: number;
}

const NIGHT: LightMood = {
  background: "#120d09",
  fog: "#1a130d",
  sky: "#b9c4dc",
  ground: "#3a2a1c",
  hemi: 0.38,
  ambient: 0.13,
  sun: 0.35,
  sunColor: "#9fb2e0",
  shafts: 0.012,
  exposure: 1.0,
  candles: 1.5,
};
const DAWN: LightMood = {
  background: "#2a2630",
  fog: "#3a3442",
  sky: "#dfe3f5",
  ground: "#6a5a50",
  hemi: 0.7,
  ambient: 0.22,
  sun: 1.0,
  sunColor: "#ffd9c0",
  shafts: 0.05,
  exposure: 1.12,
  candles: 1.15,
};
const DAY: LightMood = {
  background: "#3a2f24",
  fog: "#5a4a38",
  sky: "#fff3dc",
  ground: "#8a6a4a",
  hemi: 0.95,
  ambient: 0.3,
  sun: 1.6,
  sunColor: "#fff0d2",
  shafts: 0.075,
  exposure: 1.25,
  candles: 1.0,
};
const DUSK: LightMood = {
  background: "#2a1a12",
  fog: "#3e2618",
  sky: "#ffd2a8",
  ground: "#6a4430",
  hemi: 0.72,
  ambient: 0.22,
  sun: 1.35,
  sunColor: "#ff9e5e",
  shafts: 0.08,
  exposure: 1.15,
  candles: 1.2,
};
const EVENING: LightMood = {
  background: "#18110d",
  fog: "#22180f",
  sky: "#c8b8c8",
  ground: "#4a3424",
  hemi: 0.5,
  ambient: 0.17,
  sun: 0.5,
  sunColor: "#b39ad0",
  shafts: 0.025,
  exposure: 1.05,
  candles: 1.4,
};

/** 시각(시, 0~24)별 기준 조명. 사이 값은 섞음 */
export const MOOD_KEYS: readonly { h: number; m: LightMood }[] = [
  { h: 0, m: NIGHT },
  { h: 5, m: NIGHT },
  { h: 6.5, m: DAWN },
  { h: 8, m: DAY },
  { h: 16.5, m: DAY },
  { h: 18.5, m: DUSK },
  { h: 20, m: EVENING },
  { h: 21.5, m: NIGHT },
  { h: 24, m: NIGHT },
];

/** 지금 한국 시각(0~24, 소수점은 분) */
export function koreaHour(now = new Date()): number {
  return (now.getUTCHours() + 9 + now.getUTCMinutes() / 60) % 24;
}

function mixHex(a: string, b: string, t: number): string {
  const pa = parseInt(a.slice(1), 16);
  const pb = parseInt(b.slice(1), 16);
  const ch = (s: number) => {
    const x = (pa >> s) & 255;
    const y = (pb >> s) & 255;
    return Math.round(x + (y - x) * t);
  };
  return `#${((ch(16) << 16) | (ch(8) << 8) | ch(0)).toString(16).padStart(6, "0")}`;
}

function mix(a: LightMood, b: LightMood, t: number): LightMood {
  const n = (x: number, y: number) => x + (y - x) * t;
  return {
    background: mixHex(a.background, b.background, t),
    fog: mixHex(a.fog, b.fog, t),
    sky: mixHex(a.sky, b.sky, t),
    ground: mixHex(a.ground, b.ground, t),
    hemi: n(a.hemi, b.hemi),
    ambient: n(a.ambient, b.ambient),
    sun: n(a.sun, b.sun),
    sunColor: mixHex(a.sunColor, b.sunColor, t),
    shafts: n(a.shafts, b.shafts),
    exposure: n(a.exposure, b.exposure),
    candles: n(a.candles, b.candles),
  };
}

/** 시각(0~24)의 조명 */
export function moodAt(hour: number): LightMood {
  const h = ((hour % 24) + 24) % 24;
  for (let i = 1; i < MOOD_KEYS.length; i++) {
    const a = MOOD_KEYS[i - 1];
    const b = MOOD_KEYS[i];
    if (h <= b.h) {
      const t = (h - a.h) / (b.h - a.h);
      const s = t * t * (3 - 2 * t); // 부드럽게
      return mix(a.m, b.m, s);
    }
  }
  return NIGHT;
}

/** 주소의 ?hour=21 (시험·미리보기용). 없거나 잘못되면 null */
export function hourOverride(search: string): number | null {
  try {
    const v = new URLSearchParams(search).get("hour");
    if (v === null) return null;
    const h = Number(v);
    return Number.isFinite(h) && h >= 0 && h < 24 ? h : null;
  } catch {
    return null;
  }
}

export const MOODS = { NIGHT, DAWN, DAY, DUSK, EVENING };
