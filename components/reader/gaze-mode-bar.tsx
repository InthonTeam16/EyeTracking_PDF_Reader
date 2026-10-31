import { CameraIcon, MousePointer2Icon } from "lucide-react";

import { Button } from "@/components/ui/button";

export type GazeMode = "webcam" | "mouse";

type GazeModeBarProps = {
  mode: GazeMode;
  message: string;
  onToggle: () => void;
};

// 지금 어떤 입력으로 시선을 잡는지 보여주고, 시연 중 바로 바꿀 수 있게 한다.
export function GazeModeBar({ mode, message, onToggle }: GazeModeBarProps) {
  const ModeIcon = mode === "webcam" ? CameraIcon : MousePointer2Icon;

  return (
    <div className="sticky top-0 z-10 border-b bg-background/80 backdrop-blur">
      <div className="mx-auto flex w-full max-w-2xl items-center justify-between gap-4 px-6 py-2 text-sm">
        <p className="flex min-w-0 items-center gap-2 text-muted-foreground">
          <ModeIcon className="size-4 shrink-0 text-foreground" />
          <span className="truncate">{message}</span>
        </p>
        <Button variant="outline" size="sm" onClick={onToggle}>
          {mode === "webcam" ? "마우스 모드로" : "웹캠 모드로"}
        </Button>
      </div>
    </div>
  );
}
