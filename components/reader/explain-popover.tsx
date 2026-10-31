import { Loader2Icon, SparklesIcon, XIcon } from "lucide-react";

import type { Explanation } from "@/components/reader/use-explanations";
import { Button } from "@/components/ui/button";

type ExplainPopoverProps = {
  explanation: Explanation;
  onClose: () => void;
};

export function ExplainPopover({ explanation, onClose }: ExplainPopoverProps) {
  return (
    <aside
      role="dialog"
      aria-label="부가 설명"
      className="absolute top-0 left-full ml-4 w-64 rounded-xl bg-popover p-4 text-sm leading-relaxed text-popover-foreground shadow-md ring-1 ring-foreground/10 animate-in fade-in slide-in-from-left-2"
    >
      <div className="mb-2 flex items-center justify-between gap-2">
        <p className="flex items-center gap-1.5 font-medium">
          <SparklesIcon className="size-4 text-primary" />
          부가 설명
        </p>
        <Button
          variant="ghost"
          size="icon-xs"
          aria-label="닫기"
          onClick={onClose}
        >
          <XIcon />
        </Button>
      </div>

      {explanation.status === "loading" && (
        <p className="flex items-center gap-2 text-muted-foreground">
          <Loader2Icon className="size-4 animate-spin" />
          설명을 불러오는 중…
        </p>
      )}
      {explanation.status === "done" && <p>{explanation.text}</p>}
      {explanation.status === "error" && (
        <p className="text-destructive">
          설명을 불러오지 못했어요. 다시 응시하면 재시도합니다.
        </p>
      )}
    </aside>
  );
}
