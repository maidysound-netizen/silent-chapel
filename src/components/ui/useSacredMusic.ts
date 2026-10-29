"use client";
// 배경 성가 재생. 사용자가 소리를 켰을 때만 재생하며(자동 재생 없음), 곡 사이에 고요한 쉼을 둡니다.
// 브라우저가 음원 형식을 재생하지 못하면 직접 합성한 잔잔한 음(useAmbientSound)으로 대신합니다.
import { useEffect, useRef, useState } from "react";
import { MUSIC_TRACKS } from "@/lib/music";
import { useAmbientSound } from "./useAmbientSound";

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
    const track = MUSIC_TRACKS[0];
    const probe = document.createElement("audio");
    if (!probe.canPlayType(track.mime)) {
      setFallback(true);
      return;
    }
    const el = new Audio(track.src);
    el.preload = "auto";
    el.volume = 0;
    elRef.current = el;
    let rest: ReturnType<typeof setTimeout> | null = null;
    let stopped = false;

    const start = () => {
      if (stopped) return;
      el.currentTime = 0;
      el.volume = 0;
      el.play()
        .then(() => {
          setPlaying(true);
          fade(el, TARGET_VOLUME, FADE_MS);
        })
        .catch(() => setFallback(true));
    };
    const onEnded = () => {
      rest = setTimeout(start, track.restMs);
    };
    const onError = () => setFallback(true);
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
        el.src = "";
      });
      elRef.current = null;
      setPlaying(false);
    };
  }, [enabled]);

  if (!enabled) return "off";
  if (fallback) return "synth";
  return playing ? "chant" : "off";
}
