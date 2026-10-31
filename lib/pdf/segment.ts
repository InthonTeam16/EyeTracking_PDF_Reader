import type { Block } from "@/types";
import {
  FONT_SIZE_CHANGE_RATIO,
  FOOTNOTE_FONT_RATIO,
  MAX_FOOTNOTES,
  INDENT_RATIO,
  MAX_BLOCK_CHARS,
  MIN_BLOCK_CHARS,
  PARAGRAPH_GAP_RATIO,
  RAGGED_LINE_SHARE,
  RAGGED_MIN_LINES,
  RAGGED_RIGHT_RATIO,
  RUNNING_LINE_PAGE_RATIO,
  SHORT_LINE_RATIO,
  VERY_SHORT_LINE_RATIO,
} from "./config";
import type { Box, PageContent, Piece } from "./extract";
import { displayMathFlags, isCaption, removeNonBody, type FlowLine } from "./filter";
import { layoutPage, median } from "./layout";
import { piecesToLines, type Line } from "./lines";
import { buildVocab, joinLines, splitToFit, type Vocab } from "./text";

// boundary: 단·페이지가 시작되거나 표·그림이 지워진 자리에서 시작한 문단 (앞 문단과 이어질 수 있다)
type Paragraph = {
  text: string;
  page: number;
  fontSize: number;
  endFontSize: number;
  indented: boolean;
  boundary: boolean;
  // flow: 몇 번째 단(흐름)에서 나왔는지, flowStart: 그 단의 첫 문단인지
  flow: number;
  flowStart: boolean;
};

const SENTENCE_END = /[.!?。…"'”’)\]]$/;
// 경계에서 이을지 판단할 때는 마침표 없이 끝난 한국어 문장(~다, ~요)도 끝난 것으로 본다
const PARAGRAPH_END = /[.!?。…"'”’)\]다요]$/;
const PAGE_NUMBER = /^[-–—\s]*\d+(\s*\/\s*\d+)?[-–—\s]*$/;
// "[페이지] 012", "Page 3" 같은 쪽 표시는 본문 중간에 있어도 지운다
const PAGE_LABEL = /^[[(]?\s*(페이지|쪽|page|p\.?)\s*[\])]?\s*[-–]?\s*\d+\s*$/i;
// 새 항목의 시작: [화자] 표시, 목록 기호, 번호 ([12] 같은 인용 번호는 제외)
const ITEM_START = /^(\[[^\]\d\s][^\]]{0,14}\]|[•·▪◦‣※○●■□▶-]\s|\d{1,2}[.)]\s|\(\d{1,2}\)\s|[①-⑳]|[가-하][.)]\s)/;

// pages[i]는 i+1페이지의 내용
export function pagesToBlocks(pages: PageContent[]): Block[] {
  const bodyFont = dominantFontSize(pages.flatMap((p) => p.pieces));
  const linesByPage = pages.map((page) => layoutPage(page.pieces, bodyFont).map(piecesToLines));
  // 표·캡션의 단어도 띄어쓰기 판단에 도움이 되므로 지우기 전에 모은다
  const vocab = buildVocab(
    linesByPage.flat().map((lines) => {
      const maxWidth = Math.max(...lines.map((l) => l.width));
      return lines.map((l) => ({ text: l.text, whole: l.width < maxWidth * VERY_SHORT_LINE_RATIO }));
    }),
    isRaggedRight(linesByPage.flat()),
  );
  const flowsByPage = removeRunningLines(
    linesByPage.map((flows, i) => flows.map((lines) => removeNonBody(lines, bodyFont, pages[i].figures))),
  );

  let flowIndex = 0;
  const paragraphs = flowsByPage.flatMap((flows, i) => {
    const gaps = flows.flatMap((lines) => lines.slice(1).map((line, k) => lines[k].y - line.y));
    const medianGap = median(gaps.filter((g) => g > 0));
    return flows.flatMap((lines) => {
      const flow = flowIndex++;
      return splitParagraphs(lines, medianGap, bodyFont, pages[i].figures, vocab).map((p, k) => ({
        ...p,
        page: i + 1,
        flow,
        flowStart: k === 0,
      }));
    });
  });

  const body = joinAtBoundaries(removeCaptions(paragraphs), bodyFont, vocab);
  const sized = mergeShort(body).flatMap((p) =>
    splitToFit(p.text, MAX_BLOCK_CHARS).map((text) => ({ text, page: p.page })),
  );

  const countByPage = new Map<number, number>();
  return sized.map((p, order) => {
    const index = countByPage.get(p.page) ?? 0;
    countByPage.set(p.page, index + 1);
    return { id: `p${p.page}-b${index}`, text: p.text, page: p.page, order };
  });
}

