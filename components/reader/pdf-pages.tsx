"use client";

import {
  ChevronLeftIcon,
  ChevronRightIcon,
  Loader2Icon,
  MinusIcon,
  PlusIcon,
} from "lucide-react";
import type {
  PDFDocumentLoadingTask,
  PDFDocumentProxy,
  RenderTask,
} from "pdfjs-dist";
import {
  useEffect,
  useRef,
  useState,
  type PointerEvent,
  type RefObject,
} from "react";

import {
  resolveBlockPages,
  useHighlightBoxes,
  type HighlightTarget,
} from "@/components/reader/pdf-highlight";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { Block } from "@/types";

const ZOOM_STEP = 0.25;
const MIN_ZOOM = 0.5;
const MAX_ZOOM = 2;
// 100%일 때 페이지 폭. 칸이 이보다 좁으면 칸 폭에 맞춘다 (px).
const MAX_PAGE_WIDTH = 820;
// 페이지 좌우 여백 (px)
const PAGE_GUTTER = 48;
// 따라가기: 형광펜 줄이 화면 높이의 이 구간(위에서부터 비율) 안에 있으면 움직이지 않고,
// 벗어나면 FOLLOW_TARGET 지점으로 옮긴다.
const FOLLOW_BAND_TOP = 0.15;
const FOLLOW_BAND_BOTTOM = 0.6;
const FOLLOW_TARGET = 0.3;
// 칸 폭이 바뀐 뒤 페이지를 다시 그리기까지 기다리는 시간
const RESIZE_DELAY_MS = 150;
// 오른쪽 페이지 목록의 썸네일 폭 (px)
const THUMBNAIL_WIDTH = 80;
// 기기 픽셀 비율이 1이어도 글자가 흐리지 않게 최소 2배로 그린다. 너무 크면 메모리를 많이 써서 3배로 막는다.
const MIN_OUTPUT_SCALE = 2;
const MAX_OUTPUT_SCALE = 3;

// 정리할 때 task.destroy()를 불러야 해서 문서가 아니라 로딩 작업을 돌려준다.
async function openPdf(file: File): Promise<PDFDocumentLoadingTask> {
  const pdfjs = await import("pdfjs-dist");
  pdfjs.GlobalWorkerOptions.workerSrc = new URL(
    "pdfjs-dist/build/pdf.worker.min.mjs",
    import.meta.url,
  ).toString();

  // toBlocks와 같은 설정: 한글 CID 폰트가 깨지지 않게 CMap과 표준 글꼴을 쓴다.
  // TODO(demo): CDN 의존. 오프라인 데모가 필요하면 public/으로 옮긴다.
  const cdn = `https://unpkg.com/pdfjs-dist@${pdfjs.version}`;
  return pdfjs.getDocument({
    data: new Uint8Array(await file.arrayBuffer()),
    cMapUrl: `${cdn}/cmaps/`,
    cMapPacked: true,
    standardFontDataUrl: `${cdn}/standard_fonts/`,
  });
}

function scrollToPage(
  container: HTMLElement | null,
  pages: (HTMLElement | null)[],
  page: number,
) {
  const target = pages[page - 1];
  if (!container || !target) return;
  container.scrollTo({ top: target.offsetTop - 16, behavior: "smooth" });
}

// PDF 뷰어의 손 도구처럼 화면을 잡고 끌어서 움직인다.
function useDragToPan(scrollRef: RefObject<HTMLDivElement | null>) {
  const [panning, setPanning] = useState(false);
  const start = useRef({ x: 0, y: 0, left: 0, top: 0 });

  const stop = (event: PointerEvent<HTMLDivElement>) => {
    if (event.currentTarget.hasPointerCapture(event.pointerId))
      event.currentTarget.releasePointerCapture(event.pointerId);
    setPanning(false);
  };

  return {
    panning,
    handlers: {
      onPointerDown: (event: PointerEvent<HTMLDivElement>) => {
        const container = scrollRef.current;
        // 왼쪽 버튼만. 스크롤바를 누른 경우는 브라우저에 맡긴다.
        if (!container || event.button !== 0) return;
        const rect = container.getBoundingClientRect();
        if (
          event.clientX > rect.left + container.clientWidth ||
          event.clientY > rect.top + container.clientHeight
        )
          return;
        event.currentTarget.setPointerCapture(event.pointerId);
        start.current = {
          x: event.clientX,
          y: event.clientY,
          left: container.scrollLeft,
          top: container.scrollTop,
        };
        setPanning(true);
      },
      onPointerMove: (event: PointerEvent<HTMLDivElement>) => {
        const container = scrollRef.current;
        if (!panning || !container) return;
        container.scrollLeft =
          start.current.left - (event.clientX - start.current.x);
        container.scrollTop =
          start.current.top - (event.clientY - start.current.y);
      },
      onPointerUp: stop,
      onPointerCancel: stop,
    },
  };
}

