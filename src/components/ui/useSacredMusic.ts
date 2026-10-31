"use client";
// 배경 성가 재생. 사용자가 소리를 켰을 때만 재생하며(자동 재생 없음), 곡을 무작위 순서로 이어서 반복하고 곡 사이에 고요한 쉼을 둡니다.
// 브라우저가 음원 형식을 재생하지 못하면 직접 합성한 잔잔한 음(useAmbientSound)으로 대신합니다.
import { useEffect, useRef, useState } from "react";
import { MUSIC_TRACKS, shuffledOrder } from "@/lib/music";
import { useAmbientSound } from "./useAmbientSound";
import { useApp } from "@/store/useAppStore";

const TARGET_VOLUME = 0.45;
const FADE_MS = 2500;

function fade(el: HTMLAudioElement, to: number, ms: number, done?: () => void) {
  const from = el.volume;
  const start = performance.now();
  const step = () => {
    const t = Math.min(1, (performance.now() - start) / ms);
    el.volume = from + (to - from) * t;
    if (t < 1) requestAnimationFrame(step);
    else done?.();
  };
  requestAnimationFrame(step);
}

export type MusicMode = "off" | "chant" | "synth";

export function useSacredMusic(enabled: boolean): MusicMode {
  const [fallback, setFallback] = useState(false);
  const [playing, setPlaying] = useState(false);
  const elRef = useRef<HTMLAudioElement | null>(null);
  useAmbientSound(enabled && fallback);

  useEffect(() => {
    if (!enabled) return;
    const probe = document.createElement("audio");
    if (!probe.canPlayType(MUSIC_TRACKS[0].mime)) {
      setFallback(true);
      return;
    }
    // 섞인 순서로 한 바퀴씩 재생. 한 바퀴가 끝나면 다시 섞되, 방금 들은 곡이 바로 또 나오지 않게
    let order = shuffledOrder(MUSIC_TRACKS.length);
    let pos = 0;
    let index = order[0];
    let failures = 0;
    const el = new Audio();
    el.preload = "auto";
    el.volume = 0;
    elRef.current = el;
    let rest: ReturnType<typeof setTimeout> | null = null;
    let stopped = false;

    const start = () => {
      if (stopped) return;
      el.src = MUSIC_TRACKS[index].src;
      el.volume = 0;
      el.play()
        .then(() => {
          failures = 0;
          setPlaying(true);
          useApp.getState().setNowPlaying(index); // 플레이리스트 창의 '지금 흐르는 곡'
          fade(el, TARGET_VOLUME, FADE_MS);
        })
        .catch((e: DOMException) => {
          // 자동 재생 차단이면 합성음으로, 파일 문제면 다음 곡으로
          if (e.name === "NotAllowedError") setFallback(true);
          else skip();
        });
    };
    const next = () => {
      pos++;
      if (pos >= order.length) {
        order = shuffledOrder(MUSIC_TRACKS.length, Math.random, index);
        pos = 0;
      }
      index = order[pos];
    };
    const skip = () => {
      if (stopped) return;
      if (++failures >= MUSIC_TRACKS.length) return setFallback(true);
      next();
      start();
    };
    const onEnded = () => {
      useApp.getState().setNowPlaying(null); // 곡 사이 고요한 쉼
      const restMs = MUSIC_TRACKS[index].restMs;
      next();
      rest = setTimeout(start, restMs);
    };
    const onError = () => skip();
    el.addEventListener("ended", onEnded);
    el.addEventListener("error", onError);
    start();

    return () => {
      stopped = true;
      if (rest) clearTimeout(rest);
      el.removeEventListener("ended", onEnded);
      el.removeEventListener("error", onError);
      fade(el, 0, 800, () => {
        el.pause();
        el.removeAttribute("src");
        el.load();
      });
      elRef.current = null;
      setPlaying(false);
      useApp.getState().setNowPlaying(null);
    };
  }, [enabled]);

  if (!enabled) return "off";
  if (fallback) return "synth";
  return playing ? "chant" : "off";
}
