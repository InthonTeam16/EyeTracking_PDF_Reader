"use client";

import { useCallback, useState } from "react";

import type { Block, ExplainRequest, ExplainResponse } from "@/types";

export type Explanation =
  | { status: "loading" }
  | { status: "done"; text: string }
  | { status: "error"; message: string };

async function fetchExplanation(request: ExplainRequest): Promise<string> {
  const res = await fetch("/api/explain", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(request),
  });
  const body = (await res.json()) as ExplainResponse;
  if (!res.ok || !body.data)
    throw new Error(body.error ?? `HTTP ${res.status}`);
  return body.data.explanation;
}

// 블록별로 설명을 한 번만 받아 두고, 지금 열린 블록 하나만 보여준다.
export function useExplanations(blocks: Block[]) {
  const [openBlockId, setOpenBlockId] = useState<string | null>(null);
  const [explanations, setExplanations] = useState<Record<string, Explanation>>(
    {},
  );

  const open = (blockId: string) => {
    setOpenBlockId(blockId);
    if (explanations[blockId] && explanations[blockId].status !== "error")
      return;

    const index = blocks.findIndex((block) => block.id === blockId);
    if (index === -1) return;
    const context = [blocks[index - 1]?.text, blocks[index + 1]?.text]
      .filter(Boolean)
      .join("\n");

    const save = (explanation: Explanation) =>
      setExplanations((prev) => ({ ...prev, [blockId]: explanation }));

    save({ status: "loading" });
    fetchExplanation({ blockText: blocks[index].text, context })
      .then((text) => save({ status: "done", text }))
      .catch((error: unknown) =>
        save({
          status: "error",
          message: error instanceof Error ? error.message : String(error),
        }),
      );
  };

  // 읽는 블록이 바뀌면 다른 블록의 설명은 닫는다. 같은 블록을 보는 동안에는 둔다.
  const closeUnless = useCallback((blockId: string | null) => {
    setOpenBlockId((current) =>
      current !== null && current !== blockId ? null : current,
    );
  }, []);

  return {
    openBlockId,
    explanation: openBlockId ? (explanations[openBlockId] ?? null) : null,
    open,
    close: () => setOpenBlockId(null),
    closeUnless,
  };
}
