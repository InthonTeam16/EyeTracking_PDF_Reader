"use client";

import { Loader2Icon } from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";

import { ExplainPopover } from "@/components/reader/explain-popover";
import { GazeModeBar, type GazeMode } from "@/components/reader/gaze-mode-bar";
import { ReaderView } from "@/components/reader/reader-view";
import { useExplanations } from "@/components/reader/use-explanations";
import { useReaderBlocks } from "@/components/reader/use-reader-blocks";
import { GAZE_MIN_TRAINING_CLICKS } from "@/lib/gaze/config";
import { useGaze, type GazeStatus } from "@/lib/gaze/useGaze";
import { useMouseGaze } from "@/lib/gaze/useMouseGaze";
import type { Block, GazeEvents, GazeState } from "@/types";

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
  const [mode, setMode] = useState<GazeMode>("webcam");
  // 웹캠을 못 써서 마우스로 넘어온 경우 그 이유를 보여준다.
  const [fallbackReason, setFallbackReason] = useState<string | null>(null);

  const events: GazeEvents = { onDwell: open, onSquint: open };
  const toggleMode = () => {
    setFallbackReason(null);
    setMode((prev) => (prev === "webcam" ? "mouse" : "webcam"));
  };

  const render = (gaze: GazeState, message: string) => (
    <>
      <GazeModeBar mode={mode} message={message} onToggle={toggleMode} />
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
    </>
  );

  // 훅은 조건부로 부를 수 없어서 모드마다 컴포넌트를 나눈다.
  return mode === "webcam" ? (
    <WebcamGaze
      events={events}
      onFail={() => {
        setFallbackReason("웹캠을 쓸 수 없어 마우스 모드로 전환했어요.");
        setMode("mouse");
      }}
      render={render}
    />
  ) : (
    <MouseGaze
      events={events}
      message={fallbackReason ?? "마우스 커서를 시선 대신 쓰는 중이에요."}
      render={render}
    />
  );
}

type GazeSourceProps = {
  events: GazeEvents;
  render: (gaze: GazeState, message: string) => ReactNode;
};

function WebcamGaze({
  events,
  onFail,
  render,
}: GazeSourceProps & { onFail: () => void }) {
  const gaze = useGaze(events);
  const activeBlockId = useLastBlockId(gaze.activeBlockId);
  const failed = gaze.status.phase === "error";

  // 권한 거부·카메라 없음·모델 로드 실패 모두 마우스 모드로 넘긴다.
  useEffect(() => {
    if (failed) onFail();
  }, [failed, onFail]);

  return render(
    { ...gaze, activeBlockId },
    describeWebcam(gaze.status, gaze.calibrated),
  );
}

function MouseGaze({
  events,
  message,
  render,
}: GazeSourceProps & { message: string }) {
  const gaze = useMouseGaze(events);
  const activeBlockId = useLastBlockId(gaze.activeBlockId);
  return render({ ...gaze, activeBlockId }, message);
}

// 시선이 문단 사이 빈 곳에 있으면 직전에 본 블록을 계속 강조한다.
// 설명 팝업(onDwell)은 원래 activeBlockId 기준이라 영향이 없다.
function useLastBlockId(blockId: string | null): string | null {
  const [lastBlockId, setLastBlockId] = useState(blockId);
  if (blockId !== null && blockId !== lastBlockId) setLastBlockId(blockId);
  return blockId ?? lastBlockId;
}

// TODO(demo): 민서님 보정 오버레이가 나오면 보정 안내는 그쪽으로 옮긴다.
function describeWebcam(status: GazeStatus, calibrated: boolean): string {
  switch (status.phase) {
    case "loading":
      return "시선 인식 모델을 불러오는 중이에요.";
    case "camera":
      return "카메라 권한을 허용해 주세요.";
    case "error":
      return "웹캠을 시작하지 못했어요.";
    case "tracking":
      if (!status.faceVisible) return "얼굴이 보이지 않아요. 화면 정면을 봐 주세요.";
      if (!calibrated)
        return `화면 곳곳을 바라보며 클릭해 보정해 주세요 · ${status.clicks}/${GAZE_MIN_TRAINING_CLICKS}`;
      return "웹캠으로 시선을 따라가는 중이에요.";
  }
}
