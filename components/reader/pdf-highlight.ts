"use client";

import type { PDFDocumentProxy } from "pdfjs-dist";
import { useEffect, useRef, useState } from "react";

// 페이지 크기 대비 비율 (0~1). 페이지가 확대·축소돼도 그대로 쓴다.
export type HighlightBox = {
  left: number;
  top: number;
  width: number;
  height: number;
};

export type HighlightTarget = { page: number; text: string };

export type PageHighlight = { page: number; boxes: HighlightBox[] };

// 문장 앞뒤에서 이만큼의 글자로 위치를 찾는다. 짧으면 엉뚱한 곳과 겹치고, 길면
// toBlocks가 손본 글자(지운 각주 번호, 복원한 기호)에 걸려 못 찾는다.
const ANCHOR_CHARS = 10;
// 기준 글자를 못 찾으면 이만큼씩 안쪽으로 옮겨 다시 찾는다.
const ANCHOR_STEP = 12;
const ANCHOR_TRIES = 6;
// 문단이 다음 페이지로 이어지면 최대 이만큼의 페이지까지 칠한다.
const MAX_PAGES = 3;
// 칠한 줄의 좌우 여백 (PDF 단위, 1/72인치)
const LINE_PADDING = 1.5;

// 글자와 숫자만 비교한다. 띄어쓰기·하이픈·괄호·한글 문서 전용 기호(사용자 정의 영역 문자)는
// toBlocks가 지우거나 바꾸기 때문에 원본과 다를 수 있다.
const KEEP = /[\p{L}\p{N}]/u;
const compact = (text: string) =>
  [...text].filter((char) => KEEP.test(char)).join("");

type TextItemLike = {
  str: string;
  transform: number[];
  width: number;
  height: number;
};

type Rect = { left: number; top: number; right: number; bottom: number };

type PageText = {
  width: number;
  height: number;
  text: string;
  // text의 글자마다 그 글자가 차지하는 화면 영역
  rects: Rect[];
  // 띄어쓰기를 뺀 모든 문자(괄호·기호 포함)의 영역. 줄 안 틈이 빈 곳인지 볼 때 쓴다.
  glyphs: Rect[];
};

// 페이지 글자는 하이라이트와 페이지 보정에서 같이 쓰므로 문서마다 한 번만 읽는다.
const pageTextCache = new WeakMap<
  PDFDocumentProxy,
  Map<number, Promise<PageText>>
>();

function readPage(doc: PDFDocumentProxy, pageNumber: number) {
  let pages = pageTextCache.get(doc);
  if (!pages) {
    pages = new Map();
    pageTextCache.set(doc, pages);
  }
  let text = pages.get(pageNumber);
  if (!text) {
    text = readPageText(doc, pageNumber);
    pages.set(pageNumber, text);
  }
  return text;
}

