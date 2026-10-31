import { cn } from "@/lib/utils";

// 눈길 로고: 펼친 책 위로 시선의 궤적(호)과 눈동자(별이 든 원)가 뜬 모양.
// 색은 글자색(currentColor)과 테마 토큰을 따라 다크 모드에서도 그대로 보인다.
export function NungilLogo({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 9 64 38"
      fill="none"
      aria-hidden="true"
      className={cn("shrink-0", className)}
    >
      {/* 시선의 궤적 */}
      <path d="M8 24Q32 0 56 24Q32 5 8 24Z" fill="currentColor" />
      {/* 눈동자와 반짝임 */}
      <circle cx="32" cy="20" r="4.6" fill="currentColor" />
      <path
        d="M32 17.6 32.7 19.3 34.4 20 32.7 20.7 32 22.4 31.3 20.7 29.6 20 31.3 19.3Z"
        className="fill-background"
      />
      {/* 책장 */}
      <path
        d="M10 25c8-3 16-2 21 4v13c-5-4-12-5-19-3Z"
        className="fill-muted stroke-foreground/40"
        strokeWidth="0.8"
        strokeLinejoin="round"
      />
      <path
        d="M54 25c-8-3-16-2-21 4v13c5-4 12-5 19-3Z"
        className="fill-muted stroke-foreground/40"
        strokeWidth="0.8"
        strokeLinejoin="round"
      />
      {/* 표지 */}
      <path
        d="M7 26l3 17c8-2 15-1 20 2h4c5-3 12-4 20-2l3-17"
        stroke="currentColor"
        strokeWidth="2.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
