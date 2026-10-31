"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { GAZE_HEAD_FOLLOW_CORRELATION } from "@/lib/gaze/config";
import { correlation, headPoseFromMatrix } from "@/lib/gaze/headPose";
import { downloadRawSession, type RawGazeSample } from "@/lib/gaze/rawSamples";
import { useGazeCollector } from "@/lib/gaze/useGazeCollector";

// 짝수 열이라 화면 가운데가 비어 안내 문구를 둘 수 있다.
const COLUMNS = 6;
const ROWS = 5;
const MARGIN_PERCENT = 4;
const DOT_COUNT = COLUMNS * ROWS;
// DOT_COUNT와 서로소라 모든 점을 한 번씩 지나며, 멀리 떨어진 점으로 건너뛴다.
const ORDER_STEP = 17;
const MIN_SAMPLES_FOR_WARNING = 10;

// 고개와 시선이 함께 움직이지 않도록 자세를 고정한 채 눈만 움직여 모은다.
const CONDITIONS = [
  { id: "front", guide: "평소처럼 앉아 고개를 고정하고 눈만 움직이세요." },
  { id: "yaw-left", guide: "고개를 왼쪽으로 15도쯤 돌린 채 눈만 움직이세요." },
  {
    id: "yaw-right",
    guide: "고개를 오른쪽으로 15도쯤 돌린 채 눈만 움직이세요.",
  },
  { id: "pitch-up", guide: "턱을 살짝 든 채 눈만 움직이세요." },
  { id: "pitch-down", guide: "턱을 살짝 내린 채 눈만 움직이세요." },
  { id: "near", guide: "평소보다 화면에 가까이 앉아 눈만 움직이세요." },
  { id: "far", guide: "평소보다 뒤로 물러나 앉아 눈만 움직이세요." },
  { id: "side", guide: "의자를 옆으로 옮겨 앉아 눈만 움직이세요." },
  {
    id: "free",
    guide: "글을 읽을 때처럼 고개도 자연스럽게 움직이세요.",
    headMoves: true,
  },
];

function dotPosition(clicks: number) {
  const index = (clicks * ORDER_STEP) % DOT_COUNT;
  const span = 100 - MARGIN_PERCENT * 2;
  return {
    left: `${MARGIN_PERCENT + (span * (index % COLUMNS)) / (COLUMNS - 1)}%`,
    top: `${MARGIN_PERCENT + (span * Math.floor(index / COLUMNS)) / (ROWS - 1)}%`,
  };
}

function headFollowsDots(samples: RawGazeSample[]): boolean {
  if (samples.length < MIN_SAMPLES_FOR_WARNING) return false;
  const poses = samples.map((sample) => headPoseFromMatrix(sample.matrix));
  return (
    Math.abs(
      correlation(
        poses.map((pose) => pose.yaw),
        samples.map((sample) => sample.x),
      ),
    ) >= GAZE_HEAD_FOLLOW_CORRELATION ||
    Math.abs(
      correlation(
        poses.map((pose) => pose.pitch),
        samples.map((sample) => sample.y),
      ),
    ) >= GAZE_HEAD_FOLLOW_CORRELATION
  );
}

