"use client";

import { useEffect, useState } from "react";

import { getPendingPdf } from "@/components/reader/pdf-store";
import mockBlocks from "@/lib/mock/blocks.json";
import { isTextFile, textToBlocks } from "@/lib/pdf/textToBlocks";
import { toBlocks } from "@/lib/pdf/toBlocks";
import type { Block } from "@/types";

// 임의 경로를 fetch하지 못하게 public/samples/ 안의 파일 이름만 받는다.
const SAMPLE_NAME = /^[\w-]+$/;

async function loadSample(name: string): Promise<File> {
  const res = await fetch(`/samples/${name}.pdf`);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const blob = await res.blob();
  return new File([blob], `${name}.pdf`, { type: "application/pdf" });
}

// pdf만 원본 보기가 있고, 원본 PDF 화면에 쓰려고 그 파일(pdf)도 함께 돌려준다.
// text(TXT)와 sample(목업)은 페이지가 없어 집중 읽기만 쓴다.
export type ReaderDocument = {
  kind: "pdf" | "text" | "sample";
  title: string;
  blocks: Block[];
  pdf: File | null;
};

// 사용자가 올린 파일을 열지 못했을 때 보여줄 안내
export type ReaderFailure = { kind: "error"; message: string };

const NO_FILE_MESSAGE =
  "열려 있는 파일이 없어요. 새로고침하면 올린 파일이 사라지니 다시 열어 주세요.";

async function fileToDocument(file: File): Promise<ReaderDocument | null> {
  const text = isTextFile(file);
  const blocks = text ? await textToBlocks(file) : await toBlocks(file);
  if (blocks.length === 0) return null;
  return text
    ? { kind: "text", title: file.name, blocks, pdf: null }
    : { kind: "pdf", title: file.name, blocks, pdf: file };
}

function describeFailure(error: unknown): string {
  if (error instanceof Error && error.name === "PasswordException")
    return "암호가 걸린 PDF는 열 수 없어요. 암호를 푼 파일을 올려 주세요.";
  return "이 파일을 읽지 못했어요. 파일이 손상되지 않았는지 확인해 주세요.";
}

async function loadSampleDocument(name: string): Promise<ReaderDocument> {
  try {
    const doc = await fileToDocument(await loadSample(name));
    if (doc) return doc;
    throw new Error("블록 없음");
  } catch (error) {
    // TODO(demo): 체험하기가 끊기지 않도록 샘플을 못 불러오면 목업 블록을 보여준다.
    console.warn("샘플 PDF를 열지 못해 목업 문서를 보여줍니다.", error);
    return {
      kind: "sample",
      title: "샘플 문서",
      blocks: mockBlocks,
      pdf: null,
    };
  }
}

async function loadDocument(): Promise<ReaderDocument | ReaderFailure> {
  // 처음 한 번만 읽으면 돼서 useSearchParams 대신 직접 읽는다 (페이지를 정적으로 유지).
  const sample = new URLSearchParams(window.location.search).get("sample");
  if (sample && SAMPLE_NAME.test(sample)) return loadSampleDocument(sample);

  const file = getPendingPdf();
  if (!file) return { kind: "error", message: NO_FILE_MESSAGE };
  try {
    const doc = await fileToDocument(file);
    if (doc) return doc;
    // 스캔한 PDF나 빈 TXT처럼 읽을 글자가 없는 파일이다.
    return {
      kind: "error",
      message:
        "이 파일에서 글자를 찾지 못했어요. 스캔한 PDF는 아직 읽을 수 없어요.",
    };
  } catch (error) {
    console.warn("올린 파일을 열지 못했습니다.", error);
    return { kind: "error", message: describeFailure(error) };
  }
}

// ?sample= → 업로드한 파일 순서로 문서를 정한다. 불러오는 중이면 null.
export function useReaderBlocks(): ReaderDocument | ReaderFailure | null {
  const [doc, setDoc] = useState<ReaderDocument | ReaderFailure | null>(null);

  useEffect(() => {
    let cancelled = false;
    loadDocument().then((next) => {
      if (!cancelled) setDoc(next);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  return doc;
}
