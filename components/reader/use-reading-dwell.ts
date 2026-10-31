"use client";

import { useEffect, useEffectEvent } from "react";

import type { GazeEvents } from "@/types";

// 블록을 다 읽는 데 걸릴 시간보다 확실히 오래 머물 때만 "막혔다"고 보고 설명을 띄운다.
// 고정 1.5초(DWELL_MS)는 블록 하나를 읽는 시간(10초 이상)보다 훨씬 짧아 읽는 블록마다 설명이 떴다.
// TODO(demo): 값은 임시값. lib/gaze/config.ts는 시선 엔진 작업과 겹치지 않게 여기 둔다.
// 한국어 묵독 속도 (글자/초)
const READING_CHARS_PER_SECOND = 10;
// 예상 읽기 시간의 이 배수만큼 머물면 설명을 띄운다
const STUCK_FACTOR = 1.3;
const MIN_DWELL_MS = 4000;
const MAX_DWELL_MS = 40000;

export function readingDwellMs(text: string): number {
  const letters = text.replace(/\s/g, "").length;
  const expected = (letters / READING_CHARS_PER_SECOND) * 1000;
  return Math.min(
    Math.max(expected * STUCK_FACTOR, MIN_DWELL_MS),
    MAX_DWELL_MS,
  );
}

// 블록에 들어올 때마다 타이머를 새로 시작하고, 머무는 동안 한 번만 부른다.
export function useReadingDwell(
  activeBlockId: string | null,
  dwellMs: number,
  onDwell: GazeEvents["onDwell"],
) {
  const handleDwell = useEffectEvent((blockId: string) => {
    onDwell?.(blockId, dwellMs);
  });

  useEffect(() => {
    if (!activeBlockId) return;
    const timer = setTimeout(() => handleDwell(activeBlockId), dwellMs);
    return () => clearTimeout(timer);
  }, [activeBlockId, dwellMs]);
}
