# 팀 16 · EyeTracking PDF Reader (INTHON 2026)

이 파일은 팀원 모두의 AI 코딩 도구(Claude Code, Codex, Cursor 등)가 따르는 공용 규칙이다.
작업을 시작하기 전에 반드시 끝까지 읽는다.

## 프로젝트
- 한 줄 설명: 웹캠 아이트래킹으로 사용자가 읽는 부분을 따라가며 도와주는 PDF 리더
- 주제: '감각' (시각 정보)
- 핵심 기능
  1. 읽고 있는 블록은 하이라이트, 나머지는 블러
  2. 한 블록을 오래 응시하거나 미간을 찡그리면 그 부분의 부가 설명 팝업
  3. PDF 업로드 시 텍스트를 문맥 단위 블록으로 재배치 (줄 간격을 넓혀 시선 인식 정확도 보완)
- 우선순위: 1 + 3 → 2(오래 응시) → 2(찡그림)
- 범위 밖: 로그인, 문서 저장/히스토리, 모바일 대응, 이미지·표 인식
- 데모 시나리오: PDF를 올리면 → 재배치된 화면이 뜨고 → 읽는 곳만 선명하게 보이고 → 어려운 문단을 오래 보면 설명이 뜬다

## 스택
- Next.js (App Router, `src/` 없음) + TypeScript
- Tailwind CSS + shadcn/ui (Nova 프리셋)
- pdfjs-dist (PDF 텍스트 추출)
- WebGazer.js (시선 좌표), MediaPipe Face Landmarker (찡그림 감지)
- LLM API (부가 설명) — 키는 `.env.local`의 `LLM_API_KEY`
- Vercel 배포
- 새 라이브러리 설치는 팀 단톡에 먼저 말하고 진행

## 폴더 구조와 담당

```
app/
  page.tsx                 랜딩 + PDF 업로드 진입          김준영(랜딩 문구·디자인), 김정인(업로드 UI)
  reader/page.tsx          리더 화면                        김정인
  lab/gaze/page.tsx        시선 엔진 테스트 페이지          민서
  api/explain/route.ts     부가 설명 (LLM 호출)             박정훈
  api/reflow/route.ts      (선택) LLM 의미 단위 분할         박정훈
components/
  ui/                      shadcn 컴포넌트                  추가만 가능, 수정 금지
  reader/                  리더 관련 컴포넌트               김정인
  gaze/                    캘리브레이션 오버레이, 디버그 점  민서
  landing/                 랜딩 컴포넌트                    김준영
lib/
  gaze/                    useGaze, 스무딩, dwell, 찡그림    민서
  pdf/                     텍스트 추출, 블록 변환           박정훈
  llm/                     LLM 클라이언트                   박정훈
  llm/prompts.ts           프롬프트 문구                    박정훈, 김준영
  mock/                    목업 데이터                      누구나 추가 가능
  utils.ts                 shadcn의 cn()                    수정 금지
types/index.ts             공용 타입                        민서만 수정
public/samples/            데모용 PDF                       김준영
docs/api.md                API 명세                         박정훈
docs/decisions.md          기술적 의사결정 기록             김준영 (누구나 추가 가능)
```

### 폴더 규칙
- **내 담당 폴더만 수정한다.** 다른 사람 담당 파일이 바뀌어야 하면 직접 고치지 말고 담당자에게 요청한다.
- `types/index.ts`를 바꿔야 하면 민서에게 요청한다. 다른 파일에서 같은 타입을 새로 정의하지 않는다.
- `components/ui/`는 `npx shadcn@latest add <이름>`으로 추가만 한다. 생성된 파일을 고치지 말고, 커스텀이 필요하면 내 폴더에서 감싸서 쓴다.
- 새 유틸·컴포넌트를 만들기 전에 `lib/`, `components/`에 비슷한 게 있는지 먼저 찾는다.
- 공용 설정 파일(`package.json`, `next.config.*`, `tsconfig.json`, `app/layout.tsx`, `app/globals.css`)은 민서가 관리한다. 필요하면 요청한다.

## 모듈 간 약속 (접점)

