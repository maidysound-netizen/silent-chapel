"use client";
// 언어(번역) 탭: 한국어 | English | 日本語 — 누르는 즉시 화면 전체 언어가 바뀌고 이 기기에 저장됩니다.
import { useApp } from "@/store/useAppStore";
import { getUi, LOCALES } from "@/lib/i18n";

const SHORT: Record<string, string> = { ko: "한", en: "EN", ja: "日" };

export function LanguageTabs({ compact = false }: { compact?: boolean }) {
  const locale = useApp((s) => s.settings.locale);
  const setSettings = useApp((s) => s.setSettings);
  return (
    <div className={`lang-tabs ${compact ? "compact" : ""}`} role="tablist" aria-label={getUi(locale).language}>
      {LOCALES.map((l) => (
        <button
          key={l.id}
          role="tab"
          lang={l.id}
          aria-selected={locale === l.id}
          className={locale === l.id ? "active" : ""}
          onClick={() => setSettings({ locale: l.id })}
          title={l.label}
        >
          {compact ? SHORT[l.id] : l.label}
        </button>
      ))}
    </div>
  );
}
