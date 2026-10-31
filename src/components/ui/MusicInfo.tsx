"use client";
// 음악 정보 (설정 안): 지금 흐르는 곡과 다섯 곡 목록(연주·라이선스·출처).
import { useApp } from "@/store/useAppStore";
import { getUi } from "@/lib/i18n";
import { MUSIC_TRACKS } from "@/lib/music";

export function MusicInfo() {
  const settings = useApp((s) => s.settings);
  const setSettings = useApp((s) => s.setSettings);
  const nowPlaying = useApp((s) => s.nowPlaying);
  const ui = getUi(settings.locale);
  const current = nowPlaying !== null ? MUSIC_TRACKS[nowPlaying] : null;

  return (
    <details className="music-info" open>
      <summary>{ui.musicCredits}</summary>
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
      <p className="muted small">{ui.musicUnchanged}</p>
    </details>
  );
}
