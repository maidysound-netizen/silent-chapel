// 기도 진행 상태는 이 기기의 localStorage에만 저장합니다. 서버나 다른 방문자에게 전송하지 않습니다.
import type { RosaryProgress } from "./types.ts";
import { sanitizeProgress } from "./sequence.ts";

const KEY = "silent-chapel:rosary:v1";

export function loadProgress(): RosaryProgress | null {
  try {
    const raw = window.localStorage.getItem(KEY);
    return raw ? sanitizeProgress(JSON.parse(raw)) : null;
  } catch {
    return null;
  }
}

export function saveProgress(p: RosaryProgress | null): void {
  try {
    if (p) window.localStorage.setItem(KEY, JSON.stringify(p));
    else window.localStorage.removeItem(KEY);
  } catch {
    // 시크릿 모드 등 저장소 접근 불가 — 진행은 메모리에서만 유지
  }
}
