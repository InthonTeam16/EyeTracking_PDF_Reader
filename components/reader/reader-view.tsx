import type { ReactNode } from "react";

import { cn } from "@/lib/utils";
import type { Block } from "@/types";

type ReaderViewProps = {
  blocks: Block[];
  activeBlockId: string | null;
  // 특정 블록 옆에 띄울 요소 (부가 설명 팝업)
  aside?: { blockId: string; content: ReactNode };
};

function groupByPage(blocks: Block[]): [number, Block[]][] {
  const pages = new Map<number, Block[]>();
  for (const block of [...blocks].sort((a, b) => a.order - b.order)) {
    pages.set(block.page, [...(pages.get(block.page) ?? []), block]);
  }
  return [...pages.entries()];
}

export function ReaderView({ blocks, activeBlockId, aside }: ReaderViewProps) {
  // 시선을 아직 못 잡았으면(null) 모든 블록을 선명하게 둔다.
  const focusing = activeBlockId !== null;

  return (
    <article className="mx-auto flex w-full max-w-2xl flex-col gap-16 px-6 py-16">
      {groupByPage(blocks).map(([page, pageBlocks]) => (
        <section key={page} className="flex flex-col gap-10">
          <p className="text-xs font-medium tracking-wide text-muted-foreground">
            {page} 페이지
          </p>
          {pageBlocks.map((block) => {
            const active = block.id === activeBlockId;
            return (
              <div key={block.id} className="relative">
                <p
                  data-block-id={block.id}
                  className={cn(
                    "rounded-lg px-4 py-3 text-lg leading-loose transition-[filter,opacity,background-color] duration-300",
                    active &&
                      "bg-accent text-accent-foreground ring-1 ring-ring/30",
                    focusing && !active && "opacity-40 blur-[3px]",
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
