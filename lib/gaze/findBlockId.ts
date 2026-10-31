export function findBlockId(x: number, y: number): string | null {
  const block = document.elementFromPoint(x, y)?.closest("[data-block-id]");
  return block?.getAttribute("data-block-id") ?? null;
}
