"use client";

import { useState } from "react";
import { GazeDebugDot } from "@/components/gaze/GazeDebugDot";
import { Button } from "@/components/ui/button";
import { GAZE_MIN_TRAINING_CLICKS } from "@/lib/gaze/config";
import { type GazeStatus, useGaze } from "@/lib/gaze/useGaze";
import { useMouseGaze } from "@/lib/gaze/useMouseGaze";
import { getMockBlocks } from "@/lib/mock/blocks";
import { cn } from "@/lib/utils";
import type { GazeState } from "@/types";

const blocks = getMockBlocks();

function GazeLabView({
  gaze,
  lastDwell,
}: {
  gaze: GazeState;
  lastDwell: string | null;
}) {
  return (
    <>
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
    </>
  );
}

function MouseGazeLab() {
  const [lastDwell, setLastDwell] = useState<string | null>(null);
  const gaze = useMouseGaze({
    onDwell: (blockId, ms) => setLastDwell(`${blockId} (${ms}ms)`),
  });
  return <GazeLabView gaze={gaze} lastDwell={lastDwell} />;
}

function describeStatus(status: GazeStatus): string {
  switch (status.phase) {
    case "loading":
      return "모델을 불러오는 중입니다.";
    case "camera":
      return "카메라를 기다리는 중입니다. 권한 요청을 허용해 주세요.";
    case "error":
      return `시작하지 못했습니다: ${status.message}`;
    case "tracking": {
      const face = status.faceVisible
        ? "얼굴 인식됨"
        : "얼굴이 보이지 않습니다. 이 상태의 클릭은 학습되지 않습니다.";
      return `${face} · 학습 ${status.clicks}회 (최소 ${GAZE_MIN_TRAINING_CLICKS}회)`;
    }
  }
}

function WebcamGazeLab() {
  const [lastDwell, setLastDwell] = useState<string | null>(null);
  const gaze = useGaze({
    onDwell: (blockId, ms) => setLastDwell(`${blockId} (${ms}ms)`),
  });
  return (
    <>
      <p
        data-testid="gaze-status"
        className={cn(
          "text-sm font-medium",
          gaze.status.phase === "error" && "text-destructive",
        )}
      >
        {describeStatus(gaze.status)}
      </p>
      <GazeLabView gaze={gaze} lastDwell={lastDwell} />
    </>
  );
}

const MODES = {
  mouse: { label: "마우스", Lab: MouseGazeLab },
  webcam: { label: "웹캠", Lab: WebcamGazeLab },
};

type Mode = keyof typeof MODES;

export default function GazeLabPage() {
  const [mode, setMode] = useState<Mode>("mouse");
  const { Lab } = MODES[mode];

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-6 p-8">
      <div className="flex items-center justify-between gap-4">
        <h1 className="text-2xl font-semibold">시선 엔진 테스트</h1>
        <div className="flex gap-2">
          {(Object.keys(MODES) as Mode[]).map((key) => (
            <Button
              key={key}
              data-mode={key}
              variant={mode === key ? "default" : "outline"}
              onClick={() => setMode(key)}
            >
              {MODES[key].label}
            </Button>
          ))}
        </div>
      </div>
      {mode !== "mouse" && (
        <p className="text-sm text-muted-foreground">
          화면 곳곳을 바라보면서 클릭하면 학습합니다.
        </p>
      )}
      <Lab />
    </main>
  );
}
