"use client";

import { useEffect, useState } from "react";
import {
  GAZE_FEATURE_AVERAGE_FRAMES,
  GAZE_MAX_TRAINING_CLICKS,
  GAZE_MIN_TRAINING_CLICKS,
  GAZE_RIDGE_LAMBDA,
  GAZE_SMOOTHING_SAMPLES,
  MIN_EYE_OPEN_RATIO,
} from "@/lib/gaze/config";
import { extractGazeFeatures } from "@/lib/gaze/faceFeatures";
import { loadFaceLandmarker } from "@/lib/gaze/faceLandmarker";
import { findBlockId } from "@/lib/gaze/findBlockId";
import {
  fitGazeModel,
  type GazeModel,
  type GazeSample,
} from "@/lib/gaze/ridgeRegression";
import { createPointSmoother } from "@/lib/gaze/smoothing";
import { useDwell } from "@/lib/gaze/useDwell";
import type { GazeEvents, GazeState } from "@/types";

type FaceGaze = Pick<GazeState, "point" | "activeBlockId">;

const NO_GAZE: FaceGaze = { point: null, activeBlockId: null };

export type GazeStatus =
  | { phase: "loading" | "camera" }
  | { phase: "error"; message: string }
  | { phase: "tracking"; faceVisible: boolean; clicks: number };

function averageFeatures(frames: number[][]): number[] {
  return frames[0].map(
    (_, index) =>
      frames.reduce((sum, frame) => sum + frame[index], 0) / frames.length,
  );
}

// 학습이 부족하면 예측값이 화면 밖으로 나갈 수 있다.
function clampToViewport(point: { x: number; y: number }) {
  return {
    x: Math.min(Math.max(point.x, 0), window.innerWidth - 1),
    y: Math.min(Math.max(point.y, 0), window.innerHeight - 1),
  };
}

// GazeState에 진행 상태를 더해 반환한다. 리더는 status를 쓰지 않아도 된다.
export function useGaze(
  events: GazeEvents,
): GazeState & { status: GazeStatus } {
  const [gaze, setGaze] = useState<FaceGaze>(NO_GAZE);
  const [calibrated, setCalibrated] = useState(false);
  const [status, setStatus] = useState<GazeStatus>({ phase: "loading" });

  useEffect(() => {
    let cancelled = false;
    let animationFrame = 0;
    let stream: MediaStream | null = null;
    let video: HTMLVideoElement | null = null;
    let model: GazeModel | null = null;
    let recentFeatures: number[][] = [];
    let samples: GazeSample[] = [];
    let faceVisible = false;
    const smoother = createPointSmoother(GAZE_SMOOTHING_SAMPLES);

    const reportTracking = () => {
      setStatus({ phase: "tracking", faceVisible, clicks: samples.length });
    };

    // 클릭하는 순간 그 지점을 보고 있다고 가정하고 학습한다.
    const handleClick = (event: MouseEvent) => {
      if (recentFeatures.length === 0) return;
      samples = [
        ...samples,
        {
          features: averageFeatures(recentFeatures),
          x: event.clientX,
          y: event.clientY,
        },
      ].slice(-GAZE_MAX_TRAINING_CLICKS);
      reportTracking();
      if (samples.length < GAZE_MIN_TRAINING_CLICKS) return;
      model = fitGazeModel(samples, GAZE_RIDGE_LAMBDA);
      setCalibrated(true);
    };

    async function start() {
      const landmarker = await loadFaceLandmarker();
      if (cancelled) return;
      setStatus({ phase: "camera" });

      const userStream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "user", width: 640, height: 480 },
      });
      // 권한 팝업을 기다리는 사이 컴포넌트가 사라졌을 수 있다.
      if (cancelled) {
        userStream.getTracks().forEach((track) => track.stop());
        return;
      }
      stream = userStream;

      // TODO(demo): 캘리브레이션 구현 후 미리보기를 숨긴다.
      const element = document.createElement("video");
      element.muted = true;
      element.playsInline = true;
      element.srcObject = userStream;
      element.className =
        "pointer-events-none fixed right-4 bottom-4 z-50 w-40 -scale-x-100 rounded-lg";
      document.body.appendChild(element);
      video = element;
      await element.play();
      if (cancelled) return;

      document.addEventListener("click", handleClick, true);
      reportTracking();

      let lastVideoTime = -1;
      const tick = () => {
        animationFrame = requestAnimationFrame(tick);
        if (element.currentTime === lastVideoTime) return;
        lastVideoTime = element.currentTime;

        const [landmarks] = landmarker.detectForVideo(
          element,
          performance.now(),
        ).faceLandmarks;
        if (Boolean(landmarks) !== faceVisible) {
          faceVisible = Boolean(landmarks);
          reportTracking();
        }
        if (!landmarks) {
          recentFeatures = [];
          smoother.reset();
          setGaze(NO_GAZE);
          return;
        }

        const features = extractGazeFeatures(
          landmarks,
          element.videoWidth,
          element.videoHeight,
          MIN_EYE_OPEN_RATIO,
        );
        // 눈을 깜빡이는 동안에는 직전 시선을 유지한다.
        if (!features) return;

        recentFeatures = [...recentFeatures, features].slice(
          -GAZE_FEATURE_AVERAGE_FRAMES,
        );
        if (!model) return;

        const point = clampToViewport(smoother.add(model(features)));
        setGaze({ point, activeBlockId: findBlockId(point.x, point.y) });
      };
      animationFrame = requestAnimationFrame(tick);
    }

    start().catch((error) => {
      if (cancelled) return;
      // TODO(demo): 실패 시 마우스 모드로 넘어가는 처리를 추가한다.
      console.warn("얼굴 시선 추적을 시작하지 못했습니다.", error);
      setStatus({ phase: "error", message: String(error) });
    });

    return () => {
      cancelled = true;
      cancelAnimationFrame(animationFrame);
      document.removeEventListener("click", handleClick, true);
      stream?.getTracks().forEach((track) => track.stop());
      video?.remove();
    };
  }, []);

  useDwell(gaze.activeBlockId, events.onDwell);

  // TODO(demo): 찡그림 감지를 추가해 onSquint를 호출한다.
  return { ...gaze, calibrated, status };
}
