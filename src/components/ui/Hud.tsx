"use client";
// 성당 안 화면 UI: 접속자 수, 소리/설정/나가기, 상황별 행동 버튼
import { useSyncExternalStore } from "react";
import { useApp } from "@/store/useAppStore";
import { getUi } from "@/lib/i18n";
import { getNetworkManager } from "@/lib/net/NetworkManager";
import { TouchJoystick } from "./TouchJoystick";
import { NetStats } from "./NetStats";
import { FEATURES } from "@/lib/features";
import { LanguageTabs } from "./LanguageTabs";

export function PresenceChip() {
  const locale = useApp((s) => s.settings.locale);
  const ui = getUi(locale);
  const net = getNetworkManager();
  const snap = useSyncExternalStore(net.subscribe.bind(net), net.getSnapshot, net.getSnapshot);
  let text: string;
  let tone: "ok" | "wait" | "off" = "ok";
  switch (snap.status) {
    case "connected":
      text = ui.visitors(snap.count);
      break;
    case "auth":
    case "connecting":
      text = ui.connecting;
      tone = "wait";
      break;
    case "reconnecting":
    case "offline":
      text = ui.reconnecting;
      tone = "wait";
      break;
    case "error":
      text = ui.connectionError;
      tone = "off";
      break;
    default:
      text = ui.offlineMode;
      tone = "off";
  }
  return (
    <div className={`chip presence ${tone}`} role="status" aria-live="polite" title={snap.error ?? undefined}>
      <span className="dot" aria-hidden="true" />
      {text}
    </div>
  );
}

export function Hud({ onExit }: { onExit: () => void }) {
  const settings = useApp((s) => s.settings);
  const setSettings = useApp((s) => s.setSettings);
  const panel = useApp((s) => s.panel);
  const openPanel = useApp((s) => s.openPanel);
  const pose = useApp((s) => s.pose);
  const meditation = useApp((s) => s.meditation);
  const setMeditation = useApp((s) => s.setMeditation);
  const ui = getUi(settings.locale);
  const hideForMeditation = meditation && panel === null;

  return (
    <div className={`hud ${hideForMeditation ? "hud-quiet" : ""}`}>
      <div className="hud-top">
        <div className="hud-left">
          <span className="brand">{ui.appName}</span>
          <PresenceChip />
        </div>
        <div className="hud-right">
          <LanguageTabs compact />
          <button
            className="icon-btn"
            onClick={() => setSettings({ sound: !settings.sound })}
            aria-pressed={settings.sound}
            aria-label={`${ui.sound}: ${settings.sound ? ui.on : ui.off}`}
            title={ui.sound}
          >
            {settings.sound ? "🔈" : "🔇"}
          </button>
          <button className="icon-btn" onClick={() => openPanel(panel === "settings" ? null : "settings")} aria-label={ui.settings} title={ui.settings}>
            ⚙
          </button>
          <button className="btn small" onClick={onExit}>
            {ui.exit}
          </button>
        </div>
      </div>

      {settings.showNetStats && <NetStats />}

      <div className="hud-bottom">
        {/* 행동 안내는 3D 물체 위에 필요할 때만 뜹니다(ContextPrompts). 묵상 중에는 빠져나갈 길만 남김 */}
        {meditation && (
          <div className="hud-actions">
            <button className="btn quiet" onClick={() => setMeditation(false)}>
              {ui.leaveMeditation}
              <kbd>M</kbd>
            </button>
          </div>
        )}
        {FEATURES.bible && (
          <div className="hud-actions">
            <button className="btn" onClick={() => openPanel(panel === "bible" ? null : "bible")}>
              {ui.bible}
            </button>
          </div>
        )}
        <p className="controls-hint desktop-only">{ui.controlsPc}</p>
      </div>

      {pose !== "sit" && panel === null && <TouchJoystick label={ui.controlsMobile} />}
    </div>
  );
}
