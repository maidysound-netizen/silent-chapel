"use client";
// 직접 합성한 짧은 효과음 (외부 음원 없음)
let ctx: AudioContext | null = null;

function audio(): AudioContext | null {
  if (typeof window === "undefined") return null;
  if (!ctx) {
    const Ctx = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctx) return null;
    ctx = new Ctx();
  }
  if (ctx.state === "suspended") void ctx.resume();
  return ctx;
}

/** 나무 묵주알이 손가락 사이로 넘어가며 '딱' 부딪히는 작은 소리 */
export function beadClick(volume = 0.25) {
  const a = audio();
  if (!a) return;
  const t = a.currentTime;
  const len = Math.floor(a.sampleRate * 0.05);
  const buf = a.createBuffer(1, len, a.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 6);
  const src = a.createBufferSource();
  src.buffer = buf;
  const band = a.createBiquadFilter();
  band.type = "bandpass";
  band.frequency.value = 2300 + Math.random() * 400;
  band.Q.value = 4;
  const g = a.createGain();
  g.gain.value = volume;
  src.connect(band).connect(g).connect(a.destination);
  src.start(t);
  // 낮은 '톡' 울림
  const osc = a.createOscillator();
  osc.frequency.setValueAtTime(420, t);
  osc.frequency.exponentialRampToValueAtTime(180, t + 0.06);
  const og = a.createGain();
  og.gain.setValueAtTime(volume * 0.5, t);
  og.gain.exponentialRampToValueAtTime(0.001, t + 0.08);
  osc.connect(og).connect(a.destination);
  osc.start(t);
  osc.stop(t + 0.09);
}
