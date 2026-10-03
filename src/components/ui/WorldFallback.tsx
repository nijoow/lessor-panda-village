"use client";

import { Component, type ReactNode } from "react";
import Image from "next/image";

export function WorldFallback({ onRetry }: { onRetry: () => void }) {
  return (
    <section className="absolute inset-0 z-[110] flex items-center justify-center overflow-y-auto bg-[#fdfaf6]/65 p-4 backdrop-blur-xl">
      <div className="glass-premium max-h-[calc(100dvh-2rem)] w-full max-w-xl overflow-y-auto overscroll-contain rounded-3xl">
        <Image
          src="/images/readme/village-day.png"
          alt="판다와 집, 벚나무가 있는 마을"
          width={960}
          height={540}
          className="h-auto w-full"
          priority
        />
        <div className="space-y-3 p-6 text-sky-950">
          <h1 className="text-xl">마을 화면을 열지 못했어</h1>
          <p className="text-sm leading-relaxed">
            그래픽 기능이나 파일을 불러오는 데 문제가 있어. 다시 열거나 마을의
            산책 모습을 볼 수 있어.
          </p>
          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              onClick={onRetry}
              className="min-h-11 rounded-full bg-linear-to-br from-orange-400 to-orange-500 px-5 text-white shadow-lg shadow-orange-500/20 hover:from-orange-300 hover:to-orange-400"
            >
              다시 열기
            </button>
            <a
              href="/images/readme/village-walk.gif"
              className="glass-card flex min-h-11 items-center rounded-full border-white/50 px-5 text-sky-950 hover:bg-white/40"
            >
              산책 모습 보기
            </a>
          </div>
        </div>
      </div>
    </section>
  );
}

export class WorldErrorBoundary extends Component<
  { children: ReactNode },
  { failed: boolean }
> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    if (this.state.failed)
      return <WorldFallback onRetry={() => window.location.reload()} />;
    return this.props.children;
  }
}
