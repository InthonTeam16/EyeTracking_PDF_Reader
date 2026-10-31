"use client";

import { CameraIcon, Loader2Icon, MousePointer2Icon } from "lucide-react";
import {
  useEffect,
  useRef,
  useState,
  type PointerEvent,
  type ReactNode,
  type RefObject,
} from "react";

import { ExplainPopover } from "@/components/reader/explain-popover";
import { PdfPages } from "@/components/reader/pdf-pages";
import {
  ReaderHeader,
  type GazeMode,
  type ViewMode,
} from "@/components/reader/reader-header";
import {
  HIGHLIGHT_BOX_CLASSES,
  ReaderSettingsButton,
  useReaderSettings,
} from "@/components/reader/reader-settings";
import { ReaderView } from "@/components/reader/reader-view";
import { useExplanations } from "@/components/reader/use-explanations";
import {
  useReaderBlocks,
  type ReaderDocument,
} from "@/components/reader/use-reader-blocks";
import { GAZE_MIN_TRAINING_CLICKS } from "@/lib/gaze/config";
import { useGaze, type GazeStatus } from "@/lib/gaze/useGaze";
import { useMouseGaze } from "@/lib/gaze/useMouseGaze";
import { cn } from "@/lib/utils";
import type { GazeEvents, GazeState } from "@/types";

