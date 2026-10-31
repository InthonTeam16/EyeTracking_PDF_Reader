"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  GAZE_DATASET_FOLDS,
  GAZE_MIN_DATASET_SAMPLES,
  GAZE_OUTLIER_SIGMA,
  GAZE_RIDGE_LAMBDA,
} from "@/lib/gaze/config";
import { PRETRAINED_SAMPLES } from "@/lib/gaze/pretrainedSamples";
import { cleanDataset, type GazeSample } from "@/lib/gaze/ridgeRegression";
import { useGaze } from "@/lib/gaze/useGaze";

// 짝수 열이라 화면 가운데가 비어 안내 문구를 둘 수 있다.
const COLUMNS = 8;
const ROWS = 5;
const MARGIN_PERCENT = 4;
const DOT_COUNT = COLUMNS * ROWS;
// DOT_COUNT와 서로소라 모든 점을 한 번씩 지나며, 멀리 떨어진 점으로 건너뛴다.
const ORDER_STEP = 17;

function dotPosition(clicks: number) {
  const index = (clicks * ORDER_STEP) % DOT_COUNT;
  const span = 100 - MARGIN_PERCENT * 2;
  return {
    left: `${MARGIN_PERCENT + (span * (index % COLUMNS)) / (COLUMNS - 1)}%`,
    top: `${MARGIN_PERCENT + (span * Math.floor(index / COLUMNS)) / (ROWS - 1)}%`,
  };
}

// 기존 데이터에 이번 샘플을 더해 내려받고 결과 문구를 돌려준다.
function exportDataset(session: GazeSample[]): string {
  const dataset = cleanDataset(
    [...PRETRAINED_SAMPLES, ...session],
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

// TODO(demo): 학습 데이터 수집용 임시 페이지. 데이터를 다 모으면 지운다.
export default function GazeCollectPage() {
  const gaze = useGaze({}, { collect: true });
  const [exportResult, setExportResult] = useState<string | null>(null);
  const { status } = gaze;
  const tracking = status.phase === "tracking";
  const clicks = tracking ? status.clicks : 0;

  const message = (() => {
    switch (status.phase) {
      case "loading":
        return "모델을 불러오는 중";
      case "camera":
        return "카메라 권한을 허용해 주세요";
      case "error":
        return `시작 실패: ${status.message}`;
      case "tracking":
        return status.faceVisible
          ? `${(clicks % DOT_COUNT) + 1}/${DOT_COUNT}번째 점 · ${Math.floor(clicks / DOT_COUNT) + 1}회차`
          : "얼굴이 보이지 않아 기록되지 않습니다";
    }
  })();

  return (
    <div className="fixed inset-0 z-40 bg-background">
      {/* 개발 모드 배지가 왼쪽 아래 점을 가려 이 페이지에서만 숨긴다. */}
      <style>{"nextjs-portal { display: none; }"}</style>
      {tracking && !exportResult && (
        <button
          type="button"
          data-gaze-target
          aria-label="시선 학습 점"
          className="fixed z-60 size-6 -translate-x-1/2 -translate-y-1/2 cursor-pointer rounded-full bg-primary ring-4 ring-primary/30"
          style={dotPosition(clicks)}
        />
      )}

      <div
        className={
          exportResult
            ? "fixed top-1/2 left-1/2 flex w-96 -translate-x-1/2 -translate-y-1/2 flex-col gap-3 text-center text-sm"
            : "fixed top-1/2 left-1/2 mt-2 flex w-32 -translate-x-1/2 flex-col items-center gap-2 text-center text-xs text-muted-foreground"
        }
      >
        {exportResult ? (
          <>
            <p data-testid="export-result">{exportResult}</p>
            <Button variant="outline" onClick={() => setExportResult(null)}>
              계속 수집
            </Button>
          </>
        ) : (
          <>
            <p data-testid="collect-status">{message}</p>
            <p data-testid="collect-count">
              이번 {clicks}개 · 저장된 {PRETRAINED_SAMPLES.length}개
            </p>
            <Button
              size="sm"
              variant="outline"
              data-testid="export-dataset"
              onClick={() => setExportResult(exportDataset(gaze.getSamples()))}
            >
              내보내기
            </Button>
          </>
        )}
      </div>
    </div>
  );
}
