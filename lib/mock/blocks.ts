import type { Block } from "@/types";

export function getMockBlocks(): Block[] {
  return [
    { id: "block-1", text: "첫 번째 목업 문단입니다.", page: 1, order: 0 },
    { id: "block-2", text: "두 번째 목업 문단입니다.", page: 1, order: 1 },
    { id: "block-3", text: "세 번째 목업 문단입니다.", page: 2, order: 2 },
  ];
}
