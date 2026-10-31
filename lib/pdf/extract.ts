import type { OPS as PdfOps, PDFPageProxy } from "pdfjs-dist";
import type { TextItem } from "pdfjs-dist/types/src/display/api";
import { BACKGROUND_IMAGE_RATIO, FIGURE_MERGE_GAP, FIGURE_MIN_SHAPES, FIGURE_MIN_THICKNESS } from "./config";

// 텍스트 조각. y는 기준선이고 PDF 좌표계라 위로 갈수록 크다.
export type Piece = { str: string; x: number; y: number; width: number; fontSize: number };
export type Box = { x0: number; y0: number; x1: number; y1: number };
// figures: 이미지와 벡터 그림(도형이 모인 영역). 이 안의 글자는 본문이 아니다.
export type PageContent = { pieces: Piece[]; figures: Box[] };

type Matrix = number[];

// pdfjs는 브라우저와 Node에서 빌드가 달라 OPS를 인자로 받는다
export async function extractPage(page: PDFPageProxy, ops: typeof PdfOps): Promise<PageContent> {
  const [content, opList] = await Promise.all([page.getTextContent(), page.getOperatorList()]);
  const [vx0, vy0, vx1, vy1] = page.view;
  const pageArea = (vx1 - vx0) * (vy1 - vy0);
  const { images, shapes } = paintedBoxes(opList.fnArray, opList.argsArray, ops);
  const notBackground = (b: Box) => area(b) < pageArea * BACKGROUND_IMAGE_RATIO;
  // 밑줄·구분선 같은 얇은 선은 본문에도 흔하므로 그림 판단에서 뺀다
  const notThin = (b: Box) => Math.min(b.x1 - b.x0, b.y1 - b.y0) >= FIGURE_MIN_THICKNESS;
  const figures = [
    ...images.filter(notBackground),
    ...clusterShapes(shapes.filter((b) => notBackground(b) && notThin(b)))
      .filter((c) => c.count >= FIGURE_MIN_SHAPES)
      .map((c) => c.box)
      .filter(notBackground),
  ];

  // 공백 조각은 pdfjs가 넓은 간격에도 만들어 넣어 단·표 판별을 흐리므로 뺀다
  const pieces = content.items
    .filter((item): item is TextItem => "str" in item && item.str.trim() !== "")
    // 회전된 글자(그래프 축 라벨 등)와 세로쓰기는 본문이 아니다
    .filter((item) => item.dir !== "ttb" && Math.abs(item.transform[1]) < 0.01 * Math.abs(item.transform[0]))
    .map((item) => ({
      str: item.str,
      x: item.transform[4],
      y: item.transform[5],
      width: item.width,
      fontSize: Math.hypot(item.transform[2], item.transform[3]) || item.height,
    }))
    .filter((p) => !figures.some((b) => contains(b, p.x + p.width / 2, centerY(p))));

  return { pieces, figures };
}

export function centerY(piece: Piece): number {
  return piece.y + piece.fontSize * 0.35;
}

function contains(b: Box, x: number, y: number): boolean {
  return x >= b.x0 && x <= b.x1 && y >= b.y0 && y <= b.y1;
}

function area(b: Box): number {
  return (b.x1 - b.x0) * (b.y1 - b.y0);
}

