// '새 소식' 점: 마지막으로 본 소식 id 를 이 기기에 기억 (없거나 막혀 있으면 점만 보일 뿐 문제없음)
import { useSyncExternalStore } from "react";
import { CHANGELOG, hasUnseen } from "@/lib/changelog";

const KEY = "silent-chapel:news-seen";
const listeners = new Set<() => void>();

function read(): string | null {
  try {
    return window.localStorage.getItem(KEY);
  } catch {
    return null;
  }
}

export function markNewsSeen() {
  try {
    if (CHANGELOG[0]) window.localStorage.setItem(KEY, CHANGELOG[0].id);
  } catch {
    /* 저장 안 돼도 괜찮음 */
  }
  listeners.forEach((l) => l());
}

/** 아직 안 본 소식이 있으면 true */
export function useHasUnseenNews(): boolean {
  return useSyncExternalStore(
    (fn) => {
      listeners.add(fn);
      return () => listeners.delete(fn);
    },
    () => hasUnseen(read()),
    () => false,
  );
}
