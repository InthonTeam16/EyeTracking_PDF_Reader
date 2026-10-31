# API 명세

## POST /api/explain

블록의 부가 설명을 반환한다. 현재는 목업 응답을 반환한다.

요청

```json
{ "blockText": "설명할 문단", "context": "앞뒤 문맥 (선택)" }
```

응답

```json
{ "data": { "explanation": "부가 설명" }, "error": null }
```

실패 시 `data`는 `null`이고 `error`에 메시지가 담긴다.
