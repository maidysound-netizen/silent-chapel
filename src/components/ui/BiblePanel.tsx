"use client";
// 성경 독서 화면 (MVP: 오늘의 말씀 안내 + 공식 사이트 연결).
// 성경 본문/API 연동은 저작권·이용 조건 확인 후 BibleProvider 형태로 추가할 수 있게 비워 두었습니다.
import { useEffect, useRef } from "react";
import { useApp } from "@/store/useAppStore";
import { bibleLinks, getUi } from "@/lib/i18n";

/** 향후 확장 지점: 공식 API가 확인되면 이 인터페이스를 구현합니다 */
export interface BibleProvider {
  todaysReadings(date: Date): Promise<{ reference: string; text: string | null }[]>;
}

export function BiblePanel() {
  const locale = useApp((s) => s.settings.locale);
  const openPanel = useApp((s) => s.openPanel);
  const ui = getUi(locale);
  const links = bibleLinks[locale];
  const headingRef = useRef<HTMLHeadingElement>(null);
  const today = new Date().toLocaleDateString(locale === "ko" ? "ko-KR" : locale === "ja" ? "ja-JP" : "en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
    weekday: "long",
  });

  useEffect(() => {
    headingRef.current?.focus();
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && openPanel(null);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [openPanel]);

  return (
    <section className="panel bible-panel" role="dialog" aria-modal="false" aria-labelledby="bible-title">
      <header className="panel-header">
        <h2 id="bible-title" ref={headingRef} tabIndex={-1}>
          {ui.bibleTitle}
        </h2>
        <button className="icon-btn" onClick={() => openPanel(null)} aria-label={ui.close}>
          ✕
        </button>
      </header>
      <div className="panel-body">
        <div className="book-page">
          <h3>{ui.todaysWord}</h3>
          <p className="muted">{today}</p>
          <p>{ui.todaysWordBody}</p>
          <div className="col">
            <a className="btn primary" href={links.missa} target="_blank" rel="noopener noreferrer">
              {ui.openMissa} ↗
            </a>
            <a className="btn" href={links.bible} target="_blank" rel="noopener noreferrer">
              {ui.openBible} ↗
            </a>
          </div>
        </div>
        <p className="muted small">{ui.bibleNote}</p>
        <button className="btn wide" onClick={() => openPanel(null)}>
          {ui.close}
        </button>
      </div>
    </section>
  );
}
