"use client";
// 화면(UI) 상태 저장소. 매 프레임 바뀌는 위치 정보는 여기 두지 않고 localPlayer(가변 객체)에 둡니다.
import { create } from "zustand";
import type { Locale } from "@/lib/i18n";
import type { RosaryProgress } from "@/lib/rosary/types";
import type { InteractionTarget } from "@/lib/game/InteractionSystem";
import type { Pose } from "@/lib/game/PlayerState";
import { saveProgress } from "@/lib/rosary/storage";

export type Quality = "low" | "medium" | "high";
export type Panel = null | "rosary" | "bible" | "settings";

export interface Settings {
  quality: Quality;
  showNames: boolean;
  sound: boolean;
  mode2D: boolean;
  locale: Locale;
  showNetStats: boolean;
}

const SETTINGS_KEY = "silent-chapel:settings:v1";
const NICK_KEY = "silent-chapel:nickname";

export function defaultQuality(): Quality {
  if (typeof window === "undefined") return "medium";
  const coarse = window.matchMedia?.("(pointer: coarse)").matches;
  return coarse || window.innerWidth < 768 ? "low" : "medium";
}

export function loadSettings(): Settings {
  const base: Settings = {
    quality: defaultQuality(),
    showNames: true,
    sound: false, // 소리는 항상 꺼진 상태로 시작 (자동 재생 금지)
    mode2D: false,
    locale: "ko",
    showNetStats: false,
  };
  try {
    const raw = JSON.parse(window.localStorage.getItem(SETTINGS_KEY) ?? "null");
    if (raw && typeof raw === "object") {
      if (["low", "medium", "high"].includes(raw.quality)) base.quality = raw.quality;
      if (typeof raw.showNames === "boolean") base.showNames = raw.showNames;
      if (typeof raw.mode2D === "boolean") base.mode2D = raw.mode2D;
      if (["ko", "en", "ja"].includes(raw.locale)) base.locale = raw.locale;
      if (typeof raw.showNetStats === "boolean") base.showNetStats = raw.showNetStats;
    }
  } catch {
    /* 기본값 사용 */
  }
  return base;
}

export function loadNickname(): string {
  try {
    return window.localStorage.getItem(NICK_KEY) ?? "";
  } catch {
    return "";
  }
}

interface AppState {
  phase: "entry" | "chapel";
  nickname: string;
  roomId: string;
  settings: Settings;
  panel: Panel;
  meditation: boolean;
  prompt: InteractionTarget | null;
  /** 성모상 가까이 있음 (절하기 버튼 문구용) */
  nearMary: boolean;
  pose: Pose;
  rosary: RosaryProgress | null;
  hydrated: boolean;

  hydrate(s: Partial<Pick<AppState, "settings" | "nickname" | "rosary" | "roomId">>): void;
  enter(nickname: string, mode2D: boolean): void;
  exit(): void;
  setSettings(p: Partial<Settings>): void;
  openPanel(p: Panel): void;
  setMeditation(on: boolean): void;
  setPrompt(t: InteractionTarget | null): void;
  setNearMary(v: boolean): void;
  setPose(p: Pose): void;
  setRosary(p: RosaryProgress | null): void;
}

export const useApp = create<AppState>((set, get) => ({
  phase: "entry",
  nickname: "",
  roomId: "main-chapel",
  settings: {
    quality: "medium",
    showNames: true,
    sound: false,
    mode2D: false,
    locale: "ko",
    showNetStats: false,
  },
  panel: null,
  meditation: false,
  prompt: null,
  nearMary: false,
  pose: "stand",
  rosary: null,
  hydrated: false,

  hydrate: (s) => set({ ...s, hydrated: true }),
  enter: (nickname, mode2D) => {
    try {
      window.localStorage.setItem(NICK_KEY, nickname);
    } catch {
      /* ignore */
    }
    get().setSettings({ mode2D });
    set({ phase: "chapel", nickname, panel: mode2D ? "rosary" : null });
  },
  exit: () => set({ phase: "entry", panel: null, meditation: false, prompt: null, pose: "stand" }),
  setSettings: (p) => {
    const settings = { ...get().settings, ...p };
    set({ settings });
    try {
      const { sound: _sound, ...persist } = settings; // 소리 설정은 저장하지 않음
      window.localStorage.setItem(SETTINGS_KEY, JSON.stringify(persist));
    } catch {
      /* ignore */
    }
  },
  openPanel: (panel) => set({ panel }),
  setMeditation: (meditation) => set({ meditation }),
  setPrompt: (prompt) => {
    const cur = get().prompt;
    const same =
      cur?.kind === prompt?.kind && (cur?.kind !== "seat" || (prompt?.kind === "seat" && cur.seat.id === prompt.seat.id));
    if (!same) set({ prompt });
  },
  setNearMary: (nearMary) => {
    if (get().nearMary !== nearMary) set({ nearMary });
  },
  setPose: (pose) => set(pose === "stand" ? { pose, meditation: false } : { pose }),
  setRosary: (rosary) => {
    saveProgress(rosary);
    set({ rosary });
  },
}));
