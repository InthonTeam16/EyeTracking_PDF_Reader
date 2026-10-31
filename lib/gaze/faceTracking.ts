"use client";

import type { FaceLandmarkerResult } from "@mediapipe/tasks-vision";
import { loadFaceLandmarker } from "@/lib/gaze/faceLandmarker";

type FaceTrackingOptions = {
  previewClassName: string;
  onCamera: () => void;
  onReady: () => void;
  onFrame: (result: FaceLandmarkerResult, video: HTMLVideoElement) => void;
  onError: (error: unknown) => void;
};

// 모델과 카메라를 켜고 새 프레임마다 인식 결과를 넘긴다. 반환한 함수로 끈다.
export function startFaceTracking({
  previewClassName,
  onCamera,
  onReady,
  onFrame,
  onError,
}: FaceTrackingOptions): () => void {
  let cancelled = false;
  let animationFrame = 0;
  let stream: MediaStream | null = null;
  let video: HTMLVideoElement | null = null;

  async function start() {
    const landmarker = await loadFaceLandmarker();
    if (cancelled) return;
    onCamera();

    const userStream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: "user", width: 640, height: 480 },
    });
    // 권한 팝업을 기다리는 사이 컴포넌트가 사라졌을 수 있다.
    if (cancelled) {
      userStream.getTracks().forEach((track) => track.stop());
      return;
    }
    stream = userStream;

    // TODO(demo): 캘리브레이션 구현 후 미리보기를 숨긴다.
    const element = document.createElement("video");
    element.muted = true;
    element.playsInline = true;
    element.srcObject = userStream;
    element.className = previewClassName;
    document.body.appendChild(element);
    video = element;
    await element.play();
    if (cancelled) return;

    onReady();

    let lastVideoTime = -1;
    const tick = () => {
      animationFrame = requestAnimationFrame(tick);
      if (element.currentTime === lastVideoTime) return;
      lastVideoTime = element.currentTime;
      onFrame(landmarker.detectForVideo(element, performance.now()), element);
    };
    animationFrame = requestAnimationFrame(tick);
  }

  start().catch((error) => {
    if (!cancelled) onError(error);
  });

  return () => {
    cancelled = true;
    cancelAnimationFrame(animationFrame);
    stream?.getTracks().forEach((track) => track.stop());
    video?.remove();
  };
}
