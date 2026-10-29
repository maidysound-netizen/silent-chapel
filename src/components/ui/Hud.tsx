"use client";
// 성당 안 화면 UI: 접속자 수, 소리/설정/나가기, 상황별 행동 버튼
import { useSyncExternalStore } from "react";
import { useApp } from "@/store/useAppStore";
import { getUi } from "@/lib/i18n";
import { getNetworkManager } from "@/lib/net/NetworkManager";
import { interact, standUp, toggleSit } from "@/store/localPlayer";
import { TouchJoystick } from "./TouchJoystick";
import { NetStats } from "./NetStats";
import { FEATURES } from "@/lib/features";

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
  const prompt = useApp((s) => s.prompt);
  const pose = useApp((s) => s.pose);
  const meditation = useApp((s) => s.meditation);
  const setMeditation = useApp((s) => s.setMeditation);
  const ui = getUi(settings.locale);
  const hideForMeditation = meditation && panel === null;

  let action: { label: string; key: string; run: () => void } | null = null;
  if (pose !== "sit" && prompt) {
    if (prompt.kind === "rosary") action = { label: ui.interactRosary, key: "E", run: interact };
    else if (prompt.kind === "bible") action = { label: ui.interactBible, key: "E", run: interact };
    else action = { label: ui.interactPew, key: "F", run: toggleSit };
  }

  return (
    <div className={`hud ${hideForMeditation ? "hud-quiet" : ""}`}>
      <div className="hud-top">
        <div className="hud-left">
          <span className="brand">{ui.appName}</span>
          <PresenceChip />
        </div>
        <div className="hud-right">
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
        <div className="hud-actions" role="toolbar" aria-label="actions">
          {action && (
            <button className="btn primary action" onClick={action.run}>
              {action.label} <kbd>{action.key}</kbd>
            </button>
          )}
          {pose === "sit" && (
            <>
              <button className="btn" onClick={standUp}>
                {ui.stand} <kbd>F</kbd>
              </button>
              <button className="btn" onClick={() => setMeditation(!meditation)} aria-pressed={meditation}>
                {meditation ? ui.leaveMeditation : ui.meditate} <kbd>M</kbd>
              </button>
            </>
          )}
          <button className="btn rosary-btn" onClick={() => openPanel(panel === "rosary" ? null : "rosary")}>
            📿 {ui.rosary}
          </button>
          {FEATURES.bible && (
            <button className="btn" onClick={() => openPanel(panel === "bible" ? null : "bible")}>
              {ui.bible}
            </button>
          )}
        </div>
        <p className="controls-hint desktop-only">{ui.controlsPc}</p>
      </div>

      {pose !== "sit" && panel === null && <TouchJoystick label={ui.controlsMobile} />}
    </div>
  );
}
