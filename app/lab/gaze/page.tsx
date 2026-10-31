"use client";

import { useState } from "react";
import { GazeDebugDot } from "@/components/gaze/GazeDebugDot";
import { useMouseGaze } from "@/lib/gaze/useMouseGaze";
import { getMockBlocks } from "@/lib/mock/blocks";
import { cn } from "@/lib/utils";

const blocks = getMockBlocks();

export default function GazeLabPage() {
  const [lastDwell, setLastDwell] = useState<string | null>(null);
  const gaze = useMouseGaze({
    onDwell: (blockId, ms) => setLastDwell(`${blockId} (${ms}ms)`),
  });

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-6 p-8">
      <h1 className="text-2xl font-semibold">시선 엔진 테스트</h1>

      <dl className="grid grid-cols-2 gap-1 text-sm text-muted-foreground">
        <dt>좌표</dt>
        <dd data-testid="point">
          {gaze.point ? `${gaze.point.x}, ${gaze.point.y}` : "없음"}
        </dd>
        <dt>보고 있는 블록</dt>
        <dd data-testid="active-block">{gaze.activeBlockId ?? "없음"}</dd>
        <dt>캘리브레이션</dt>
        <dd data-testid="calibrated">{gaze.calibrated ? "완료" : "필요"}</dd>
        <dt>마지막 응시</dt>
        <dd data-testid="last-dwell">{lastDwell ?? "없음"}</dd>
      </dl>

      <div className="flex flex-col gap-8">
        {blocks.map((block) => (
          <p
            key={block.id}
            data-block-id={block.id}
            className={cn(
              "rounded-lg border p-6",
              gaze.activeBlockId === block.id && "border-primary bg-accent",
            )}
          >
            {block.text}
          </p>
        ))}
      </div>

      <GazeDebugDot point={gaze.point} />
    </main>
  );
}
