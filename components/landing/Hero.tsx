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
        <p className="self-start rounded-full border border-border px-3 py-1.5 text-sm text-muted-foreground">
          웹캠 아이트래킹 PDF 리더
        </p>
        <h1 className="text-5xl leading-[1.15] font-bold tracking-tight md:text-[56px]">
          읽는 곳만
          <br />
          선명하게.
        </h1>
        <p className="max-w-[30em] text-lg leading-relaxed text-foreground/80 md:text-[19px]">
          웹캠이 시선을 따라가며 지금 읽는 문단만 또렷하게 비춰요. 한 문단에서
          오래 머물거나 미간을 찌푸리면, 그 부분을 쉽게 풀어 설명해 드려요.
        </p>
        <div className="flex flex-wrap items-center gap-3">{actions}</div>
      </div>
      <div className="min-w-0 flex-[1_1_460px]">
        <ReaderPreview />
      </div>
    </section>
  );
}
