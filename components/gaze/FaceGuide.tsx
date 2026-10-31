import { useEffect, useEffectEvent, type CSSProperties } from "react";

import { Button } from "@/components/ui/button";
import { GAZE_FACE_GUIDE } from "@/lib/gaze/config";
import {
  FACE_MESSAGES,
  findFaceIssue,
  type FaceFrame,
} from "@/lib/gaze/posture";
import { cn } from "@/lib/utils";

// 단계별 카메라 화면 자리. 영상은 useGaze가 만든 미리보기라 CSS로 옮기고, 타원을 같은 자리에 겹친다.
// 어느 칸이든 4:3으로 잘라 보여 줘서 타원 비율이 같다.
const CAMERA_BOXES = {
  // 보정 전 시작 자세 맞추기
  large: {
    left: "50%",
    top: "40%",
    width: "28rem",
    height: "21rem",
    translate: "-50% -50%",
  },
  // 12점 보정 중. 점은 세로 4%, 50%, 96% 줄에 있어 위 두 줄 사이가 비어 있다.
  // 낮은 화면에서는 아래 안내 문구와 겹치지 않게 줄인다.
  calibration: {
    left: "50%",
    top: "26%",
    width: "min(16rem, 37.33vh)",
    height: "min(12rem, 28vh)",
    translate: "-50% -50%",
  },
  // 보정 후 읽는 동안
  mini: { right: "1rem", bottom: "1rem", width: "10rem", height: "7.5rem" },
} satisfies Record<string, CSSProperties>;

function isAligned(face: FaceFrame | null) {
  return face !== null && findFaceIssue(face, GAZE_FACE_GUIDE) === null;
}

type CameraGuideProps = {
  box: keyof typeof CAMERA_BOXES;
  face: FaceFrame | null;
};

// 카메라 화면을 box 자리로 옮기고 얼굴 위치 타원을 겹친다. 자세가 맞으면 초록색이 된다.
// 배경(z-40) 안에 넣으면 타원이 그 쌓임 순서에 묶여 영상(z-50) 아래로 깔리니 밖에 둔다.
export function CameraGuide({ box, face }: CameraGuideProps) {
  const { left, top, right, bottom, width, height, translate } = {
    left: "auto",
    top: "auto",
    right: "auto",
    bottom: "auto",
    translate: "none",
    ...CAMERA_BOXES[box],
  };

  return (
    <>
      <style>
        {`video { left: ${left}; top: ${top}; right: ${right}; bottom: ${bottom}; width: ${width}; height: ${height}; translate: ${translate}; object-fit: cover; border-radius: 0.75rem; }`}
      </style>
      <div
        aria-hidden
        data-testid="camera-guide"
        className="pointer-events-none fixed z-60"
        // 영상과 같은 자리에 겹치려고 같은 값을 쓴다.
        style={CAMERA_BOXES[box]}
      >
        <div
          data-testid="camera-guide-oval"
          className={cn(
            "absolute inset-x-[28.5%] inset-y-[12%] rounded-[50%] ring-background",
            box === "large" ? "border-4 ring-2" : "border-2 ring-1",
            isAligned(face) ? "border-green-500" : "border-primary",
          )}
        />
      </div>
    </>
  );
}

type FaceGuideProps = {
  face: FaceFrame | null;
  onStart: () => void;
  onCancel?: () => void;
};

// 보정 전에 카메라 화면을 크게 보여 주고 시작 자세를 맞춘다.
export function FaceGuide({ face, onStart, onCancel }: FaceGuideProps) {
  const issue = face ? findFaceIssue(face, GAZE_FACE_GUIDE) : null;
  const aligned = isAligned(face);
  const start = useEffectEvent(onStart);

  useEffect(() => {
    if (!aligned) return;
    const timer = setTimeout(() => start(), GAZE_FACE_GUIDE.holdMs);
    return () => clearTimeout(timer);
  }, [aligned]);

  return (
    <>
      <CameraGuide box="large" face={face} />
      <div
        data-gaze-ignore
        className="fixed top-[calc(40%+11.5rem)] left-1/2 z-60 flex w-md -translate-x-1/2 flex-col items-center gap-2 text-center text-sm"
      >
        <p data-testid="face-guide-status" className="font-medium text-foreground">
          {!face
            ? "얼굴이 보이지 않아요. 화면 정면을 봐 주세요."
            : issue
              ? FACE_MESSAGES[issue]
              : "좋아요. 그대로 있어 주세요."}
        </p>
        {face && (
          <p
            data-testid="face-guide-values"
            className="text-xs text-muted-foreground tabular-nums"
          >
            위치 {Math.round(face.x * 100)}, {Math.round(face.y * 100)} · 눈 사이{" "}
            {Math.round(face.eyeDistance * 100)}% · 좌우 {face.yaw.toFixed(0)}° ·
            상하 {face.pitch.toFixed(0)}°
          </p>
        )}
        <div className="flex gap-2">
          <Button size="sm" variant="ghost" onClick={onStart}>
            그냥 시작
          </Button>
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
