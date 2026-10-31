"use client";

import { useState } from "react";

import { cn } from "@/lib/utils";

type PreviewParagraph = {
  heading: string;
  text: string;
  explanation?: string;
};

// 랜딩 히어로의 리더 미리보기용 문단. 실제 리더 블록이 아니므로 data-block-id를 붙이지 않는다.
const PARAGRAPHS: PreviewParagraph[] = [
  {
    heading: "매끄럽게 읽는다는 착각",
    text: "책을 읽을 때 우리는 눈이 문장 위를 일정한 속도로 미끄러져 간다고 느낀다. 하지만 실제로 눈은 그렇게 움직이지 않는다.",
  },
  {
    heading: "멈춤과 도약",
    text: "단속운동이 일어나는 동안에는 시각 정보의 처리가 크게 억제되는데, 이를 단속운동 억제(saccadic suppression)라 부른다.",
    explanation:
      "눈이 다음 위치로 휙 옮겨 가는 아주 짧은 순간에는 뇌가 들어오는 장면을 거의 처리하지 않아요. 그래서 시선을 옮길 때 세상이 흔들려 보이지 않아요.",
  },
  {
    heading: "선명하게 보이는 범위",
    text: "망막에서 가장 선명한 상이 맺히는 곳은 중심와라는 작은 영역이다. 그 바깥의 주변시는 글자를 또렷하게 구분하지 못한다.",
  },
  {
    heading: "건너뛰고 되돌아가기",
    text: "눈은 모든 단어에 멈추지 않는다. 짧고 자주 쓰이는 단어는 그냥 건너뛰고, 낯선 단어에는 더 오래 머문다.",
  },
];

export function ReaderPreview() {
  const [activeIndex, setActiveIndex] = useState(0);

  return (
    <div className="rounded-2xl border border-border bg-muted/50 p-3.5">
      <div className="flex items-center justify-between px-1.5 pt-0.5 pb-3 text-[13px] text-muted-foreground">
        <span>눈은 어떻게 글을 읽는가 · 1쪽</span>
        <span className="inline-flex items-center gap-1.5">
          <span className="size-2 rounded-full bg-primary" aria-hidden="true" />
          시선 추적 중
        </span>
      </div>
      <div className="flex flex-col gap-2.5 rounded-xl border border-border bg-background p-4.5">
        {PARAGRAPHS.map((paragraph, index) => {
          const active = index === activeIndex;
          return (
            <div key={paragraph.heading} className="flex flex-col gap-2">
              <button
                type="button"
                onMouseEnter={() => setActiveIndex(index)}
                onFocus={() => setActiveIndex(index)}
                aria-pressed={active}
                className={cn(
                  "relative block w-full cursor-default rounded-xl border py-3 pr-10 pl-3.5 text-left text-sm leading-7 text-foreground transition-[filter,opacity,background-color] duration-300 outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
                  active
                    ? "border-ring bg-muted"
                    : "border-transparent opacity-60 blur-[3px]",
                )}
              >
                <span className="mb-1 block text-xs font-bold text-muted-foreground">
                  {paragraph.heading}
                </span>
                {paragraph.text}
                {active && (
                  <span
                    className="absolute top-3.5 right-3.5 size-3.5 rounded-full bg-primary ring-6 ring-primary/15"
                    aria-hidden="true"
                  />
                )}
              </button>
              {active && paragraph.explanation && (
                <div
                  role="note"
                  className="ml-4 flex flex-col gap-1.5 rounded-xl border border-border bg-popover px-4 py-3.5 text-popover-foreground shadow-lg"
                >
                  <span className="text-xs font-bold text-muted-foreground">
                    오래 바라본 문단 · 쉬운 설명
                  </span>
                  <span className="text-sm leading-relaxed">
                    {paragraph.explanation}
                  </span>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
