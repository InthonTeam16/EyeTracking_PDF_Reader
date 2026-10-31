// 줄 잇기와 문장 나누기. 문서 안에서 실제로 쓰인 단어(어절) 목록과 조사·어미 규칙으로 띄어쓰기를 판단한다.
import { MID_WORD_BREAK_RATIO, MIN_WRAP_EVIDENCE, WORD_WRAP_THRESHOLD } from "./config";

// words: 문서에 나온 어절 (소문자)
// midWordBreaks: 한글 단어 중간에서도 줄을 바꾼 문서인지 (한글·워드의 글자 단위 줄 나눔)
export type Vocab = { words: Set<string>; midWordBreaks: boolean };

// 어절 끝에 자주 오는 조사·어미 글자. 앞 줄이 이 글자로 끝나면 띄어 쓴 자리로 본다.
const ENDING_SYLLABLES = "은는이가을를의에와과도로고며서다한할된될인들게면나요지만등및것수때해히록적던여라니데써러야께";

const HANGUL_END = /[가-힣]$/;
const HANGUL_START = /^[가-힣]/;

// 줄의 첫 어절만으로 나올 수 있는 조사·어미 (앞 어절에 붙여 쓴다)
const JOSA = new Set([
  "은", "는", "이", "가", "을", "를", "의", "에", "에서", "에게", "께", "으로", "로", "와", "과", "도",
  "만", "까지", "부터", "보다", "처럼", "이다", "였다", "이며", "이고", "이나", "나", "란", "이란",
  "라는", "이라는", "한다", "했다", "하는", "하여", "하고", "하며", "된다", "되는", "되어", "들",
  "들은", "들이", "들을", "들의", "다", "요", "니다", "습니다", "서", "으로서", "로서", "으로써",
  "로써", "에는", "에도", "와의", "과의", "이라", "라고", "이라고",
]);

// 뒤에 마침표가 와도 문장 끝이 아닌 약어 (소문자, 마지막 마침표 제외)
const ABBREVIATIONS = new Set([
  "e.g", "i.e", "al", "fig", "figs", "eq", "eqs", "vs", "dr", "mr", "mrs", "ms", "prof", "no", "nos",
  "vol", "pp", "p", "cf", "approx", "sec", "ch", "ref", "refs", "jr", "sr", "st", "inc", "ltd", "dept",
]);

function normalize(token: string): string {
  return token.replace(/^[^0-9A-Za-z가-힣]+|[^0-9A-Za-z가-힣]+$/g, "").toLowerCase();
}

// 줄 맨 앞·맨 뒤 어절은 줄바꿈에 잘렸을 수 있어 빼고 모은다.
// flows: 단(흐름)별 줄 목록. whole은 짧은 줄(제목, 표의 칸, 문단 마지막 줄)이라 양 끝 어절도 온전한 경우
// raggedRight: 줄 오른쪽 끝이 들쭉날쭉한 문서 (어절 단위 줄바꿈이 확실하다)
export function buildVocab(flows: { text: string; whole: boolean }[][], raggedRight = false): Vocab {
  const words = new Set<string>();
  for (const { text, whole } of flows.flat()) {
    const tokens = text.split(" ");
    for (const token of whole ? tokens : tokens.slice(1, -1)) {
      const word = normalize(token);
      if (word) words.add(word);
    }
  }

  return { words, midWordBreaks: !raggedRight && detectMidWordBreaks(flows, words) };
}

// 단어 중간에서 줄을 바꾼 문서인지 두 가지 증거로 판단한다.
//  1) 줄 경계의 두 조각을 붙인 어절이 문서에 자주 있으면 단어 중간 줄바꿈
//  2) 줄 끝 글자가 조사·어미인 비율이 "어절 끝" 분포에 가까우면 어절 단위, "아무 글자" 분포에 가까우면 글자 단위
// 잘못 판단했을 때 손해가 더 큰 쪽(글자 단위 문서를 어절 단위로 보는 것)을 피하도록 글자 단위 쪽으로 기울인다.
function detectMidWordBreaks(flows: { text: string }[][], words: Set<string>): boolean {
  let merged = 0;
  let boundaries = 0;
  let tailEndings = 0;
  for (const lines of flows) {
    for (let i = 1; i < lines.length; i++) {
      const a = lines[i - 1].text;
      const b = lines[i].text;
      if (!HANGUL_END.test(a) || !HANGUL_START.test(b)) continue;
      boundaries++;
      if (ENDING_SYLLABLES.includes(a[a.length - 1])) tailEndings++;
      if (words.has(normalize(a.slice(a.lastIndexOf(" ") + 1)) + normalize(b.split(" ")[0]))) merged++;
    }
  }
  if (boundaries < MIN_WRAP_EVIDENCE) return true;
  if (merged / boundaries >= MID_WORD_BREAK_RATIO) return true;

  const hangulWords = [...words].filter((w) => /^[가-힣]+$/.test(w));
  const chars = hangulWords.join("");
  if (hangulWords.length === 0) return true;
  const wordEndRate = hangulWords.filter((w) => ENDING_SYLLABLES.includes(w[w.length - 1])).length / hangulWords.length;
  const charRate = [...chars].filter((c) => ENDING_SYLLABLES.includes(c)).length / chars.length;
  // 글자 단위 문서도 띄어쓰기 자리에서 끊길 확률(어절 경계 수 / 글자 경계 수)만큼은 어절 끝 분포를 따른다
  const spaceShare = hangulWords.length / (chars.length + hangulWords.length);
  const charWrapRate = spaceShare * wordEndRate + (1 - spaceShare) * charRate;
  const threshold = charWrapRate + (wordEndRate - charWrapRate) * WORD_WRAP_THRESHOLD;
  return tailEndings / boundaries < threshold;
}

