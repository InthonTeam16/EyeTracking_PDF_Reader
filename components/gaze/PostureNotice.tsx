import { Button } from "@/components/ui/button";
import { POSTURE_MESSAGES, type PostureIssue } from "@/lib/gaze/posture";

type PostureNoticeProps = {
  issue: PostureIssue;
  onRecalibrate: () => void;
};

// 보정 때와 자세가 달라졌다고 알린다. 자세를 되돌리면 저절로 사라진다.
export function PostureNotice({ issue, onRecalibrate }: PostureNoticeProps) {
  return (
    <div
      role="status"
      data-gaze-ignore
      data-testid="posture-notice"
      className="flex items-center justify-between gap-4 rounded-xl bg-muted px-4 py-3 text-sm"
    >
      <p>{POSTURE_MESSAGES[issue]}</p>
      <Button
        size="sm"
        variant="outline"
        className="shrink-0"
        onClick={onRecalibrate}
      >
        시선 다시 맞추기
      </Button>
    </div>
  );
}