async function readPageText(
  doc: PDFDocumentProxy,
  pageNumber: number,
): Promise<PageText> {
  const page = await doc.getPage(pageNumber);
  const viewport = page.getViewport({ scale: 1 });
  const { items } = await page.getTextContent();

  let text = "";
  const rects: Rect[] = [];
  const glyphs: Rect[] = [];
  for (const raw of items) {
    if (!("str" in raw)) continue;
    const item = raw as TextItemLike;
    const [, , c, d, x, y] = item.transform;
    const size = Math.hypot(c, d) || item.height;
    // 한 조각 안 글자는 폭이 같다고 보고 나눠서, 줄 중간에서 시작·끝나는 문단도
    // 그 글자까지만 칠한다. 위아래는 기준선 아래 글자 꼬리부터 글자 머리까지.
    const chars = [...item.str];
    const charRect = (index: number): Rect => {
      const charLeft = x + (item.width * index) / chars.length;
      const charRight = x + (item.width * (index + 1)) / chars.length;
      const [x1, y1] = viewport.convertToViewportPoint(
        charLeft,
        y - size * 0.2,
      );
      const [x2, y2] = viewport.convertToViewportPoint(
        charRight,
        y + size * 0.85,
      );
      return {
        left: Math.min(x1, x2),
        right: Math.max(x1, x2),
        top: Math.min(y1, y2),
        bottom: Math.max(y1, y2),
      };
    };
    // 조각의 첫·마지막 글자는 바깥쪽 기호(`[`, `.)` 등)까지 넓힌다. 비교는 글자만 해서
    // 기호가 범위에서 빠지고, 같은 폭 어림이 괄호·마침표에서 어긋나는 것도 함께 막는다.
    const visible = chars.flatMap((char, index) =>
      /\s/.test(char) ? [] : [index],
    );
    const letters = chars.flatMap((char, index) =>
      KEEP.test(char) ? [index] : [],
    );
    const firstLetter = letters[0];
    const lastLetter = letters[letters.length - 1];
    const edgeLeft = visible.length ? charRect(visible[0]).left : 0;
    const edgeRight = visible.length
      ? charRect(visible[visible.length - 1]).right
      : 0;

    for (const index of visible) {
      const rect = charRect(index);
      glyphs.push(rect);
      if (!KEEP.test(chars[index])) continue;
      if (index === firstLetter) rect.left = Math.min(rect.left, edgeLeft);
      if (index === lastLetter) rect.right = Math.max(rect.right, edgeRight);
      text += chars[index];
      rects.push(rect);
    }
  }
  return {
    width: viewport.width,
    height: viewport.height,
    text,
    rects,
    glyphs,
  };
}

// target의 앞(또는 뒤) 글자를 pageText에서 찾는다. 찾으면 target 시작(끝)에 해당하는 위치.
function findAnchor(
  pageText: string,
  target: string,
  from: number,
  fromEnd: boolean,
): number | null {
  return findAnchorWithOffset(pageText, target, from, fromEnd)?.index ?? null;
}

// offset이 0이면 블록의 진짜 앞(뒤)을 찾은 것이고, 0보다 크면 안쪽으로 옮겨서 찾은 것이다.
function findAnchorWithOffset(
  pageText: string,
  target: string,
  from: number,
  fromEnd: boolean,
): { index: number; offset: number } | null {
  for (let i = 0; i < ANCHOR_TRIES; i++) {
    const offset = i * ANCHOR_STEP;
    const anchor = fromEnd
      ? target.slice(
          Math.max(target.length - offset - ANCHOR_CHARS, 0),
          target.length - offset,
        )
      : target.slice(offset, offset + ANCHOR_CHARS);
    if (anchor.length < ANCHOR_CHARS / 2) return null;
    const index = pageText.indexOf(anchor, from);
    // 안쪽으로 옮겨서 찾았으면 건너뛴 만큼 거슬러 가지 않고 찾은 곳부터 칠한다.
    // 블록 앞뒤가 원본과 다른 경우(합친 제목 등) 엉뚱한 글자까지 칠하는 것보다 낫다.
    if (index !== -1)
      return { index: fromEnd ? index + anchor.length : index, offset };
  }
  return null;
}

// 두 글자 사이 빈칸에 페이지의 다른 글자가 있는지. 있으면 같은 문장이 이어지는 것이다.
// (괄호 지문처럼 글꼴이 다른 부분은 PDF 안 글자 순서가 화면 순서와 달라 범위에서 빠질 수 있다.)
function hasTextBetween(left: Rect, right: Rect, pageRects: Rect[]) {
  const top = Math.max(left.top, right.top);
  const bottom = Math.min(left.bottom, right.bottom);
  return pageRects.some(
    (r) =>
      r.left >= left.right - 1 &&
      r.right <= right.left + 1 &&
      Math.min(r.bottom, bottom) - Math.max(r.top, top) > 0,
  );
}

