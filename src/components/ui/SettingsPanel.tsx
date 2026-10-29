"use client";
import { useEffect } from "react";
import { useApp, type Quality } from "@/store/useAppStore";
import { getUi, LOCALES, type Locale } from "@/lib/i18n";
import { MUSIC_TRACKS } from "@/lib/music";

export function SettingsPanel() {
  const settings = useApp((s) => s.settings);
  const setSettings = useApp((s) => s.setSettings);
  const openPanel = useApp((s) => s.openPanel);
  const ui = getUi(settings.locale);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && openPanel(null);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [openPanel]);

  const qualities: { id: Quality; label: string }[] = [
    { id: "low", label: ui.qualityLow },
    { id: "medium", label: ui.qualityMedium },
    { id: "high", label: ui.qualityHigh },
  ];

  return (
    <section className="panel settings-panel" role="dialog" aria-modal="false" aria-labelledby="settings-title">
      <header className="panel-header">
        <h2 id="settings-title">{ui.settings}</h2>
        <button className="icon-btn" onClick={() => openPanel(null)} aria-label={ui.close}>
          ✕
        </button>
      </header>
      <div className="panel-body">
        <fieldset>
          <legend>{ui.quality}</legend>
          {qualities.map((q) => (
            <label key={q.id}>
              <input type="radio" name="quality" checked={settings.quality === q.id} onChange={() => setSettings({ quality: q.id })} />
              {q.label}
            </label>
          ))}
        </fieldset>
        <label className="toggle">
          <input type="checkbox" checked={settings.sound} onChange={(e) => setSettings({ sound: e.target.checked })} />
          {ui.sound} <span className="muted small">— {ui.soundOnHint}</span>
        </label>
        <label className="toggle">
          <input type="checkbox" checked={settings.showNames} onChange={(e) => setSettings({ showNames: e.target.checked })} />
          {ui.showNames}
        </label>
        <label className="toggle">
          <input type="checkbox" checked={settings.mode2D} onChange={(e) => setSettings({ mode2D: e.target.checked })} />
          {ui.mode2D}
        </label>
        <label className="toggle">
          <input type="checkbox" checked={settings.showNetStats} onChange={(e) => setSettings({ showNetStats: e.target.checked })} />
          {ui.netStats}
        </label>
        <label className="select">
          {ui.language}
          <select value={settings.locale} onChange={(e) => setSettings({ locale: e.target.value as Locale })}>
            {LOCALES.map((l) => (
              <option key={l.id} value={l.id}>
                {l.label}
              </option>
            ))}
          </select>
        </label>
        <details className="credits">
          <summary>{ui.musicCredits}</summary>
          {MUSIC_TRACKS.map((t) => (
            <p key={t.src} className="small">
              「{t.title}」 — {t.performer}
              <br />
              <a href={t.licenseUrl} target="_blank" rel="noopener noreferrer">
                {t.license}
              </a>{" "}
              ·{" "}
              <a href={t.sourceUrl} target="_blank" rel="noopener noreferrer">
                Wikimedia Commons ↗
              </a>{" "}
              · 원본 그대로 사용(편집 없음)
            </p>
          ))}
        </details>
        <p className="muted small">{ui.disclaimer}</p>
      </div>
    </section>
  );
}
