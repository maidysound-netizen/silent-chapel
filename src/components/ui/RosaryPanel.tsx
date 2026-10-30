"use client";
// 묵주기도 패널: 신비 선택 → 단계별 진행 → 완료. 진행 상태는 이 기기에만 저장됩니다.
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useApp } from "@/store/useAppStore";
import { getRosaryLocale, getUi } from "@/lib/i18n";
import type { MysteryId, RosaryOptions } from "@/lib/rosary/types";
import { DEFAULT_ROSARY_OPTIONS } from "@/lib/rosary/types";
import {
  beadKey,
  buildRosarySequence,
  completedBeads,
  nextStep,
  prevStep,
  setPaused,
  startProgress,
  suggestedMysteryForDay,
} from "@/lib/rosary/sequence";
import dynamic from "next/dynamic";
import { RosaryBeadsSvg } from "./RosaryBeadsSvg";
import { beadClick } from "./sfx";

// 3D 묵주(WebGL)는 브라우저에서만 불러오고, 불러오는 동안은 2D 묵주를 보여 줌
const RosaryViewer = dynamic(() => import("../rosary/RosaryViewer"), {
  ssr: false,
  loading: () => <div className="rosary-3d" aria-hidden="true" />,
});

const MYSTERY_ORDER: MysteryId[] = ["joyful", "luminous", "sorrowful", "glorious"];

