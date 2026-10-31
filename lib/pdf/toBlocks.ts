import { getMockBlocks } from "@/lib/mock/blocks";
import type { Block } from "@/types";

// TODO(demo): 빈 구현. pdfjs 연동 전까지 목업 블록을 반환한다.
export async function toBlocks(file: File): Promise<Block[]> {
  void file;
  return getMockBlocks();
}
