// 묵주기도 도메인 타입. React/Three.js에 의존하지 않는 순수 모듈입니다.

export type MysteryId = "joyful" | "sorrowful" | "glorious" | "luminous";

/** 기도 단계의 종류. 실제 문구는 locale 파일(prayers)에서 찾습니다. */
export type PrayerKind =
  | "signOfCross" // 십자성호(성호경)
  | "creed" // 사도신경
  | "ourFather" // 주님의 기도
  | "hailMary" // 성모송
  | "gloryBe" // 영광송
  | "fatima" // 구원을 비는 기도 (선택)
  | "mystery" // 신비 묵상 안내
  | "hailHolyQueen" // 성모 찬송
  | "closingPrayer"; // 묵주기도를 마치며 드리는 기도 (선택)

/** 묵주 위의 위치. 십자가, 펜던트(도입부), 다섯 단의 알, 연결 사슬 */
export type BeadRef =
  | { kind: "cross" }
  | { kind: "pendantLarge" }
  | { kind: "pendantSmall"; index: number } // 0..2
  | { kind: "medal" }
  | { kind: "decadeLarge"; decade: number } // 1..5
  | { kind: "decadeSmall"; decade: number; index: number }; // index 0..9

export interface RosaryStep {
  /** 0부터 시작하는 순번 */
  index: number;
  kind: PrayerKind;
  /** 0 = 시작/마침 기도, 1..5 = 단 번호 */
  decade: number;
  /** 성모송일 때 현재 번호(1부터)와 해당 묶음의 총 개수 */
  hailMary?: { n: number; of: number };
  /** 선택 기도(지역·공동체 관습에 따라 생략 가능) */
  optional: boolean;
  bead: BeadRef | null;
}

export interface RosaryOptions {
  /** 각 단의 영광송 뒤 '구원을 비는 기도'(파티마 기도) */
  includeFatima: boolean;
  /** 성모 찬송 뒤 '묵주기도를 마치며 드리는 기도' */
  includeClosingPrayer: boolean;
}

export const DEFAULT_ROSARY_OPTIONS: RosaryOptions = {
  includeFatima: true,
  includeClosingPrayer: true,
};

export type RosaryStatus = "praying" | "paused" | "complete";

export interface RosaryProgress {
  version: 1;
  mystery: MysteryId;
  options: RosaryOptions;
  stepIndex: number;
  status: RosaryStatus;
  startedAt: number;
  updatedAt: number;
}
