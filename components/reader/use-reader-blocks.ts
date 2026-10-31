"use client";

import { useEffect, useState } from "react";

import { getPendingPdf } from "@/components/reader/pdf-store";
import mockBlocks from "@/lib/mock/blocks.json";
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

async function loadBlocks(): Promise<Block[]> {
  // 처음 한 번만 읽으면 돼서 useSearchParams 대신 직접 읽는다 (페이지를 정적으로 유지).
  const sample = new URLSearchParams(window.location.search).get("sample");
  try {
    const file =
      sample && SAMPLE_NAME.test(sample)
        ? await loadSample(sample)
        : getPendingPdf();
    if (!file) throw new Error("PDF 없음");

    const blocks = await toBlocks(file);
    if (blocks.length === 0) throw new Error("블록 없음");
    return blocks;
  } catch {
    // TODO(demo): 데모 경로가 끊기지 않도록 실패하면 목업 블록을 보여준다.
    return mockBlocks;
  }
}

// ?sample= → 업로드한 파일 → 목업 순서로 블록을 정한다. 불러오는 중이면 null.
export function useReaderBlocks(): Block[] | null {
  const [blocks, setBlocks] = useState<Block[] | null>(null);

  useEffect(() => {
    let cancelled = false;
    loadBlocks().then((next) => {
      if (!cancelled) setBlocks(next);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  return blocks;
}
