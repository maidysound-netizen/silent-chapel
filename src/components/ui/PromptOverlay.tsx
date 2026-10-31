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
import { ALTAR, CANDLE_RACKS, MARY, MARY_SHRINE, ROSARY_STAND, ROSE_ALTAR } from "@/lib/game/chapelLayout";
import { nearCandleRack } from "@/lib/game/InteractionSystem";
import { bow, interact, localPlayer, offerRose, pickRose, sitAt } from "@/store/localPlayer";
import { FLOWERS } from "@/lib/game/roses";
import { sceneRefs } from "../scene/sceneRefs";

interface PromptItem {
  id: string;
  text: string;
  keyHint: string;
  /** 3D 위치 (함수면 매 프레임 계산 — 움직이는 대상) */
  at: [number, number, number] | (() => [number, number, number]);
  /** 같은 group 의 안내는 한 덩어리로 위아래로 쌓아 보여 줌 (겹치지 않게). 위치는 첫 항목 기준 */
  group?: string;
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
  const heldEmoji = (FLOWERS[useApp((s) => s.heldFlower)] ?? FLOWERS[0]).emoji;
  const ui = getUi(useApp((s) => s.settings.locale));
  const showKeys = useMemo(() => typeof window !== "undefined" && !window.matchMedia?.("(pointer: coarse)").matches, []);

  const items: PromptItem[] = [];
  if (phase === "chapel" && panel === null) {
    // 앉아 있을 때의 행동(묵주기도·묵상 시점·일어나기)은 화면 아래 가운데(Hud)에 표시
    if (pose !== "sit") {
      // 장미: 제단에서 받기 / 들고 있으면 성모상·제단 앞에서 바치기 (절하기 안내 위에 쌓아 보여 줌)
      if (nearRose && !holdingRose)
        items.push({ id: "rose-pick", text: `💐 ${ui.pickRose}`, keyHint: "E", at: [ROSE_ALTAR.x, ROSE_ALTAR.height + 0.7, ROSE_ALTAR.z], run: () => pickRose() });
      if (holdingRose && nearMary)
        items.push({ id: "rose-mary", text: `${heldEmoji} ${ui.offerRoseMary}`, keyHint: "E", at: [MARY.x + 0.2, MARY_SHRINE.pedestalH + MARY_SHRINE.statueH + 0.25, MARY.z], group: "mary", run: () => offerRose("mary") });
      else if (holdingRose && nearJesus)
        items.push({ id: "rose-jesus", text: `${heldEmoji} ${ui.offerRoseJesus}`, keyHint: "E", at: [ALTAR.x, ALTAR.height + 1.1, ALTAR.z], group: "jesus", run: () => offerRose("jesus") });
      if (prompt?.kind === "candles" && !holdingRose)
        items.push({
          id: "candles",
          text: `🕯 ${ui.lightWish}`,
          keyHint: "E",
          // 가까운 제단 위에 띄움 (매 프레임 위치 계산)
          at: () => {
            const r = CANDLE_RACKS[Math.max(0, nearCandleRack(localPlayer.state.x, localPlayer.state.z))];
            return [r.x + r.facing * 0.2, 1.55, r.z];
          },
          run: interact,
        });
      if (prompt?.kind === "rosary" && !holdingRose)
        items.push({ id: "rosary", text: `📿 ${ui.interactRosary}`, keyHint: "E", at: [ROSARY_STAND.x, ROSARY_STAND.y + 0.35, ROSARY_STAND.z], run: interact });
      if (nearMary) items.push({ id: "mary", text: `🙏 ${ui.bowToMary}`, keyHint: "B", at: [MARY.x + 0.2, MARY_SHRINE.pedestalH + MARY_SHRINE.statueH + 0.25, MARY.z], group: "mary", run: bow });
      else if (nearJesus) items.push({ id: "jesus", text: `✝ ${ui.bowToJesus}`, keyHint: "B", at: [ALTAR.x, ALTAR.height + 1.1, ALTAR.z], group: "jesus", run: bow });
      if (prompt?.kind === "seat") {
        const seat = prompt.seat;
        items.push({ id: `seat-${seat.id}`, text: ui.interactPew, keyHint: "F", at: [seat.x, 1.05, seat.z], run: () => sitAt(seat) });
      }
    }
  }

  // 같은 group 의 안내는 한 덩어리로 (예: 성모상 위 "꽃 바치기"와 "절하기" 를 위아래로)
  const groups: { id: string; at: PromptItem["at"]; items: PromptItem[] }[] = [];
  for (const it of items) {
    const g = it.group ? groups.find((x) => x.id === it.group) : undefined;
    if (g) g.items.push(it);
    else groups.push({ id: it.group ?? it.id, at: it.at, items: [it] });
  }

  const refs = useRef(new Map<string, HTMLDivElement>());
  const groupsRef = useRef(groups);
  groupsRef.current = groups;

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
      // 휴대폰은 위쪽 표시줄이 두 줄이라 그만큼 아래에서 멈춤. 위쪽에 행동 줄(꽃 고르기 등)이 떠 있으면 그 아래로
      let topGap = rect.width < 640 ? 124 : 56;
      const dock = document.querySelector<HTMLElement>(".hud-actions.dock");
      if (dock && getComputedStyle(dock).position === "fixed") topGap = Math.max(topGap, dock.getBoundingClientRect().bottom - rect.top + 8);
      for (const g of groupsRef.current) {
        const el = refs.current.get(g.id);
        if (!el) continue;
        const p = typeof g.at === "function" ? g.at() : g.at;
        v.set(p[0], p[1], p[2]).project(cam);
        const visible = v.z < 1 && Math.abs(v.x) < 1.1 && Math.abs(v.y) < 1.1;
        el.style.visibility = visible ? "visible" : "hidden";
        if (!visible) continue;
        // 화면 가장자리에서 잘리지 않도록 안쪽으로 붙임
        const half = el.offsetWidth / 2 + 8;
        const x = Math.min(rect.right - half, Math.max(rect.left + half, rect.left + ((v.x + 1) / 2) * rect.width));
        const y = Math.max(rect.top + el.offsetHeight + topGap, rect.top + ((1 - v.y) / 2) * rect.height);
        el.style.transform = `translate(${x}px, ${y}px) translate(-50%, -100%)`;
      }
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);

  return (
    <div className="prompt-layer">
      {groups.map((g) => (
        <div
          key={g.id}
          className="prompt-group"
          ref={(el) => {
            if (el) refs.current.set(g.id, el);
            else refs.current.delete(g.id);
          }}
          style={{ visibility: "hidden" }}
        >
          {g.items.map((it) => (
            <button key={it.id} className="prompt-tag" onClick={it.run}>
              {it.text}
              {showKeys && <kbd>{it.keyHint}</kbd>}
            </button>
          ))}
        </div>
      ))}
    </div>
  );
}
