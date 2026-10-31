import {
  COLUMN_FULL_LINE_RATIO,
  COLUMN_FULL_LINE_SHARE,
  COLUMN_MIN_CHARS,
  GUTTER_MIN_RATIO,
  GUTTER_MIN_ROWS,
  GUTTER_ROW_RATIO,
  ROW_ATTACH_RATIO,
} from "./config";
import { centerY, type Piece } from "./extract";
import { groupRows } from "./lines";

// 한 페이지의 조각을 읽는 순서대로 단(흐름)별로 나눈다. 1단이면 흐름이 하나다.
//   1) 여러 행에서 공통으로 비어 있는 세로 띠를 찾아 단 경계로 삼는다 (개수 제한 없음)
//   2) 위에서부터 행이 가로지르는 단 경계가 같은 것끼리 묶어 구간을 만든다
//      (제목·초록처럼 전체 폭을 쓰는 행은 별도 구간)
//   3) 구간마다 왼쪽 단부터 위→아래로 읽는다
export function layoutPage(pieces: Piece[], bodyFont: number): Piece[][] {
  if (pieces.length === 0) return [];
  const rows = groupRows(pieces);
  const minGap = bodyFont * GUTTER_MIN_RATIO;
  const gutters = findGutters(rows, minGap);
  if (gutters.length === 0) return [pieces];

  const bands: { key: string; active: number[]; pieces: Piece[] }[] = [];
  let prevRow: Piece[] | null = null;
  for (const row of rows) {
    const active = gutters.filter((g) => !crosses(row, g, minGap, bodyFont));
    const key = active.join(",");
    const band = bands[bands.length - 1];
    if (band && (band.key === key || continuesWiderBand(row, prevRow, band.active, active))) {
      band.pieces.push(...row);
    } else {
      bands.push({ key, active, pieces: [...row] });
    }
    prevRow = row;
  }

  return bands.flatMap((band) => {
    const bounds = [-Infinity, ...band.active, Infinity];
    return bounds
      .slice(1)
      .map((right, i) => band.pieces.filter((p) => midX(p) > bounds[i] && midX(p) <= right))
      .filter((column) => column.length > 0);
  });
}

// 전체 폭 문단(캡션 등)의 짧은 마지막 줄은 단 경계를 가로지르지 않아 아래 단 구간으로 잘못 들어간다.
// 바로 위 행과 줄 간격만큼 붙어 있고 한쪽 단에만 글이 있으면 위 구간에 이어 붙인다.
function continuesWiderBand(row: Piece[], prevRow: Piece[] | null, bandActive: number[], active: number[]): boolean {
  if (!prevRow || bandActive.length >= active.length) return false;
  const fontSize = Math.max(...row.map((p) => p.fontSize));
  if (centerY(prevRow[0]) - centerY(row[0]) > fontSize * ROW_ATTACH_RATIO) return false;
  const bounds = [-Infinity, ...active, Infinity];
  const columnOf = (p: Piece) => bounds.findIndex((b, i) => midX(p) > b && midX(p) <= bounds[i + 1]);
  return new Set(row.map(columnOf)).size === 1;
}

function midX(p: Piece): number {
  return p.x + p.width / 2;
}

// 행 안에서 minGap 이상 벌어진 구간들 (텍스트 사이의 빈 공간)
function rowGaps(row: Piece[], minGap: number): [number, number][] {
  const sorted = [...row].sort((a, b) => a.x - b.x);
  const gaps: [number, number][] = [];
  let end = sorted[0].x + sorted[0].width;
  for (const p of sorted.slice(1)) {
    if (p.x - end >= minGap) gaps.push([end, p.x]);
    end = Math.max(end, p.x + p.width);
  }
  return gaps;
}

