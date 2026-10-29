"use client";
// 직접 합성한 잔잔한 배경음 (저작권 문제 없는 Web Audio 합성음). 사용자가 켰을 때만 재생합니다.
import { useEffect, useRef } from "react";

export function useAmbientSound(enabled: boolean) {
  const ctxRef = useRef<{ ctx: AudioContext; master: GainNode } | null>(null);

  useEffect(() => {
    if (!enabled) {
      const cur = ctxRef.current;
      if (cur) {
        cur.master.gain.setTargetAtTime(0, cur.ctx.currentTime, 0.4);
        const t = setTimeout(() => {
          void cur.ctx.close();
        }, 1500);
        ctxRef.current = null;
        return () => clearTimeout(t);
      }
      return;
    }
    const Ctx = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!Ctx) return;
    const ctx = new Ctx();
    const master = ctx.createGain();
    master.gain.value = 0;
    const filter = ctx.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.value = 900;
    filter.connect(master);
    master.connect(ctx.destination);
    // D 장조 화음을 느리게 숨쉬듯 (오르간 페달 느낌)
    const freqs = [73.42, 110, 146.83, 220, 277.18];
    freqs.forEach((f, i) => {
      const osc = ctx.createOscillator();
      osc.type = i < 2 ? "sine" : "triangle";
      osc.frequency.value = f;
      const g = ctx.createGain();
      g.gain.value = 0.12 / (i + 1);
      const lfo = ctx.createOscillator();
      lfo.frequency.value = 0.05 + i * 0.013;
      const lfoGain = ctx.createGain();
      lfoGain.gain.value = 0.05 / (i + 1);
      lfo.connect(lfoGain).connect(g.gain);
      osc.connect(g).connect(filter);
      osc.start();
      lfo.start();
    });
    master.gain.setTargetAtTime(0.35, ctx.currentTime, 2);
    ctxRef.current = { ctx, master };
    return undefined;
  }, [enabled]);

  useEffect(
    () => () => {
      void ctxRef.current?.ctx.close();
      ctxRef.current = null;
    },
    [],
  );
}
