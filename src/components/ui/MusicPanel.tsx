"use client";
// 성가와 소식: 지금 흐르는 곡, 다섯 곡 목록(출처·라이선스), 그 아래 은은한 업데이트 소식.
import { useEffect } from "react";
import { useApp } from "@/store/useAppStore";
import { getUi } from "@/lib/i18n";
import { MUSIC_TRACKS } from "@/lib/music";
import { CHANGELOG } from "@/lib/changelog";
import { markNewsSeen } from "./newsSeen";

export function MusicPanel() {
  const settings = useApp((s) => s.settings);
  const setSettings = useApp((s) => s.setSettings);
  const openPanel = useApp((s) => s.openPanel);
  const nowPlaying = useApp((s) => s.nowPlaying);
  const ui = getUi(settings.locale);

  useEffect(() => {
    markNewsSeen();
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && openPanel(null);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [openPanel]);

  const current = nowPlaying !== null ? MUSIC_TRACKS[nowPlaying] : null;

  return (
    <section className="panel music-panel" role="dialog" aria-modal="false" aria-labelledby="music-title">
      <header className="panel-header">
        <h2 id="music-title">♪ {ui.playlist}</h2>
        <button className="icon-btn" onClick={() => openPanel(null)} aria-label={ui.close}>
          ✕
        </button>
      </header>
      <div className="panel-body">
        <div className="now-playing" aria-live="polite">
          <span className="muted small">{ui.nowPlaying}</span>
          {!settings.sound ? (
            <p>
              {ui.soundIsOff}{" "}
              <button className="btn small" onClick={() => setSettings({ sound: true })}>
                🔈 {ui.turnOnSound}
              </button>
            </p>
          ) : current ? (
            <p className="now-title">
              {current.title} <span className="muted small">— {current.performer}</span>
            </p>
          ) : (
            <p className="muted">{ui.betweenTracks}</p>
          )}
        </div>

        <ol className="track-list">
          {MUSIC_TRACKS.map((t, i) => (
            <li key={t.src} className={settings.sound && nowPlaying === i ? "playing" : undefined}>
              <span>{t.title}</span>
              <span className="muted small">
                {t.performer} ·{" "}
                <a href={t.licenseUrl} target="_blank" rel="noopener noreferrer">
                  {t.license}
                </a>{" "}
                ·{" "}
                <a href={t.sourceUrl} target="_blank" rel="noopener noreferrer">
                  Commons ↗
                </a>
              </span>
            </li>
          ))}
        </ol>

        <details className="news" open>
          <summary className="muted small">{ui.news}</summary>
          <ul>
            {CHANGELOG.map((c) => (
              <li key={c.id} className="small">
                <span className="news-date">{c.date}</span> {c.text[settings.locale]}
              </li>
            ))}
          </ul>
        </details>
      </div>
    </section>
  );
}
