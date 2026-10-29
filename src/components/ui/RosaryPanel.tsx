"use client";
// 묵주기도 패널: 신비 선택 → 단계별 진행 → 완료. 진행 상태는 이 기기에만 저장됩니다.
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useApp } from "@/store/useAppStore";
import { getRosaryLocale, getUi } from "@/lib/i18n";
import type { MysteryId, RosaryOptions } from "@/lib/rosary/types";
import { DEFAULT_ROSARY_OPTIONS } from "@/lib/rosary/types";
import {
  buildRosarySequence,
  changeOptions,
  nextStep,
  prevStep,
  setPaused,
  startProgress,
  suggestedMysteryForDay,
} from "@/lib/rosary/sequence";
import { RosaryBeadsSvg } from "./RosaryBeadsSvg";

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
  const today = useMemo(() => suggestedMysteryForDay(new Date().getDay()), []);
  const [selected, setSelected] = useState<MysteryId>(progress?.mystery ?? today);

  const steps = useMemo(() => buildRosarySequence(progress?.options ?? options), [progress?.options, options]);

  const close = useCallback(() => openPanel(null), [openPanel]);

  useEffect(() => {
    headingRef.current?.focus();
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
        if (progress.status === "praying") setRosary(nextStep(progress));
      } else if (e.key === "ArrowLeft") {
        e.preventDefault();
        setRosary(prevStep(progress));
      } else if (e.key === "p" || e.key === "P") {
        setRosary(setPaused(progress, progress.status !== "paused"));
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [choosing, progress, setRosary, close]);

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
  const paused = progress.status === "paused";
  const step = steps[progress.stepIndex];
  const prayer = data.prayers[step.kind];
  const mystery = data.mysteries[progress.mystery];
  const decadeInfo = step.decade > 0 ? mystery.decades[step.decade - 1] : null;
  const firstDecadeIndex = steps.findIndex((s) => s.decade === 1);
  const section = step.decade > 0 ? ui.decadeN(step.decade) : step.index < firstDecadeIndex ? ui.intro : ui.outro;
  const liveText = complete
    ? ui.complete
    : [section, prayer.name, step.hailMary ? ui.hailMaryCount(step.hailMary.n, step.hailMary.of) : ""].filter(Boolean).join(", ");

  return (
    <section className="panel rosary-panel" role="dialog" aria-modal="false" aria-labelledby="rosary-title">
      <header className="panel-header">
        <h2 id="rosary-title" ref={headingRef} tabIndex={-1}>
          {mystery.name}
          {!complete && <span className="sub"> · {section}</span>}
        </h2>
        <button className="icon-btn" onClick={close} aria-label={ui.close}>
          ✕
        </button>
      </header>
      <div className="panel-body rosary-body">
        <div className="beads-wrap">
          <RosaryBeadsSvg steps={steps} stepIndex={progress.stepIndex} complete={complete} />
        </div>

        <div className="step-area">
          <p className="sr-only" aria-live="polite">
            {liveText}
          </p>

          {complete ? (
            <div className="complete-card">
              <h3>{ui.complete}</h3>
              <p>{ui.completeBody}</p>
              <div className="row">
                <button className="btn" onClick={() => setChoosing(true)}>
                  {ui.again}
                </button>
                <button className="btn primary" onClick={close}>
                  {ui.close}
                </button>
              </div>
            </div>
          ) : (
            <div className={`step-card ${paused ? "is-paused" : ""}`}>
              {decadeInfo && (
                <p className="mystery-line">
                  <strong>{ui.decadeN(step.decade)}</strong> {decadeInfo.title}
                  <span className="scripture">
                    {ui.scripture}: {decadeInfo.scripture}
                  </span>
                </p>
              )}
              <h3 className="prayer-name">
                {prayer.name}
                {step.optional && <em className="badge">{ui.optional}</em>}
              </h3>
              {step.hailMary && (
                <div className="hm-count" aria-hidden="true">
                  <span>{ui.hailMaryCount(step.hailMary.n, step.hailMary.of)}</span>
                  <span className="dots">
                    {Array.from({ length: step.hailMary.of }, (_, i) => (
                      <i key={i} className={i < step.hailMary!.n - 1 ? "on" : i === step.hailMary!.n - 1 ? "cur" : ""} />
                    ))}
                  </span>
                </div>
              )}
              <p className="guide">{prayer.guide}</p>
              {prayer.text ? (
                <p className="prayer-text">{prayer.text}</p>
              ) : (
                <p className="prayer-link">
                  <a href={prayer.sourceUrl} target="_blank" rel="noopener noreferrer">
                    {ui.officialText} ↗
                  </a>
                </p>
              )}
              {paused && <p className="paused-msg">{ui.paused}</p>}
            </div>
          )}

          {!complete && (
            <>
              <div className="progress" aria-hidden="true">
                <div className="bar" style={{ width: `${((progress.stepIndex + 1) / steps.length) * 100}%` }} />
              </div>
              <p className="step-count">{ui.stepCount(progress.stepIndex + 1, steps.length)}</p>
              <div className="controls">
                <button className="btn" onClick={() => setRosary(prevStep(progress))} disabled={progress.stepIndex === 0}>
                  ← {ui.prev}
                </button>
                <button className="btn" onClick={() => setRosary(setPaused(progress, !paused))} aria-pressed={paused}>
                  {paused ? ui.continue : ui.pause}
                </button>
                <button className="btn primary" onClick={() => setRosary(nextStep(progress))} disabled={paused}>
                  {ui.next} →
                </button>
              </div>
              <details className="more">
                <summary>{ui.options} · {ui.sources}</summary>
                <label>
                  <input
                    type="checkbox"
                    checked={progress.options.includeFatima}
                    onChange={(e) => setRosary(changeOptions(progress, { ...progress.options, includeFatima: e.target.checked }))}
                  />
                  {ui.includeFatima}
                </label>
                <label>
                  <input
                    type="checkbox"
                    checked={progress.options.includeClosingPrayer}
                    onChange={(e) =>
                      setRosary(changeOptions(progress, { ...progress.options, includeClosingPrayer: e.target.checked }))
                    }
                  />
                  {ui.includeClosing}
                </label>
                <p className="muted">{ui.textNotIncluded}</p>
                <ul className="sources">
                  {data.sources.map((s) => (
                    <li key={s.url}>
                      <a href={s.url} target="_blank" rel="noopener noreferrer">
                        {s.label} ↗
                      </a>
                    </li>
                  ))}
                </ul>
                <button className="btn small" onClick={() => setChoosing(true)}>
                  {ui.restart}
                </button>
              </details>
            </>
          )}
          <p className="muted small">{ui.savedLocally}</p>
          <p className="muted small kbd-hint">{ui.keyboardHint}</p>
        </div>
      </div>
    </section>
  );
}