// 왼쪽 정렬 문서에서 문장 중간 줄의 오른쪽 끝이 한 글자 이상 들쭉날쭉하면 어절 단위로 줄을 바꾼 문서다.
// (단어 중간에서 줄을 바꾸면 줄이 거의 꽉 찬다. 양쪽 정렬 문서는 여기서 판단하지 않는다.)
function isRaggedRight(flows: Line[][]): boolean {
  let total = 0;
  let ragged = 0;
  for (const lines of flows) {
    const maxWidth = Math.max(...lines.map((l) => l.width));
    const right = Math.max(...lines.map((l) => l.x + l.width));
    for (const line of lines.slice(0, -1)) {
      if (SENTENCE_END.test(line.text) || line.width < maxWidth * VERY_SHORT_LINE_RATIO) continue;
      total++;
      if (right - (line.x + line.width) > line.fontSize * RAGGED_RIGHT_RATIO) ragged++;
    }
  }
  return total >= RAGGED_MIN_LINES && ragged / total >= RAGGED_LINE_SHARE;
}

// 글자 수 기준으로 가장 많이 쓰인 글자 크기
function dominantFontSize(pieces: Piece[]): number {
  const counts = new Map<number, number>();
  for (const p of pieces) {
    const size = Math.round(p.fontSize * 2) / 2;
    counts.set(size, (counts.get(size) ?? 0) + p.str.length);
  }
  let best = 0;
  let bestCount = -1;
  for (const [size, count] of counts) {
    if (count > bestCount) [best, bestCount] = [size, count];
  }
  return best || 12;
}

// 단 맨 위·아래의 쪽번호, 그리고 여러 페이지에 반복되는 머리말·꼬리말을 지운다
function removeRunningLines(pages: FlowLine[][][]): FlowLine[][][] {
  const key = (line: FlowLine) => line.text.replace(/\d+/g, "#");
  const edges = (lines: FlowLine[]) => [lines[0], lines[lines.length - 1]].filter(Boolean);
  const edgeCount = new Map<string, number>();
  for (const flows of pages) {
    for (const k of new Set(flows.flatMap(edges).map(key))) edgeCount.set(k, (edgeCount.get(k) ?? 0) + 1);
  }
  const minPages = Math.max(2, pages.length * RUNNING_LINE_PAGE_RATIO);

  return pages.map((flows) =>
    flows
      .map((lines) =>
        lines.filter((line, i) => {
          if (PAGE_LABEL.test(line.text)) return false;
          if (i !== 0 && i !== lines.length - 1) return true;
          if (PAGE_NUMBER.test(line.text)) return false;
          return (edgeCount.get(key(line)) ?? 0) < minPages;
        }),
      )
      .filter((lines) => lines.length > 0),
  );
}

function splitParagraphs(
  lines: FlowLine[],
  medianGap: number,
  bodyFont: number,
  figures: Box[],
  vocab: Vocab,
): Omit<Paragraph, "page" | "flow" | "flowStart">[] {
  if (lines.length === 0) return [];

  const maxWidth = Math.max(...lines.map((l) => l.width));
  const leftMargin = Math.min(...lines.map((l) => l.x));
  const isMath = displayMathFlags(lines);
  const isIndented = (line: FlowLine) => line.x - leftMargin > line.fontSize * INDENT_RATIO;
  // 첫 줄 들여쓰기: 앞 줄보다 들어가 있고, 다음 줄은 다시 나온다.
  // (초록처럼 통째로 들여 쓴 영역이나 목록의 내어쓰기 줄은 새 문단이 아니다)
  // 오른쪽 끝까지 차 있어야 한다 (가운데 정렬된 제목의 둘째 줄은 들여쓰기가 아니다)
  const isFirstLineIndent = (i: number) => {
    const [prev, line, next] = [lines[i - 1], lines[i], lines[i + 1]];
    const indent = line.fontSize * INDENT_RATIO;
    const reachesRight = line.x + line.width >= prev.x + prev.width - indent;
    return line.x - prev.x > indent && reachesRight && (!next || next.x < line.x - indent / 2);
  };
  // 내어쓰기: 앞 줄보다 나와 있으면 새 항목이나 들여 쓴 영역의 끝이다.
  // 가운데 정렬 줄, 그리고 첫 줄만 들여 쓴 문단의 둘째 줄(문단이 아직 한 줄)은 제외한다.
  let linesInParagraph = 1;
  const isOutdent = (i: number) => {
    if (linesInParagraph < 2) return false;
    const [prev, line] = [lines[i - 1], lines[i]];
    const centered = Math.abs(prev.x + prev.width / 2 - (line.x + line.width / 2)) < line.fontSize;
    return prev.x - line.x > line.fontSize * INDENT_RATIO && !centered;
  };
  const start = (line: FlowLine, boundary: boolean) => ({
    text: line.text,
    fontSize: line.fontSize,
    endFontSize: line.fontSize,
    // 새 항목으로 시작하는 문단은 들여쓴 문단처럼 앞 문단과 잇지 않는다
    indented: isIndented(line) || ITEM_START.test(line.text),
    boundary,
  });

  const paragraphs = [start(lines[0], true)];
  for (let i = 1; i < lines.length; i++) {
    const prev = lines[i - 1];
    const line = lines[i];
    const current = paragraphs[paragraphs.length - 1];
    const removedBetween = line.afterRemoved || hasFigureBetween(prev, line, figures);
    const isBreak =
      removedBetween ||
      // 큰 글자(제목)는 줄 간격도 넓으므로 글자 크기에 비례해 기준을 늘린다
      (medianGap > 0 &&
        prev.y - line.y > medianGap * PARAGRAPH_GAP_RATIO * Math.max(1, prev.fontSize / bodyFont)) ||
      Math.abs(line.fontSize - prev.fontSize) / prev.fontSize > FONT_SIZE_CHANGE_RATIO ||
      (SENTENCE_END.test(prev.text) && prev.width < maxWidth * SHORT_LINE_RATIO) ||
      prev.width < maxWidth * VERY_SHORT_LINE_RATIO ||
      isFirstLineIndent(i) ||
      isOutdent(i) ||
      ITEM_START.test(line.text) ||
      // 별행 수식은 앞뒤 본문과 나눈다
      isMath[i] !== isMath[i - 1];

    if (isMath[i] && isMath[i - 1] && !isBreak) {
      // 여러 줄 수식은 줄바꿈으로 잇는다
      current.text += `\n${line.text}`;
      current.endFontSize = line.fontSize;
      linesInParagraph++;
    } else if (isBreak) {
      paragraphs.push(start(line, removedBetween));
      linesInParagraph = 1;
    } else {
      current.text = joinLines(current.text, line.text, vocab);
      current.endFontSize = line.fontSize;
      linesInParagraph++;
    }
  }
  return paragraphs;
}

