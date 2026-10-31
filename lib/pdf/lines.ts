import {
  LETTER_SPACED_GAP_RATIO,
  ROW_CENTER_TOLERANCE,
  SUPERSCRIPT_RISE_RATIO,
  SUPERSCRIPT_SIZE_RATIO,
  TABLE_GAP_RATIO,
  WORD_GAP_RATIO,
} from "./config";
import { centerY, type Piece } from "./extract";

// bigGaps: 표의 칸 사이처럼 넓은 간격의 개수, maxGap: 가장 넓은 간격 (공백 조각이 채운 곳은 간격이 아니다)
export type Line = {
  text: string;
  x: number;
  y: number;
  width: number;
  fontSize: number;
  bigGaps: number;
  maxGap: number;
};

const FOOTNOTE_MARK = /^[\d\s,*†‡§¹²³⁴⁵⁶⁷⁸⁹⁰\-–]+$/;
const EMPTY_BRACKET = /\[\s*\]/g;
const LONE_SYLLABLE_END = /(^|[\s\]])[가-힣]$/;
const LABEL_ONLY = /^\[[^\]]+\]$/;

// 세로 중심이 가까운 조각끼리 묶어 위→아래 순서의 행으로 만든다.
// 높이가 아니라 중심으로 비교해서, 위첨자처럼 기준선이 다른 조각도 같은 행에 들어간다.
export function groupRows(pieces: Piece[]): Piece[][] {
  const sorted = [...pieces].sort((a, b) => centerY(b) - centerY(a) || a.x - b.x);
  const rows: { center: number; fontSize: number; pieces: Piece[] }[] = [];
  for (const piece of sorted) {
    const row = rows[rows.length - 1];
    const tolerance = Math.max(row?.fontSize ?? 0, piece.fontSize) * ROW_CENTER_TOLERANCE;
    if (row && Math.abs(row.center - centerY(piece)) <= tolerance) {
      row.pieces.push(piece);
      row.fontSize = Math.max(row.fontSize, piece.fontSize);
    } else {
      rows.push({ center: centerY(piece), fontSize: piece.fontSize, pieces: [piece] });
    }
  }
  return rows.map((r) => r.pieces);
}

export function piecesToLines(pieces: Piece[]): Line[] {
  return groupRows(pieces)
    .map(toLine)
    .filter((line): line is Line => line !== null);
}

function toLine(row: Piece[]): Line | null {
  const main = row.reduce((a, b) => (b.fontSize > a.fontSize ? b : a));
  // 작고 위로 올라간 숫자·기호는 각주 번호로 보고 글자만 뺀다 (자리는 남겨 공백이 생기지 않게)
  const isMark = (p: Piece) =>
    p.fontSize < main.fontSize * SUPERSCRIPT_SIZE_RATIO &&
    p.y > main.y + main.fontSize * SUPERSCRIPT_RISE_RATIO &&
    FOOTNOTE_MARK.test(p.str);
  // 빈 괄호([])는 문서 변환 흔적이라 글자와 자리 모두 뺀다
  const words = [...row]
    .sort((a, b) => a.x - b.x)
    .filter((p) => p.str.replace(EMPTY_BRACKET, "").trim() !== "");
  if (words.length === 0 || words.every(isMark)) return null;

  // 조각 사이 간격을 먼저 구한다 (각주 번호 자리는 간격이 아니다)
  const spaced: { piece: Piece; gap: number }[] = [];
  let prevEnd = words[0].x;
  for (const piece of words) {
    const gap = piece.x - prevEnd;
    prevEnd = Math.max(prevEnd, piece.x + piece.width);
    if (!isMark(piece)) spaced.push({ piece, gap: spaced.length === 0 ? 0 : gap });
  }
  const wordGaps = spaced.map((s) => s.gap).filter((g) => g > main.fontSize * WORD_GAP_RATIO);
  // 양쪽 정렬로 단어 간격이 고르게 넓어진 줄은 표도, 균등 배분도 아니다
  const isEven = wordGaps.length >= 3 && Math.max(...wordGaps) <= Math.min(...wordGaps) * 1.5;

  let text = "";
  const gaps: number[] = [];
  for (const { piece, gap } of spaced) {
    const str = piece.str.replace(EMPTY_BRACKET, "");
    if (text && gap > piece.fontSize * WORD_GAP_RATIO) {
      // 균등 배분으로 글자 사이를 넓힌 한글 낱자(산   쵸)는 붙인다
      const letterSpaced =
        !isEven &&
        gap >= piece.fontSize * LETTER_SPACED_GAP_RATIO &&
        LONE_SYLLABLE_END.test(text) &&
        /^\s*[가-힣]/.test(str);
      if (letterSpaced) {
        text += str.trimStart();
        continue;
      }
      // 줄 맨 앞 [화자] 표시 뒤의 간격은 표의 칸이 아니다
      if (!LABEL_ONLY.test(text.trim())) gaps.push(gap);
      text += " ";
    }
    text += str;
  }

  const tableGaps = isEven ? [] : gaps;
  const kept = words.filter((p) => !isMark(p));
  const left = kept[0].x;
  return {
    text: text.replace(/\s+/g, " ").trim(),
    x: left,
    y: main.y,
    width: Math.max(...kept.map((p) => p.x + p.width)) - left,
    fontSize: main.fontSize,
    bigGaps: tableGaps.filter((g) => g > main.fontSize * TABLE_GAP_RATIO).length,
    maxGap: Math.max(0, ...tableGaps),
  };
}
