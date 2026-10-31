import type { Block } from "@/types";
import { MAX_BLOCK_CHARS, MIN_BLOCK_CHARS } from "./config";
import { splitToFit } from "./text";

// TXT 파일인지. 확장자가 없거나 브라우저가 형식을 모를 때도 있어 둘 다 본다.
export function isTextFile(file: File): boolean {
  return file.type === "text/plain" || /\.txt$/i.test(file.name);
}

// 한글 TXT는 UTF-8이 아니라 EUC-KR(윈도우 메모장 옛 형식)일 때가 많다.
// UTF-8로 읽다가 깨지면 EUC-KR로 다시 읽는다.
async function readText(file: File): Promise<string> {
  const bytes = await file.arrayBuffer();
  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  } catch {
    return new TextDecoder("euc-kr").decode(bytes);
  }
}

// "[페이지] 003", "쪽 12", "Page 3"처럼 줄 하나가 쪽 표시뿐이면 지운다.
// 한글(HWP) 문서를 TXT로 바꾸면 이런 줄이 본문 중간에 남는다. (segment.ts의 PAGE_LABEL과 같은 생각)
const PAGE_LABEL_LINE =
  /^[ \t]*[[(]?[ \t]*(페이지|쪽|page|p\.?)[ \t]*[\])]?[ \t]*[-–]?[ \t]*[A-Z]?\d+[ \t]*$/gim;

// 빈 줄이 있으면 빈 줄로 문단을 나누고 문단 안 줄은 띄어 잇는다.
// 빈 줄이 없는 글(한 줄이 한 문단)은 줄마다 문단으로 본다.
function toParagraphs(text: string): string[] {
  const normalized = text
    .replace(/^﻿/, "")
    .replace(/\r\n?/g, "\n")
    // 쪽 표시 줄은 빈 줄로 남기지 않고 통째로 지워 문단이 끊기지 않게 한다.
    .replace(new RegExp(`${PAGE_LABEL_LINE.source}\\n?`, "gim"), "");
  const hasBlankLines = /\n[ \t]*\n/.test(normalized);
  const parts = hasBlankLines
    ? normalized.split(/\n[ \t]*\n+/).map((p) => p.replace(/\s*\n\s*/g, " "))
    : normalized.split("\n");
  return parts.map((p) => p.replace(/[ \t]+/g, " ").trim()).filter(Boolean);
}

// PDF 블록과 같은 기준: 짧은 문단(제목 등)은 다음 문단 앞에 줄바꿈으로 붙이고,
// 긴 문단은 문장 경계에서 MAX_BLOCK_CHARS 이하로 나눈다.
function mergeShort(paragraphs: string[]): string[] {
  const result: string[] = [];
  let pending: string | null = null;
  for (const paragraph of paragraphs) {
    const merged: string = pending ? `${pending}\n${paragraph}` : paragraph;
    if (merged.length < MIN_BLOCK_CHARS) {
      pending = merged;
    } else {
      result.push(merged);
      pending = null;
    }
  }
  if (pending) {
    if (result.length > 0) result[result.length - 1] += `\n${pending}`;
    else result.push(pending);
  }
  return result;
}

// TXT에는 페이지가 없어서 모든 블록을 1페이지로 둔다.
export async function textToBlocks(file: File): Promise<Block[]> {
  const texts = mergeShort(toParagraphs(await readText(file))).flatMap((p) =>
    splitToFit(p, MAX_BLOCK_CHARS),
  );
  return texts.map((text, index) => ({
    id: `t-b${index}`,
    text,
    page: 1,
    order: index,
  }));
}