// 한글 형광펜처럼 줄마다 글자가 있는 부분만 칠한다. 틈 기준(글자 높이의 3배)은 단 사이 여백보다 작고
// 양쪽 정렬로 넓어진 띄어쓰기보다 크게 잡았다. 같은 높이의 글자를 한 줄로 모은 뒤 비어 있는 큰 틈에서 나눈다.
function toLineRects(rects: Rect[], pageRects: Rect[]): Rect[] {
  const lines: Rect[][] = [];
  for (const rect of [...rects].sort((a, b) => a.top - b.top)) {
    const line = lines.find((chars) => {
      const first = chars[0];
      const overlap =
        Math.min(first.bottom, rect.bottom) - Math.max(first.top, rect.top);
      return (
        overlap > Math.min(first.bottom - first.top, rect.bottom - rect.top) / 2
      );
    });
    if (line) line.push(rect);
    else lines.push([rect]);
  }

  const segments: Rect[] = [];
  for (const chars of lines) {
    const sorted = [...chars].sort((a, b) => a.left - b.left);
    let segment = { ...sorted[0] };
    for (const rect of sorted.slice(1)) {
      const gap = rect.left - segment.right;
      if (
        gap > (rect.bottom - rect.top) * 3 &&
        !hasTextBetween(segment, rect, pageRects)
      ) {
        segments.push(segment);
        segment = { ...rect };
      } else {
        merge(segment, rect);
      }
    }
    segments.push(segment);
  }
  return segments;
}

function merge(target: Rect, rect: Rect) {
  target.left = Math.min(target.left, rect.left);
  target.right = Math.max(target.right, rect.right);
  target.top = Math.min(target.top, rect.top);
  target.bottom = Math.max(target.bottom, rect.bottom);
}

function toPageHighlight(
  page: number,
  pageText: PageText,
  start: number,
  end: number,
): PageHighlight {
  return {
    page,
    boxes: toLineRects(pageText.rects.slice(start, end), pageText.glyphs).map(
      (line) => ({
        left: (line.left - LINE_PADDING) / pageText.width,
        top: line.top / pageText.height,
        width: (line.right - line.left + LINE_PADDING * 2) / pageText.width,
        height: (line.bottom - line.top) / pageText.height,
      }),
    ),
  };
}

async function locate(
  doc: PDFDocumentProxy,
  { page: firstPage, text }: HighlightTarget,
): Promise<PageHighlight[]> {
  const target = compact(text);
  if (target.length < ANCHOR_CHARS / 2) return [];
  const tail = target.slice(-ANCHOR_CHARS);

  const result: PageHighlight[] = [];
  const lastPage = Math.min(firstPage + MAX_PAGES - 1, doc.numPages);
  for (let page = firstPage; page <= lastPage; page++) {
    const pageText = await readPage(doc, page);
    const continuing = result.length > 0;

    if (continuing) {
      // 이어지는 페이지는 위에서부터 블록의 진짜 끝까지 칠한다 (앞 페이지에서 확인한 위치).
      const end = pageText.text.indexOf(tail);
      result.push(toPageHighlight(page, pageText, 0, end + tail.length));
      return result;
    }

    const start = findAnchor(pageText.text, target, 0, false);
    // 시작을 못 찾았으면 다음 페이지에서 찾는다. 긴 문단을 나눈 뒤쪽 블록은
    // 문단이 시작한 페이지 번호를 그대로 달고 있어 실제로는 다음 페이지에 있을 수 있다.
    if (start === null) continue;
    const startIndex = Math.max(start, 0);

    const end = findAnchorWithOffset(pageText.text, target, startIndex, true);
    // 진짜 끝(offset 0)을 찾았으면 이 페이지에서 끝난다.
    if (end && end.offset === 0 && end.index > startIndex) {
      result.push(toPageHighlight(page, pageText, startIndex, end.index));
      return result;
    }

    // 블록 중간까지만 찾았거나 못 찾았으면, 다음 페이지 첫머리에 진짜 끝이 있는지 본다.
    // 남은 글자 수보다 훨씬 아래에서 찾은 같은 말은 다른 문장이다.
    const leftover = target.length - (pageText.text.length - startIndex);
    const next = page < doc.numPages ? await readPage(doc, page + 1) : null;
    const nextEnd = next ? next.text.indexOf(tail) : -1;
    const continues =
      nextEnd !== -1 && nextEnd <= Math.max(leftover, 0) * 2 + ANCHOR_CHARS * 4;
    if (!continues && end && end.index > startIndex) {
      // 원본과 글자가 조금 달라 진짜 끝을 못 찾았을 뿐 이 페이지에서 끝나는 경우
      result.push(toPageHighlight(page, pageText, startIndex, end.index));
      return result;
    }
    result.push(
      toPageHighlight(page, pageText, startIndex, pageText.text.length),
    );
    if (!continues) return result;
  }
  return result;
}

