# API 명세

## POST /api/explain

블록의 부가 설명을 LLM으로 만들어 반환한다. 서버에 `LLM_API_KEY`가 없으면 LLM을 부르지 않고 목업 설명을 반환한다.

요청

```json
{ "blockText": "설명할 문단", "context": "앞뒤 문맥 (선택)" }
```

응답

```json
{ "data": { "explanation": "부가 설명" }, "error": null }
```

실패 시 `data`는 `null`이고 `error`에 메시지가 담긴다.

| 상태 코드 | 경우 |
| --- | --- |
| 200 | 성공. 키가 없어 목업 설명을 반환한 경우도 포함 |
| 400 | 본문이 JSON이 아니거나, `blockText`가 비었거나 문자열이 아니거나, `context`가 문자열이 아님 |
| 502 | LLM 호출 실패 또는 시간 초과(15초) |

- `blockText`는 2000자, `context`는 1500자까지만 LLM으로 보낸다.
- 설명은 마크다운 기호를 지우고 220자 이내로 줄여 일반 텍스트로 반환한다.
- 서버 환경 변수: `LLM_API_KEY`, `LLM_BASE_URL`(선택), `LLM_MODEL`(선택).

## toBlocks (클라이언트 함수)

```ts
import { toBlocks } from "@/lib/pdf/toBlocks";
const blocks: Block[] = await toBlocks(file);
```

- 브라우저 전용. `"use client"` 컴포넌트에서 호출한다.
- 반환: 읽는 순서대로 정렬된 `Block[]`. `id`는 `p{페이지}-b{페이지 안 번호}`, `order`는 문서 전체에서 0부터.
- `text`에는 줄바꿈(`\n`)이 들어갈 수 있다 (제목 + 본문을 한 블록으로 묶은 경우). 렌더링할 때 `whitespace-pre-line`을 쓰면 그대로 보인다.
- 1단·2단·N단 레이아웃을 읽는 순서대로 정리하고, 이미지·벡터 그림·표·캡션·쪽번호·머리말은 빼고 본문만 반환한다.
- 텍스트가 없는 PDF(스캔본)는 빈 배열 `[]`을 반환한다. 안내 문구는 호출하는 쪽에서 띄운다.
- PDF가 아니거나 깨진 파일이면 에러를 던진다. 호출하는 쪽에서 `try/catch`로 잡는다.
