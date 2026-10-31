import {
  buildExplainUserPrompt,
  EXPLAIN_SYSTEM_PROMPT,
} from "@/lib/llm/prompts";
import { getMockExplanation } from "@/lib/mock/explanation";
import type { ExplainRequest, ExplainResponse } from "@/types";

// 해커톤 제공 Lablup Token Factory (OpenAI 호환 API). 환경 변수로 바꿀 수 있다.
const DEFAULT_BASE_URL = "https://api.console.lablup.ai/v1";
const DEFAULT_MODEL = "DeepSeek-V4.1-Flash-B300";
// 추론형 모델은 생각하는 데도 토큰을 쓰므로 넉넉히 준다. 출력은 아래에서 잘라낸다.
const MAX_TOKENS = 1024;
const TIMEOUT_MS = 15_000;

// toBlocks 블록은 최대 600자다. 비정상적으로 긴 입력은 잘라서 비용을 막는다.
const MAX_BLOCK_CHARS = 2000;
const MAX_CONTEXT_CHARS = 1500;
// 팝업 폭에 맞춘 출력 상한. 프롬프트로 150자를 요청하지만 넘칠 때를 대비한다.
const MAX_EXPLANATION_CHARS = 220;

function reply(body: ExplainResponse, status = 200) {
  return Response.json(body, { status });
}

function parseRequest(raw: unknown): ExplainRequest | null {
  if (typeof raw !== "object" || raw === null) return null;
  const { blockText, context } = raw as Record<string, unknown>;
  if (typeof blockText !== "string" || blockText.trim() === "") return null;
  if (context !== undefined && typeof context !== "string") return null;
  return {
    blockText: blockText.trim().slice(0, MAX_BLOCK_CHARS),
    context: context?.trim().slice(0, MAX_CONTEXT_CHARS) || undefined,
  };
}

// 팝업은 일반 텍스트로 보여주므로 마크다운 기호를 지우고 길이를 맞춘다.
function cleanExplanation(text: string): string {
  const plain = text
    .replace(/\*\*|__|`|^#+\s*/gm, "")
    .replace(/^\s*[-*•]\s+/gm, "")
    .replace(/\s+/g, " ")
    .trim();
  if (plain.length <= MAX_EXPLANATION_CHARS) return plain;

  const cut = plain.slice(0, MAX_EXPLANATION_CHARS);
  // 마지막 문장 끝(. ? !)까지만 남긴다.
  const lastEnd = Math.max(
    cut.lastIndexOf(". "),
    cut.lastIndexOf("? "),
    cut.lastIndexOf("! "),
  );
  return lastEnd > 0 ? cut.slice(0, lastEnd + 1).trim() : `${cut.trim()}…`;
}

type ChatCompletionResponse = {
  choices?: { message?: { content?: string | null } }[];
  error?: { message?: string } | string;
};

// 추론형 모델이 본문에 섞어 보내는 <think>…</think> 블록을 지운다.
function stripReasoning(text: string): string {
  return text.replace(/<think>[\s\S]*?(<\/think>|$)/g, "").trim();
}

async function callLLM(apiKey: string, request: ExplainRequest) {
  const baseUrl = (process.env.LLM_BASE_URL || DEFAULT_BASE_URL).replace(
    /\/+$/,
    "",
  );
  const res = await fetch(`${baseUrl}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: process.env.LLM_MODEL || DEFAULT_MODEL,
      max_tokens: MAX_TOKENS,
      messages: [
        { role: "system", content: EXPLAIN_SYSTEM_PROMPT },
        { role: "user", content: buildExplainUserPrompt(request) },
      ],
    }),
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });

  const body = (await res.json().catch(() => ({}))) as ChatCompletionResponse;
  if (!res.ok) {
    const message =
      typeof body.error === "string" ? body.error : body.error?.message;
    throw new Error(message ?? `LLM HTTP ${res.status}`);
  }

  // 추론 내용(reasoning_content)은 쓰지 않고 최종 답(content)만 쓴다.
  const text = stripReasoning(body.choices?.[0]?.message?.content ?? "");
  if (!text) throw new Error("LLM 응답에 설명이 없습니다.");
  return cleanExplanation(text);
}

export async function POST(request: Request) {
  const raw: unknown = await request.json().catch(() => null);
  const body = parseRequest(raw);
  if (!body) {
    return reply(
      { data: null, error: "blockText(문자열)가 필요합니다." },
      400,
    );
  }

  const apiKey = process.env.LLM_API_KEY;
  if (!apiKey) {
    // TODO(demo): 키가 없으면 데모 PDF용 목업 설명으로 대신한다.
    return reply({
      data: { explanation: getMockExplanation(body.blockText) },
      error: null,
    });
  }

  try {
    const explanation = await callLLM(apiKey, body);
    return reply({ data: { explanation }, error: null });
  } catch (error) {
    console.error("[api/explain]", error);
    return reply(
      { data: null, error: "설명을 만들지 못했습니다. 잠시 후 다시 시도해 주세요." },
      502,
    );
  }
}
