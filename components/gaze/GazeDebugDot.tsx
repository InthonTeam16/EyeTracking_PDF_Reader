import type { GazeState } from "@/types";

export function GazeDebugDot({ point }: { point: GazeState["point"] }) {
  if (!point) return null;

  return (
    <div
      aria-hidden
      className="pointer-events-none fixed z-50 size-4 -translate-x-1/2 -translate-y-1/2 rounded-full bg-destructive/70"
      style={{ left: point.x, top: point.y }}
    />
  );
}