function findGutters(rows: Piece[][], minGap: number): number[] {
  const all = rows.flat();
  const minX = Math.floor(Math.min(...all.map((p) => p.x)));
  const maxX = Math.ceil(Math.max(...all.map((p) => p.x + p.width)));
  const score = new Array<number>(Math.max(0, maxX - minX)).fill(0);
  for (const row of rows) {
    for (const [from, to] of rowGaps(row, minGap)) {
      for (let x = Math.ceil(from); x < to; x++) score[x - minX]++;
    }
  }

  // 점수가 기준 이상인 x 구간마다 가장 높은 지점(평탄하면 가운데)을 후보로
  const threshold = Math.max(GUTTER_MIN_ROWS, rows.length * GUTTER_ROW_RATIO);
  const candidates: number[] = [];
  let x = 0;
  while (x < score.length) {
    if (score[x] < threshold) {
      x++;
      continue;
    }
    let end = x;
    while (end < score.length && score[end] >= threshold) end++;
    const run = score.slice(x, end);
    const peak = Math.max(...run);
    const first = run.indexOf(peak);
    const last = run.lastIndexOf(peak);
    candidates.push(minX + x + (first + last) / 2);
    x = end;
  }

  // 양쪽 글이 짧은 경계(표의 칸, 목록의 탭)는 하나씩 빼면서 다시 검사한다
  // 먼저 이웃 후보 없이 하나씩 검사해 표 안의 가짜 경계를 거른다.
  // (가짜 경계와 함께 검사하면 진짜 단 경계가 반쪽짜리 단으로 잘려 먼저 탈락할 수 있다)
  let gutters = candidates.filter((g) => isTextColumns(rows, g, undefined, undefined, minGap));
  for (;;) {
    const invalid = gutters.filter((g, i) => !isTextColumns(rows, g, gutters[i - 1], gutters[i + 1], minGap));
    if (invalid.length === 0) return gutters;
    const worst = invalid.reduce((a, b) => (gapRowCount(rows, a, minGap) <= gapRowCount(rows, b, minGap) ? a : b));
    gutters = gutters.filter((g) => g !== worst);
  }
}

function isGapAt(row: Piece[], g: number, minGap: number): boolean {
  return rowGaps(row, minGap).some(([from, to]) => from <= g && g <= to);
}

function gapRowCount(rows: Piece[][], g: number, minGap: number): number {
  return rows.filter((row) => isGapAt(row, g, minGap)).length;
}

function isTextColumns(
  rows: Piece[][],
  g: number,
  prev: number | undefined,
  next: number | undefined,
  minGap: number,
): boolean {
  const sides = [
    { from: prev ?? -Infinity, to: g, chars: [] as number[], widths: [] as number[] },
    { from: g, to: next ?? Infinity, chars: [] as number[], widths: [] as number[] },
  ];
  for (const row of rows) {
    if (!isGapAt(row, g, minGap)) continue;
    for (const side of sides) {
      const ps = row.filter((p) => midX(p) > side.from && midX(p) < side.to);
      if (ps.length === 0) continue;
      side.chars.push(ps.reduce((n, p) => n + p.str.trim().length, 0));
      side.widths.push(Math.max(...ps.map((p) => p.x + p.width)) - Math.min(...ps.map((p) => p.x)));
    }
  }
  // 본문 단은 줄의 상당수가 단 폭을 꽉 채운다. 표의 열은 칸마다 길이가 들쭉날쭉하다.
  // (같은 페이지에 표가 섞여 있어도 본문 단이 걸러지지 않도록 중간값 대신 꽉 찬 줄의 비율을 본다)
  const fullShare = (widths: number[]) =>
    widths.filter((w) => w >= Math.max(...widths) * COLUMN_FULL_LINE_RATIO).length / widths.length;
  return sides.every(
    (side) =>
      side.chars.length > 0 &&
      median(side.chars) >= COLUMN_MIN_CHARS &&
      fullShare(side.widths) >= COLUMN_FULL_LINE_SHARE,
  );
}

// 행이 단 경계를 가로지르는지: 경계 위에 걸친 조각이 양쪽으로 충분히 뻗어 있거나,
// 경계 양옆 조각 사이가 단어 간격 정도로 좁으면 한 줄로 이어진 것으로 본다
function crosses(row: Piece[], g: number, minGap: number, bodyFont: number): boolean {
  if (row.some((p) => p.x < g - bodyFont && p.x + p.width > g + bodyFont)) return true;
  const leftEnd = Math.max(...row.filter((p) => midX(p) <= g).map((p) => p.x + p.width));
  const rightStart = Math.min(...row.filter((p) => midX(p) > g).map((p) => p.x));
  return Number.isFinite(leftEnd) && Number.isFinite(rightStart) && rightStart - leftEnd < minGap;
}

export function median(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.floor(sorted.length / 2)];
}
