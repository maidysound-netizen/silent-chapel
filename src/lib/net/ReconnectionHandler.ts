// 연결이 끊기면 점점 간격을 늘려 다시 시도합니다(지수 백오프 + 무작위 지터).
// 브라우저가 오프라인이면 기다렸다가 온라인이 되는 즉시 시도합니다.

export function backoffDelayMs(attempt: number, baseMs = 1000, maxMs = 30_000, jitter = Math.random()): number {
  const exp = Math.min(maxMs, baseMs * 2 ** Math.max(0, attempt));
  return Math.round(exp * (0.7 + 0.3 * jitter));
}

export class ReconnectionHandler {
  private attempt = 0;
  private timer: ReturnType<typeof setTimeout> | null = null;
  private disposed = false;
  private readonly onOnline = () => {
    if (this.timer || this.pending) this.fireNow();
  };
  private pending = false;

  private readonly reconnect: () => Promise<void>;

  constructor(reconnect: () => Promise<void>) {
    this.reconnect = reconnect;
    if (typeof window !== "undefined") window.addEventListener("online", this.onOnline);
  }

  /** 연결 실패/끊김 시 호출 */
  schedule(): void {
    if (this.disposed || this.timer) return;
    this.pending = true;
    if (typeof navigator !== "undefined" && navigator.onLine === false) return; // online 이벤트 대기
    const delay = backoffDelayMs(this.attempt++);
    this.timer = setTimeout(() => this.fireNow(), delay);
  }

  /** 연결 성공 시 호출 */
  reset(): void {
    this.attempt = 0;
    this.pending = false;
    if (this.timer) clearTimeout(this.timer);
    this.timer = null;
  }

  get attempts(): number {
    return this.attempt;
  }

  private fireNow(): void {
    if (this.disposed) return;
    if (this.timer) clearTimeout(this.timer);
    this.timer = null;
    this.pending = false;
    this.reconnect().catch(() => this.schedule());
  }

  dispose(): void {
    this.disposed = true;
    if (this.timer) clearTimeout(this.timer);
    if (typeof window !== "undefined") window.removeEventListener("online", this.onOnline);
  }
}
