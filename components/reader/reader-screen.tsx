"use client";

import { useSearchParams } from "next/navigation";
import { useState } from "react";

import { ReaderView } from "@/components/reader/reader-view";
import { useMouseGaze } from "@/lib/gaze/useMouseGaze";
import mockBlocks from "@/lib/mock/blocks.json";
import type { Block } from "@/types";

// TODO(demo): 업로드 연결 전까지 목업 블록을 보여준다.
const blocks: Block[] = mockBlocks;

export function ReaderScreen() {
  const gaze = useMouseGaze({});

  // TODO(demo): useMouseGaze 구현 전 화면 확인용. /reader?debug 에서 클릭한 블록을 active로 둔다.
  const debug = useSearchParams().has("debug");
  const [debugBlockId, setDebugBlockId] = useState<string | null>(null);
  const activeBlockId = debug ? debugBlockId : gaze.activeBlockId;

  return (
    <main className="flex flex-1 flex-col bg-background">
      <ReaderView
        blocks={blocks}
        activeBlockId={activeBlockId}
        onBlockClick={
          debug ? (id) => setDebugBlockId((prev) => (prev === id ? null : id)) : undefined
        }
      />
    </main>
  );
}
