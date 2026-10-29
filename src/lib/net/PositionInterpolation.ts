// 스냅샷 보간: 받은 위치들을 버퍼에 쌓고, '현재 - 지연' 시점의 위치를 두 스냅샷 사이에서 계산합니다.
// 네트워크가 띄엄띄엄 와도 화면에서는 부드럽게 움직입니다.

import { lerpAngle } from "../game/PlayerState.ts";

export interface Snapshot {
  /** 받은 시각(로컬 시계, ms). 송신자 시계와의 차이 문제를 피하려고 받은 시각을 씁니다 */
  time: number;
  x: number;
  y: number;
  z: number;
  yaw: number;
}

export interface Sample {
  x: number;
  y: number;
  z: number;
  yaw: number;
}

const MAX_SNAPSHOTS = 32;
/** 두 스냅샷 사이 거리가 이보다 크면 미끄러지듯 보간하지 않고 즉시 이동 */
export const TELEPORT_DISTANCE = 4;

export class SnapshotBuffer {
  private snaps: Snapshot[] = [];

  push(s: Snapshot): void {
    const last = this.snaps[this.snaps.length - 1];
    if (last && s.time <= last.time) s = { ...s, time: last.time + 1 };
    // 앉기/일어나기 등으로 크게 이동하면 보간하지 않고 바로 이동
    if (last && Math.hypot(s.x - last.x, s.z - last.z) > TELEPORT_DISTANCE) this.snaps = [];
    this.snaps.push(s);
    if (this.snaps.length > MAX_SNAPSHOTS) this.snaps.shift();
  }

  get size(): number {
    return this.snaps.length;
  }

  latest(): Snapshot | undefined {
    return this.snaps[this.snaps.length - 1];
  }

  clear(): void {
    this.snaps = [];
  }

  /** renderTime(= now - delay) 시점의 보간 위치 */
  sample(renderTime: number): Sample | null {
    const s = this.snaps;
    if (s.length === 0) return null;
    if (renderTime <= s[0].time || s.length === 1) return pick(s[0]);
    const last = s[s.length - 1];
    if (renderTime >= last.time) return pick(last);
    for (let i = s.length - 1; i > 0; i--) {
      const a = s[i - 1];
      const b = s[i];
      if (renderTime >= a.time) {
        const t = (renderTime - a.time) / (b.time - a.time || 1);
        // 너무 오래된 것은 정리
        if (i > 2) this.snaps.splice(0, i - 2);
        return {
          x: a.x + (b.x - a.x) * t,
          y: a.y + (b.y - a.y) * t,
          z: a.z + (b.z - a.z) * t,
          yaw: lerpAngle(a.yaw, b.yaw, t),
        };
      }
    }
    return pick(last);
  }
}

function pick(s: Snapshot): Sample {
  return { x: s.x, y: s.y, z: s.z, yaw: s.yaw };
}