// 블록마다 실제로 시작하는 원본 페이지를 찾는다. 긴 문단을 나눈 뒤쪽 블록은
// 문단이 시작한 페이지 번호를 그대로 달고 있어서, 다음 페이지에 있어도 앞 페이지로 표시된다.
export async function resolveBlockPages(
  doc: PDFDocumentProxy,
  blocks: { id: string; page: number; text: string }[],
): Promise<Map<string, number>> {
  const pages = new Map<string, number>();
  // 블록은 읽는 순서대로라 앞 블록보다 앞 페이지에 있을 수 없다.
  let previous = 1;
  for (const block of blocks) {
    const target = compact(block.text);
    const from = Math.max(block.page, previous);
    const last = Math.min(from + MAX_PAGES - 1, doc.numPages);
    for (let page = from; page <= last; page++) {
      const { text } = await readPage(doc, page);
      if (findAnchor(text, target, 0, false) !== null) {
        pages.set(block.id, page);
        previous = page;
        break;
      }
    }
  }
  return pages;
}

// 여러 블록의 위치를 찾아 id별로 돌려준다 (즐겨찾기 표시). 못 찾은 블록은 빈 배열이다.
export function useBlockHighlights(
  doc: PDFDocumentProxy | null,
  targets: (HighlightTarget & { id: string })[],
): Map<string, PageHighlight[]> {
  const key = targets
    .map(({ id, page, text }) => `${id}\n${page}\n${text}`)
    .join("\n\n");
  const [found, setFound] = useState(new Map<string, PageHighlight[]>());
  const cacheRef = useRef(new Map<string, PageHighlight[]>());

  useEffect(() => {
    if (!doc) return;
    let cancelled = false;
    Promise.all(
      targets.map(async (target) => {
        const cacheKey = `${target.page}\n${target.text}`;
        const pages =
          cacheRef.current.get(cacheKey) ??
          (await locate(doc, target).catch((): PageHighlight[] => []));
        cacheRef.current.set(cacheKey, pages);
        return [target.id, pages] as const;
      }),
    ).then((entries) => {
      if (!cancelled) setFound(new Map(entries));
    });
    return () => {
      cancelled = true;
    };
    // targets는 key로 비교한다 (렌더마다 새 배열이라서).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [doc, key]);

  return found;
}

// 지금 읽는 블록이 원본 PDF 페이지의 어디에 있는지 찾는다.
// Block에는 페이지 번호만 있어서, 페이지 글자에서 블록 문장의 앞뒤를 찾아 영역을 정한다.
// 못 찾으면 빈 배열이고 하이라이트만 안 보인다. 찾는 중이면 null.
export function useHighlightBoxes(
  doc: PDFDocumentProxy | null,
  target: HighlightTarget | null,
): PageHighlight[] | null {
  const key = target ? `${target.page}\n${target.text}` : null;
  const [found, setFound] = useState<{
    key: string;
    pages: PageHighlight[];
  } | null>(null);
  // 같은 블록을 다시 볼 때 페이지 글자를 또 읽지 않게 결과를 기억한다.
  const cacheRef = useRef(new Map<string, PageHighlight[]>());

  useEffect(() => {
    if (!doc || !target || !key) return;
    let cancelled = false;
    const cached = cacheRef.current.get(key);
    const result = cached
      ? Promise.resolve(cached)
      : locate(doc, target).catch((): PageHighlight[] => []);
    result.then((pages) => {
      cacheRef.current.set(key, pages);
      if (!cancelled) setFound({ key, pages });
    });
    return () => {
      cancelled = true;
    };
    // target은 key로 비교한다 (렌더마다 새 객체라서).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [doc, key]);

  if (!key) return [];
  return found && found.key === key ? found.pages : null;
}
