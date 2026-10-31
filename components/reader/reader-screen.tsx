"use client";

import { ExplainPopover } from "@/components/reader/explain-popover";
import { ReaderView } from "@/components/reader/reader-view";
import { useExplanations } from "@/components/reader/use-explanations";
import { useMouseGaze } from "@/lib/gaze/useMouseGaze";
import mockBlocks from "@/lib/mock/blocks.json";
import type { Block } from "@/types";

// TODO(demo): 업로드 연결 전까지 목업 블록을 보여준다.
const blocks: Block[] = mockBlocks;

export function ReaderScreen() {
  const { openBlockId, explanation, open, close } = useExplanations(blocks);
  const gaze = useMouseGaze({ onDwell: open, onSquint: open });

  return (
    <main className="flex flex-1 flex-col bg-background">
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
    </main>
  );
}
