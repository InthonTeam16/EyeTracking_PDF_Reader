"use client";

import { CameraIcon, Loader2Icon, MousePointer2Icon } from "lucide-react";
import {
  useCallback,
  useEffect,
  useMemo,
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
  HIGHLIGHT_CLASSES,
  ReaderSettingsButton,
  useReaderSettings,
} from "@/components/reader/reader-settings";
import { useTheme } from "@/components/reader/theme";
import { ReaderView } from "@/components/reader/reader-view";
import { useCenterReading } from "@/components/reader/use-center-reading";
import { useExplanations } from "@/components/reader/use-explanations";
import {
  readingDwellMs,
  useReadingDwell,
} from "@/components/reader/use-reading-dwell";
import {
  useReaderBlocks,
  type ReaderDocument,
} from "@/components/reader/use-reader-blocks";
import { CalibrationOverlay } from "@/components/gaze/CalibrationOverlay";
import { GAZE_CALIBRATION_POINTS } from "@/lib/gaze/config";
import {
  useGaze,
  type GazeModelKind,
  type GazeStatus,
} from "@/lib/gaze/useGaze";
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
  const { blocks, pdf: file, kind, title } = doc;
  const { openBlockId, explanation, open, close, closeUnless } =
    useExplanations(blocks);
  // 블록마다 예상 읽기 시간보다 오래 머물 때 설명을 띄운다 (use-reading-dwell.ts).
  const dwellMsFor = useCallback(
    (blockId: string) =>
      readingDwellMs(blocks.find((block) => block.id === blockId)?.text ?? ""),
    [blocks],
  );
  const [chosenViewMode, setViewMode] = useState<ViewMode>("focus");
  // 원본 PDF가 없는 문서(TXT, 목업)는 집중 읽기만 쓴다.
  const hasPdf = file !== null;
  const viewMode: ViewMode = hasPdf ? chosenViewMode : "focus";
  const [gazeMode, setGazeMode] = useState<GazeMode>("webcam");
  // 웹캠을 못 써서 마우스로 넘어온 경우 그 이유를 보여준다.
  const [fallbackReason, setFallbackReason] = useState<string | null>(null);
  const [settings, updateSettings] = useReaderSettings();
  const { dark } = useTheme();
  // 분할 보기에서 집중 읽기 칸이 차지하는 비율
  const [readingRatio, setReadingRatio] = useState(0.5);
  // true면 원본 PDF를 왼쪽에 둔다
  const [pdfFirst, setPdfFirst] = useState(false);
  const splitRef = useRef<HTMLDivElement>(null);
  // 읽는 블록을 가운데로 데려오는 집중 읽기 스크롤 영역
  const readingScrollRef = useRef<HTMLDivElement>(null);
  const stepTimerRef = useRef<HTMLDivElement>(null);
  // 원본 PDF에서 다시 찾은 블록별 실제 페이지. 찾기 전에는 toBlocks가 준 페이지를 쓴다.
  const [resolvedPages, setResolvedPages] = useState<Map<
    string,
    number
  > | null>(null);
  const pagedBlocks = useMemo(
    () =>
      resolvedPages
        ? blocks.map((block) => ({
            ...block,
            page: resolvedPages.get(block.id) ?? block.page,
          }))
        : blocks,
    [blocks, resolvedPages],
  );

  // 부가 설명을 끄면 오래 응시하거나 찡그려도 팝업을 띄우지 않는다.
  const events: GazeEvents = settings.explain
    ? { onDwell: open, onSquint: open }
    : {};
  const totalPages = Math.max(...pagedBlocks.map((block) => block.page));
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

  const render = (
    gaze: GazeState,
    message: string,
    onPdf: boolean,
    onRecalibrate?: () => void,
  ) => {
    // 분할 보기에서 원본 PDF를 보는 중이면 어느 칸을 보는지와 읽기가 멈췄다는 걸 보여준다.
    const viewingPdf = split && onPdf;
    const activeBlock = pagedBlocks.find(
      (block) => block.id === gaze.activeBlockId,
    );
    const activePage = activeBlock?.page ?? null;
    // PDF는 원본 페이지, 페이지가 없는 문서는 문단 순서로 진행 위치를 보여준다.
    const progress = hasPdf
      ? { current: activePage, total: totalPages, unit: "" }
      : {
          current: activeBlock ? pagedBlocks.indexOf(activeBlock) + 1 : null,
          total: pagedBlocks.length,
          unit: " 문단",
        };

    return (
      <>
        <ReaderHeader
          title={title}
          viewMode={viewMode}
          showViewModes={hasPdf}
          onViewModeChange={setViewMode}
          onSwapPanes={() => setPdfFirst((prev) => !prev)}
          gazeMode={gazeMode}
          onGazeModeToggle={toggleGazeMode}
          onRecalibrate={onRecalibrate}
          settings={
            <ReaderSettingsButton
              settings={settings}
              onChange={updateSettings}
              hasPdf={hasPdf}
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
            <div className="relative flex min-h-0 flex-1 flex-col">
              <div
                ref={readingScrollRef}
                className={cn(
                  "min-h-0 flex-1 overflow-y-auto transition-opacity duration-200",
                  viewingPdf && "opacity-50",
                )}
              >
                <ReaderView
                  blocks={pagedBlocks}
                  showPages={kind === "pdf"}
                  centerSpace
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
              <StepTimer timerRef={stepTimerRef} />
              <ReadingPausedBadge visible={viewingPdf} />
            </div>
            <ReadingProgress {...progress} />
          </section>

          {split && (
            <SplitHandle containerRef={splitRef} onResize={resizeSplit} />
          )}

          <section
            aria-label="원본 PDF"
            className={cn(
              "relative min-h-0 min-w-0 flex-1 flex-col",
              viewMode === "focus" ? "hidden" : "flex",
              split && pdfFirst ? "order-1" : "order-3",
            )}
          >
            {/* 칸 내용 위에 그려야 해서 테두리를 따로 둔다. */}
            <div
              aria-hidden
              className={cn(
                "pointer-events-none absolute inset-0 z-20 border-2 border-primary transition-opacity duration-200",
                viewingPdf ? "opacity-100" : "opacity-0",
              )}
            />
            {file && (
              <PdfPages
                file={file}
                follow={settings.syncPdf}
                thumbnailsSide={split && pdfFirst ? "left" : "right"}
                inverted={dark && settings.darkPdf}
                blocks={blocks}
                onResolvePages={setResolvedPages}
                highlight={
                  activeBlock
                    ? {
                        page: activeBlock.page,
                        text: activeBlock.text,
                        // 형광펜이 "없음"이어도 따라가기에 쓰려고 위치는 찾는다.
                        className:
                          settings.pdfHighlightColor === "none"
                            ? null
                            : HIGHLIGHT_CLASSES[settings.pdfHighlightColor],
                      }
                    : null
                }
              />
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
      dwellMsFor={dwellMsFor}
      onActiveBlockChange={closeUnless}
      scrollRef={readingScrollRef}
      stepTimerRef={stepTimerRef}
      onFail={() => {
        setFallbackReason("웹캠을 쓸 수 없어 마우스 모드로 전환했어요.");
        setGazeMode("mouse");
      }}
      render={render}
    />
  ) : (
    <MouseGaze
      events={events}
      dwellMsFor={dwellMsFor}
      onActiveBlockChange={closeUnless}
      scrollRef={readingScrollRef}
      stepTimerRef={stepTimerRef}
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

// 눈짓으로 넘기기까지 남은 시간. 시선이 있는 쪽(칸 위나 아래) 가장자리에 차오른다.
// 값은 useCenterReading이 data-side와 --step-progress로 직접 넣는다.
function StepTimer({
  timerRef,
}: {
  timerRef: RefObject<HTMLDivElement | null>;
}) {
  return (
    <div
      ref={timerRef}
      aria-hidden
      className="pointer-events-none absolute inset-x-6 z-10 mx-auto hidden h-1.5 max-w-2xl overflow-hidden rounded-full bg-muted data-[side]:block data-[side=next]:bottom-4 data-[side=previous]:top-4"
    >
      {/* 매 프레임 바뀌는 값이라 Tailwind 클래스로 정할 수 없다. */}
      <div
        className="h-full origin-left bg-primary"
        style={{ transform: "scaleX(var(--step-progress, 0))" }}
      />
    </div>
  );
}

// 스크롤해도 보이도록 집중 읽기 칸 위쪽에 고정한다.
function ReadingPausedBadge({ visible }: { visible: boolean }) {
  return (
    <p
      aria-hidden={!visible}
      className={cn(
        "pointer-events-none absolute inset-x-0 top-4 z-10 mx-auto w-fit rounded-full bg-primary px-3 py-1 text-xs text-primary-foreground transition-opacity duration-200",
        visible ? "opacity-100" : "opacity-0",
      )}
    >
      원본 PDF를 보는 중 · 읽기 멈춤
    </p>
  );
}

function ReadingProgress({
  current,
  total,
  unit,
}: {
  current: number | null;
  total: number;
  unit: string;
}) {
  const percent = current ? (current / total) * 100 : 0;
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
        {current ?? "–"} / {total}
        {unit}
      </p>
    </footer>
  );
}

type GazeSourceProps = {
  events: GazeEvents;
  // 블록별 설명 기준 시간(ms)
  dwellMsFor: (blockId: string) => number;
  // 읽는 블록이 바뀌면 알린다 (다른 블록의 설명 팝업을 닫는 데 쓴다)
  onActiveBlockChange: (blockId: string | null) => void;
  // onPdf: 시선이 집중 읽기 칸 밖(분할 보기의 원본 PDF)에 있어 읽기가 멈춘 상태
  render: (
    gaze: GazeState,
    message: string,
    onPdf: boolean,
    onRecalibrate?: () => void,
  ) => ReactNode;
};

// 읽는 블록 기준으로 설명 타이머를 재고, 블록이 바뀌면 알린다.
// 원본 PDF를 보는 동안(lookingAtText가 false)에는 타이머를 재지 않는다.
function useBlockExplain(
  activeBlockId: string | null,
  lookingAtText: boolean,
  { events, dwellMsFor, onActiveBlockChange }: Omit<GazeSourceProps, "render">,
) {
  useReadingDwell(
    lookingAtText ? activeBlockId : null,
    activeBlockId ? dwellMsFor(activeBlockId) : 0,
    events.onDwell,
  );
  useEffect(() => {
    onActiveBlockChange(activeBlockId);
  }, [activeBlockId, onActiveBlockChange]);
}

// 기본은 기하 모델 + 판단 미루기. 비교할 때는 주소의 ?gaze= 뒤에 쉼표로 이어 붙인다 (예: ?gaze=iris,nodefer).
// iris 홍채 회귀, nodefer 바로 판단, legacy 이전 방식(이동 평균 + 좌표 아래 블록), eyelook 세로 입력 추가
function readGazeExperiment(): {
  model: GazeModelKind;
  eyeLook: boolean;
  geometric: boolean;
  defer: boolean;
} {
  const flags = new Set(
    (new URLSearchParams(window.location.search).get("gaze") ?? "").split(","),
  );
  return {
    model: flags.has("legacy") ? "legacy" : "reading",
    eyeLook: flags.has("eyelook"),
    geometric: !flags.has("iris"),
    defer: !flags.has("nodefer"),
  };
}

// 읽는 블록을 가운데에 고정하고 눈짓으로 한 블록씩 넘긴다 (use-center-reading.ts).
// 시선 좌표로 블록을 바로 고르는 방식은 웹캠 오차가 커서 쓰지 않는다.
// 부가 설명 타이머는 가운데 블록 기준이고, 원본 PDF를 보는 동안에는 재지 않는다.
type CenterReadingProps = {
  scrollRef: RefObject<HTMLElement | null>;
  stepTimerRef: RefObject<HTMLElement | null>;
};

function WebcamGaze({
  events,
  dwellMsFor,
  onActiveBlockChange,
  scrollRef,
  stepTimerRef,
  onFail,
  render,
}: GazeSourceProps & CenterReadingProps & { onFail: () => void }) {
  const [experiment] = useState(readGazeExperiment);
  const gaze = useGaze(
    { onSquint: events.onSquint },
    { guided: true, ...experiment },
  );
  // 보정 중에는 멈춘다. 끝나면 새로 시작해서 이전 보정 때의 시선 기준점이 남지 않는다.
  const { activeBlockId, lookingAtText } = useCenterReading(
    gaze.point,
    scrollRef,
    stepTimerRef,
    gaze.calibrated,
  );
  useBlockExplain(activeBlockId, lookingAtText, {
    events,
    dwellMsFor,
    onActiveBlockChange,
  });
  const failed = gaze.status.phase === "error";
  const { status } = gaze;

  // 권한 거부·카메라 없음·모델 로드 실패 모두 마우스 모드로 넘긴다.
  useEffect(() => {
    if (failed) onFail();
  }, [failed, onFail]);

  return (
    <>
      {status.phase === "tracking" && !gaze.calibrated && (
        <CalibrationOverlay
          clicks={status.clicks}
          faceVisible={status.faceVisible}
          onCancel={() => {
            if (!gaze.cancelRecalibrate()) onFail();
          }}
        />
      )}
      {render(
        { ...gaze, activeBlockId },
        describeWebcam(gaze.status, gaze.calibrated),
        gaze.calibrated && !lookingAtText,
        gaze.calibrated ? gaze.recalibrate : undefined,
      )}
    </>
  );
}

// 마우스 모드도 커서 높이로 같은 방식으로 넘긴다 (웹캠이 없을 때의 백업).
function MouseGaze({
  events,
  dwellMsFor,
  onActiveBlockChange,
  scrollRef,
  stepTimerRef,
  message,
  render,
}: GazeSourceProps & CenterReadingProps & { message: string }) {
  const gaze = useMouseGaze({});
  const { activeBlockId, lookingAtText } = useCenterReading(
    gaze.point,
    scrollRef,
    stepTimerRef,
  );
  useBlockExplain(activeBlockId, lookingAtText, {
    events,
    dwellMsFor,
    onActiveBlockChange,
  });
  return render({ ...gaze, activeBlockId }, message, !lookingAtText);
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
        return `점을 바라보며 클릭해 보정해 주세요 · ${status.clicks}/${GAZE_CALIBRATION_POINTS.length}`;
      return "웹캠으로 시선을 따라가는 중이에요.";
  }
}
