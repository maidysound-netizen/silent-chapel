"use client";
// 성당 안 화면 UI: 접속자 수, 소리/설정/나가기, 상황별 행동 버튼
import { useSyncExternalStore } from "react";
import { useApp } from "@/store/useAppStore";
import { getUi } from "@/lib/i18n";
import { getNetworkManager } from "@/lib/net/NetworkManager";
import { roomNumber } from "@/lib/net/RoomManager";
import { RunButton, TouchJoystick } from "./TouchJoystick";
import { NetStats } from "./NetStats";
import { FEATURES } from "@/lib/features";
import { bow, standUp } from "@/store/localPlayer";
import { LanguageTabs } from "./LanguageTabs";

export function PresenceChip() {
  const locale = useApp((s) => s.settings.locale);
  const ui = getUi(locale);
  const net = getNetworkManager();
  const snap = useSyncExternalStore(net.subscribe.bind(net), net.getSnapshot, net.getSnapshot);
  let text: string;
  let tone: "ok" | "wait" | "off" = "ok";
  switch (snap.status) {
    case "connected": {
      // 방이 여러 개라 지금 어느 방인지 함께 보여 줌 (?room= 으로 고른 별도 방은 번호 없음)
      const n = roomNumber(snap.roomId);
      text = n ? `${ui.roomName(n)} · ${ui.visitors(snap.count)}` : ui.visitors(snap.count);
      break;
    }
    case "full":
      text = ui.allRoomsFull;
      tone = "wait";
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
  const nearShrine = useApp((s) => s.nearMary || s.nearJesus);
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
        {/* 서 있을 때의 행동 안내는 물체 위에 필요할 때만 뜹니다(PromptOverlay).
            앉아 있을 때만 아래 가운데에 묵주기도 · 묵상 시점 · 절하기 · 일어나기를 보여 줌 */}
        {pose === "sit" && !meditation && panel === null && (
          <div className="hud-actions seated-bar">
            <button className="btn" onClick={() => openPanel("rosary")}>
              📿 {ui.rosary}
              <kbd>R</kbd>
            </button>
            <button className="btn" onClick={() => setMeditation(true)}>
              {ui.meditate}
              <kbd>M</kbd>
            </button>
            <button className="btn" onClick={bow}>
              {ui.bow}
              <kbd>B</kbd>
            </button>
            <button className="btn" onClick={standUp}>
              {ui.stand}
              <kbd>F</kbd>
            </button>
          </div>
        )}
        {/* 서 있을 때는 어디서든, 바라보는 방향으로 절할 수 있음 (성모상·제단 앞에서는 물체 위 안내가 대신함) */}
        {pose !== "sit" && panel === null && !nearShrine && (
          <div className="hud-actions">
            <button className="btn quiet" onClick={bow}>
              🙇 {ui.bow}
              <kbd>B</kbd>
            </button>
          </div>
        )}
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

      {pose !== "sit" && panel === null && (
        <>
          <TouchJoystick label={ui.controlsMobile} />
          <RunButton label={ui.run} />
        </>
      )}
    </div>
  );
}
