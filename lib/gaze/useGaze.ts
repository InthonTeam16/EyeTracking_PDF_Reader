"use client";

import {
  useCallback,
  useEffect,
  useEffectEvent,
  useRef,
  useState,
} from "react";
import {
  GAZE_CALIBRATION_POINTS,
  GAZE_CORRECTION_CLICKS,
  GAZE_EYEBALL,
  GAZE_FEATURE_AVERAGE_FRAMES,
  GAZE_MAX_TRAINING_CLICKS,
  GAZE_MIN_TRAINING_CLICKS,
  GAZE_ONE_EURO,
  GAZE_PITCH_Y_PER_DEGREE,
  GAZE_POINT_UPDATE_MS,
  GAZE_RIDGE_LAMBDA,
  GAZE_SMOOTHING_SAMPLES,
  GAZE_TRACKER,
  GAZE_TRACKER_DEFER_LAG,
  GAZE_TRACKER_MARGIN,
  GAZE_YAW_X_PER_DEGREE,
  MIN_EYE_OPEN_RATIO,
  SQUINT,
} from "@/lib/gaze/config";
import { createBlockTracker, readBlockBoxes } from "@/lib/gaze/blockTracker";
import {
  extractGazeFeatures,
  eyeLookVertical,
  PITCH_FEATURE_INDEX,
  YAW_FEATURE_INDEX,
} from "@/lib/gaze/faceFeatures";
import { startFaceTracking } from "@/lib/gaze/faceTracking";
import { findBlockId } from "@/lib/gaze/findBlockId";
import { extractGeometricFeatures } from "@/lib/gaze/geometricGaze";
import { createOneEuroFilter } from "@/lib/gaze/oneEuro";
import { createSquintDetector } from "@/lib/gaze/squint";
import { PRETRAINED_SAMPLES } from "@/lib/gaze/pretrainedSamples";
import {
  computeOffset,
  type FixedInput,
  fitGazeModel,
  fitGazeModelWithFixedInputs,
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

// 고개를 들고 같은 점을 본 데이터로는 상하 각도의 영향이 학습되지 않아 값을 정해 둔다.
const FIXED_PITCH: FixedInput = {
  index: PITCH_FEATURE_INDEX,
  axis: "y",
  perUnit: GAZE_PITCH_Y_PER_DEGREE,
};
// 개인 보정은 한 자세로 하므로 좌우 각도의 영향도 배울 수 없다.
const FIXED_YAW: FixedInput = {
  index: YAW_FEATURE_INDEX,
  axis: "x",
  perUnit: GAZE_YAW_X_PER_DEGREE,
};

function fitModel(
  samples: GazeSample[],
  guided: boolean,
  geometric: boolean,
): GazeModel {
  // 기하 모델의 입력은 이미 자세가 반영된 화면 위 점이라 선형 변환만 배운다.
  if (geometric) return fitGazeModel(samples, GAZE_RIDGE_LAMBDA);
  return fitGazeModelWithFixedInputs(
    samples,
    GAZE_RIDGE_LAMBDA,
    guided ? [FIXED_PITCH, FIXED_YAW] : [FIXED_PITCH],
  );
}

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
// samples를 주면 저장된 데이터 대신 쓰고, 바뀌면 카메라를 끄지 않고 다시 학습한다.
// data-gaze-ignore 안의 클릭은 학습과 보정에 쓰지 않는다.
// guided면 data-gaze-target 점의 클릭으로 사람마다 보정하고, 그 뒤 클릭은 치우침 보정에만 쓴다.
// model이 "reading"이면 읽기 순서를 아는 블록 추적기로 블록을 정하고, 보정이 끝난 뒤에는
// 블록이나 보정 점을 누른 클릭만 치우침 보정에 쓴다 (버튼·메뉴 클릭은 그곳을 보고 있다는 보장이 약하다).
// "legacy"는 이동 평균 + 좌표 아래 블록인 이전 방식이다 (비교용).
// eyeLook은 실험용 세로 입력을 더한다. 저장된 데이터(samples)와 함께 쓰지 않는다.
// geometric이면 홍채 좌표 대신 기하 모델(lib/gaze/geometricGaze.ts)의 시선-화면 교점을 입력으로 쓴다.
// 입력 모양이 달라 저장된 데이터는 쓰지 않고 보정 점으로만 학습한다.
// defer면 블록 추적기가 관측 몇 개를 더 본 뒤 블록을 정한다 (lib/gaze/blockTracker.ts).
export type GazeModelKind = "reading" | "legacy";

export function useGaze(
  events: GazeEvents,
  {
    samples,
    guided = false,
    model = "reading",
    eyeLook = false,
    geometric = false,
    defer = false,
  }: {
    samples?: GazeSample[];
    guided?: boolean;
    model?: GazeModelKind;
    eyeLook?: boolean;
    geometric?: boolean;
    defer?: boolean;
  } = {},
): GazeState & { status: GazeStatus; recalibrate: () => void } {
  const baseSamples = samples ?? PRETRAINED_SAMPLES;
  const usesPretrained =
    !geometric && baseSamples.length >= GAZE_MIN_TRAINING_CLICKS;
  const [gaze, setGaze] = useState<FaceGaze>(NO_GAZE);
  const [trained, setTrained] = useState(false);
  const [status, setStatus] = useState<GazeStatus>({ phase: "loading" });
  const samplesRef = useRef<GazeSample[]>([]);
  const modelRef = useRef<GazeModel | null>(null);
  const usesPretrainedRef = useRef(usesPretrained);
  const offsetRef = useRef({ x: 0, y: 0 });

  useEffect(() => {
    usesPretrainedRef.current = usesPretrained;
    modelRef.current = usesPretrained
      ? fitModel(baseSamples, guided, geometric)
      : null;
    offsetRef.current = { x: 0, y: 0 };
    samplesRef.current = [];
  }, [baseSamples, usesPretrained, guided, geometric]);

  const recalibrate = useCallback(() => {
    samplesRef.current = [];
    modelRef.current = null;
    offsetRef.current = { x: 0, y: 0 };
    setTrained(false);
    setGaze(NO_GAZE);
    setStatus((current) =>
      current.phase === "tracking" ? { ...current, clicks: 0 } : current,
    );
  }, []);

  const handleSquint = useEffectEvent((blockId: string) => {
    events.onSquint?.(blockId);
  });

  useEffect(() => {
    let recentFeatures: number[][] = [];
    let faceVisible = false;
    const reading = model === "reading";
    const smoother = createPointSmoother(GAZE_SMOOTHING_SAMPLES);
    const filter = createOneEuroFilter(GAZE_ONE_EURO);
    // 관측 오차는 화면 비율로 정해 두고 시작할 때의 창 크기로 바꾼다.
    const tracker = createBlockTracker({
      ...GAZE_TRACKER,
      sigmaX: GAZE_TRACKER.sigmaX * window.innerWidth,
      sigmaY: GAZE_TRACKER.sigmaY * window.innerHeight,
      lag: defer ? GAZE_TRACKER_DEFER_LAG : GAZE_TRACKER.lag,
    });
    const squint = createSquintDetector(SQUINT);
    let activeBlockId: string | null = null;
    let lastPointUpdate = -Infinity;

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
      const calibrating =
        guided &&
        !usesPretrainedRef.current &&
        samplesRef.current.length < GAZE_CALIBRATION_POINTS.length;
      if (calibrating && !target.closest("[data-gaze-target]")) return;
      const wasCalibrated =
        guided && !usesPretrainedRef.current && !calibrating;
      const correcting =
        wasCalibrated || (usesPretrainedRef.current && modelRef.current);
      if (
        reading &&
        correcting &&
        !target.closest("[data-block-id], [data-gaze-target]")
      )
        return;
      samplesRef.current = [
        ...samplesRef.current,
        {
          features: averageFeatures(recentFeatures),
          // 창 크기가 달라도 쓸 수 있게 화면 비율로 저장한다.
          x: event.clientX / window.innerWidth,
          y: event.clientY / window.innerHeight,
        },
      ].slice(-GAZE_MAX_TRAINING_CLICKS);
      reportTracking();

      if (usesPretrainedRef.current && modelRef.current) {
        offsetRef.current = computeOffset(
          modelRef.current,
          samplesRef.current.slice(-GAZE_CORRECTION_CLICKS),
        );
        return;
      }
      if (wasCalibrated && modelRef.current) {
        offsetRef.current = computeOffset(
          modelRef.current,
          samplesRef.current
            .slice(GAZE_CALIBRATION_POINTS.length)
            .slice(-GAZE_CORRECTION_CLICKS),
        );
        return;
      }
      const minClicks = guided
        ? GAZE_CALIBRATION_POINTS.length
        : GAZE_MIN_TRAINING_CLICKS;
      if (samplesRef.current.length < minClicks) return;
      modelRef.current = fitModel(samplesRef.current, guided, geometric);
      setTrained(true);
    };

    const stop = startFaceTracking({
      previewClassName:
        "pointer-events-none fixed right-4 bottom-4 z-50 w-40 -scale-x-100 rounded-lg",
      onCamera: () => setStatus({ phase: "camera" }),
      onReady: () => {
        document.addEventListener("click", handleClick, true);
        reportTracking();
      },
      onFrame: (result, video) => {
        const [landmarks] = result.faceLandmarks;
        const [matrix] = result.facialTransformationMatrixes;
        const visible = Boolean(landmarks && matrix);
        if (visible !== faceVisible) {
          faceVisible = visible;
          reportTracking();
        }
        if (!landmarks || !matrix) {
          recentFeatures = [];
          smoother.reset();
          filter.reset();
          squint.reset();
          activeBlockId = null;
          setGaze(NO_GAZE);
          return;
        }

        const now = performance.now();
        const blendshapes = result.faceBlendshapes[0]?.categories ?? [];
        // 찡그리면 눈이 가늘어져 시선 입력이 없을 수 있어 먼저 본다.
        if (squint.add(blendshapes, now) && activeBlockId)
          handleSquint(activeBlockId);

        const base = extractGazeFeatures(
          landmarks,
          video.videoWidth,
          video.videoHeight,
          MIN_EYE_OPEN_RATIO,
          matrix.data,
        );
        // 눈을 깜빡이는 동안에는 직전 시선을 유지한다.
        if (!base) return;
        const gazeInput = geometric
          ? extractGeometricFeatures(
              landmarks,
              video.videoWidth,
              video.videoHeight,
              matrix.data,
              GAZE_EYEBALL,
            )
          : base;
        if (!gazeInput) return;
        const features = eyeLook
          ? [...gazeInput, eyeLookVertical(blendshapes)]
          : gazeInput;

        recentFeatures = [...recentFeatures, features].slice(
          -GAZE_FEATURE_AVERAGE_FRAMES,
        );
        if (!modelRef.current) return;

        const predicted = modelRef.current(features);
        const offset = offsetRef.current;
        const raw = {
          x: (predicted.x + offset.x) * window.innerWidth,
          y: (predicted.y + offset.y) * window.innerHeight,
        };
        if (!reading) {
          const point = clampToViewport(smoother.add(raw));
          activeBlockId = findBlockId(point.x, point.y);
          setGaze({ point, activeBlockId });
          return;
        }

        const point = clampToViewport(filter.add(raw, now));
        const next = tracker.add(point, now, () =>
          readBlockBoxes(GAZE_TRACKER_MARGIN),
        ).activeBlockId;
        // 매 프레임 다시 그리지 않도록 점은 가끔만, 블록이 바뀌면 바로 알린다.
        if (next === activeBlockId && now - lastPointUpdate < GAZE_POINT_UPDATE_MS)
          return;
        activeBlockId = next;
        lastPointUpdate = now;
        setGaze({ point, activeBlockId });
      },
      onError: (error) => {
        // TODO(demo): 실패 시 마우스 모드로 넘어가는 처리를 추가한다.
        console.warn("얼굴 시선 추적을 시작하지 못했습니다.", error);
        setStatus({ phase: "error", message: String(error) });
      },
    });

    return () => {
      stop();
      document.removeEventListener("click", handleClick, true);
    };
  }, [guided, model, eyeLook, geometric, defer]);

  useDwell(gaze.activeBlockId, events.onDwell);

  return {
    ...gaze,
    calibrated: usesPretrained || trained,
    status,
    recalibrate,
  };
}
