"use client";

import type { GazeEvents, GazeState } from "@/types";

// TODO(demo): 빈 구현. WebGazer 연동 전까지 초기 상태만 반환한다.
export function useGaze(events: GazeEvents): GazeState {
  void events;
  return { point: null, activeBlockId: null, calibrated: false };
}
