import type { MysteryId, PrayerKind } from "../rosary/types.ts";

export type Locale = "ko" | "en" | "ja";

export interface PrayerEntry {
  /** 기도 이름 (예: 성모송) */
  name: string;
  /** 사용자에게 보여 줄 짧은 진행 안내. 기도문 자체가 아닙니다. */
  guide: string;
  /**
   * 정식 기도문 전문. 사용 권한이 확인된 경우에만 채웁니다.
   * null이면 UI가 공식 출처 링크를 대신 보여 줍니다.
   */
  text: string | null;
  /** 공식 기도문 출처 */
  sourceUrl: string;
}

export interface MysterySet {
  name: string;
  /** 전통적으로 바치는 요일 안내 */
  days: string;
  decades: { title: string; scripture: string }[];
}

export interface RosaryLocale {
  prayers: Record<PrayerKind, PrayerEntry>;
  mysteries: Record<MysteryId, MysterySet>;
  sources: { label: string; url: string }[];
  notes: string[];
}
