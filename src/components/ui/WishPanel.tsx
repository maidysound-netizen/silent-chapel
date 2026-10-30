"use client";
// 소원 초: 소원을 적어 초를 켜고(색은 무작위), 하루 안에 켜진 초들을 읽습니다.
// 자기 초와(관리자는 모든 초) '초 끄기'로 지울 수 있습니다.
import { useEffect, useState, useSyncExternalStore } from "react";
import { useApp } from "@/store/useAppStore";
import { getUi } from "@/lib/i18n";
import { getNetworkManager } from "@/lib/net/NetworkManager";
import { randomWishColor, sanitizeWish, WISH_COLORS, WISH_MAX, type LightResult } from "@/lib/wishes";

export function WishPanel() {
  const locale = useApp((s) => s.settings.locale);
  const nickname = useApp((s) => s.nickname);
  const openPanel = useApp((s) => s.openPanel);
  const ui = getUi(locale);
  const net = getNetworkManager();
  const snap = useSyncExternalStore(net.subscribe.bind(net), net.getSnapshot, net.getSnapshot);
  useSyncExternalStore(
    (fn) => net.wishes.subscribe(fn),
    () => net.wishes.version,
    () => 0,
  );
  const [text, setText] = useState("");
  const [color, setColor] = useState(() => randomWishColor());
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    void net.loadWishes();
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && openPanel(null);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [net, openPanel]);

  const reasonText: Record<Exclude<LightResult, { ok: true }>["reason"], string> = {
    tooSoon: ui.wishTooSoon,
    daily: ui.wishDaily,
    notInRoom: ui.wishNotInRoom,
    banned: ui.wishBanned,
    invalid: ui.wishInvalid,
    error: ui.wishError,
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const wish = sanitizeWish(text);
    setBusy(true);
    const res = await net.lightWish(wish, color, nickname);
    setBusy(false);
    if (res.ok) {
      setText("");
      setColor(randomWishColor()); // 다음 초는 또 다른 색
      setNotice(ui.wishLit);
    } else setNotice(reasonText[res.reason]);
  };

  const now = Date.now();
  const list = net.wishes.all(now);
  const online = net.enabled;

  return (
    <section className="panel wish-panel" role="dialog" aria-modal="false" aria-labelledby="wish-title">
      <header className="panel-header">
        <h2 id="wish-title">🕯 {ui.wishTitle}</h2>
        <button className="icon-btn" onClick={() => openPanel(null)} aria-label={ui.close}>
          ✕
        </button>
      </header>
      <div className="panel-body">
        <form className="wish-form" onSubmit={(e) => void submit(e)}>
          <div className="wish-input-row">
            <span className="wish-swatch" style={{ background: WISH_COLORS[color] }} aria-hidden="true" />
            <textarea
              value={text}
              maxLength={WISH_MAX}
              rows={2}
              placeholder={ui.wishPlaceholder}
              onChange={(e) => setText(e.target.value)}
              // 입력 중 키가 이동·단축키로 쓰이지 않게
              onKeyDown={(e) => e.stopPropagation()}
            />
          </div>
          <div className="wish-actions">
            <span className="muted small">
              {Array.from(text).length}/{WISH_MAX}
            </span>
            <button className="btn" type="submit" disabled={busy || sanitizeWish(text).length === 0}>
              🕯 {ui.wishLight}
            </button>
          </div>
          <p className="muted small">{online ? ui.wishNote : ui.wishOffline}</p>
          {notice && (
            <p className="small" role="status">
              {notice}
            </p>
          )}
        </form>
        {list.length === 0 ? (
          <p className="muted">{ui.wishEmpty}</p>
        ) : (
          <ul className="wish-list">
            {list.map((c) => {
              const mine = c.userId === snap.uid || c.userId === "local";
              return (
                <li key={c.id}>
                  <span className="wish-swatch" style={{ background: WISH_COLORS[c.color] }} aria-hidden="true" />
                  <span className="wish-text">
                    {c.wish}
                    <span className="muted small">
                      {" "}
                      — {c.nickname} · {ui.wishAgo(Math.floor((now - c.createdAt) / 60000))}
                    </span>
                  </span>
                  {(mine || snap.isAdmin) && (
                    <button className="icon-btn small" onClick={() => void net.removeWish(c.id)} aria-label={ui.wishRemove} title={ui.wishRemove}>
                      ✕
                    </button>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </section>
  );
}
