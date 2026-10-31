import {
  ArrowLeftIcon,
  ArrowLeftRightIcon,
  BookOpenIcon,
  CameraIcon,
  Columns2Icon,
  FileTextIcon,
  MousePointer2Icon,
  type LucideIcon,
} from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";

import { Button, buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export type ViewMode = "focus" | "pdf" | "split";
export type GazeMode = "webcam" | "mouse";

const VIEW_MODES: { value: ViewMode; label: string; icon: LucideIcon }[] = [
  { value: "focus", label: "집중 읽기", icon: BookOpenIcon },
  { value: "pdf", label: "원본 PDF", icon: FileTextIcon },
  { value: "split", label: "분할 보기", icon: Columns2Icon },
];

type ReaderHeaderProps = {
  title: string;
  viewMode: ViewMode;
  // 원본 PDF가 없는 문서(TXT 등)는 보기 방식 탭을 숨긴다
  showViewModes: boolean;
  onViewModeChange: (mode: ViewMode) => void;
  // 분할 보기에서 좌우 칸을 바꾼다
  onSwapPanes: () => void;
  gazeMode: GazeMode;
  onGazeModeToggle: () => void;
  // 오른쪽 끝에 붙는 설정 버튼
  settings: ReactNode;
};

export function ReaderHeader({
  title,
  viewMode,
  showViewModes,
  onViewModeChange,
  onSwapPanes,
  gazeMode,
  onGazeModeToggle,
  settings,
}: ReaderHeaderProps) {
  return (
    <header className="flex h-14 shrink-0 items-center gap-4 border-b bg-background px-4">
      <div className="flex min-w-0 flex-1 items-center gap-2">
        <Link
          href="/"
          aria-label="처음으로"
          className={buttonVariants({ variant: "ghost", size: "icon-sm" })}
        >
          <ArrowLeftIcon />
        </Link>
        <p className="truncate text-sm font-medium">{title}</p>
      </div>

      <div
        className={cn(
          "flex shrink-0 items-center gap-2",
          !showViewModes && "hidden",
        )}
      >
        <div
          role="group"
          aria-label="보기 방식"
          className="flex items-center gap-1 rounded-lg bg-muted p-1"
        >
          {VIEW_MODES.map(({ value, label, icon: Icon }) => (
            <Button
              key={value}
              variant="ghost"
              size="sm"
              aria-pressed={viewMode === value}
              onClick={() => onViewModeChange(value)}
              className={cn(
                "text-muted-foreground",
                viewMode === value &&
                  "bg-background text-foreground shadow-sm hover:bg-background",
              )}
            >
              <Icon />
              {label}
            </Button>
          ))}
        </div>
        {viewMode === "split" && (
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label="좌우 바꾸기"
            title="좌우 바꾸기"
            onClick={onSwapPanes}
          >
            <ArrowLeftRightIcon />
          </Button>
        )}
      </div>

      <div className="flex flex-1 items-center justify-end gap-2">
        <Button variant="outline" size="sm" onClick={onGazeModeToggle}>
          {gazeMode === "webcam" ? <MousePointer2Icon /> : <CameraIcon />}
          {gazeMode === "webcam" ? "마우스 모드로" : "웹캠 모드로"}
        </Button>
        {settings}
      </div>
    </header>
  );
}