export function RosaryPanel() {
  const locale = useApp((s) => s.settings.locale);
  const ui = getUi(locale);
  const data = getRosaryLocale(locale);
  const progress = useApp((s) => s.rosary);
  const setRosary = useApp((s) => s.setRosary);
  const openPanel = useApp((s) => s.openPanel);
  const [choosing, setChoosing] = useState(progress === null);
  const [options, setOptions] = useState<RosaryOptions>(progress?.options ?? DEFAULT_ROSARY_OPTIONS);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const [use3D] = useState(() => {
    try {
      return !!document.createElement("canvas").getContext("webgl2");
    } catch {
      return false;
    }
  });
  const today = useMemo(() => suggestedMysteryForDay(new Date().getDay()), []);
  const [selected, setSelected] = useState<MysteryId>(progress?.mystery ?? today);

  const steps = useMemo(() => buildRosarySequence(progress?.options ?? options), [progress?.options, options]);

  const close = useCallback(() => openPanel(null), [openPanel]);

  // 버튼·키보드·묵주 굴리기가 모두 같은 함수를 씀. 한 번에 여러 알을 굴려도 최신 상태를 쓰도록 store에서 직접 읽음
  const advance = useCallback(() => {
    const p = useApp.getState().rosary;
    // 멈춤 상태였어도 묵주를 굴리면 다시 이어서 기도 (nextStep이 praying으로 바꿈)
    if (!p || p.status === "complete") return;
    setRosary(nextStep(p));
    if (useApp.getState().settings.sound) beadClick(0.07);
  }, [setRosary]);
  const goBack = useCallback(() => {
    const p = useApp.getState().rosary;
    if (!p || p.stepIndex === 0) return;
    setRosary(prevStep(p));
    if (useApp.getState().settings.sound) beadClick(0.045);
  }, [setRosary]);

  useEffect(() => {
    (headingRef.current ?? closeRef.current)?.focus({ preventScroll: true });
  }, [choosing]);

  // 키보드 조작
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        close();
        return;
      }
      if (choosing || !progress) return;
      const onButton = (e.target as HTMLElement | null)?.tagName === "BUTTON";
      if (e.key === "ArrowRight" || (e.key === " " && !onButton)) {
        e.preventDefault();
        advance();
      } else if (e.key === "ArrowLeft") {
        e.preventDefault();
        goBack();
      } else if (e.key === "p" || e.key === "P") {
        setRosary(setPaused(progress, progress.status !== "paused"));
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [choosing, progress, setRosary, close, advance, goBack]);

  const begin = () => {
    setRosary(startProgress(selected, options));
    setChoosing(false);
  };

  // ---------- 신비 선택 ----------
  if (choosing || !progress) {
    const saved = progress && progress.status !== "complete" ? progress : null;
    return (
      <section className="panel rosary-panel" role="dialog" aria-modal="false" aria-labelledby="rosary-title">
        <header className="panel-header">
          <h2 id="rosary-title" ref={headingRef} tabIndex={-1}>
            {ui.rosary}
          </h2>
          <button className="icon-btn" onClick={close} aria-label={ui.close}>
            ✕
          </button>
        </header>
        <div className="panel-body">
          {saved && (
            <div className="resume-card">
              <p>
                {data.mysteries[saved.mystery].name} ·{" "}
                {steps[saved.stepIndex]?.decade ? ui.decadeN(steps[saved.stepIndex].decade) : ui.intro} ·{" "}
                {ui.stepCount(saved.stepIndex + 1, buildRosarySequence(saved.options).length)}
              </p>
              <button className="btn primary" onClick={() => { setRosary(setPaused(saved, false)); setChoosing(false); }}>
                {ui.resume}
              </button>
            </div>
          )}
          <fieldset className="mystery-list">
            <legend>{ui.chooseMystery}</legend>
            {MYSTERY_ORDER.map((id) => (
              <label key={id} className={`mystery-option ${selected === id ? "selected" : ""}`}>
                <input type="radio" name="mystery" value={id} checked={selected === id} onChange={() => setSelected(id)} />
                <span className="mystery-name">{data.mysteries[id].name}</span>
                <span className="mystery-days">
                  {data.mysteries[id].days}
                  {id === today && <em className="badge">{ui.todaySuggestion}</em>}
                </span>
              </label>
            ))}
          </fieldset>
          <fieldset className="options">
            <legend>{ui.options}</legend>
            <label>
              <input type="checkbox" checked={options.includeFatima} onChange={(e) => setOptions({ ...options, includeFatima: e.target.checked })} />
              {ui.includeFatima}
            </label>
            <label>
              <input
                type="checkbox"
                checked={options.includeClosingPrayer}
                onChange={(e) => setOptions({ ...options, includeClosingPrayer: e.target.checked })}
              />
              {ui.includeClosing}
            </label>
          </fieldset>
          <button className="btn primary wide" onClick={begin}>
            {saved ? ui.restart : ui.begin}
          </button>
          <ul className="notes">
            {data.notes.map((n) => (
              <li key={n}>{n}</li>
            ))}
          </ul>
        </div>
      </section>
    );
  }

  // ---------- 진행 / 완료 ----------
  const complete = progress.status === "complete";
  const done = completedBeads(steps, progress.stepIndex, complete);
  const currentBead = complete ? null : steps[progress.stepIndex]?.bead ?? null;
  const currentKey = currentBead ? beadKey(currentBead) : null;
  const paused = progress.status === "paused";
  const step = steps[progress.stepIndex];
  const prayer = data.prayers[step.kind];
  const mystery = data.mysteries[progress.mystery];
  const firstDecadeIndex = steps.findIndex((s) => s.decade === 1);
  const section = step.decade > 0 ? ui.decadeN(step.decade) : step.index < firstDecadeIndex ? ui.intro : ui.outro;
  const liveText = complete
    ? ui.complete
    : [section, prayer.name, step.hailMary ? ui.hailMaryCount(step.hailMary.n, step.hailMary.of) : ""].filter(Boolean).join(", ");

  // 기도 중에는 글씨 없이 3D 묵주만 창 가득 보여 줌 (닫기·처음부터는 구석의 작은 아이콘)
  return (
    <section className="rosary-full" role="dialog" aria-modal="true" aria-label={mystery.name}>
      {use3D ? (
        <RosaryViewer done={done} currentKey={currentKey} onNext={advance} onPrev={goBack} hint={ui.rollHint} />
      ) : (
        <div className="rosary-full-2d">
          <RosaryBeadsSvg steps={steps} stepIndex={progress.stepIndex} complete={complete} />
        </div>
      )}
      <div className="rosary-corner">
        <button className="icon-btn" onClick={() => setChoosing(true)} aria-label={ui.restart} title={ui.restart}>
          ↺
        </button>
        <button className="icon-btn" ref={closeRef} onClick={close} aria-label={ui.close} title={ui.close}>
          ✕
        </button>
      </div>
      <p className="sr-only" aria-live="polite">
        {liveText}
      </p>
      {complete && (
        <div className="complete-card rosary-complete">
          <h3>{ui.complete}</h3>
          <div className="row">
            <button className="btn" onClick={() => setChoosing(true)}>
              {ui.again}
            </button>
            <button className="btn primary" onClick={close}>
              {ui.close}
            </button>
          </div>
        </div>
      )}
    </section>
  );
}
