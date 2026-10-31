"use client";

import { useEffect, useState } from "react";
import { FACE_MESH_PATH } from "@/lib/gaze/config";
import { findBlockId } from "@/lib/gaze/findBlockId";
import { useDwell } from "@/lib/gaze/useDwell";
import type { GazeEvents, GazeState } from "@/types";

type WebcamGaze = Pick<GazeState, "point" | "activeBlockId">;

const NO_GAZE: WebcamGaze = { point: null, activeBlockId: null };

export function useGaze(events: GazeEvents): GazeState {
  const [gaze, setGaze] = useState<WebcamGaze>(NO_GAZE);

  useEffect(() => {
    let cancelled = false;
    let stop: (() => void) | null = null;

    async function start() {
      // 소스 진입점은 @mediapipe/face_mesh를 번들링하지 못해 사전 빌드본을 쓴다.
      const { webgazer } = await import("webgazer/dist/webgazer.commonjs2.js");
      // Strict Mode의 첫 번째 실행은 여기서 멈춰 begin()이 두 번 호출되지 않는다.
      if (cancelled) return;

      webgazer.params.faceMeshSolutionPath = FACE_MESH_PATH;
      webgazer.saveDataAcrossSessions(false);
      webgazer.showPredictionPoints(false);
      webgazer.setGazeListener((data) => {
        if (!data) {
          setGaze(NO_GAZE);
          return;
        }
        const point = { x: Math.round(data.x), y: Math.round(data.y) };
        setGaze({ point, activeBlockId: findBlockId(point.x, point.y) });
      });

      try {
        await webgazer.begin();
      } catch (error) {
        webgazer.clearGazeListener();
        throw error;
      }

      // end()는 웹캠과 마우스 리스너를 정리하지 않아서 따로 해제한다.
      stop = () => {
        webgazer.clearGazeListener();
        webgazer.removeMouseEventListeners();
        webgazer.stopVideo();
        webgazer.end();
      };
      // 권한 팝업을 기다리는 사이 컴포넌트가 사라졌을 수 있다.
      if (cancelled) stop();
    }

    start().catch((error) => {
      // TODO(demo): 실패 시 마우스 모드로 넘어가는 처리를 추가한다.
      console.warn("웹캠 시선 추적을 시작하지 못했습니다.", error);
    });

    return () => {
      cancelled = true;
      stop?.();
    };
  }, []);

  useDwell(gaze.activeBlockId, events.onDwell);

  // TODO(demo): 캘리브레이션 구현 후 실제 상태를 반환한다.
  return { ...gaze, calibrated: false };
}
