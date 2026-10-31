import type { GazeSample } from "@/lib/gaze/ridgeRegression";
import samples from "@/lib/gaze/pretrainedSamples.json";

// /lab/gaze의 데이터 수집에서 내보낸 파일로 pretrainedSamples.json을 덮어쓴다.
// faceFeatures.ts의 입력값 구성을 바꾸면 다시 수집해야 한다.
export const PRETRAINED_SAMPLES = samples as GazeSample[];
