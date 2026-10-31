import type { ReactNode } from "react";

import {
  BLUR_CLASSES,
  FONT_CLASSES,
  FONT_SIZE_CLASSES,
  LINE_HEIGHT_CLASSES,
  type ReaderSettings,
} from "@/components/reader/reader-settings";
import { cn } from "@/lib/utils";
import type { Block } from "@/types";

type ReaderViewProps = {
  blocks: Block[];
  activeBlockId: string | null;
  settings: ReaderSettings;
  // 특정 블록 옆에 띄울 요소 (부가 설명 팝업)
  aside?: { blockId: string; content: ReactNode };
  // 본문 위에 띄울 안내 (시선 상태)
  notice?: ReactNode;
};

// block.page는 toBlocks가 넣은 원본 PDF의 페이지 번호다.
function groupByPage(blocks: Block[]): [number, Block[]][] {
  const pages = new Map<number, Block[]>();
  for (const block of [...blocks].sort((a, b) => a.order - b.order)) {
    pages.set(block.page, [...(pages.get(block.page) ?? []), block]);
  }
  return [...pages.entries()];
}

export function ReaderView({
  blocks,
  activeBlockId,
  settings,
  aside,
  notice,
}: ReaderViewProps) {
  // 시선을 아직 못 잡았거나(null) 하이라이트를 껐으면 모든 블록을 선명하게 둔다.
  const focusing = settings.highlight && activeBlockId !== null;

  return (
    <article className="mx-auto flex w-full max-w-2xl flex-col gap-12 px-6 py-10">
      {notice}
      {groupByPage(blocks).map(([page, pageBlocks]) => (
        <section key={page} className="flex flex-col gap-10">
          <p className="text-xs font-medium tracking-wide text-muted-foreground">
            원본 {page}쪽
          </p>
          {pageBlocks.map((block) => {
            const active = focusing && block.id === activeBlockId;
            return (
              <div key={block.id} className="relative">
                <p
                  data-block-id={block.id}
                  className={cn(
                    // toBlocks가 제목과 본문 사이에 넣은 \n을 그대로 보여준다.
                    "rounded-lg px-4 py-3 whitespace-pre-line transition-[filter,opacity,background-color] duration-300",
                    FONT_CLASSES[settings.font],
                    FONT_SIZE_CLASSES[settings.fontSize],
                    LINE_HEIGHT_CLASSES[settings.lineHeight],
                    active &&
                      "bg-accent text-accent-foreground ring-1 ring-ring/30",
                    focusing && !active && BLUR_CLASSES[settings.blur],
                  )}
                >
                  {block.text}
                </p>
                {aside?.blockId === block.id && aside.content}
              </div>
            );
          })}
        </section>
      ))}
    </article>
  );
}
