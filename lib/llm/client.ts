import { getMockExplanation } from "@/lib/mock/explanation";
import type { ExplainRequest } from "@/types";

// TODO(demo): 빈 구현. LLM 연동 전까지 목업 설명을 반환한다.
export async function explain(request: ExplainRequest): Promise<string> {
  void request;
  return getMockExplanation();
}
