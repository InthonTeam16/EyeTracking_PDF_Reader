import type { GazeSample } from "@/lib/gaze/ridgeRegression";
import samples from "@/lib/gaze/pretrainedSamples.json";

// /lab/gaze/datasets의 "선택 세트 내보내기"로 받은 파일로 pretrainedSamples.json을 덮어쓴다.
// faceFeatures.ts의 입력값 구성을 바꾸면 다시 수집해야 한다.
export const PRETRAINED_SAMPLES = samples as GazeSample[];