// TODO(demo): 학습 데이터 수집용 임시 페이지. 데이터를 다 모으면 지운다.
export default function GazeCollectPage() {
  const [step, setStep] = useState(0);
  const [collecting, setCollecting] = useState(false);
  const [person, setPerson] = useState("");
  const [exportResult, setExportResult] = useState<string | null>(null);

  const condition = CONDITIONS.at(step);
  const conditionId = condition?.id ?? "";
  const collector = useGazeCollector(conditionId);
  const { status, pose, samples } = collector;
  const tracking = status.phase === "tracking";
  const faceVisible = tracking && status.faceVisible;

  const conditionSamples = samples.filter(
    (sample) => sample.condition === conditionId,
  );
  const clicks = conditionSamples.length;
  const showDot = tracking && collecting && clicks < DOT_COUNT;

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
          ? `${step + 1}/${CONDITIONS.length}단계 · ${clicks}/${DOT_COUNT}번째 점`
          : "얼굴이 보이지 않아 기록되지 않습니다";
    }
  })();

  const nextStep = () => {
    setStep((current) => current + 1);
    setCollecting(false);
  };

  const exportControls = (
    <>
      <Button
        size="sm"
        variant="outline"
        data-testid="export-dataset"
        disabled={samples.length === 0}
        onClick={() => {
          const session = collector.buildSession(person.trim());
          downloadRawSession(session);
          setExportResult(`${session.samples.length}개를 내보냈습니다.`);
        }}
      >
        내보내기
      </Button>
      {exportResult && <p data-testid="export-result">{exportResult}</p>}
    </>
  );

  return (
    <div className="fixed inset-0 z-40 bg-background">
      {/* 개발 모드 배지가 왼쪽 아래 점을 가려 이 페이지에서만 숨긴다. */}
      <style>{"nextjs-portal { display: none; }"}</style>
      {showDot && (
        <button
          type="button"
          data-gaze-target
          aria-label="시선 학습 점"
          className="fixed z-60 size-6 -translate-x-1/2 -translate-y-1/2 cursor-pointer rounded-full bg-primary ring-4 ring-primary/30"
          style={dotPosition(clicks)}
        />
      )}

      {showDot ? (
        <div className="fixed top-1/2 left-1/2 mt-2 flex w-40 -translate-x-1/2 flex-col items-center gap-2 text-center text-xs text-muted-foreground">
          <p data-testid="collect-status">{message}</p>
          <p data-testid="head-pose" className="tabular-nums">
            {pose
              ? `좌우 ${pose.yaw.toFixed(0)}° 상하 ${pose.pitch.toFixed(0)}° 거리 ${Math.abs(pose.z).toFixed(0)}cm`
              : "-"}
          </p>
          {!condition?.headMoves && headFollowsDots(conditionSamples) && (
            <p data-testid="head-warning" className="text-destructive">
              고개가 점을 따라갑니다. 눈만 움직이세요.
            </p>
          )}
          <Button
            size="sm"
            variant="outline"
            data-testid="redo-condition"
            onClick={() => {
              collector.discard(conditionId);
              setCollecting(false);
            }}
          >
            이 단계 다시
          </Button>
          {exportControls}
        </div>
      ) : (
        <div className="fixed top-1/2 left-1/2 mt-2 flex w-96 -translate-x-1/2 flex-col items-center gap-3 text-center text-sm">
          {!condition ? (
            <p data-testid="collect-guide">
              모든 단계를 마쳤습니다. 내보내기를 눌러 파일을 받으세요.
            </p>
          ) : collecting ? (
            <>
              <p data-testid="collect-guide">
                {step + 1}단계를 마쳤습니다. 지금까지 {samples.length}개입니다.
              </p>
              <Button data-testid="next-condition" onClick={nextStep}>
                다음 단계
              </Button>
            </>
          ) : (
            <>
              <label className="flex items-center gap-2 text-xs text-muted-foreground">
                수집자
                <input
                  data-testid="collect-person"
                  value={person}
                  className="rounded-lg border bg-background px-2 py-1 text-foreground"
                  onChange={(event) => setPerson(event.target.value)}
                />
              </label>
              <p data-testid="collect-guide" className="font-medium">
                {step + 1}/{CONDITIONS.length}단계: {condition.guide}
              </p>
              <p className="text-xs text-muted-foreground">
                자세를 잡은 뒤 시작하고, 나타나는 점을 바라보며 클릭하세요.
              </p>
              <p className="text-xs text-muted-foreground">{message}</p>
              <div className="flex gap-2">
                <Button
                  data-testid="start-condition"
                  disabled={!faceVisible}
                  onClick={() => setCollecting(true)}
                >
                  시작
                </Button>
                <Button
                  variant="outline"
                  data-testid="skip-condition"
                  onClick={nextStep}
                >
                  건너뛰기
                </Button>
              </div>
            </>
          )}
          {exportControls}
        </div>
      )}
    </div>
  );
}
