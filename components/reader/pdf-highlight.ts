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
// 박스 여백 (PDF 단위, 1/72인치)
const BOX_PADDING = 4;

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
  // text의 글자마다 그 글자가 나온 조각의 화면 영역
  rects: Rect[];
};

async function readPage(
  doc: PDFDocumentProxy,
  pageNumber: number,
): Promise<PageText> {
  const page = await doc.getPage(pageNumber);
  const viewport = page.getViewport({ scale: 1 });
  const { items } = await page.getTextContent();

  let text = "";
  const rects: Rect[] = [];
  for (const raw of items) {
    if (!("str" in raw)) continue;
    const item = raw as TextItemLike;
    const [, , c, d, x, y] = item.transform;
    const size = Math.hypot(c, d) || item.height;
    // 기준선 아래 글자 꼬리까지 조금 내려서 감싼다. 두 모서리를 화면 좌표로 바꾼다.
    const [x1, y1] = viewport.convertToViewportPoint(x, y - size * 0.25);
    const [x2, y2] = viewport.convertToViewportPoint(
      x + item.width,
      y + size * 0.9,
    );
    const rect = {
      left: Math.min(x1, x2),
      right: Math.max(x1, x2),
      top: Math.min(y1, y2),
      bottom: Math.max(y1, y2),
    };
    for (const char of item.str) {
      if (!KEEP.test(char)) continue;
      text += char;
      rects.push(rect);
    }
  }
  return { width: viewport.width, height: viewport.height, text, rects };
}

// target의 앞(또는 뒤) 글자를 pageText에서 찾는다. 찾으면 target 시작(끝)에 해당하는 위치.
function findAnchor(
  pageText: string,
  target: string,
  from: number,
  fromEnd: boolean,
): number | null {
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
    if (index !== -1)
      return fromEnd ? index + anchor.length + offset : index - offset;
  }
  return null;
}

// 같은 줄의 조각을 먼저 한 줄로 합치고, 줄들을 단마다 문단 박스 하나로 묶는다.
// 양쪽 정렬 문서는 한 줄이 단어 묶음 여러 조각으로 나뉘어 있어서 바로 묶으면 박스가 겹친다.
function toBoxes(rects: Rect[]): Rect[] {
  const lines: Rect[] = [];
  for (const rect of [...rects].sort((a, b) => a.top - b.top)) {
    const line = lines.find((l) => {
      const overlap =
        Math.min(l.bottom, rect.bottom) - Math.max(l.top, rect.top);
      return overlap > Math.min(l.bottom - l.top, rect.bottom - rect.top) / 2;
    });
    if (line) merge(line, rect);
    else lines.push({ ...rect });
  }

  const boxes: Rect[] = [];
  for (const line of lines.sort((a, b) => a.top - b.top)) {
    const lineHeight = line.bottom - line.top;
    const box = boxes.find(
      (b) =>
        line.left < b.right &&
        line.right > b.left &&
        line.top - b.bottom < lineHeight * 1.5,
    );
    if (box) merge(box, line);
    else boxes.push({ ...line });
  }
  return boxes;
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
  const unique = [...new Set(pageText.rects.slice(start, end))];
  return {
    page,
    boxes: toBoxes(unique).map((box) => ({
      left: (box.left - BOX_PADDING) / pageText.width,
      top: (box.top - BOX_PADDING) / pageText.height,
      width: (box.right - box.left + BOX_PADDING * 2) / pageText.width,
      height: (box.bottom - box.top + BOX_PADDING * 2) / pageText.height,
    })),
  };
}

async function locate(
  doc: PDFDocumentProxy,
  { page: firstPage, text }: HighlightTarget,
): Promise<PageHighlight[]> {
  let remaining = compact(text);
  if (remaining.length < ANCHOR_CHARS / 2) return [];

  const result: PageHighlight[] = [];
  const lastPage = Math.min(firstPage + MAX_PAGES - 1, doc.numPages);
  for (let page = firstPage; page <= lastPage; page++) {
    const pageText = await readPage(doc, page);
    const start = findAnchor(pageText.text, remaining, 0, false);
    if (start === null) {
      // 아직 시작을 못 찾았으면 다음 페이지에서 찾는다. 긴 문단을 나눈 뒤쪽 블록은
      // 문단이 시작한 페이지 번호를 그대로 달고 있어 실제로는 다음 페이지에 있을 수 있다.
      if (result.length === 0) continue;
      // 이어지는 페이지에서 앞부분을 못 찾으면 페이지 맨 위부터 이어진 것으로 본다.
    }
    const startIndex = Math.max(start ?? 0, 0);

    const end = findAnchor(pageText.text, remaining, startIndex, true);
    if (end !== null && end > startIndex) {
      result.push(toPageHighlight(page, pageText, startIndex, end));
      return result;
    }

    // 끝을 못 찾으면 페이지 끝까지 칠하고 남은 글자는 다음 페이지에서 찾는다.
    const used = pageText.text.length - startIndex;
    if (used <= 0) return result;
    result.push(
      toPageHighlight(page, pageText, startIndex, pageText.text.length),
    );
    remaining = remaining.slice(used);
    if (remaining.length < ANCHOR_CHARS) return result;
  }
  return result;
}

// 지금 읽는 블록이 원본 PDF 페이지의 어디에 있는지 찾는다.
// Block에는 페이지 번호만 있어서, 페이지 글자에서 블록 문장의 앞뒤를 찾아 영역을 정한다.
// 못 찾으면 빈 배열이고 하이라이트만 안 보인다.
export function useHighlightBoxes(
  doc: PDFDocumentProxy | null,
  target: HighlightTarget | null,
): PageHighlight[] {
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

  return found && found.key === key ? found.pages : [];
}
