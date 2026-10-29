"use client";
// 네트워크 측정값 표시 (Phase 3 검증용): 초당 메시지 수, 전송 주기, 지연, 누적량
import { useEffect, useState } from "react";
import { getNetworkManager } from "@/lib/net/NetworkManager";

export function NetStats() {
  const [, tick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => tick((t) => t + 1), 1000);
    return () => clearInterval(id);
  }, []);
  const net = getNetworkManager();
  const m = net.metrics;
  const snap = net.getSnapshot();
  return (
    <div className="netstats" aria-label="network stats">
      <div>status {snap.status} · room {snap.roomId ?? "-"}</div>
      <div>players {snap.count} · send {m.sendHz.toFixed(1)} Hz · interp {Math.round(net.interpolationDelay)} ms</div>
      <div>
        msg/s ↑{m.sentPerSec.toFixed(1)} ↓{m.recvPerSec.toFixed(1)} · total ↑{m.sentTotal} ↓{m.recvTotal}
      </div>
      <div>
        bytes ↑{(m.sentBytes / 1024).toFixed(1)}KB ↓{(m.recvBytes / 1024).toFixed(1)}KB · drop {m.droppedInvalid}/{m.droppedStale}
      </div>
      <div>latency* {m.latencyMs === null ? "-" : `${Math.round(m.latencyMs)} ms`} · reconnects {m.reconnects}</div>
      <div className="muted">* 보낸 시각→받은 시각 (기기 간 시계 차이 포함)</div>
    </div>
  );
}
