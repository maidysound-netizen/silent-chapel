"use client";
// 앱 최상위: 저장된 설정 복원 → 입장 화면 / 성당(3D 또는 2D) 전환, 키보드 입력, 네트워크 연결 수명 관리
import dynamic from "next/dynamic";
import { useEffect } from "react";
import { useApp, loadNickname, loadSettings } from "@/store/useAppStore";
import { loadProgress } from "@/lib/rosary/storage";
import { getNetworkManager } from "@/lib/net/NetworkManager";
import { roomFromLocation } from "@/lib/net/RoomManager";
import { localPlayer, interact, resetLocalPlayer, toggleSit } from "@/store/localPlayer";
import { EntryScreen } from "./ui/EntryScreen";
import { Hud } from "./ui/Hud";
import { RosaryPanel } from "./ui/RosaryPanel";
import { BiblePanel } from "./ui/BiblePanel";
import { SettingsPanel } from "./ui/SettingsPanel";
import { useSacredMusic } from "./ui/useSacredMusic";
import { getUi } from "@/lib/i18n";
import { FEATURES } from "@/lib/features";

// Three.js는 브라우저에서만 실행 (서버 렌더링 제외)
const ChapelCanvas = dynamic(() => import("./scene/ChapelCanvas"), {
  ssr: false,
  loading: () => <div className="loading">Silent Chapel…</div>,
});

const MOVE_KEYS: Record<string, [number, number]> = {
  KeyW: [1, 0],
  ArrowUp: [1, 0],
  KeyS: [-1, 0],
  ArrowDown: [-1, 0],
  KeyA: [0, -1],
  ArrowLeft: [0, -1],
  KeyD: [0, 1],
  ArrowRight: [0, 1],
};

function useKeyboard(active: boolean) {
  useEffect(() => {
    if (!active) return;
    const pressed = new Set<string>();
    const recompute = () => {
      let f = 0;
      let r = 0;
      for (const k of pressed) {
        f += MOVE_KEYS[k][0];
        r += MOVE_KEYS[k][1];
      }
      localPlayer.keys.forward = Math.max(-1, Math.min(1, f));
      localPlayer.keys.right = Math.max(-1, Math.min(1, r));
    };
    const typing = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      return t?.tagName === "INPUT" || t?.tagName === "SELECT" || t?.tagName === "TEXTAREA";
    };
    const down = (e: KeyboardEvent) => {
      if (typing(e) || e.metaKey || e.ctrlKey || e.altKey) return;
      const app = useApp.getState();
      if (app.panel !== null) return; // 패널이 열려 있으면 패널이 키를 처리
      if (MOVE_KEYS[e.code]) {
        e.preventDefault();
        pressed.add(e.code);
        recompute();
      } else if (e.code === "KeyE") interact();
      else if (e.code === "KeyF") toggleSit();
      else if (e.code === "KeyM" && app.pose === "sit") app.setMeditation(!app.meditation);
    };
    const up = (e: KeyboardEvent) => {
      if (pressed.delete(e.code)) recompute();
    };
    const clear = () => {
      pressed.clear();
      recompute();
    };
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    window.addEventListener("blur", clear);
    const unsub = useApp.subscribe((s, prev) => s.panel !== prev.panel && clear());
    return () => {
      window.removeEventListener("keydown", down);
      window.removeEventListener("keyup", up);
      window.removeEventListener("blur", clear);
      unsub();
      clear();
    };
  }, [active]);
}

/** 2D 기도 모드 배경: 3D 없이 고딕 창 실루엣만 */
function Backdrop2D() {
  return (
    <div className="backdrop-2d" aria-hidden="true">
      <div className="window w1" />
      <div className="window w2" />
      <div className="window w3" />
      <div className="cross" />
    </div>
  );
}

export default function ChapelApp() {
  const phase = useApp((s) => s.phase);
  const hydrated = useApp((s) => s.hydrated);
  const settings = useApp((s) => s.settings);
  const panel = useApp((s) => s.panel);
  const nickname = useApp((s) => s.nickname);
  const roomId = useApp((s) => s.roomId);
  const exit = useApp((s) => s.exit);
  const openPanel = useApp((s) => s.openPanel);
  const inChapel = phase === "chapel";
  const mode2D = settings.mode2D;

  useEffect(() => {
    useApp.getState().hydrate({
      settings: loadSettings(),
      nickname: loadNickname(),
      rosary: loadProgress(),
      roomId: roomFromLocation(window.location.search),
    });
  }, []);

  useEffect(() => {
    document.documentElement.lang = settings.locale;
  }, [settings.locale]);

  // 개발 모드에서만: 브라우저 콘솔/자동 테스트용 핸들 (프로덕션 빌드에는 포함되지 않음)
  useEffect(() => {
    if (process.env.NODE_ENV !== "production") {
      (window as unknown as Record<string, unknown>).__chapel = { localPlayer, net: getNetworkManager(), app: useApp };
    }
  }, []);

  useKeyboard(inChapel && !mode2D);
  useSacredMusic(inChapel && settings.sound);

  // 3D 성당에 있는 동안만 실시간 방에 연결 (2D 기도 모드는 개인 기도)
  useEffect(() => {
    if (!inChapel || mode2D) return;
    const net = getNetworkManager();
    resetLocalPlayer();
    void net.connect(roomId, nickname);
    const onUnload = () => void net.disconnect();
    window.addEventListener("pagehide", onUnload);
    return () => {
      window.removeEventListener("pagehide", onUnload);
      void net.disconnect();
    };
  }, [inChapel, mode2D, roomId, nickname]);

  if (!hydrated) return <div className="loading">Silent Chapel…</div>;

  const ui = getUi(settings.locale);
  const in2D = inChapel && mode2D;

  return (
    <div className={`chapel ${in2D ? "mode-2d" : ""}`}>
      {/* 입장 화면 뒤에도 성당이 보이도록 3D는 입장 전부터 그립니다 (2D 기도 모드 제외) */}
      {in2D ? <Backdrop2D /> : <ChapelCanvas />}

      {!inChapel && <EntryScreen />}

      {inChapel && !mode2D && (
        <>
          <Hud onExit={exit} />
          {panel === "rosary" && <RosaryPanel />}
          {FEATURES.bible && panel === "bible" && <BiblePanel />}
          {panel === "settings" && <SettingsPanel />}
        </>
      )}

      {in2D && (
        <>
          <div className="hud-top solo">
            <span className="brand">{ui.appName}</span>
            <div className="hud-right">
              <button className="btn small" onClick={() => openPanel(panel === "settings" ? null : "settings")}>
                {ui.settings}
              </button>
              <button className="btn small" onClick={exit}>
                {ui.exit}
              </button>
            </div>
          </div>
          <div className="center-2d">
            {panel === "settings" ? (
              <SettingsPanel />
            ) : FEATURES.bible && panel === "bible" ? (
              <BiblePanel />
            ) : panel === "rosary" ? (
              <RosaryPanel />
            ) : (
              <div className="panel launcher-2d">
                <button className="btn primary wide" onClick={() => openPanel("rosary")}>
                  📿 {ui.rosary}
                </button>
                {FEATURES.bible && (
                  <button className="btn wide" onClick={() => openPanel("bible")}>
                    {ui.bible}
                  </button>
                )}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
