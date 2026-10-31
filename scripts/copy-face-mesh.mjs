// WebGazer가 런타임에 불러오는 얼굴 인식 파일을 public/으로 복사한다. (predev, prebuild에서 실행)
import { cpSync } from "node:fs";

cpSync("node_modules/webgazer/dist/mediapipe/face_mesh", "public/mediapipe/face_mesh", {
  recursive: true,
});