function hasFigureBetween(prev: FlowLine, line: FlowLine, figures: Box[]): boolean {
  const left = Math.min(prev.x, line.x);
  const right = Math.max(prev.x + prev.width, line.x + line.width);
  return figures.some((b) => b.y0 >= line.y && b.y1 <= prev.y + prev.fontSize && b.x1 > left && b.x0 < right);
}

function removeCaptions(paragraphs: Paragraph[]): Paragraph[] {
  const result: Paragraph[] = [];
  let removed = false;
  for (const p of paragraphs) {
    if (isCaption(p.text)) {
      removed = true;
    } else {
      result.push(removed ? { ...p, boundary: true } : p);
      removed = false;
    }
  }
  return result;
}

// 단·페이지 경계나 지워진 표·그림 때문에 끊긴 문장을 다시 잇는다.
// 앞 문단이 문장 중간에서 끝났고, 둘 다 본문 크기이며, 다음 문단이 들여쓰기로 시작하지 않을 때만.
function joinAtBoundaries(paragraphs: Paragraph[], bodyFont: number, vocab: Vocab): Paragraph[] {
  const isBody = (size: number) => Math.abs(size - bodyFont) / bodyFont <= FONT_SIZE_CHANGE_RATIO;
  // 각주는 본문보다 조금만 작은 경우가 많다 (본문 10pt, 각주 9pt)
  const isSmall = (size: number) => size < bodyFont * FOOTNOTE_FONT_RATIO;
  const result: Paragraph[] = [];
  for (const p of paragraphs) {
    // 단·페이지 끝의 각주(작은 글자)는 건너뛰고 그 앞 본문 문단과 잇는다. 각주는 이어진 문단 뒤로 밀린다.
    let j = result.length - 1;
    // 새 단이 시작될 때, 바로 앞 단의 끝에 붙은 각주만 건너뛴다
    const prevFlow = result[j]?.flow;
    // (각주는 몇 개뿐이고, 이어 붙일 문단은 본문 크기여야 한다 — 참고문헌처럼 단 전체가 작은 글자면 건너뛰지 않는다)
    if (p.flowStart && result.length > 0) {
      while (j > 0 && isSmall(result[j].fontSize) && result[j].flow === prevFlow) j--;
      const skipped = result.length - 1 - j;
      const isPlainBody = (size: number) => Math.abs(size - bodyFont) / bodyFont <= 0.05;
      if (result[j]?.flow !== prevFlow || skipped > MAX_FOOTNOTES || !isPlainBody(result[j].endFontSize)) {
        j = result.length - 1;
      }
    }
    const last = result[j];
    if (
      last &&
      p.boundary &&
      !p.indented &&
      !PARAGRAPH_END.test(last.text) &&
      isBody(last.endFontSize) &&
      isBody(p.fontSize)
    ) {
      last.text = joinLines(last.text, p.text, vocab);
      last.endFontSize = p.endFontSize;
    } else {
      result.push({ ...p });
    }
  }
  return result;
}

// 짧은 문단(제목 등)은 다음 문단 앞에 줄바꿈으로 붙인다. 마지막이 짧으면 앞 문단에 붙인다.
function mergeShort(paragraphs: Paragraph[]): Paragraph[] {
  const result: Paragraph[] = [];
  let pending: Paragraph | null = null;
  for (const p of paragraphs) {
    const merged: Paragraph = pending ? { ...p, text: `${pending.text}\n${p.text}`, page: pending.page } : p;
    if (merged.text.length < MIN_BLOCK_CHARS) {
      pending = merged;
    } else {
      result.push(merged);
      pending = null;
    }
  }
  if (pending) {
    const last = result[result.length - 1];
    if (last) last.text = `${last.text}\n${pending.text}`;
    else result.push(pending);
  }
  return result;
}
