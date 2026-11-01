import { memo, useMemo, type ReactNode } from "react";

import {
  BLUR_CLASSES,
  FONT_CLASSES,
  FONT_SIZE_CLASSES,
  LINE_HEIGHT_CLASSES,
  type ReaderSettings,
} from "@/components/reader/reader-settings";
import { cn } from "@/lib/utils";
import type { Block } from "@/types";

type ReaderViewProps = {
  blocks: Block[];
  activeBlockId: string | null;
  settings: ReaderSettings;
  // 특정 블록 옆에 띄울 요소 (부가 설명 팝업)
  aside?: { blockId: string; content: ReactNode };
  // 본문 위에 띄울 안내 (시선 상태)
  notice?: ReactNode;
  // 원본 페이지 구분("원본 N쪽")을 보여줄지. 페이지가 없는 TXT·목업은 끈다.
  showPages?: boolean;
  // "가운데 고정" 읽기에서 첫·마지막 블록도 가운데까지 올 수 있게 위아래 여백을 둔다.
  centerSpace?: boolean;
};

// block.page는 toBlocks가 넣은 원본 PDF의 페이지 번호다.
function groupByPage(blocks: Block[]): [number, Block[]][] {
  const pages = new Map<number, Block[]>();
  for (const block of [...blocks].sort((a, b) => a.order - b.order)) {
    const page = pages.get(block.page);
    if (page) page.push(block);
    else pages.set(block.page, [block]);
  }
  return [...pages.entries()];
}

// 흐림 필터는 그리는 비용이 커서, 블록이 이보다 많으면 읽는 블록 근처에만 건다.
// 수천 블록에 모두 걸면 넘길 때마다 화면이 1초 가까이 멈춘다.
const FULL_BLUR_MAX_BLOCKS = 200;
const BLUR_RADIUS_BLOCKS = 20;

// 시선이 바뀔 때마다 리더가 다시 그려지므로, 긴 문서가 버벅이지 않게 바뀐 블록만 다시 그린다.
const ReaderBlock = memo(function ReaderBlock({
  block,
  active,
  blurred,
  dimmed,
  settings,
  aside,
}: {
  block: Block;
  active: boolean;
  blurred: boolean;
  dimmed: boolean;
  settings: ReaderSettings;
  aside?: ReactNode;
}) {
  return (
    <div className="relative">
      <p
        data-block-id={block.id}
        className={cn(
          // toBlocks가 제목과 본문 사이에 넣은 \n을 그대로 보여준다.
          "rounded-lg px-4 py-3 whitespace-pre-line transition-[filter,opacity,background-color] duration-300",
          FONT_CLASSES[settings.font],
          FONT_SIZE_CLASSES[settings.fontSize],
          LINE_HEIGHT_CLASSES[settings.lineHeight],
          active && "bg-accent text-accent-foreground ring-1 ring-ring/30",
          blurred && BLUR_CLASSES[settings.focus - 1],
          dimmed && "opacity-30",
        )}
      >
        {block.text}
      </p>
      {aside}
    </div>
  );
});

export function ReaderView({
  blocks,
  activeBlockId,
  settings,
  aside,
  notice,
  showPages = true,
  centerSpace = false,
}: ReaderViewProps) {
  // 시선을 아직 못 잡았거나(null) 하이라이트를 껐으면 모든 블록을 선명하게 둔다.
  const focusing = settings.focus > 0 && activeBlockId !== null;
  const pages = useMemo(() => groupByPage(blocks), [blocks]);
  const positions = useMemo(
    () =>
      new Map(
        pages
          .flatMap(([, pageBlocks]) => pageBlocks)
          .map((block, position) => [block.id, position]),
      ),
    [pages],
  );
  const activePosition = positions.get(activeBlockId ?? "") ?? 0;
  const limitBlur = blocks.length > FULL_BLUR_MAX_BLOCKS;

  return (
    <article className="mx-auto flex w-full max-w-2xl flex-col gap-12 px-6 py-10">
      {notice}
      {centerSpace && <div aria-hidden="true" className="h-[40vh] shrink-0" />}
      {pages.map(([page, pageBlocks]) => (
        <section key={page} className="flex flex-col gap-10">
          {showPages && (
            <p className="text-xs font-medium tracking-wide text-muted-foreground">
              원본 {page}쪽
            </p>
          )}
          {pageBlocks.map((block) => {
            const active = focusing && block.id === activeBlockId;
            const far =
              limitBlur &&
              Math.abs((positions.get(block.id) ?? 0) - activePosition) >
                BLUR_RADIUS_BLOCKS;
            return (
              <ReaderBlock
                key={block.id}
                block={block}
                active={active}
                blurred={focusing && !active && !far}
                dimmed={focusing && !active && far}
                settings={settings}
                aside={aside?.blockId === block.id ? aside.content : undefined}
              />
            );
          })}
        </section>
      ))}
      {centerSpace && <div aria-hidden="true" className="h-[45vh] shrink-0" />}
    </article>
  );
}
