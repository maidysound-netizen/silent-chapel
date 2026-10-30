"use client";
// 함께 있는 사람 목록. 관리자에게만 '내보내기' 버튼이 보입니다 (실제 권한은 서버 ban_user 가 확인).
import { useEffect, useState, useSyncExternalStore } from "react";
import { useApp } from "@/store/useAppStore";
import { getUi } from "@/lib/i18n";
import { getNetworkManager } from "@/lib/net/NetworkManager";

export function PeoplePanel() {
  const locale = useApp((s) => s.settings.locale);
  const openPanel = useApp((s) => s.openPanel);
  const ui = getUi(locale);
  const net = getNetworkManager();
  const snap = useSyncExternalStore(net.subscribe.bind(net), net.getSnapshot, net.getSnapshot);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && openPanel(null);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [openPanel]);

  const kick = async (uid: string, name: string) => {
    if (!window.confirm(ui.kickConfirm(name))) return;
    setBusy(uid);
    const ok = await net.banUser(uid);
    setBusy(null);
    setNotice(ok ? ui.kickDone(name) : ui.kickFail);
  };

  return (
    <section className="panel people-panel" role="dialog" aria-modal="false" aria-labelledby="people-title">
      <header className="panel-header">
        <h2 id="people-title">{ui.people}</h2>
        <button className="icon-btn" onClick={() => openPanel(null)} aria-label={ui.close}>
          ✕
        </button>
      </header>
      <div className="panel-body">
        {snap.others.length === 0 ? (
          <p className="muted">{ui.peopleEmpty}</p>
        ) : (
          <ul className="people-list">
            {snap.others.map((o) => (
              <li key={o.uid}>
                <span>
                  {o.nick} <span className="muted small">#{o.tag}</span>
                </span>
                {snap.isAdmin && (
                  <button className="btn small danger" disabled={busy === o.uid} onClick={() => void kick(o.uid, o.nick)}>
                    {ui.kick}
                  </button>
                )}
              </li>
            ))}
          </ul>
        )}
        {notice && (
          <p className="small" role="status">
            {notice}
          </p>
        )}
      </div>
    </section>
  );
}
