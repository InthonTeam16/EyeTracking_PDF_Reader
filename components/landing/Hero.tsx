import type { ReactNode } from "react";

import { ReaderPreview } from "@/components/landing/ReaderPreview";

type HeroProps = {
  // PDF 업로드 버튼 등 행동 버튼 영역. 업로드 UI는 김정인 담당이라 app/page.tsx에서 넘겨받는다.
  actions: ReactNode;
};

export function Hero({ actions }: HeroProps) {
  return (
    <section className="mx-auto flex max-w-6xl flex-wrap items-center gap-16 px-6 pt-22 pb-24 md:px-8">
      <div className="flex min-w-0 flex-[1_1_420px] flex-col gap-7">
        <h1 className="text-5xl leading-[1.15] font-bold tracking-tight md:text-[56px]">
          눈길
        </h1>
        <p className="text-2xl font-semibold tracking-tight md:text-[28px]">
          EyeTracking PDF/TXT Reader
        </p>
        <p className="max-w-[30em] text-lg leading-relaxed text-foreground/80 md:text-[19px]">
          아이트래킹을 통해 읽는 문장을 파악하고, ai 설명으로 어려운 문장의 이해를 돕는다.
        </p>
        <div className="flex flex-wrap items-center gap-3">{actions}</div>
      </div>
      <div className="min-w-0 flex-[1_1_460px]">
        <ReaderPreview />
      </div>
    </section>
  );
}
