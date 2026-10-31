import { useState } from "react";

import { CameraGuide, FaceGuide } from "@/components/gaze/FaceGuide";
import { Button } from "@/components/ui/button";
import { GAZE_CALIBRATION_POINTS } from "@/lib/gaze/config";
import type { FaceFrame } from "@/lib/gaze/posture";

// 점 개수와 서로소라 모든 점을 한 번씩 지나며, 멀리 떨어진 점으로 건너뛴다.
const ORDER_STEP = 5;

type CalibrationOverlayProps = {
  clicks: number;
  faceVisible: boolean;
  onCancel?: () => void;
  // 주면 점을 보여 주기 전에 시작 자세부터 맞추고, 보정 중에도 카메라 화면을 보여 준다.
  faceGuide?: { face: FaceFrame | null };
};

// 화면 전체를 덮고 점을 하나씩 보여 준다. 클릭은 useGaze가 받아 학습한다.
export function CalibrationOverlay({
  clicks,
  faceVisible,
  onCancel,
  faceGuide,
}: CalibrationOverlayProps) {
  const [aligning, setAligning] = useState(faceGuide !== undefined);
  const total = GAZE_CALIBRATION_POINTS.length;
  const point = GAZE_CALIBRATION_POINTS[(clicks * ORDER_STEP) % total];

  if (aligning && faceGuide) {
    return (
      <>
        <div
          data-testid="calibration-overlay"
          className="fixed inset-0 z-40 bg-background"
        />
        <style>{"nextjs-portal { display: none; }"}</style>
        <FaceGuide
          face={faceGuide.face}
          onStart={() => setAligning(false)}
          onCancel={onCancel}
        />
      </>
    );
  }

  return (
    <>
      {faceGuide && <CameraGuide box="calibration" face={faceGuide.face} />}
      <div
        data-testid="calibration-overlay"
        className="fixed inset-0 z-40 bg-background"
      >
        {/* 개발 모드 배지와 카메라 미리보기가 모서리 점을 가려 이 화면에서만 숨긴다.
            시작 자세 가이드를 쓰면 카메라는 점과 겹치지 않는 자리로 옮겨 보여 준다. */}
        <style>
          {faceGuide
            ? "nextjs-portal { display: none; }"
            : "nextjs-portal { display: none; } video { visibility: hidden; }"}
        </style>
        {faceVisible && (
          <button
            type="button"
            data-gaze-target
            aria-label="보정 점"
            className="fixed z-60 size-6 -translate-x-1/2 -translate-y-1/2 cursor-pointer rounded-full bg-primary ring-4 ring-primary/30"
            // 보정 점마다 위치가 달라 Tailwind 클래스로 정할 수 없다.
            style={{ left: `${point.left}%`, top: `${point.top}%` }}
          />
        )}
        <div
          data-gaze-ignore
          className="fixed top-1/2 left-1/2 flex w-40 -translate-x-1/2 -translate-y-1/2 flex-col items-center gap-2 text-center text-xs text-muted-foreground"
        >
          <p
            data-testid="calibration-status"
            className="font-medium text-foreground"
          >
            {faceVisible
              ? `점을 바라보며 클릭하세요 · ${clicks}/${total}`
              : "얼굴이 보이지 않아요. 화면 정면을 봐 주세요."}
          </p>
          <p>평소 읽는 자세로 앉아 주세요.</p>
          {onCancel && (
            <Button size="sm" variant="ghost" onClick={onCancel}>
              건너뛰기
            </Button>
          )}
        </div>
      </div>
    </>
  );
}
