# 기술적 의사결정 기록

기술적인 선택(라이브러리, 알고리즘, 파라미터)과 그 이유를 한두 줄로 남긴다.

- `DWELL_MS = 1500`: 실측 전 임시값. 실제 웹캠 테스트 후 조정한다.
- `onDwell`은 블록에 들어온 뒤 `DWELL_MS`가 지나면 머무는 동안 한 번만 호출: 같은 문단을 계속 볼 때 설명 API가 반복 호출되지 않게 하기 위해.
- WebGazer를 제거하고 MediaPipe Face Landmarker로 시선 추정기를 직접 구현(`useGaze`): WebGazer는 눈 이미지 밝기만 학습해 머리 자세와 홍채 위치를 쓰지 않는다. 실제 웹캠 비교에서 Face Landmarker 쪽이 훨씬 나았다. 같은 모델로 찡그림도 처리할 수 있고, WebGazer의 GPL 라이선스 문제도 사라진다.
- MediaPipe wasm(27MB)은 커밋하지 않고 `predev`, `prebuild`에서 `public/mediapipe/`로 복사: 저장소를 가볍게 유지하고 패키지 버전과 파일이 어긋나지 않게 하기 위해. CDN을 쓰지 않아 발표장 네트워크에도 영향받지 않는다.
- `GAZE_SMOOTHING_SAMPLES = 10`: 실제 테스트에서 좌표가 많이 튀어 이동 평균을 적용. 값은 임시이며 조정한다.
- 시선 입력값은 눈꼬리 기준 홍채 위치(양쪽 눈)와 랜드마크로 계산한 머리 자세·위치: 변환 행렬 없이 합성 데이터로 검증할 수 있다. 입력값 수가 적고 클릭 샘플도 적어 표준화한 릿지 회귀를 쓴다.
- `face_landmarker.task`(float16, 3.76MB)는 Google 공식 저장소에서 받아 `public/models/`에 커밋: 발표장 네트워크에 영향받지 않게 하기 위해.
- `pdfjs-dist`, `@mediapipe/tasks-vision` 설치: AGENTS.md의 스택대로 PDF 텍스트 추출과 시선·찡그림 감지에 쓴다.
- `ExplainRequest`, `ExplainResponse`를 `types/index.ts`에 추가: API 라우트와 호출하는 쪽이 같은 타입을 쓰게 하기 위해.
