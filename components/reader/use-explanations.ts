"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import type { Block, ExplainRequest, ExplainResponse } from "@/types";

export type Explanation =
  | { status: "loading" }
  | { status: "done"; text: string }
  | { status: "error"; message: string };

// 즐겨찾기한 부가 설명. 문서 저장은 범위 밖이라 메모리에만 들고 있는다.
export type Favorite = { blockId: string; text: string };

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
  const [favorites, setFavorites] = useState<Favorite[]>([]);
  // 블록 id는 문서마다 겹치므로(p1-b0 등), 문서가 바뀌면 이전 문서의 설명을 모두 비운다.
  const [ownerBlocks, setOwnerBlocks] = useState(blocks);
  if (ownerBlocks !== blocks) {
    setOwnerBlocks(blocks);
    setOpenBlockId(null);
    setExplanations({});
    setFavorites([]);
  }
  const currentBlocks = useRef(blocks);
  useEffect(() => {
    currentBlocks.current = blocks;
  }, [blocks]);

  // 설명을 다 받은 블록만 즐겨찾기할 수 있다. 이미 있으면 해제한다.
  const toggleFavorite = (blockId: string) => {
    const explanation = explanations[blockId];
    setFavorites((prev) => {
      if (prev.some((favorite) => favorite.blockId === blockId))
        return prev.filter((favorite) => favorite.blockId !== blockId);
      return explanation?.status === "done"
        ? [...prev, { blockId, text: explanation.text }]
        : prev;
    });
  };

  const open = (blockId: string) => {
    setOpenBlockId(blockId);
    if (explanations[blockId] && explanations[blockId].status !== "error")
      return;

    const index = blocks.findIndex((block) => block.id === blockId);
    if (index === -1) return;
    const context = [blocks[index - 1]?.text, blocks[index + 1]?.text]
      .filter(Boolean)
      .join("\n");

    const save = (explanation: Explanation) => {
      // 받는 사이 문서가 바뀌었으면 같은 id의 다른 문단에 붙지 않게 버린다.
      if (currentBlocks.current !== blocks) return;
      setExplanations((prev) => ({ ...prev, [blockId]: explanation }));
    };

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
    favorites,
    toggleFavorite,
  };
}
