# 기술적 의사결정 기록

기술적인 선택(라이브러리, 알고리즘, 파라미터)과 그 이유를 한두 줄로 남긴다.

- `DWELL_MS = 1500`: 실측 전 임시값. 실제 웹캠 테스트 후 조정한다.
- `ExplainRequest`, `ExplainResponse`를 `types/index.ts`에 추가: API 라우트와 호출하는 쪽이 같은 타입을 쓰게 하기 위해.
