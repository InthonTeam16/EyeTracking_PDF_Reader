import {
  CAPTION_MAX_CHARS,
  FIGURE_LABEL_DISTANCE_RATIO,
  FIGURE_LABEL_INDENT_RATIO,
  MATH_SIDE_MARGIN_RATIO,
  SHORT_LABEL_RATIO,
  SMALL_FONT_RATIO,
  TABLE_EDGE_GAP_RATIO,
  TABLE_MIN_ROWS,
  TABLE_NUMERIC_RATIO,
} from "./config";
import type { Box } from "./extract";
import type { Line } from "./lines";

// 숫자 칸: 12.5, 76.4/76.1, 8.5k, 80%, (3.2), - 등
const NUMERIC = /^[(+±-]?\d[\d.,/]*[%kKmMx]?\)?$|^[-–—]$/;

const EQUATION_NUMBER = /\s\(\d{1,3}[a-z]?\)$/;
const MATH_RELATION = /[=≤≥≈∈∝]/;

// afterRemoved: 바로 앞에서 표·그림 글자가 지워졌다 (문단 경계로 쓴다)
export type FlowLine = Line & { afterRemoved: boolean };

// 별행 수식: 끝에 (1) 같은 번호가 붙은 식, 또는 양옆이 비어 가운데 놓인 식
export function displayMathFlags(lines: Line[]): boolean[] {
  if (lines.length === 0) return [];
  const left = Math.min(...lines.map((l) => l.x));
  const right = Math.max(...lines.map((l) => l.x + l.width));
  const maxWidth = Math.max(...lines.map((l) => l.width));
  return lines.map((l) => {
    if (!MATH_RELATION.test(l.text)) return false;
    if (EQUATION_NUMBER.test(l.text)) return true;
    const margin = l.fontSize * MATH_SIDE_MARGIN_RATIO;
    return l.x - left > margin && right - (l.x + l.width) > margin && l.width < maxWidth * 0.8;
  });
}

// 한 단(흐름)의 줄에서 표와 그림 안 글자를 지운다
export function removeNonBody(lines: Line[], bodyFont: number, figures: Box[] = []): FlowLine[] {
  const maxWidth = Math.max(0, ...lines.map((l) => l.width));
  const left = Math.min(...lines.map((l) => l.x));
  const isMath = displayMathFlags(lines);
  const removed = lines.map(
    (l) =>
      (l.fontSize < bodyFont * SMALL_FONT_RATIO && l.width < maxWidth * SHORT_LABEL_RATIO) ||
      isFigureLabel(l, left, figures),
  );

  // 표의 행: 칸 간격이 있거나 숫자 위주인 줄. 표 행 사이에 끼인 한 줄도 표로 본다. 수식 줄은 표가 아니다.
  const rowLike = lines.map((l, k) => {
    if (isMath[k]) return false;
    if (l.bigGaps > 0) return true;
    const tokens = l.text.split(" ");
    return tokens.length >= 3 && tokens.filter((t) => NUMERIC.test(t)).length / tokens.length >= TABLE_NUMERIC_RATIO;
  });
  const inTable = rowLike.map((v, k) => v || (k > 0 && rowLike[k - 1] && rowLike[k + 1] === true));

  // 표의 행이 이어지면 표. 바로 위아래 줄이 간격이 조금 좁거나 칸 수가 같으면 머리글 행으로 보고 함께 지운다.
  const tokenCount = (k: number) => lines[k].text.split(" ").length;
  const isTableEdge = (k: number, neighbor: number) =>
    k >= 0 &&
    k < lines.length &&
    (lines[k].maxGap >= lines[k].fontSize * TABLE_EDGE_GAP_RATIO ||
      (tokenCount(k) >= 3 && tokenCount(k) === tokenCount(neighbor)));
  let i = 0;
  while (i < lines.length) {
    let end = i;
    while (end < lines.length && inTable[end]) end++;
    if (end - i >= TABLE_MIN_ROWS) {
      let from = i;
      let to = end;
      while (isTableEdge(from - 1, from)) from--;
      while (isTableEdge(to, to - 1)) to++;
      for (let k = from; k < to; k++) removed[k] = true;
    }
    i = Math.max(end, i + 1);
  }

  const result: FlowLine[] = [];
  let pending = false;
  lines.forEach((line, k) => {
    if (removed[k]) {
      pending = true;
    } else {
      result.push({ ...line, afterRemoved: pending });
      pending = false;
    }
  });
  return result;
}

// 그림 바로 위·아래에 붙은 짧은 제목·라벨 줄 (본문처럼 단 왼쪽에서 시작하지 않고, 문장으로 끝나지 않는다)
function isFigureLabel(line: Line, left: number, figures: Box[]): boolean {
  if (line.x - left < line.fontSize * FIGURE_LABEL_INDENT_RATIO || /[.!?]$/.test(line.text)) return false;
  const near = line.fontSize * FIGURE_LABEL_DISTANCE_RATIO;
  const top = line.y + line.fontSize;
  return figures.some(
    (b) =>
      line.x < b.x1 &&
      line.x + line.width > b.x0 &&
      ((line.y >= b.y1 - 2 && line.y - b.y1 < near) || (top <= b.y0 + 2 && b.y0 - top < near)),
  );
}

// 그림·표 캡션: "그림 1.", "[표 2]", "<그림 3>", "Figure 1:", "Table 2." 처럼 번호 뒤에 구두점이 오거나,
// 짧은 문단이 "표 1 ..." 으로 시작하면 캡션으로 본다 ("그림 1에서 보듯이"는 본문)
const CAPTION = /^[[<(]?\s*(그림|표|사진|도표|figure|fig\.?|table|tab\.?)\s*\d+([.-]\d+)*\s*([\].:)>|]|\s)/i;

export function isCaption(text: string): boolean {
  const m = CAPTION.exec(text);
  if (!m) return false;
  return m[3].trim() !== "" || text.length < CAPTION_MAX_CHARS;
}
