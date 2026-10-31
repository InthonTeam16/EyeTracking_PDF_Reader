import {
  FRACTION_MAX_WIDTH,
  SCRIPT_DROP_RATIO,
  SCRIPT_RISE_RATIO,
  SUPERSCRIPT_SIZE_RATIO,
  WORD_GAP_RATIO,
} from "./config";
import type { Box, Piece } from "./extract";

// 수식 복원: 첨자는 ^·_ 표기(한 글자면 유니코드), 근호는 √(...), 분수는 분자/분모로 한 줄에 펼친다.

export type ScriptKind = "sup" | "sub";

const SUP: Record<string, string> = {
  "0": "⁰", "1": "¹", "2": "²", "3": "³", "4": "⁴", "5": "⁵", "6": "⁶", "7": "⁷", "8": "⁸", "9": "⁹",
  "+": "⁺", "-": "⁻", "−": "⁻", "=": "⁼", "(": "⁽", ")": "⁾", n: "ⁿ", i: "ⁱ", T: "ᵀ",
};
const SUB: Record<string, string> = {
  "0": "₀", "1": "₁", "2": "₂", "3": "₃", "4": "₄", "5": "₅", "6": "₆", "7": "₇", "8": "₈", "9": "₉",
  "+": "₊", "-": "₋", "−": "₋", "=": "₌", "(": "₍", ")": "₎", a: "ₐ", e: "ₑ", h: "ₕ", i: "ᵢ", j: "ⱼ",
  k: "ₖ", l: "ₗ", m: "ₘ", n: "ₙ", o: "ₒ", p: "ₚ", r: "ᵣ", s: "ₛ", t: "ₜ", u: "ᵤ", v: "ᵥ", x: "ₓ",
};

// 본문 글자(main)보다 작고 기준선이 올라가 있으면 위첨자, 내려가 있으면 아래첨자
export function scriptKind(piece: Piece, main: Piece): ScriptKind | null {
  if (piece.fontSize >= main.fontSize * SUPERSCRIPT_SIZE_RATIO) return null;
  const offset = piece.y - main.y;
  if (offset > main.fontSize * SCRIPT_RISE_RATIO) return "sup";
  if (offset < -main.fontSize * SCRIPT_DROP_RATIO) return "sub";
  return null;
}

// 연속된 첨자 조각을 아래첨자 → 위첨자 순으로 붙인다 (겹쳐 쌓인 W_i^Q, d_model^(−0.5))
export function formatScripts(items: { str: string; kind: ScriptKind }[]): string {
  const sub = items.filter((i) => i.kind === "sub").map((i) => i.str.trim()).join("");
  const sup = items.filter((i) => i.kind === "sup").map((i) => i.str.trim()).join("");
  return (sub ? formatScript(sub, "sub") : "") + (sup ? formatScript(sup, "sup") : "");
}

export function formatScript(text: string, kind: ScriptKind): string {
  const t = text.trim();
  const table = kind === "sup" ? SUP : SUB;
  if ([...t].every((ch) => table[ch])) return [...t].map((ch) => table[ch]).join("");
  const grouped = t.length === 1 || /^\(.*\)$/.test(t);
  return (kind === "sup" ? "^" : "_") + (grouped ? t : `(${t})`);
}

// 조각들을 왼쪽부터 이어 한 줄 수식으로 만든다
export function linearize(pieces: Piece[]): string {
  if (pieces.length === 0) return "";
  const main = pieces.reduce((a, b) => (b.fontSize > a.fontSize ? b : a));
  const sorted = [...pieces].sort((a, b) => a.x - b.x);
  let text = "";
  let scripts: { str: string; kind: ScriptKind }[] = [];
  const flush = () => {
    text += formatScripts(scripts);
    scripts = [];
  };
  let prevEnd = sorted[0].x;
  for (const p of sorted) {
    const gap = p.x - prevEnd;
    prevEnd = Math.max(prevEnd, p.x + p.width);
    const k = scriptKind(p, main);
    if (k) {
      scripts.push({ str: p.str, kind: k });
      continue;
    }
    flush();
    if (text && gap > p.fontSize * WORD_GAP_RATIO) text += " ";
    text += p.str;
  }
  flush();
  return text.replace(/\s+/g, " ").trim();
}

