"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  GAZE_CORRECTION_CLICKS,
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
import { PRETRAINED_SAMPLES } from "@/lib/gaze/pretrainedSamples";
import {
  computeOffset,
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
  | {
      phase: "tracking";
      faceVisible: boolean;
      clicks: number;
      usesPretrained: boolean;
    };

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
// 저장된 데이터가 있으면 바로 시선을 내고 클릭은 치우침 보정에만 쓴다.
// collect는 저장된 데이터 없이 data-gaze-target 요소의 클릭만 샘플로 모은다.
// samples를 주면 저장된 데이터 대신 쓰고, 바뀌면 카메라를 끄지 않고 다시 학습한다.
// data-gaze-ignore 안의 클릭은 학습과 보정에 쓰지 않는다.
export function useGaze(
  events: GazeEvents,
  {
    collect = false,
    samples,
  }: { collect?: boolean; samples?: GazeSample[] } = {},
): GazeState & { status: GazeStatus; getSamples: () => GazeSample[] } {
  const baseSamples = collect ? null : (samples ?? PRETRAINED_SAMPLES);
  const usesPretrained =
    baseSamples !== null && baseSamples.length >= GAZE_MIN_TRAINING_CLICKS;
  const [gaze, setGaze] = useState<FaceGaze>(NO_GAZE);
  const [trained, setTrained] = useState(false);
  const [status, setStatus] = useState<GazeStatus>({ phase: "loading" });
  const samplesRef = useRef<GazeSample[]>([]);
  const getSamples = useCallback(() => samplesRef.current, []);
  const modelRef = useRef<GazeModel | null>(null);
  const usesPretrainedRef = useRef(usesPretrained);
  const offsetRef = useRef({ x: 0, y: 0 });

  useEffect(() => {
    usesPretrainedRef.current = usesPretrained;
    modelRef.current =
      baseSamples && usesPretrained
        ? fitGazeModel(baseSamples, GAZE_RIDGE_LAMBDA)
        : null;
    offsetRef.current = { x: 0, y: 0 };
    samplesRef.current = [];
  }, [baseSamples, usesPretrained]);

  useEffect(() => {
    let cancelled = false;
    let animationFrame = 0;
    let stream: MediaStream | null = null;
    let video: HTMLVideoElement | null = null;
    let recentFeatures: number[][] = [];
    let faceVisible = false;
    const smoother = createPointSmoother(GAZE_SMOOTHING_SAMPLES);

    const reportTracking = () => {
      setStatus({
        phase: "tracking",
        faceVisible,
        clicks: samplesRef.current.length,
        usesPretrained: usesPretrainedRef.current,
      });
    };

    // 클릭하는 순간 그 지점을 보고 있다고 가정하고 학습한다.
    const handleClick = (event: MouseEvent) => {
      if (recentFeatures.length === 0) return;
      const target = event.target as Element;
      if (target.closest("[data-gaze-ignore]")) return;
      if (collect && !target.closest("[data-gaze-target]")) return;
      const nextSamples = [
        ...samplesRef.current,
        {
          features: averageFeatures(recentFeatures),
          // 창 크기가 달라도 쓸 수 있게 화면 비율로 저장한다.
          x: event.clientX / window.innerWidth,
          y: event.clientY / window.innerHeight,
        },
      ];
      samplesRef.current = collect
        ? nextSamples
        : nextSamples.slice(-GAZE_MAX_TRAINING_CLICKS);
      reportTracking();

      if (usesPretrainedRef.current && modelRef.current) {
        offsetRef.current = computeOffset(
          modelRef.current,
          samplesRef.current.slice(-GAZE_CORRECTION_CLICKS),
        );
        return;
      }
      if (samplesRef.current.length < GAZE_MIN_TRAINING_CLICKS) return;
      modelRef.current = fitGazeModel(samplesRef.current, GAZE_RIDGE_LAMBDA);
      setTrained(true);
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
      // 수집 때는 점이 지나지 않는 화면 가운데에 둔다.
      element.className = collect
        ? "pointer-events-none fixed top-1/2 left-1/2 z-50 w-32 -translate-x-1/2 -translate-y-full -scale-x-100 rounded-lg"
        : "pointer-events-none fixed right-4 bottom-4 z-50 w-40 -scale-x-100 rounded-lg";
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
        if (!modelRef.current) return;

        const predicted = modelRef.current(features);
        const offset = offsetRef.current;
        const point = clampToViewport(
          smoother.add({
            x: (predicted.x + offset.x) * window.innerWidth,
            y: (predicted.y + offset.y) * window.innerHeight,
          }),
        );
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
  }, [collect]);

  useDwell(gaze.activeBlockId, events.onDwell);

  // TODO(demo): 찡그림 감지를 추가해 onSquint를 호출한다.
  return {
    ...gaze,
    calibrated: usesPretrained || trained,
    status,
    getSamples,
  };
}
