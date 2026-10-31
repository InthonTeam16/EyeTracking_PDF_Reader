# 기술적 의사결정 기록

기술적인 선택(라이브러리, 알고리즘, 파라미터)과 그 이유를 한두 줄로 남긴다.

- `DWELL_MS = 1500`: 실측 전 임시값. 실제 웹캠 테스트 후 조정한다.
- `onDwell`은 블록에 들어온 뒤 `DWELL_MS`가 지나면 머무는 동안 한 번만 호출: 같은 문단을 계속 볼 때 설명 API가 반복 호출되지 않게 하기 위해.
- `pdfjs-dist`, `webgazer`, `@mediapipe/tasks-vision` 설치: AGENTS.md의 스택대로 PDF 텍스트 추출, 시선 좌표, 찡그림 감지에 쓴다. 찡그림 감지는 Face Landmarker가 포함된 `@mediapipe/tasks-vision` 패키지를 쓴다.
- `webgazer`는 GPL-3.0-or-later 라이선스다. 해커톤 데모에는 문제없지만, 대회 후 서비스로 배포하거나 코드를 비공개로 유지하려면 라이선스를 다시 검토한다.
- `ExplainRequest`, `ExplainResponse`를 `types/index.ts`에 추가: API 라우트와 호출하는 쪽이 같은 타입을 쓰게 하기 위해.
