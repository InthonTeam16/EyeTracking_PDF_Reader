import { explain } from "@/lib/llm/client";
import type { ExplainRequest, ExplainResponse } from "@/types";

// TODO(demo): 입력 검증과 에러 응답은 LLM 연동 때 추가한다.
export async function POST(request: Request) {
  const body = (await request.json()) as ExplainRequest;
  const explanation = await explain(body);
  const response: ExplainResponse = { data: { explanation }, error: null };
  return Response.json(response);
}
