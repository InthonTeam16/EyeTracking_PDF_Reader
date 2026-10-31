"use client";

import type { FaceLandmarker } from "@mediapipe/tasks-vision";
import {
  FACE_LANDMARKER_MODEL_PATH,
  TASKS_VISION_WASM_PATH,
} from "@/lib/gaze/config";

let loading: Promise<FaceLandmarker> | null = null;

async function createFaceLandmarker(): Promise<FaceLandmarker> {
  const { FaceLandmarker, FilesetResolver } = await import(
    "@mediapipe/tasks-vision"
  );
  const vision = await FilesetResolver.forVisionTasks(TASKS_VISION_WASM_PATH);
  return FaceLandmarker.createFromOptions(vision, {
    baseOptions: {
      modelAssetPath: FACE_LANDMARKER_MODEL_PATH,
      delegate: "GPU",
    },
    runningMode: "VIDEO",
    numFaces: 1,
  });
}

// 모델 로딩이 오래 걸려 한 번만 만들고 재사용한다.
export function loadFaceLandmarker(): Promise<FaceLandmarker> {
  loading ??= createFaceLandmarker().catch((error) => {
    loading = null;
    throw error;
  });
  return loading;
}
