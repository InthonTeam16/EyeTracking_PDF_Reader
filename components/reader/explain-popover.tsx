import { Loader2Icon, SparklesIcon, StarIcon, XIcon } from "lucide-react";

import type { Explanation } from "@/components/reader/use-explanations";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type ExplainPopoverProps = {
  explanation: Explanation;
  favorite: boolean;
  onToggleFavorite: () => void;
  onClose: () => void;
};

export function ExplainPopover({
  explanation,
  favorite,
  onToggleFavorite,
  onClose,
}: ExplainPopoverProps) {
  return (
    <aside
      role="dialog"
      aria-label="부가 설명"
      // 본문 칸이 넓으면 블록 오른쪽에, 분할 보기처럼 좁으면 블록 아래에 띄운다.
      // 기준 폭(@7xl)은 본문(max-w-2xl)과 팝업(w-64)이 나란히 들어가는 크기다.
      className="mt-3 rounded-xl bg-popover p-4 text-sm leading-relaxed text-popover-foreground shadow-md ring-1 ring-foreground/10 animate-in fade-in @7xl:absolute @7xl:top-0 @7xl:left-full @7xl:mt-0 @7xl:ml-4 @7xl:w-64 @7xl:slide-in-from-left-2"
    >
      <div className="mb-2 flex items-center justify-between gap-2">
        <p className="flex items-center gap-1.5 font-medium">
          <SparklesIcon className="size-4 text-primary" />
          부가 설명
        </p>
        <div className="flex items-center gap-1">
          {explanation.status === "done" && (
            <Button
              variant="ghost"
              size="icon-xs"
              aria-label="즐겨찾기"
              aria-pressed={favorite}
              onClick={onToggleFavorite}
            >
              <StarIcon
                className={cn(favorite && "fill-yellow-400 text-yellow-400")}
              />
            </Button>
          )}
          <Button
            variant="ghost"
            size="icon-xs"
            aria-label="닫기"
            onClick={onClose}
          >
            <XIcon />
          </Button>
        </div>
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
