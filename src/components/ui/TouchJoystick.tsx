"use client";
// 모바일 가상 조이스틱과 달리기 버튼. 값은 localPlayer.touch / localPlayer.run 에 직접 씁니다.
// 왼손 엄지로 조이스틱, 오른손 엄지로 달리기 버튼을 누르고 있는 동안 달립니다.
import { useEffect, useRef, useState } from "react";
import { localPlayer } from "@/store/localPlayer";

const RADIUS = 48;

export function TouchJoystick({ label }: { label: string }) {
  const base = useRef<HTMLDivElement>(null);
  const [knob, setKnob] = useState({ x: 0, y: 0 });
  const pid = useRef<number | null>(null);

  const update = (clientX: number, clientY: number) => {
    const rect = base.current!.getBoundingClientRect();
    let dx = clientX - (rect.left + rect.width / 2);
    let dy = clientY - (rect.top + rect.height / 2);
    const len = Math.hypot(dx, dy);
    if (len > RADIUS) {
      dx = (dx / len) * RADIUS;
      dy = (dy / len) * RADIUS;
    }
    setKnob({ x: dx, y: dy });
    localPlayer.touch.right = dx / RADIUS;
    localPlayer.touch.forward = -dy / RADIUS;
  };
  const end = () => {
    pid.current = null;
    setKnob({ x: 0, y: 0 });
    localPlayer.touch.right = 0;
    localPlayer.touch.forward = 0;
  };

  return (
    <div
      ref={base}
      className="joystick"
      role="application"
      aria-label={label}
      onPointerDown={(e) => {
        e.stopPropagation();
        pid.current = e.pointerId;
        try {
          e.currentTarget.setPointerCapture(e.pointerId);
        } catch {
          /* 포인터가 이미 사라진 경우 */
        }
        update(e.clientX, e.clientY);
      }}
      onPointerMove={(e) => pid.current === e.pointerId && update(e.clientX, e.clientY)}
      onPointerUp={end}
      onPointerCancel={end}
    >
      <div className="knob" style={{ transform: `translate(${knob.x}px, ${knob.y}px)` }} />
    </div>
  );
}

/** 누르고 있는 동안 달리기 (모바일) */
export function RunButton({ label }: { label: string }) {
  const [held, setHeld] = useState(false);
  const pid = useRef<number | null>(null);
  const set = (v: boolean) => {
    localPlayer.run.touch = v;
    setHeld(v);
  };
  // 버튼이 사라질 때(앉기·패널 열기) 달리기 해제
  useEffect(() => () => void (localPlayer.run.touch = false), []);
  const end = (e: React.PointerEvent) => {
    if (pid.current !== e.pointerId) return;
    pid.current = null;
    set(false);
  };
  return (
    <button
      type="button"
      className={`run-btn ${held ? "held" : ""}`}
      aria-label={label}
      aria-pressed={held}
      onPointerDown={(e) => {
        e.stopPropagation();
        pid.current = e.pointerId;
        try {
          e.currentTarget.setPointerCapture(e.pointerId);
        } catch {
          /* ignore */
        }
        set(true);
      }}
      onPointerUp={end}
      onPointerCancel={end}
      onContextMenu={(e) => e.preventDefault()}
    >
      {label}
    </button>
  );
}
