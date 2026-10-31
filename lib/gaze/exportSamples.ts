import {
  GAZE_DATASET_FOLDS,
  GAZE_MIN_DATASET_SAMPLES,
  GAZE_OUTLIER_SIGMA,
  GAZE_RIDGE_LAMBDA,
} from "@/lib/gaze/config";
import { cleanDataset, type GazeSample } from "@/lib/gaze/ridgeRegression";

// 이상치를 뺀 샘플을 pretrainedSamples.json으로 내려받고 결과 문구를 돌려준다.
export function exportSamples(samples: GazeSample[]): string {
  const dataset = cleanDataset(
    samples,
    GAZE_RIDGE_LAMBDA,
    GAZE_DATASET_FOLDS,
    GAZE_OUTLIER_SIGMA,
    GAZE_MIN_DATASET_SAMPLES,
  );
  const round = (value: number) => Number(value.toFixed(5));
  const rounded = dataset.samples.map((sample) => ({
    features: sample.features.map(round),
    x: round(sample.x),
    y: round(sample.y),
  }));

  const link = document.createElement("a");
  link.href = URL.createObjectURL(
    new Blob([JSON.stringify(rounded)], { type: "application/json" }),
  );
  link.download = "pretrainedSamples.json";
  link.click();
  URL.revokeObjectURL(link.href);

  const error = dataset.error
    ? `처음 보는 자세의 평균 오차는 가로 ${(dataset.error.x * 100).toFixed(1)}%, 세로 ${(dataset.error.y * 100).toFixed(1)}%입니다.`
    : `${GAZE_MIN_DATASET_SAMPLES}개 미만이라 이상치 제거와 오차 측정을 건너뛰었습니다.`;
  return `${rounded.length}개를 내보냈습니다 (이상치 ${dataset.removed}개 제외). ${error} lib/gaze/pretrainedSamples.json에 덮어쓰세요.`;
}
