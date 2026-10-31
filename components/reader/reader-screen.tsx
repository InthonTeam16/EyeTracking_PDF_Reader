"use client";

import { Loader2Icon } from "lucide-react";

import { ExplainPopover } from "@/components/reader/explain-popover";
import { ReaderView } from "@/components/reader/reader-view";
import { useExplanations } from "@/components/reader/use-explanations";
import { useReaderBlocks } from "@/components/reader/use-reader-blocks";
import { useMouseGaze } from "@/lib/gaze/useMouseGaze";
import type { Block } from "@/types";

export function ReaderScreen() {
  const blocks = useReaderBlocks();

  return (
    <main className="flex flex-1 flex-col bg-background">
      {blocks ? (
        <ReaderContent blocks={blocks} />
      ) : (
        <p className="m-auto flex items-center gap-2 text-muted-foreground">
          <Loader2Icon className="size-4 animate-spin" />
          PDF를 읽기 좋은 블록으로 재배치하는 중…
        </p>
      )}
    </main>
  );
}

// 블록이 준비된 뒤에만 시선 추적과 설명 팝업을 붙인다.
function ReaderContent({ blocks }: { blocks: Block[] }) {
  const { openBlockId, explanation, open, close } = useExplanations(blocks);
  const gaze = useMouseGaze({ onDwell: open, onSquint: open });

  return (
    <ReaderView
      blocks={blocks}
      activeBlockId={gaze.activeBlockId}
      aside={
        openBlockId && explanation
          ? {
              blockId: openBlockId,
              content: (
                <ExplainPopover explanation={explanation} onClose={close} />
              ),
            }
          : undefined
      }
    />
  );
}
