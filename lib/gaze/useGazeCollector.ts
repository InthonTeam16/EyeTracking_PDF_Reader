"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  GAZE_FEATURE_AVERAGE_FRAMES,
  MIN_EYE_OPEN_RATIO,
} from "@/lib/gaze/config";
import { extractGazeFeatures } from "@/lib/gaze/faceFeatures";
import { startFaceTracking } from "@/lib/gaze/faceTracking";
import { type HeadPose, headPoseFromMatrix } from "@/lib/gaze/headPose";
import {
  averageFrames,
  frameFromResult,
  landmarksFromFrame,
  type RawFrame,
  type RawGazeSample,
  type RawGazeSession,
  sortedBlendshapes,
} from "@/lib/gaze/rawSamples";

const POSE_REPORT_MS = 200;

export type CollectorStatus =
  | { phase: "loading" | "camera" }
  | { phase: "error"; message: string }
  | { phase: "tracking"; faceVisible: boolean };

// data-gaze-target 클릭마다 얼굴 원본 값을 현재 조건과 함께 모은다.
export function useGazeCollector(condition: string) {
  const [status, setStatus] = useState<CollectorStatus>({ phase: "loading" });
  const [pose, setPose] = useState<HeadPose | null>(null);
  const [samples, setSamples] = useState<RawGazeSample[]>([]);
  const conditionRef = useRef(condition);
  const videoSizeRef = useRef({ width: 0, height: 0 });
  const blendshapeNamesRef = useRef<string[]>([]);

  useEffect(() => {
    conditionRef.current = condition;
  }, [condition]);

  useEffect(() => {
    let recentFrames: RawFrame[] = [];
    let faceVisible = false;
    let lastPoseReport = 0;

    // 클릭하는 순간 그 지점을 보고 있다고 가정한다.
    const handleClick = (event: MouseEvent) => {
      if (recentFrames.length === 0) return;
      if (!(event.target as Element).closest("[data-gaze-target]")) return;
      const sample: RawGazeSample = {
        ...averageFrames(recentFrames),
        // 창 크기가 달라도 쓸 수 있게 화면 비율로 저장한다.
        x: event.clientX / window.innerWidth,
        y: event.clientY / window.innerHeight,
        viewportWidth: window.innerWidth,
        viewportHeight: window.innerHeight,
        condition: conditionRef.current,
        time: Date.now(),
      };
      setSamples((current) => [...current, sample]);
    };

    const stop = startFaceTracking({
      // 점이 지나지 않는 화면 가운데에 둔다.
      previewClassName:
        "pointer-events-none fixed top-1/2 left-1/2 z-50 w-32 -translate-x-1/2 -translate-y-full -scale-x-100 rounded-lg",
      onCamera: () => setStatus({ phase: "camera" }),
      onReady: () => {
        document.addEventListener("click", handleClick, true);
        setStatus({ phase: "tracking", faceVisible });
      },
      onFrame: (result, video) => {
        const frame = frameFromResult(result);
        if (Boolean(frame) !== faceVisible) {
          faceVisible = Boolean(frame);
          setStatus({ phase: "tracking", faceVisible });
        }
        if (!frame) {
          recentFrames = [];
          setPose(null);
          return;
        }

        videoSizeRef.current = {
          width: video.videoWidth,
          height: video.videoHeight,
        };
        blendshapeNamesRef.current = sortedBlendshapes(result).map(
          (category) => category.categoryName,
        );
        const now = performance.now();
        if (now - lastPoseReport >= POSE_REPORT_MS) {
          lastPoseReport = now;
          setPose(headPoseFromMatrix(frame.matrix));
        }

        // 눈을 깜빡이는 프레임은 시선을 알 수 없어 뺀다.
        const eyesOpen = extractGazeFeatures(
          landmarksFromFrame(frame),
          video.videoWidth,
          video.videoHeight,
          MIN_EYE_OPEN_RATIO,
        );
        if (!eyesOpen) return;
        recentFrames = [...recentFrames, frame].slice(
          -GAZE_FEATURE_AVERAGE_FRAMES,
        );
      },
      onError: (error) => {
        console.warn("얼굴 인식을 시작하지 못했습니다.", error);
        setStatus({ phase: "error", message: String(error) });
      },
    });

    return () => {
      stop();
      document.removeEventListener("click", handleClick, true);
    };
  }, []);

  const discard = useCallback((target: string) => {
    setSamples((current) =>
      current.filter((sample) => sample.condition !== target),
    );
  }, []);

  const buildSession = useCallback(
    (person: string): RawGazeSession => ({
      version: 2,
      person,
      video: videoSizeRef.current,
      screen: {
        width: window.screen.width,
        height: window.screen.height,
        pixelRatio: window.devicePixelRatio,
      },
      blendshapeNames: blendshapeNamesRef.current,
      samples,
    }),
    [samples],
  );

  return { status, pose, samples, discard, buildSession };
}
