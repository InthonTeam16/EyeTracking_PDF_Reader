import {
  GAZE_DATASET_FOLDS,
  GAZE_MIN_DATASET_SAMPLES,
  GAZE_RIDGE_LAMBDA,
} from "@/lib/gaze/config";
import {
  HEAD_FEATURE_INDICES,
  IRIS_FEATURE_INDICES,
} from "@/lib/gaze/faceFeatures";
import {
  type AxisError,
  baselineError,
  blockHoldoutError,
  evaluateModel,
  fitGazeModel,
  type GazeSample,
  pickFeatures,
} from "@/lib/gaze/ridgeRegression";

export type DatasetStats = {
  baseline: AxisError;
  all: AxisError | null;
  irisOnly: AxisError | null;
  headOnly: AxisError | null;
};

export function computeDatasetStats(samples: GazeSample[]): DatasetStats {
  const holdout = (data: GazeSample[]) =>
    samples.length < GAZE_MIN_DATASET_SAMPLES
      ? null
      : blockHoldoutError(data, GAZE_RIDGE_LAMBDA, GAZE_DATASET_FOLDS);

  return {
    baseline: baselineError(samples),
    all: holdout(samples),
    irisOnly: holdout(pickFeatures(samples, IRIS_FEATURE_INDICES)),
    headOnly: holdout(pickFeatures(samples, HEAD_FEATURE_INDICES)),
  };
}

// 다른 세트로만 학습한 모델이 이 세트를 얼마나 맞히는지 잰다.
export function crossSetError(
  samples: GazeSample[],
  others: GazeSample[],
): AxisError | null {
  if (others.length < GAZE_MIN_DATASET_SAMPLES || samples.length === 0) {
    return null;
  }
  return evaluateModel(fitGazeModel(others, GAZE_RIDGE_LAMBDA), samples);
}

const total = (error: AxisError) => error.x + error.y;

// TODO(demo): 판정 기준은 임시값. 실제 비교 결과를 보고 조정한다.
const LEARNED_RATIO = 0.8;

export function judgeDataset(stats: DatasetStats): string {
  if (!stats.all || !stats.irisOnly || !stats.headOnly) return "샘플 부족";
  if (total(stats.all) >= total(stats.baseline) * LEARNED_RATIO) {
    return "학습 안 됨";
  }
  if (total(stats.headOnly) <= total(stats.irisOnly)) return "머리 의존";
  // 위아래로 읽을 때는 세로로 블록을 구분하므로 따로 본다.
  if (stats.all.y >= stats.baseline.y * LEARNED_RATIO) return "세로 약함";
  return "양호";
}