// 연산자 목록을 따라가며 변환 행렬을 계산해, 이미지와 도형(채우기·선)이 그려지는 영역을 구한다.
// 클리핑에만 쓰는 경로는 화면에 보이지 않으므로 뺀다.
function paintedBoxes(fnArray: number[], argsArray: unknown[], ops: typeof PdfOps) {
  const imagePaints = new Set<number>([ops.paintImageXObject, ops.paintInlineImageXObject, ops.paintImageMaskXObject]);
  const pathPaints = new Set<number>([
    ops.stroke,
    ops.closeStroke,
    ops.fill,
    ops.eoFill,
    ops.fillStroke,
    ops.eoFillStroke,
    ops.closeFillStroke,
    ops.closeEOFillStroke,
  ]);
  const stack: Matrix[] = [];
  let ctm: Matrix = [1, 0, 0, 1, 0, 0];
  const images: Box[] = [];
  const shapes: Box[] = [];

  fnArray.forEach((fn, i) => {
    const args = argsArray[i] as unknown[] | null;
    if (fn === ops.save) {
      stack.push(ctm);
    } else if (fn === ops.restore) {
      ctm = stack.pop() ?? ctm;
    } else if (fn === ops.transform && args) {
      ctm = multiply(ctm, args as number[]);
    } else if (fn === ops.paintFormXObjectBegin) {
      stack.push(ctm);
      const matrix = args?.[0] as number[] | null | undefined;
      if (matrix) ctm = multiply(ctm, Array.from(matrix));
    } else if (fn === ops.paintFormXObjectEnd) {
      ctm = stack.pop() ?? ctm;
    } else if (imagePaints.has(fn)) {
      images.push(transformBox(ctm, 0, 0, 1, 1));
    } else if (fn === ops.constructPath && args) {
      // [그리기 연산, 경로 데이터, [minX, minY, maxX, maxY]]
      const [op, , minMax] = args as [number, unknown, ArrayLike<number> | null];
      if (pathPaints.has(op) && minMax) shapes.push(transformBox(ctm, minMax[0], minMax[1], minMax[2], minMax[3]));
    }
  });
  return { images, shapes };
}

function transformBox(ctm: Matrix, x0: number, y0: number, x1: number, y1: number): Box {
  const corners = [
    [x0, y0],
    [x1, y0],
    [x0, y1],
    [x1, y1],
  ].map(([x, y]) => [x * ctm[0] + y * ctm[2] + ctm[4], x * ctm[1] + y * ctm[3] + ctm[5]]);
  const xs = corners.map((c) => c[0]);
  const ys = corners.map((c) => c[1]);
  return { x0: Math.min(...xs), y0: Math.min(...ys), x1: Math.max(...xs), y1: Math.max(...ys) };
}

// 서로 닿거나 가까운 도형끼리 묶는다. 도형이 많이 모인 묶음이 그림·표 테두리다.
function clusterShapes(shapes: Box[]): { box: Box; count: number }[] {
  const near = (a: Box, b: Box) =>
    a.x0 - FIGURE_MERGE_GAP <= b.x1 &&
    b.x0 - FIGURE_MERGE_GAP <= a.x1 &&
    a.y0 - FIGURE_MERGE_GAP <= b.y1 &&
    b.y0 - FIGURE_MERGE_GAP <= a.y1;
  const union = (a: Box, b: Box): Box => ({
    x0: Math.min(a.x0, b.x0),
    y0: Math.min(a.y0, b.y0),
    x1: Math.max(a.x1, b.x1),
    y1: Math.max(a.y1, b.y1),
  });

  let clusters = shapes.map((box) => ({ box, count: 1 }));
  // 합칠 것이 없을 때까지 반복한다 (묶음이 커지면서 새로 닿는 묶음이 생긴다)
  for (let changed = true; changed; ) {
    changed = false;
    const merged: { box: Box; count: number }[] = [];
    for (const c of clusters) {
      const target = merged.find((m) => near(m.box, c.box));
      if (target) {
        target.box = union(target.box, c.box);
        target.count += c.count;
        changed = true;
      } else {
        merged.push({ ...c });
      }
    }
    clusters = merged;
  }
  return clusters;
}

// pdfjs Util.transform과 같은 순서: m을 먼저 적용하고 ctm을 나중에 적용
function multiply(ctm: Matrix, m: Matrix): Matrix {
  return [
    ctm[0] * m[0] + ctm[2] * m[1],
    ctm[1] * m[0] + ctm[3] * m[1],
    ctm[0] * m[2] + ctm[2] * m[3],
    ctm[1] * m[2] + ctm[3] * m[3],
    ctm[0] * m[4] + ctm[2] * m[5] + ctm[4],
    ctm[1] * m[4] + ctm[3] * m[5] + ctm[5],
  ];
}
