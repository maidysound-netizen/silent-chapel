"use client";
// 필요할 때만 물체 위에 떠오르는 행동 안내 (HTML 버튼).
// 3D 위치를 매 프레임 화면 좌표로 바꿔 따라다니게 하므로, 거리와 상관없이 글씨 크기가 일정하고
// 터치·키보드·화면 읽기 프로그램에서도 일반 버튼처럼 동작합니다.
//   묵주 받침대 근처 → 묵주 집어 들기 (E) · 성모상 근처 → 성모님께 절하기 (B)
//   제단 앞 → 예수님께 절하기 (B)
//   장의자 근처 → 앉기 (F)   (앉아 있을 때의 행동은 Hud 아래 가운데에 표시)
import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { useApp } from "@/store/useAppStore";
import { getUi } from "@/lib/i18n";
import { ALTAR, CANDLE_RACK, MARY, MARY_SHRINE, ROSARY_STAND, ROSE_ALTAR } from "@/lib/game/chapelLayout";
import { bow, interact, offerRose, pickRose, sitAt } from "@/store/localPlayer";
import { sceneRefs } from "../scene/sceneRefs";

interface PromptItem {
  id: string;
  text: string;
  keyHint: string;
  /** 3D 위치 (함수면 매 프레임 계산 — 움직이는 대상) */
  at: [number, number, number] | (() => [number, number, number]);
  /** 화면에서 위로 띄울 픽셀 (여러 개를 쌓을 때) */
  lift?: number;
  run: () => void;
}

export function PromptOverlay() {
  const phase = useApp((s) => s.phase);
  const panel = useApp((s) => s.panel);
  const prompt = useApp((s) => s.prompt);
  const pose = useApp((s) => s.pose);
  const nearMary = useApp((s) => s.nearMary);
  const nearJesus = useApp((s) => s.nearJesus);
  const nearRose = useApp((s) => s.nearRoseAltar);
  const holdingRose = useApp((s) => s.holdingRose);
  const ui = getUi(useApp((s) => s.settings.locale));
  const showKeys = useMemo(() => typeof window !== "undefined" && !window.matchMedia?.("(pointer: coarse)").matches, []);

  const items: PromptItem[] = [];
  if (phase === "chapel" && panel === null) {
    // 앉아 있을 때의 행동(묵주기도·묵상 시점·일어나기)은 화면 아래 가운데(Hud)에 표시
    if (pose !== "sit") {
      // 장미: 제단에서 받기 / 들고 있으면 성모상·제단 앞에서 바치기 (절하기 안내 위에 쌓아 보여 줌)
      if (nearRose && !holdingRose)
        items.push({ id: "rose-pick", text: `🌹 ${ui.pickRose}`, keyHint: "E", at: [ROSE_ALTAR.x, ROSE_ALTAR.height + 0.7, ROSE_ALTAR.z], run: pickRose });
      if (holdingRose && nearMary)
        items.push({ id: "rose-mary", text: `🌹 ${ui.offerRoseMary}`, keyHint: "E", at: [MARY.x + 0.2, MARY_SHRINE.pedestalH + MARY_SHRINE.statueH + 0.25, MARY.z], lift: 48, run: () => offerRose("mary") });
      else if (holdingRose && nearJesus)
        items.push({ id: "rose-jesus", text: `🌹 ${ui.offerRoseJesus}`, keyHint: "E", at: [ALTAR.x, ALTAR.height + 1.1, ALTAR.z], lift: 48, run: () => offerRose("jesus") });
      if (prompt?.kind === "candles" && !holdingRose)
        items.push({ id: "candles", text: `🕯 ${ui.lightWish}`, keyHint: "E", at: [CANDLE_RACK.x + 0.2, 1.55, CANDLE_RACK.z], run: interact });
      if (prompt?.kind === "rosary" && !holdingRose)
        items.push({ id: "rosary", text: `📿 ${ui.interactRosary}`, keyHint: "E", at: [ROSARY_STAND.x, ROSARY_STAND.y + 0.35, ROSARY_STAND.z], run: interact });
      if (nearMary) items.push({ id: "mary", text: `🙏 ${ui.bowToMary}`, keyHint: "B", at: [MARY.x + 0.2, MARY_SHRINE.pedestalH + MARY_SHRINE.statueH + 0.25, MARY.z], run: bow });
      else if (nearJesus) items.push({ id: "jesus", text: `✝ ${ui.bowToJesus}`, keyHint: "B", at: [ALTAR.x, ALTAR.height + 1.1, ALTAR.z], run: bow });
      if (prompt?.kind === "seat") {
        const seat = prompt.seat;
        items.push({ id: `seat-${seat.id}`, text: ui.interactPew, keyHint: "F", at: [seat.x, 1.05, seat.z], run: () => sitAt(seat) });
      }
    }
  }

  const refs = useRef(new Map<string, HTMLButtonElement>());
  const itemsRef = useRef(items);
  itemsRef.current = items;

  // 매 프레임 3D → 화면 좌표
  useEffect(() => {
    let raf = 0;
    const v = new THREE.Vector3();
    const tick = () => {
      raf = requestAnimationFrame(tick);
      const cam = sceneRefs.camera;
      const canvas = sceneRefs.canvas;
      if (!cam || !canvas) return;
      const rect = canvas.getBoundingClientRect();
      for (const it of itemsRef.current) {
        const el = refs.current.get(it.id);
        if (!el) continue;
        const p = typeof it.at === "function" ? it.at() : it.at;
        v.set(p[0], p[1], p[2]).project(cam);
        const visible = v.z < 1 && Math.abs(v.x) < 1.1 && Math.abs(v.y) < 1.1;
        el.style.visibility = visible ? "visible" : "hidden";
        if (!visible) continue;
        // 화면 가장자리에서 잘리지 않도록 안쪽으로 붙임
        const half = el.offsetWidth / 2 + 8;
        const x = Math.min(rect.right - half, Math.max(rect.left + half, rect.left + ((v.x + 1) / 2) * rect.width));
        const y = Math.max(rect.top + el.offsetHeight + 56, rect.top + ((1 - v.y) / 2) * rect.height - (it.lift ?? 0));
        el.style.transform = `translate(${x}px, ${y}px) translate(-50%, -100%)`;
      }
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);

  return (
    <div className="prompt-layer">
      {items.map((it) => (
        <button
          key={it.id}
          ref={(el) => {
            if (el) refs.current.set(it.id, el);
            else refs.current.delete(it.id);
          }}
          className="prompt-tag"
          style={{ visibility: "hidden" }}
          onClick={it.run}
        >
          {it.text}
          {showKeys && <kbd>{it.keyHint}</kbd>}
        </button>
      ))}
    </div>
  );
}