type PdfPagesProps = {
  file: File;
  // 켜면 지금 읽는 블록(highlight) 위치를 따라 스크롤한다 (집중 읽기와 동기화).
  follow: boolean;
  // 페이지 목록을 둘 쪽. 분할 보기에서 PDF가 왼쪽이면 화면 바깥쪽인 왼쪽에 둔다.
  thumbnailsSide?: "left" | "right";
  // 지금 읽는 블록과 형광펜 색 클래스. className이 null이면 위치만 따라가고 칠하지 않는다.
  highlight?: (HighlightTarget & { className: string | null }) | null;
  // 다크 모드에서 흰 페이지를 뒤집어 검은 바탕에 밝은 글씨로 보여준다.
  inverted?: boolean;
  // 문서를 열면 블록마다 실제 원본 페이지를 찾아 알려준다.
  blocks?: Block[];
  onResolvePages?: (pages: Map<string, number>) => void;
};

export function PdfPages({
  file,
  follow,
  thumbnailsSide = "right",
  highlight = null,
  inverted = false,
  blocks,
  onResolvePages,
}: PdfPagesProps) {
  const [doc, setDoc] = useState<PDFDocumentProxy | null>(null);
  const [failed, setFailed] = useState(false);
  // 첫 페이지의 원래 크기. 배율과 페이지 자리 크기에 쓴다.
  const [baseSize, setBaseSize] = useState<{
    width: number;
    height: number;
  } | null>(null);
  const [containerWidth, setContainerWidth] = useState(0);
  const [zoom, setZoom] = useState(1);
  const [currentPage, setCurrentPage] = useState(1);
  const scrollRef = useRef<HTMLDivElement>(null);
  const pageRefs = useRef<(HTMLDivElement | null)[]>([]);
  const highlighted = useHighlightBoxes(doc, highlight);
  const { panning, handlers: panHandlers } = useDragToPan(scrollRef);

  useEffect(() => {
    if (!doc || !blocks || !onResolvePages) return;
    let cancelled = false;
    resolveBlockPages(doc, blocks)
      .then((pages) => {
        if (!cancelled) onResolvePages(pages);
      })
      // 못 찾으면 toBlocks가 준 페이지 번호를 그대로 쓴다.
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [doc, blocks, onResolvePages]);

  useEffect(() => {
    let cancelled = false;
    let task: PDFDocumentLoadingTask | null = null;

    openPdf(file)
      .then(async (next) => {
        task = next;
        if (cancelled) {
          next.destroy();
          return;
        }
        const opened = await next.promise;
        const viewport = (await opened.getPage(1)).getViewport({ scale: 1 });
        if (cancelled) return;
        setBaseSize({ width: viewport.width, height: viewport.height });
        setDoc(opened);
      })
      .catch(() => {
        if (!cancelled) setFailed(true);
      });

    return () => {
      cancelled = true;
      task?.destroy();
      // 페이지가 숨겨졌다 돌아올 때도 여기를 지나므로, 닫힌 문서로 그리지 않게 비운다.
      setDoc(null);
      setBaseSize(null);
    };
  }, [file]);

  useEffect(() => {
    const container = scrollRef.current;
    if (!container) return;
    // 분할 손잡이를 끄는 동안 매번 다시 그리지 않도록, 멈춘 뒤에만 폭을 반영한다.
    let timer = 0;
    const observer = new ResizeObserver(([entry]) => {
      const width = entry.contentRect.width;
      window.clearTimeout(timer);
      timer = window.setTimeout(
        () => setContainerWidth(width),
        RESIZE_DELAY_MS,
      );
    });
    observer.observe(container);
    return () => {
      window.clearTimeout(timer);
      observer.disconnect();
    };
  }, []);

  const scale =
    baseSize && containerWidth > 0
      ? (Math.min(containerWidth - PAGE_GUTTER, MAX_PAGE_WIDTH) /
          baseSize.width) *
        zoom
      : null;
  // 숨겨져 있으면 폭이 0이라 scale이 없다. 화면에 나타나는 순간에도 동기화한다.
  const shown = scale !== null;
  const numPages = doc?.numPages ?? 0;

  // 따라가기: 형광펜 첫 줄이 화면의 편한 구간을 벗어나면 그 줄이 위쪽 30%에 오도록
  // 부드럽게 스크롤한다. 같은 페이지 안에서는 조금씩, 다음 페이지로 가면 그만큼 넘어간다.
  // 위치를 못 찾은 블록은 그 페이지 맨 위로 간다.
  const followPage = highlight?.page ?? null;
  const firstLine = highlighted?.[0];
  const followKey = !followPage
    ? null
    : highlighted === null
      ? "pending"
      : firstLine?.boxes[0]
        ? `${firstLine.page}:${firstLine.boxes[0].top}`
        : `page:${followPage}`;
  useEffect(() => {
    const container = scrollRef.current;
    if (!follow || !doc || !shown || !container || !followKey) return;
    if (followKey === "pending") return;
    const line = firstLine?.boxes[0];
    const pageElement = firstLine ? pageRefs.current[firstLine.page - 1] : null;
    if (!line || !pageElement) {
      if (followPage) scrollToPage(container, pageRefs.current, followPage);
      return;
    }
    const y = pageElement.offsetTop + line.top * pageElement.offsetHeight;
    const top = container.scrollTop;
    const height = container.clientHeight;
    if (
      y < top + height * FOLLOW_BAND_TOP ||
      y > top + height * FOLLOW_BAND_BOTTOM
    )
      container.scrollTo({
        top: y - height * FOLLOW_TARGET,
        behavior: "smooth",
      });
    // followKey가 바뀔 때만 움직인다 (같은 줄을 보는 동안 다시 스크롤하지 않게).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [follow, doc, shown, followKey]);

  const goToPage = (page: number) =>
    scrollToPage(scrollRef.current, pageRefs.current, page);

  // 화면 위쪽 1/3 지점을 지나간 마지막 페이지를 지금 페이지로 본다.
  const handleScroll = () => {
    const container = scrollRef.current;
    if (!container) return;
    const marker = container.scrollTop + container.clientHeight / 3;
    let page = 1;
    pageRefs.current.forEach((element, index) => {
      if (element && element.offsetTop <= marker) page = index + 1;
    });
    setCurrentPage(page);
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      {/* 페이지 이동과 확대·축소를 한 묶음으로 가운데에 둔다. PDF 칸이 어느 쪽에 있어도 같은 자리다. */}
      <div className="flex h-11 shrink-0 items-center justify-center gap-1 border-b px-3 text-sm">
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label="이전 페이지"
          disabled={currentPage <= 1}
          onClick={() => goToPage(currentPage - 1)}
        >
          <ChevronLeftIcon />
        </Button>
        <span className="min-w-16 text-center text-muted-foreground tabular-nums">
          {numPages > 0 ? `${currentPage} / ${numPages}` : "–"}
        </span>
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label="다음 페이지"
          disabled={currentPage >= numPages}
          onClick={() => goToPage(currentPage + 1)}
        >
          <ChevronRightIcon />
        </Button>
        <span aria-hidden="true" className="mx-2 h-4 w-px bg-border" />
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label="축소"
            disabled={zoom <= MIN_ZOOM}
            onClick={() => setZoom((z) => Math.max(z - ZOOM_STEP, MIN_ZOOM))}
          >
            <MinusIcon />
          </Button>
          <span className="w-12 text-center text-muted-foreground tabular-nums">
            {Math.round(zoom * 100)}%
          </span>
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label="확대"
            disabled={zoom >= MAX_ZOOM}
            onClick={() => setZoom((z) => Math.min(z + ZOOM_STEP, MAX_ZOOM))}
          >
            <PlusIcon />
          </Button>
        </div>
      </div>

      <div className="flex min-h-0 flex-1">
        <div
          ref={scrollRef}
          onScroll={handleScroll}
          {...panHandlers}
          className={cn(
            "relative min-w-0 flex-1 touch-none overflow-auto bg-muted select-none",
            panning ? "cursor-grabbing" : "cursor-grab",
          )}
        >
          {failed ? (
            <p className="p-8 text-center text-sm text-muted-foreground">
              원본 PDF를 열지 못했어요.
            </p>
          ) : !doc || !baseSize || !scale ? (
            <p className="flex items-center justify-center gap-2 p-8 text-sm text-muted-foreground">
              <Loader2Icon className="size-4 animate-spin" />
              원본 PDF를 여는 중…
            </p>
          ) : (
            // 확대해서 칸보다 넓어지면 가운데 정렬 대신 왼쪽부터 보이고 가로로 스크롤된다.
            <div className="flex w-max min-w-full flex-col items-center gap-4 p-4">
              {Array.from({ length: numPages }, (_, index) => (
                <div
                  key={index}
                  ref={(element) => {
                    pageRefs.current[index] = element;
                  }}
                  className="relative shrink-0 bg-card shadow-sm ring-1 ring-foreground/10"
                >
                  <PdfCanvas
                    doc={doc}
                    pageNumber={index + 1}
                    width={baseSize.width * scale}
                    height={baseSize.height * scale}
                    inverted={inverted}
                  />
                  {highlight?.className &&
                    highlighted
                      ?.find((h) => h.page === index + 1)
                      ?.boxes.map((box, boxIndex) => (
                        <div
                          key={boxIndex}
                          aria-hidden="true"
                          className={cn(
                            "pointer-events-none absolute rounded-[2px]",
                            // 흰 페이지에서는 곱하기로 겹쳐 글자가 그대로 보이게 하고,
                            // 뒤집은 검은 페이지에서는 밝은 글자가 묻히지 않게 연하게 겹친다.
                            inverted
                              ? "opacity-30 mix-blend-screen"
                              : "mix-blend-multiply",
                            highlight.className,
                          )}
                          // 페이지 비율 위치라 Tailwind 클래스로 정할 수 없다.
                          style={{
                            left: `${box.left * 100}%`,
                            top: `${box.top * 100}%`,
                            width: `${box.width * 100}%`,
                            height: `${box.height * 100}%`,
                          }}
                        />
                      ))}
                </div>
              ))}
            </div>
          )}
        </div>

        {doc && baseSize && (
          <PageThumbnails
            doc={doc}
            baseSize={baseSize}
            currentPage={currentPage}
            onSelect={goToPage}
            side={thumbnailsSide}
            inverted={inverted}
          />
        )}
      </div>
    </div>
  );
}

type PageThumbnailsProps = {
  doc: PDFDocumentProxy;
  baseSize: { width: number; height: number };
  currentPage: number;
  onSelect: (page: number) => void;
  side: "left" | "right";
  inverted: boolean;
};

function PageThumbnails({
  doc,
  baseSize,
  currentPage,
  onSelect,
  side,
  inverted,
}: PageThumbnailsProps) {
  const itemRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const height = (baseSize.height / baseSize.width) * THUMBNAIL_WIDTH;

  // 본문을 스크롤하면 목록에서도 지금 페이지가 보이게 한다.
  useEffect(() => {
    itemRefs.current[currentPage - 1]?.scrollIntoView({ block: "nearest" });
  }, [currentPage]);

  return (
    <nav
      aria-label="페이지 목록"
      className={cn(
        "flex w-32 shrink-0 flex-col items-center gap-3 overflow-y-auto bg-background py-3",
        side === "left" ? "order-first border-r" : "border-l",
      )}
    >
      {Array.from({ length: doc.numPages }, (_, index) => {
        const page = index + 1;
        const active = page === currentPage;
        return (
          <button
            key={index}
            ref={(element) => {
              itemRefs.current[index] = element;
            }}
            type="button"
            aria-label={`${page} 페이지로 이동`}
            aria-current={active ? "page" : undefined}
            onClick={() => onSelect(page)}
            className="flex flex-col items-center gap-1 text-xs text-muted-foreground"
          >
            <span
              className={cn(
                "rounded-sm bg-card ring-1 ring-foreground/10 transition-shadow",
                active && "ring-2 ring-primary",
              )}
            >
              <PdfCanvas
                doc={doc}
                pageNumber={page}
                width={THUMBNAIL_WIDTH}
                height={height}
                inverted={inverted}
              />
            </span>
            <span className={cn(active && "font-medium text-foreground")}>
              {page}
            </span>
          </button>
        );
      })}
    </nav>
  );
}

type PdfCanvasProps = {
  doc: PDFDocumentProxy;
  pageNumber: number;
  // 화면에 보일 폭 (px)
  width: number;
  // 그리기 전 자리 높이. 그린 뒤에는 페이지 실제 비율로 바뀐다.
  height: number;
  inverted: boolean;
};

// 화면 근처에 온 페이지만 그린다. 페이지가 많은 문서도 처음에 느려지지 않게 하기 위해서.
// 크기가 바뀔 때마다 새 canvas에 다 그린 뒤 바꿔 끼운다. 같은 canvas를 다시 쓰면
// 이전 그리기가 끝나기 전에 겹쳐 그려져 배율이 어긋난다.
function PdfCanvas({
  doc,
  pageNumber,
  width,
  height,
  inverted,
}: PdfCanvasProps) {
  const hostRef = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);
  const [renderedHeight, setRenderedHeight] = useState<number | null>(null);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setVisible(true);
          observer.disconnect();
        }
      },
      { rootMargin: "800px 0px" },
    );
    observer.observe(host);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!visible) return;
    let cancelled = false;
    let task: RenderTask | null = null;

    doc.getPage(pageNumber).then((page) => {
      if (cancelled) return;
      const viewport = page.getViewport({
        scale: width / page.getViewport({ scale: 1 }).width,
      });
      const outputScale = Math.min(
        Math.max(window.devicePixelRatio || 1, MIN_OUTPUT_SCALE),
        MAX_OUTPUT_SCALE,
      );
      const canvas = document.createElement("canvas");
      canvas.width = Math.floor(viewport.width * outputScale);
      canvas.height = Math.floor(viewport.height * outputScale);
      // 화면 크기를 px로 못 박는다. 퍼센트로 두면 레이아웃 계산에 canvas의
      // 실제 픽셀 크기(화면의 2~3배)가 쓰여 페이지가 커지고 한쪽으로 치우친다.
      canvas.style.display = "block";
      canvas.style.width = `${viewport.width}px`;
      canvas.style.height = `${viewport.height}px`;

      task = page.render({
        canvas,
        viewport,
        transform: [outputScale, 0, 0, outputScale, 0, 0],
      });
      task.promise
        .then(() => {
          if (cancelled) return;
          hostRef.current?.replaceChildren(canvas);
          setRenderedHeight(viewport.height);
        })
        // 크기가 바뀌어 취소된 렌더는 에러로 끝나므로 무시한다.
        .catch(() => {});
    });

    return () => {
      cancelled = true;
      task?.cancel();
    };
  }, [doc, pageNumber, width, visible]);

  return (
    <div
      ref={hostRef}
      // 페이지 크기는 PDF마다 달라 Tailwind 클래스로 정할 수 없다.
      style={{ width, height: renderedHeight ?? height }}
      // 색을 뒤집고 색상만 반 바퀴 돌려 그림·컬러 글자는 원래 색에 가깝게 둔다.
      className={cn("overflow-hidden", inverted && "invert hue-rotate-180")}
    />
  );
}
