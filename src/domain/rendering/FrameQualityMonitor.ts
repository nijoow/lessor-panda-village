/** Decisions use contiguous visible samples, never wall time spent in another tab. */
export class FrameQualityMonitor {
  private warmup = 5;
  private elapsed = 0;
  private samples: number[] = [];
  private slowSeconds = 0;
  private fastSeconds = 0;
  reset(warmup = 3) {
    this.warmup = warmup;
    this.elapsed = 0;
    this.samples = [];
    this.slowSeconds = 0;
    this.fastSeconds = 0;
  }
  sample(delta: number, visible: boolean) {
    if (!visible || !Number.isFinite(delta) || delta <= 0 || delta > 0.5) {
      this.reset();
      return null;
    }
    if (this.warmup > 0) { this.warmup -= delta; return null; }
    this.elapsed += delta;
    this.samples.push(delta * 1000);
    if (this.elapsed < 1) return null;
    const elapsed = this.elapsed;
    const samples = this.samples;
    const frameMs = elapsed * 1000 / samples.length;
    const sorted = [...samples].sort((a, b) => a - b);
    const p95FrameMs = sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * 0.95))];
    const slow = frameMs > 36 || p95FrameMs > 48;
    const fast = frameMs < 22 && p95FrameMs < 28;
    this.slowSeconds = slow ? this.slowSeconds + elapsed : 0;
    this.fastSeconds = fast ? this.fastSeconds + elapsed : 0;
    const direction = this.slowSeconds >= 3 ? -1 : this.fastSeconds >= 30 ? 1 : 0;
    this.elapsed = 0;
    this.samples = [];
    if (direction !== 0) this.reset(5);
    return { frameMs, p95FrameMs, fps: 1000 / frameMs, samples: samples.length, direction };
  }
}