export function ReaderScreen() {
  const doc = useReaderBlocks();

  return (
    <main className="flex h-dvh flex-col overflow-hidden bg-background">
      {doc ? (
        <ReaderContent doc={doc} />
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
function ReaderContent({ doc }: { doc: ReaderDocument }) {
  const { blocks, file } = doc;
  const { openBlockId, explanation, open, close } = useExplanations(blocks);
  const [viewMode, setViewMode] = useState<ViewMode>("focus");
  const [gazeMode, setGazeMode] = useState<GazeMode>("webcam");
  // 웹캠을 못 써서 마우스로 넘어온 경우 그 이유를 보여준다.
  const [fallbackReason, setFallbackReason] = useState<string | null>(null);
  const [settings, updateSettings] = useReaderSettings();
  // 분할 보기에서 집중 읽기 칸이 차지하는 비율
  const [readingRatio, setReadingRatio] = useState(0.5);
  // true면 원본 PDF를 왼쪽에 둔다
  const [pdfFirst, setPdfFirst] = useState(false);
  const splitRef = useRef<HTMLDivElement>(null);

  // 부가 설명을 끄면 오래 응시하거나 찡그려도 팝업을 띄우지 않는다.
  const events: GazeEvents = settings.explain
    ? { onDwell: open, onSquint: open }
    : {};
  const totalPages = Math.max(...blocks.map((block) => block.page));
  const split = viewMode === "split";
  const toggleGazeMode = () => {
    setFallbackReason(null);
    setGazeMode((prev) => (prev === "webcam" ? "mouse" : "webcam"));
  };
  // x는 분할 영역 왼쪽 끝에서 손잡이까지의 비율
  const resizeSplit = (x: number) => {
    const ratio = pdfFirst ? 1 - x : x;
    setReadingRatio(
      Math.min(Math.max(ratio, MIN_PANE_RATIO), 1 - MIN_PANE_RATIO),
    );
  };

  const render = (gaze: GazeState, message: string) => {
    const activeBlock = blocks.find((block) => block.id === gaze.activeBlockId);
    const activePage = activeBlock?.page ?? null;

    return (
      <>
        <ReaderHeader
          title={file?.name ?? "샘플 문서"}
          viewMode={viewMode}
          onViewModeChange={setViewMode}
          onSwapPanes={() => setPdfFirst((prev) => !prev)}
          gazeMode={gazeMode}
          onGazeModeToggle={toggleGazeMode}
          settings={
            <ReaderSettingsButton
              settings={settings}
              onChange={updateSettings}
            />
          }
        />
        {/* 모드를 바꿔도 PDF를 다시 열지 않도록 두 칸을 항상 두고 숨기기만 한다.
            칸마다 따로 스크롤되도록 이 영역은 화면 높이를 넘지 않는다. */}
        <div ref={splitRef} className="flex min-h-0 flex-1 overflow-hidden">
          <section
            aria-label="집중 읽기"
            className={cn(
              "@container min-h-0 min-w-0 flex-col",
              viewMode === "pdf" ? "hidden" : "flex",
              split ? "shrink-0 grow-0" : "flex-1",
              split && pdfFirst ? "order-3" : "order-1",
            )}
            // 끌어서 바꾸는 비율이라 Tailwind 클래스로 정할 수 없다.
            style={split ? { flexBasis: `${readingRatio * 100}%` } : undefined}
          >
            <div className="min-h-0 flex-1 overflow-y-auto">
              <ReaderView
                blocks={blocks}
                activeBlockId={gaze.activeBlockId}
                settings={settings}
                notice={<GazeNotice mode={gazeMode} message={message} />}
                aside={
                  settings.explain && openBlockId && explanation
                    ? {
                        blockId: openBlockId,
                        content: (
                          <ExplainPopover
                            explanation={explanation}
                            onClose={close}
                          />
                        ),
                      }
                    : undefined
                }
              />
            </div>
            <ReadingProgress page={activePage} totalPages={totalPages} />
          </section>

          {split && (
            <SplitHandle containerRef={splitRef} onResize={resizeSplit} />
          )}

          <section
            aria-label="원본 PDF"
            className={cn(
              "min-h-0 min-w-0 flex-1 flex-col",
              viewMode === "focus" ? "hidden" : "flex",
              split && pdfFirst ? "order-1" : "order-3",
            )}
          >
            {file ? (
              <PdfPages
                file={file}
                syncPage={settings.syncPdf ? activePage : null}
                thumbnailsSide={split && pdfFirst ? "left" : "right"}
                highlight={
                  settings.pdfHighlight && activeBlock
                    ? {
                        page: activeBlock.page,
                        text: activeBlock.text,
                        className:
                          HIGHLIGHT_BOX_CLASSES[settings.pdfHighlightColor],
                      }
                    : null
                }
              />
            ) : (
              <p className="m-auto p-8 text-sm text-muted-foreground">
                샘플 문서라 원본 PDF가 없어요. PDF를 올리면 여기서 볼 수 있어요.
              </p>
            )}
          </section>
        </div>
      </>
    );
  };

  // 훅은 조건부로 부를 수 없어서 모드마다 컴포넌트를 나눈다.
  return gazeMode === "webcam" ? (
    <WebcamGaze
      events={events}
      onFail={() => {
        setFallbackReason("웹캠을 쓸 수 없어 마우스 모드로 전환했어요.");
        setGazeMode("mouse");
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

// 분할 보기에서 한쪽 칸이 너무 좁아지지 않게 막는 최소 비율
const MIN_PANE_RATIO = 0.25;

// 두 칸 사이를 끌어서 폭을 바꾸는 손잡이 (윈도우 분할 화면처럼)
function SplitHandle({
  containerRef,
  onResize,
}: {
  containerRef: RefObject<HTMLDivElement | null>;
  onResize: (x: number) => void;
}) {
  const [dragging, setDragging] = useState(false);

  const handleMove = (event: PointerEvent<HTMLDivElement>) => {
    const rect = containerRef.current?.getBoundingClientRect();
    if (!dragging || !rect) return;
    onResize((event.clientX - rect.left) / rect.width);
  };

  return (
    <div
      role="separator"
      aria-orientation="vertical"
      aria-label="칸 크기 조절"
      onPointerDown={(event) => {
        // 끄는 동안 글자가 선택되지 않게 하고, 손잡이 밖으로 나가도 계속 받는다.
        event.preventDefault();
        event.currentTarget.setPointerCapture(event.pointerId);
        setDragging(true);
      }}
      onPointerMove={handleMove}
      onPointerUp={() => setDragging(false)}
      onPointerCancel={() => setDragging(false)}
      className={cn(
        "group order-2 flex w-2 shrink-0 cursor-col-resize touch-none justify-center bg-border/40",
        dragging && "bg-primary/20",
      )}
    >
      <span
        className={cn(
          "w-px bg-border transition-colors group-hover:w-0.5 group-hover:bg-primary/60",
          dragging && "w-0.5 bg-primary",
        )}
      />
    </div>
  );
}

function GazeNotice({ mode, message }: { mode: GazeMode; message: string }) {
  const Icon = mode === "webcam" ? CameraIcon : MousePointer2Icon;
  return (
    <p className="flex items-center gap-3 rounded-xl bg-muted px-4 py-3 text-sm text-muted-foreground">
      <Icon className="size-4 shrink-0 text-foreground" />
      {message}
    </p>
  );
}

function ReadingProgress({
  page,
  totalPages,
}: {
  page: number | null;
  totalPages: number;
}) {
  const percent = page ? (page / totalPages) * 100 : 0;
  return (
    <footer className="mx-auto w-full max-w-2xl shrink-0 px-6 pb-3">
      <div className="h-0.5 bg-muted">
        {/* 진행률은 문서마다 달라 Tailwind 클래스로 정할 수 없다. */}
        <div
          className="h-full bg-foreground transition-[width] duration-300"
          style={{ width: `${percent}%` }}
        />
      </div>
      <p className="mt-2 text-right text-xs text-muted-foreground tabular-nums">
        {page ?? "–"} / {totalPages}
      </p>
    </footer>
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
      if (!status.faceVisible)
        return "얼굴이 보이지 않아요. 화면 정면을 봐 주세요.";
      if (!calibrated)
        return `화면 곳곳을 바라보며 클릭해 보정해 주세요 · ${status.clicks}/${GAZE_MIN_TRAINING_CLICKS}`;
      return "웹캠으로 시선을 따라가는 중이에요.";
  }
}
