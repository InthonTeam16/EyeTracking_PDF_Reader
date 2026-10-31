import type { FaceLandmarkerResult } from "@mediapipe/tasks-vision";
import { MIN_EYE_OPEN_RATIO } from "@/lib/gaze/config";
import { extractGazeFeatures } from "@/lib/gaze/faceFeatures";
import type { GazeSample } from "@/lib/gaze/ridgeRegression";

// 입력값을 바꿔도 다시 모으지 않도록 계산 전 값을 그대로 저장한다.
export type RawFrame = {
  // 랜드마크 478개의 x, y, z를 이어 붙인 값
  landmarks: number[];
  // 열 우선 4x4 얼굴 변환 행렬
  matrix: number[];
  // blendshapeNames와 같은 순서
  blendshapes: number[];
};

export type RawGazeSample = RawFrame & {
  x: number;
  y: number;
  viewportWidth: number;
  viewportHeight: number;
  condition: string;
  time: number;
};

export type RawGazeSession = {
  version: 2;
  person: string;
  video: { width: number; height: number };
  screen: { width: number; height: number; pixelRatio: number };
  blendshapeNames: string[];
  samples: RawGazeSample[];
};

export function sortedBlendshapes(result: FaceLandmarkerResult) {
  return [...(result.faceBlendshapes[0]?.categories ?? [])].sort(
    (a, b) => a.index - b.index,
  );
}

export function frameFromResult(result: FaceLandmarkerResult): RawFrame | null {
  const landmarks = result.faceLandmarks[0];
  const matrix = result.facialTransformationMatrixes[0];
  if (!landmarks || !matrix) return null;
  return {
    landmarks: landmarks.flatMap((point) => [point.x, point.y, point.z]),
    matrix: [...matrix.data],
    blendshapes: sortedBlendshapes(result).map((category) => category.score),
  };
}

const round = (value: number) => Number(value.toFixed(5));

function averageValues(rows: number[][]): number[] {
  return rows[0].map((_, index) =>
    round(rows.reduce((sum, row) => sum + row[index], 0) / rows.length),
  );
}

export function averageFrames(frames: RawFrame[]): RawFrame {
  return {
    landmarks: averageValues(frames.map((frame) => frame.landmarks)),
    matrix: averageValues(frames.map((frame) => frame.matrix)),
    blendshapes: averageValues(frames.map((frame) => frame.blendshapes)),
  };
}

export function landmarksFromFrame(frame: RawFrame) {
  return Array.from({ length: frame.landmarks.length / 3 }, (_, index) => ({
    x: frame.landmarks[index * 3],
    y: frame.landmarks[index * 3 + 1],
  }));
}

export function isRawGazeSession(data: unknown): data is RawGazeSession {
  return (
    typeof data === "object" &&
    data !== null &&
    "version" in data &&
    data.version === 2
  );
}

// 원본 값을 회귀 모델의 입력값으로 바꾼다.
export function rawSessionToSamples(session: RawGazeSession): GazeSample[] {
  return session.samples.flatMap((sample) => {
    const features = extractGazeFeatures(
      landmarksFromFrame(sample),
      session.video.width,
      session.video.height,
      MIN_EYE_OPEN_RATIO,
      sample.matrix,
    );
    return features ? [{ features, x: sample.x, y: sample.y }] : [];
  });
}

export function downloadRawSession(session: RawGazeSession) {
  const link = document.createElement("a");
  link.href = URL.createObjectURL(
    new Blob([JSON.stringify(session)], { type: "application/json" }),
  );
  link.download = `gazeRaw-${session.person || "unknown"}-${session.samples[0]?.time ?? 0}.json`;
  link.click();
  URL.revokeObjectURL(link.href);
}