```ts
// types/index.ts
export type Block = { id: string; text: string; page: number; order: number };

export type GazeState = {
  point: { x: number; y: number } | null;  // 화면 좌표 (px)
  activeBlockId: string | null;            // 지금 보고 있는 블록
  calibrated: boolean;
};

export type GazeEvents = {
  onDwell?: (blockId: string, ms: number) => void;  // 한 블록을 기준 시간 이상 응시
  onSquint?: (blockId: string) => void;             // 응시 중 찡그림 감지
};
```

- 리더가 렌더링하는 모든 블록 요소에는 `data-block-id={block.id}`를 붙인다. 시선 엔진은 이 속성으로 좌표 → 블록을 찾는다.
- 시선 입력은 두 가지 구현이 **같은 모양**을 반환한다.
  - `useGaze(events): GazeState` — 실제 웹캠 (`lib/gaze/`, 민서)
  - `useMouseGaze(events): GazeState` — 마우스 커서로 흉내 (`lib/gaze/`, 민서가 먼저 만들어 둠)
  - 리더는 둘 중 하나만 바꿔 끼우면 동작해야 한다. 마우스 모드는 데모 백업이기도 하니 지우지 않는다.
- 응시 기준 시간 같은 상수는 `lib/gaze/config.ts`에 모은다.
- PDF 변환: `toBlocks(file: File): Promise<Block[]>` (`lib/pdf/`, 박정훈)
- 부가 설명 API: `POST /api/explain`
  - 요청 `{ blockText: string, context?: string }`
  - 응답 `{ data: { explanation: string } | null, error: string | null }`
- 백엔드나 시선 엔진이 아직 없으면 `lib/mock/`의 목업 데이터로 진행한다. 목업은 함수 하나로 감싸서 나중에 교체하기 쉽게 한다.

## 브라우저 전용 코드 주의
- WebGazer, MediaPipe, pdfjs는 브라우저에서만 동작한다. 사용하는 컴포넌트는 `"use client"`를 붙이고, 라이브러리는 `useEffect` 안이나 dynamic import로 불러온다. 서버 컴포넌트나 API 라우트에서 import하지 않는다.
- 타입이 없는 라이브러리는 `types/vendor.d.ts`에 `declare module`로 선언한다 (민서에게 요청).
- 웹캠 스트림과 requestAnimationFrame 루프는 컴포넌트가 사라질 때 반드시 정리한다.

## 코드 스타일
- 컴포넌트는 함수형 + named export
- 스타일은 Tailwind만 사용, 별도 CSS 파일을 만들지 않는다
- 색·간격은 shadcn 테마 토큰을 쓴다 (임의 hex 값 금지)
- 비밀 키는 `.env.local`에만 둔다. 클라이언트 코드에서 LLM 키를 쓰지 않고 반드시 API 라우트를 거친다

## Git
- 브랜치: `feat/<기능>`, `fix/<내용>` — 짧게 파고 몇 시간 안에 머지
- 커밋: `feat: 블러 효과 추가` 형식, 한국어 가능
- main에 직접 push 금지, PR로 머지 (민서가 머지, 민서 부재 시 백엔드 PR은 박정훈)
- PR 전에 `git pull origin main`으로 최신 내용을 합치고 `npm run build`가 통과하는지 확인
- PR은 기능 하나·화면 하나 단위로 작게

## AI 작업 규칙
- 큰 작업은 바로 코드를 쓰지 말고, 바꿀 파일 목록과 계획을 먼저 보여준다
- 요청받은 범위와 내 담당 폴더 밖의 파일은 건드리지 않는다. 필요하면 멈추고 사람에게 알린다
- 작업이 끝나면 `npm run build`와 `npm run lint`를 돌려 통과시킨다
- 라이브러리 사용법은 추측하지 말고 공식 문서를 확인한다
- 기술적인 선택(라이브러리, 알고리즘, 파라미터)을 했으면 이유를 한두 줄로 `docs/decisions.md`에 남긴다

## 데모 우선 원칙
- 완벽한 예외 처리보다 데모 경로가 절대 깨지지 않는 것이 우선이다
- 하드코딩·목업으로 때운 부분은 `// TODO(demo):` 주석으로 표시한다
- 웹캠 권한 거부나 인식 실패 시 마우스 모드로 자연스럽게 넘어가야 한다
