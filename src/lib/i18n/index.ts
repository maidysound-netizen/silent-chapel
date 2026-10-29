import type { Locale, RosaryLocale } from "./types";
import { rosaryKo } from "./rosary.ko";
import { rosaryEn } from "./rosary.en";
import { rosaryJa } from "./rosary.ja";
import { uiDicts, type UiDict } from "./ui";

export type { Locale, RosaryLocale, UiDict };
export { bibleLinks } from "./ui";

const rosaryDicts: Record<Locale, RosaryLocale> = { ko: rosaryKo, en: rosaryEn, ja: rosaryJa };

export const LOCALES: { id: Locale; label: string }[] = [
  { id: "ko", label: "한국어" },
  { id: "en", label: "English" },
  { id: "ja", label: "日本語" },
];

export function getUi(locale: Locale): UiDict {
  return uiDicts[locale] ?? uiDicts.ko;
}

export function getRosaryLocale(locale: Locale): RosaryLocale {
  return rosaryDicts[locale] ?? rosaryKo;
}
