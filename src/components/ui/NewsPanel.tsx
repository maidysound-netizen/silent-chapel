"use client";
// 새로운 소식: 위쪽 소식 버튼을 누르면 바로 보이는 공지·업데이트 목록 (lib/changelog.ts).
import { useEffect } from "react";
import { useApp } from "@/store/useAppStore";
import { getUi } from "@/lib/i18n";
import { CHANGELOG } from "@/lib/changelog";
import { markNewsSeen } from "./newsSeen";

export function NewsPanel() {
  const locale = useApp((s) => s.settings.locale);
  const openPanel = useApp((s) => s.openPanel);
  const ui = getUi(locale);

  useEffect(() => {
    markNewsSeen();
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && openPanel(null);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [openPanel]);

  return (
    <section className="panel news-panel" role="dialog" aria-modal="false" aria-labelledby="news-title">
      <header className="panel-header">
        <h2 id="news-title">🕊 {ui.news}</h2>
        <button className="icon-btn" onClick={() => openPanel(null)} aria-label={ui.close}>
          ✕
        </button>
      </header>
      <div className="panel-body">
        <ul className="news-list">
          {CHANGELOG.map((c) => (
            <li key={c.id}>
              <span className="news-date">{c.date}</span>
              <p>{c.text[locale]}</p>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
