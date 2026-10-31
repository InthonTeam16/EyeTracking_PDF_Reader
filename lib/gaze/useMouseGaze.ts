"use client";

import { useEffect, useState } from "react";
import { findBlockId } from "@/lib/gaze/findBlockId";
import { useDwell } from "@/lib/gaze/useDwell";
import type { GazeEvents, GazeState } from "@/types";

type MouseGaze = Pick<GazeState, "point" | "activeBlockId">;

const OUTSIDE: MouseGaze = { point: null, activeBlockId: null };

// 찡그림은 마우스로 흉내 낼 수 없어 onSquint는 호출하지 않는다.
export function useMouseGaze(events: GazeEvents): GazeState {
  const [gaze, setGaze] = useState<MouseGaze>(OUTSIDE);

  useEffect(() => {
    let point: GazeState["point"] = null;

    const update = () => {
      setGaze(
        point
          ? { point, activeBlockId: findBlockId(point.x, point.y) }
          : OUTSIDE,
      );
    };
    const handleMouseMove = (event: MouseEvent) => {
      point = { x: event.clientX, y: event.clientY };
      update();
    };
    const handleMouseLeave = () => {
      point = null;
      update();
    };

    window.addEventListener("mousemove", handleMouseMove);
    // 커서가 멈춰 있어도 스크롤하면 아래 블록이 바뀐다.
    window.addEventListener("scroll", update, { capture: true, passive: true });
    document.documentElement.addEventListener("mouseleave", handleMouseLeave);

    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("scroll", update, { capture: true });
      document.documentElement.removeEventListener(
        "mouseleave",
        handleMouseLeave,
      );
    };
  }, []);

  useDwell(gaze.activeBlockId, events.onDwell);

  return { ...gaze, calibrated: true };
}
