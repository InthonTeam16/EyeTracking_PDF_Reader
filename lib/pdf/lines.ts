import {
  LETTER_SPACED_GAP_RATIO,
  ROW_CENTER_TOLERANCE,
  TABLE_GAP_RATIO,
  WORD_GAP_RATIO,
} from "./config";
import { centerY, type Piece } from "./extract";
import { hypuaToJamo } from "./hypua";
import { formatScripts, scriptKind, type ScriptKind } from "./math";

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

const FOOTNOTE_MARK = /^[\d\s,*∗†‡§¹²³⁴⁵⁶⁷⁸⁹⁰\-–]+$/;
// 각주 번호가 붙는 자리: 줄 맨 앞, 긴 영단어·한글·문장부호 뒤 (짧은 변수 뒤의 위첨자는 지수 n²)
const FOOTNOTE_CONTEXT = /(^|[A-Za-z]{3,}|[가-힣]|[.,;:"'”’\]])\s*$/;
const EMPTY_BRACKET = /\[\s*\]/g;
const SIDE_MARK = /^\[[A-Z가-하]\]$/;
// 구간 표시가 본문과 이만큼(글자 크기 대비) 떨어져 있으면 여백 표시로 본다
const SIDE_MARK_GAP_RATIO = 1;
// 한글(HWP) 문서 전용 글꼴의 사용자 정의 영역 문자 중 뜻이 분명한 것을 표준 문자로 바꾼다
const HWP_PUA: Record<string, string> = { "\u{F0854}": "『", "\u{F0855}": "』", "\u{F00DA}": "예" };
const HWP_PUA_PATTERN = new RegExp(Object.keys(HWP_PUA).join("|"), "gu");
const LONE_SYLLABLE_END = /(^|[\s\]])[가-힣]$/;
const LABEL_ONLY = /^\[[^\]]+\]$/;

// 세로 중심이 가까운 조각끼리 묶어 위→아래 순서의 행으로 만든다.
// 높이가 아니라 중심으로 비교하고, 기준은 행에서 가장 큰 글자로 옮겨 간다.
// 그래서 위첨자·아래첨자처럼 기준선이 다른 조각도 같은 행에 들어간다.
export function groupRows(pieces: Piece[]): Piece[][] {
  const sorted = [...pieces].sort((a, b) => centerY(b) - centerY(a) || a.x - b.x);
  const rows: { center: number; fontSize: number; pieces: Piece[] }[] = [];
  for (const piece of sorted) {
    const row = rows[rows.length - 1];
    const tolerance = Math.max(row?.fontSize ?? 0, piece.fontSize) * ROW_CENTER_TOLERANCE;
    if (row && Math.abs(row.center - centerY(piece)) <= tolerance) {
      row.pieces.push(piece);
      if (piece.fontSize > row.fontSize) {
        row.fontSize = piece.fontSize;
        row.center = centerY(piece);
      }
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
  // 빈 괄호([])는 문서 변환 흔적이라 글자와 자리 모두 뺀다
  const sorted = [...row]
    .sort((a, b) => a.x - b.x)
    .filter((p) => p.str.replace(EMPTY_BRACKET, "").trim() !== "");
  // 지문 옆 여백의 [A]·[B] 같은 구간 표시는 본문이 아니다 (넓은 간격으로 떨어져 있거나 혼자 있는 것만)
  const words = sorted.filter((p, i) => {
    if (!SIDE_MARK.test(p.str.trim())) return true;
    const prev = sorted[i - 1];
    const next = sorted[i + 1];
    const far = (gap: number) => gap > main.fontSize * SIDE_MARK_GAP_RATIO;
    return !((!prev || far(p.x - (prev.x + prev.width))) && (!next || far(next.x - (p.x + p.width))));
  });
  if (words.length === 0) return null;

  // 조각 사이 간격과 첨자 여부를 먼저 구한다
  let prevEnd = words[0].x;
  const spaced = words.map((piece, i) => {
    const gap = i === 0 ? 0 : piece.x - prevEnd;
    prevEnd = Math.max(prevEnd, piece.x + piece.width);
    return { piece, gap, kind: scriptKind(piece, main) };
  });
  const wordGaps = spaced
    .filter((s) => !s.kind && s.gap > main.fontSize * WORD_GAP_RATIO)
    .map((s) => s.gap);
  // 양쪽 정렬로 단어 간격이 고르게 넓어진 줄은 표도, 균등 배분도 아니다
  const isEven = wordGaps.length >= 3 && Math.max(...wordGaps) <= Math.min(...wordGaps) * 1.5;

  let text = "";
  const gaps: number[] = [];
  const kept: Piece[] = [];
  let scripts: { str: string; kind: ScriptKind }[] = [];
  const flush = () => {
    text += formatScripts(scripts);
    scripts = [];
  };

  for (const { piece, gap, kind } of spaced) {
    const str = piece.str.replace(EMPTY_BRACKET, "");
    if (kind) {
      // 긴 단어·문장부호 뒤(또는 줄 맨 앞)의 위첨자 숫자·기호는 각주 번호라 뺀다
      if (scripts.length === 0 && kind === "sup" && FOOTNOTE_MARK.test(str) && FOOTNOTE_CONTEXT.test(text)) continue;
      scripts.push({ str, kind });
      kept.push(piece);
      continue;
    }
    flush();
    kept.push(piece);
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
  flush();
  if (kept.length === 0 || text.trim() === "") return null;

  const tableGaps = isEven ? [] : gaps;
  const left = kept[0].x;
  return {
    text: hypuaToJamo(text.replace(HWP_PUA_PATTERN, (ch) => HWP_PUA[ch]))
      .replace(/\s+/g, " ")
      .trim(),
    x: left,
    y: main.y,
    width: Math.max(...kept.map((p) => p.x + p.width)) - left,
    fontSize: main.fontSize,
    bigGaps: tableGaps.filter((g) => g > main.fontSize * TABLE_GAP_RATIO).length,
    maxGap: Math.max(0, ...tableGaps),
  };
}
