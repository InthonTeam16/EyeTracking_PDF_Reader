"use client";

import { ReaderView } from "@/components/reader/reader-view";
import { useMouseGaze } from "@/lib/gaze/useMouseGaze";
import mockBlocks from "@/lib/mock/blocks.json";
import type { Block } from "@/types";

// TODO(demo): 업로드 연결 전까지 목업 블록을 보여준다.
const blocks: Block[] = mockBlocks;

export function ReaderScreen() {
  const gaze = useMouseGaze({});

  return (
    <main className="flex flex-1 flex-col bg-background">
      <ReaderView blocks={blocks} activeBlockId={gaze.activeBlockId} />
    </main>
  );
}
