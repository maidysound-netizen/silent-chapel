"use client";
import { useEffect, useState, useSyncExternalStore } from "react";
import { getNetworkManager } from "@/lib/net/NetworkManager";
import { useApp, type Quality } from "@/store/useAppStore";
import { getUi } from "@/lib/i18n";
import { LanguageTabs } from "./LanguageTabs";
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
        <div className="setting-row">
          <span>{ui.language}</span>
          <LanguageTabs />
        </div>
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
              · {ui.musicUnchanged}
            </p>
          ))}
        </details>
        <AdminSection />
        <p className="muted small">{ui.disclaimer}</p>
      </div>
    </section>
  );
}

/** 관리자 비밀번호 입력 (Supabase 연결이 있을 때만). 비밀번호는 서버 claim_admin 이 해시와 비교하며 저장하지 않음 */
function AdminSection() {
  const locale = useApp((s) => s.settings.locale);
  const ui = getUi(locale);
  const net = getNetworkManager();
  const snap = useSyncExternalStore(net.subscribe.bind(net), net.getSnapshot, net.getSnapshot);
  const [code, setCode] = useState("");
  const [result, setResult] = useState<"ok" | "fail" | null>(null);
  const [busy, setBusy] = useState(false);
  if (!net.enabled) return null;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    const ok = await net.claimAdmin(code);
    setBusy(false);
    setCode("");
    setResult(ok ? "ok" : "fail");
  };

  return (
    <details className="admin-section">
      <summary>{ui.admin}</summary>
      {snap.isAdmin ? (
        <p className="small">✓ {ui.adminOk}</p>
      ) : (
        <form onSubmit={(e) => void submit(e)}>
          <p className="muted small">{ui.adminHint}</p>
          <label className="small">
            {ui.adminCode}
            <input type="password" autoComplete="off" minLength={8} maxLength={128} value={code} onChange={(e) => setCode(e.target.value)} />
          </label>
          <button className="btn small" type="submit" disabled={busy || code.length < 8}>
            {ui.adminClaim}
          </button>
          {result === "fail" && <p className="small">{ui.adminFail}</p>}
        </form>
      )}
    </details>
  );
}