function hasWordStartingWith(words: Set<string>, prefix: string): boolean {
  for (const word of words) if (word.startsWith(prefix)) return true;
  return false;
}

// 앞 줄 a 뒤에 다음 줄 b를 잇는다
export function joinLines(a: string, b: string, vocab: Vocab): string {
  const tail = a.slice(a.lastIndexOf(" ") + 1);
  const head = b.split(" ")[0];

  // 영어 하이픈: 대문자·숫자로 이어지면(COVID-19) 그대로, 문서에 하이픈 단어가 있으면 유지, 아니면 줄바꿈 하이픈으로 보고 지운다
  if (/[A-Za-z]-$/.test(a)) {
    if (!/^[a-z]/.test(b)) return a + b;
    const base = normalize(tail);
    const rest = normalize(head);
    const { words } = vocab;
    const keep =
      words.has(`${base}-${rest}`) ||
      (!words.has(base + rest) && (base.includes("-") || (words.has(base) && words.has(rest))));
    return keep ? a + b : a.slice(0, -1) + b;
  }

  // 닫는 괄호·문장부호로 시작하면 붙인다
  if (/^[)\]}.,;:!?%]/.test(b)) return a + b;

  const h = normalize(head);
  // 영문·숫자 뒤에 조사가 오면 붙인다 (PDF + 에서)
  if (/[A-Za-z0-9)\]]$/.test(a) && HANGUL_START.test(b) && JOSA.has(h)) return a + b;

  // 한글: 단어 중간에서 줄이 바뀌었는지 문서의 어절 목록 → 조사 → 앞 줄 끝 글자 순으로 판단한다.
  // 어절 단위로 줄을 바꾼 문서라면 줄 경계는 항상 띄어쓰기다.
  if (HANGUL_END.test(a) && HANGUL_START.test(b) && vocab.midWordBreaks) {
    const t = normalize(tail);
    const merged = t + h;
    if (vocab.words.has(merged) || hasWordStartingWith(vocab.words, merged)) return a + b;
    if (vocab.words.has(t) && vocab.words.has(h)) return `${a} ${b}`;
    if (JOSA.has(h)) return a + b;
    return ENDING_SYLLABLES.includes(a[a.length - 1]) ? `${a} ${b}` : a + b;
  }

  return `${a} ${b}`;
}

// 문장 끝: 마침표·물음표·느낌표(+닫는 따옴표·괄호) 뒤에 공백이나 글 끝이 올 때.
// 3.14처럼 뒤에 공백이 없거나, 약어·이름 이니셜 뒤의 마침표는 제외한다.
export function splitSentences(text: string): string[] {
  const cuts: number[] = [];
  for (const m of text.matchAll(/[.!?。]+["'”’)\]]*(?=\s|$)/g)) {
    const before = text.slice(0, m.index).split(/\s/).pop() ?? "";
    const word = before.toLowerCase().replace(/^[("'“‘[]+/, "");
    if (m[0].startsWith(".") && (ABBREVIATIONS.has(word) || /^[A-Z]$/.test(before))) continue;
    cuts.push(m.index + m[0].length);
  }
  return cutAt(text, cuts);
}

function cutAfter(text: string, pattern: RegExp): string[] {
  return cutAt(
    text,
    [...text.matchAll(pattern)].map((m) => m.index + m[0].length),
  );
}

function cutAt(text: string, cuts: number[]): string[] {
  const parts: string[] = [];
  let start = 0;
  for (const cut of [...cuts, text.length]) {
    if (cut > start) parts.push(text.slice(start, cut));
    start = Math.max(start, cut);
  }
  return parts;
}

// 긴 글을 max 이하의 비슷한 길이로 나눈다.
// 문장 → 마침표 없는 한국어 문장 끝(~다, ~요) → 쉼표 → 띄어쓰기 → 글자 수 순서로 더 잘게 자른다.
export function splitToFit(text: string, max: number): string[] {
  if (text.length <= max) return [text];
  const splitters: ((s: string) => string[])[] = [
    splitSentences,
    (s) => cutAfter(s, /[다요죠까](?=\s)/g),
    (s) => cutAfter(s, /[,，;]\s/g),
    (s) => cutAfter(s, /\s/g),
    (s) => {
      const size = Math.ceil(s.length / Math.ceil(s.length / max));
      return cutAt(s, Array.from({ length: Math.ceil(s.length / size) }, (_, i) => (i + 1) * size));
    },
  ];
  const units = refine([text], splitters, max);
  return pack(units, max);
}

function refine(units: string[], splitters: ((s: string) => string[])[], max: number): string[] {
  const [split, ...rest] = splitters;
  if (!split) return units;
  return units.flatMap((u) => (u.length <= max ? [u] : refine(split(u), rest, max)));
}

// 원문 순서를 지키며 단위를 목표 길이 근처로 모은다
function pack(units: string[], max: number): string[] {
  const total = units.reduce((n, u) => n + u.length, 0);
  const target = total / Math.ceil(total / max);
  const chunks: string[] = [];
  let current = "";
  for (const unit of units) {
    if (current && current.length + unit.length > max) {
      chunks.push(current);
      current = "";
    }
    current += unit;
    if (current.length >= target) {
      chunks.push(current);
      current = "";
    }
  }
  if (current) chunks.push(current);
  return chunks.map((c) => c.trim()).filter(Boolean);
}