const midX = (p: Piece) => p.x + p.width / 2;
const largest = (ps: Piece[]) => ps.reduce((a, b) => (b.fontSize > a.fontSize ? b : a));
// 여러 항이면 괄호로 묶는다 (a+b)/c
const wrap = (t: string) => (/[\s+\-−=,·×/]/.test(t) ? `(${t})` : t);

export function composeMath(pieces: Piece[], rules: Box[], verticals: Box[] = []): Piece[] {
  let result = [...pieces];
  const used = new Set<Box>();

  // 1) 근호: √ 기호 오른쪽 위에서 시작하는 가로선 아래의 조각을 묶는다
  for (const root of pieces.filter((p) => p.str.trim() === "√")) {
    const bar = rules.find(
      (r) =>
        !used.has(r) &&
        Math.abs(r.x0 - (root.x + root.width)) < root.fontSize * 0.3 &&
        Math.abs(r.y0 - root.y) < root.fontSize * 0.5,
    );
    if (!bar) continue;
    const inner = result.filter(
      (p) => p !== root && midX(p) > bar.x0 && midX(p) < bar.x1 + 1 && p.y < bar.y0 && p.y > bar.y0 - root.fontSize * 1.5,
    );
    if (inner.length === 0) continue;
    used.add(bar);
    const base = largest(inner);
    const merged: Piece = {
      str: `√${wrap(linearize(inner))}`,
      x: root.x,
      y: base.y,
      width: bar.x1 - root.x,
      fontSize: base.fontSize,
    };
    result = result.filter((p) => p !== root && !inner.includes(p)).concat(merged);
  }

  // 2) 분수: 분수선 위(분자)와 아래(분모)에 선 폭 안쪽 조각이 있으면 a/b 로 펼친다
  for (const bar of rules) {
    const width = bar.x1 - bar.x0;
    if (used.has(bar) || width > FRACTION_MAX_WIDTH) continue;
    // 양끝에 세로선이 닿은 가로선은 표 테두리다
    const touches = (x: number) => verticals.some((v) => Math.abs(v.x0 - x) < 2 && v.y0 <= bar.y1 + 2 && v.y1 >= bar.y0 - 2);
    if (touches(bar.x0) || touches(bar.x1)) continue;
    const inRange = (p: Piece) => p.x >= bar.x0 - 2 && p.x + p.width <= bar.x1 + 2;
    const num = result.filter((p) => inRange(p) && p.y > bar.y0 && p.y < bar.y0 + p.fontSize * 1.6);
    const den = result.filter((p) => inRange(p) && p.y < bar.y0 && p.y > bar.y0 - p.fontSize * 1.6);
    if (num.length === 0 || den.length === 0) continue;
    // 분자·분모가 선 폭의 상당 부분을 채워야 한다 (표의 가로줄, 밑줄과 구분)
    const span = (ps: Piece[]) => Math.max(...ps.map((p) => p.x + p.width)) - Math.min(...ps.map((p) => p.x));
    // 짧은 분수선(1/√d)은 분자·분모가 선 가운데에 있으면 된다
    const centered = (ps: Piece[]) => {
      const mid = (Math.min(...ps.map((p) => p.x)) + Math.max(...ps.map((p) => p.x + p.width))) / 2;
      return Math.abs(mid - (bar.x0 + bar.x1) / 2) < width * 0.3;
    };
    const fills = (ps: Piece[]) => span(ps) >= width * 0.4 || (width < 40 && centered(ps));
    if (!fills(num) || !fills(den)) continue;
    // 표의 가로줄 위아래 칸과 구분: 한글·영단어(4글자 이상)가 있거나 항이 많으면 수식이 아니다
    const fontSize = largest([...num, ...den]).fontSize;
    const isWordy = (ps: Piece[]) =>
      ps.some((p) => /[가-힣]|[A-Za-z]{4,}/.test(p.str) && p.fontSize >= fontSize * SUPERSCRIPT_SIZE_RATIO);
    const numText = linearize(num);
    const denText = linearize(den);
    const terms = (t: string) => t.split(" ").length;
    if (isWordy(num) || isWordy(den) || terms(numText) > 3 || terms(denText) > 3) continue;
    used.add(bar);
    const merged: Piece = {
      str: `${wrap(numText)}/${wrap(denText)}`,
      x: bar.x0,
      y: bar.y0 - fontSize * 0.25,
      width,
      fontSize,
    };
    result = result.filter((p) => !num.includes(p) && !den.includes(p)).concat(merged);
  }
  return result;
}
