"use client";
import { useState } from "react";
import { useApp } from "@/store/useAppStore";
import { getUi, LOCALES, type Locale } from "@/lib/i18n";
import { NICK_MAX, sanitizeNickname } from "@/lib/net/protocol";
import { getNetworkManager } from "@/lib/net/NetworkManager";

export function EntryScreen() {
  const savedNick = useApp((s) => s.nickname);
  const locale = useApp((s) => s.settings.locale);
  const setSettings = useApp((s) => s.setSettings);
  const enter = useApp((s) => s.enter);
  const ui = getUi(locale);
  const [nick, setNick] = useState(savedNick);
  const clean = sanitizeNickname(nick);
  const online = getNetworkManager().enabled;

  const go = (mode2D: boolean) => {
    if (!clean) return;
    enter(clean, mode2D);
  };

  return (
    <main className="entry">
      <div className="entry-card">
        <div className="entry-arch" aria-hidden="true" />
        <h1>{ui.appName}</h1>
        <p className="tagline">{ui.tagline}</p>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            go(false);
          }}
        >
          <label htmlFor="nick">{ui.nicknameLabel}</label>
          <input
            id="nick"
            value={nick}
            maxLength={NICK_MAX + 8}
            autoComplete="off"
            placeholder={ui.nicknamePlaceholder}
            onChange={(e) => setNick(e.target.value)}
            aria-describedby="nick-hint"
          />
          <p id="nick-hint" className="muted small">
            {ui.nicknameHint}
          </p>
          <button className="btn primary wide" type="submit" disabled={!clean}>
            {ui.enter}
          </button>
          <button className="btn wide" type="button" disabled={!clean} onClick={() => go(true)}>
            {ui.enter2D}
          </button>
        </form>
        <p className={`mode ${online ? "on" : "off"}`}>
          {online ? `● ${ui.onlineMode}` : `○ ${ui.offlineMode} — ${ui.offlineReason}`}
        </p>
        <details className="controls">
          <summary>{ui.controlsTitle}</summary>
          <p>{ui.controlsPc}</p>
          <p>{ui.controlsMobile}</p>
        </details>
        <div className="entry-footer">
          <select aria-label={ui.language} value={locale} onChange={(e) => setSettings({ locale: e.target.value as Locale })}>
            {LOCALES.map((l) => (
              <option key={l.id} value={l.id}>
                {l.label}
              </option>
            ))}
          </select>
          <p className="muted small">{ui.disclaimer}</p>
        </div>
      </div>
    </main>
  );
}
