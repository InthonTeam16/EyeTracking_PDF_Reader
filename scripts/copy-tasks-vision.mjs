// MediaPipe가 런타임에 불러오는 wasm 파일을 public/으로 복사한다. (predev, prebuild에서 실행)
import { cpSync } from "node:fs";

// FilesetResolver가 쓰지 않는 module 빌드는 제외한다.
cpSync("node_modules/@mediapipe/tasks-vision/wasm", "public/mediapipe/tasks-vision", {
  recursive: true,
  filter: (source) => !source.includes("wasm_module_internal"),
});
