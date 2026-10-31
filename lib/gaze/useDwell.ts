"use client";

import { useEffect, useEffectEvent } from "react";
import { DWELL_MS } from "@/lib/gaze/config";
import type { GazeEvents } from "@/types";

// 블록에 들어올 때마다 타이머를 새로 시작하고, 머무는 동안 한 번만 호출한다.
export function useDwell(
  activeBlockId: string | null,
  onDwell: GazeEvents["onDwell"],
) {
  const handleDwell = useEffectEvent((blockId: string) => {
    onDwell?.(blockId, DWELL_MS);
  });

  useEffect(() => {
    if (!activeBlockId) return;
    const timer = setTimeout(() => handleDwell(activeBlockId), DWELL_MS);
    return () => clearTimeout(timer);
  }, [activeBlockId]);
}
