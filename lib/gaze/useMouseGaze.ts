"use client";

import type { GazeEvents, GazeState } from "@/types";

// TODO(demo): 빈 구현. 마우스 추적 구현 전까지 초기 상태만 반환한다.
export function useMouseGaze(events: GazeEvents): GazeState {
  void events;
  return { point: null, activeBlockId: null, calibrated: false };
}
