"use client";

import {
  BanIcon,
  EyeIcon,
  FileTextIcon,
  Settings2Icon,
  SunMoonIcon,
  TypeIcon,
  type LucideIcon,
} from "lucide-react";
import { useEffect, useRef, useState, type ReactNode } from "react";

import { setTheme, useTheme } from "@/components/reader/theme";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export type HighlightColor = "yellow" | "green" | "pink" | "blue";

export type ReaderSettings = {
  font: "sans" | "serif";
  // FONT_SIZE_CLASSES의 순서
  fontSize: number;
  lineHeight: "tight" | "normal" | "loose";
  // 0이면 하이라이트·흐림 없이 그냥 읽는다. 1부터는 BLUR_CLASSES[focus - 1]
  focus: number;
  // 끄면 오래 응시해도 부가 설명 팝업을 띄우지 않는다
  explain: boolean;
  // 켜면 원본 PDF가 지금 읽는 블록의 페이지로 따라간다
  syncPdf: boolean;
  // 원본 PDF에서 지금 읽는 줄을 칠할 형광펜 색. none이면 칠하지 않는다
  pdfHighlightColor: HighlightColor | "none";
  // 다크 모드에서 흰 PDF 페이지도 색을 뒤집어 어둡게 보여준다
  darkPdf: boolean;
};

export const DEFAULT_SETTINGS: ReaderSettings = {
  font: "sans",
  fontSize: 1,
  lineHeight: "normal",
  focus: 3,
  explain: true,
  syncPdf: false,
  pdfHighlightColor: "yellow",
  darkPdf: true,
};

// Tailwind가 클래스를 찾을 수 있게 전체 이름으로 적는다.
export const FONT_CLASSES: Record<ReaderSettings["font"], string> = {
  sans: "font-sans",
  serif: "font-serif",
};
export const FONT_SIZE_CLASSES = [
  "text-base",
  "text-lg",
  "text-xl",
  "text-2xl",
];
export const LINE_HEIGHT_CLASSES: Record<ReaderSettings["lineHeight"], string> =
  {
    tight: "leading-relaxed",
    normal: "leading-loose",
    loose: "leading-[2.5]",
  };
// 지금 읽지 않는 블록에 붙는 클래스. 오른쪽으로 갈수록 강하게 흐린다.
export const BLUR_CLASSES = [
  "opacity-60",
  "opacity-50 blur-[1px]",
  "opacity-40 blur-[3px]",
  "opacity-30 blur-[5px]",
  "opacity-20 blur-[8px]",
];

// 형광펜 색. 테마 토큰은 회색뿐이라 Tailwind 기본 팔레트의 파스텔 톤(200)을 쓴다 (docs/decisions.md).
export const HIGHLIGHT_CLASSES: Record<HighlightColor, string> = {
  yellow: "bg-yellow-200",
  green: "bg-green-200",
  pink: "bg-pink-200",
  blue: "bg-sky-200",
};
const HIGHLIGHT_SWATCHES: { value: HighlightColor; label: string }[] = [
  { value: "yellow", label: "노랑" },
  { value: "green", label: "초록" },
  { value: "pink", label: "분홍" },
  { value: "blue", label: "파랑" },
];

// 설정 모양을 바꾸면 버전을 올려 예전에 저장된 설정 대신 새 기본값으로 시작하게 한다.
const STORAGE_KEY = "reader-settings-v3";

// 다시 열어도 같은 설정으로 읽도록 이 브라우저에만 저장한다.
export function useReaderSettings() {
  const [settings, setSettings] = useState<ReaderSettings>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      return saved
        ? { ...DEFAULT_SETTINGS, ...(JSON.parse(saved) as ReaderSettings) }
        : DEFAULT_SETTINGS;
    } catch {
      return DEFAULT_SETTINGS;
    }
  });

  const update = (patch: Partial<ReaderSettings>) =>
    setSettings((prev) => {
      const next = { ...prev, ...patch };
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      } catch {
        // 저장이 막힌 브라우저에서는 이번 세션에만 적용한다.
      }
      return next;
    });

  return [settings, update] as const;
}

type Tab = "text" | "reading" | "pdf" | "theme";

const TABS: { value: Tab; label: string; icon: LucideIcon }[] = [
  { value: "text", label: "글자", icon: TypeIcon },
  { value: "reading", label: "읽기", icon: EyeIcon },
  { value: "pdf", label: "원본 PDF", icon: FileTextIcon },
  { value: "theme", label: "테마", icon: SunMoonIcon },
];

type ReaderSettingsButtonProps = {
  settings: ReaderSettings;
  onChange: (patch: Partial<ReaderSettings>) => void;
};

export function ReaderSettingsButton({
  settings,
  onChange,
}: ReaderSettingsButtonProps) {
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<Tab>("text");
  const rootRef = useRef<HTMLDivElement>(null);
  const { theme } = useTheme();

  // 패널 밖을 누르거나 Esc를 누르면 닫는다.
  useEffect(() => {
    if (!open) return;
    const handlePointerDown = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [open]);

  return (
    <div ref={rootRef} className="relative">
      <Button
        variant="ghost"
        size="icon-sm"
        aria-label="보기 설정"
        aria-expanded={open}
        onClick={() => setOpen((prev) => !prev)}
      >
        <Settings2Icon />
      </Button>

      {open && (
        <div
          role="dialog"
          aria-label="보기 설정"
          className="absolute top-full right-0 z-20 mt-2 w-72 overflow-hidden rounded-xl bg-popover text-sm text-popover-foreground shadow-lg ring-1 ring-foreground/10 animate-in fade-in slide-in-from-top-1"
        >
          <div role="tablist" className="flex border-b">
            {TABS.map(({ value, label, icon: Icon }) => (
              <button
                key={value}
                type="button"
                role="tab"
                aria-selected={tab === value}
                aria-label={label}
                title={label}
                onClick={() => setTab(value)}
                className={cn(
                  "flex flex-1 justify-center py-3 text-muted-foreground transition-colors hover:text-foreground",
                  tab === value &&
                    "text-foreground shadow-[inset_0_-2px_0_var(--color-foreground)]",
                )}
              >
                <Icon className="size-4" />
              </button>
            ))}
          </div>

          <div role="tabpanel" className="flex flex-col gap-5 p-4">
            {tab === "text" && (
              <>
                <Row label="글꼴">
                  <Segmented
                    value={settings.font}
                    options={[
                      { value: "sans", label: "고딕" },
                      { value: "serif", label: "명조" },
                    ]}
                    onChange={(font) => onChange({ font })}
                  />
                </Row>
                <Row label="글자 크기">
                  <Range
                    value={settings.fontSize}
                    max={FONT_SIZE_CLASSES.length - 1}
                    onChange={(fontSize) => onChange({ fontSize })}
                    start={<span className="text-xs">가</span>}
                    end={<span className="text-lg">가</span>}
                  />
                </Row>
                <Row label="줄 간격">
                  <Segmented
                    value={settings.lineHeight}
                    options={[
                      { value: "tight", label: "좁게" },
                      { value: "normal", label: "보통" },
                      { value: "loose", label: "넓게" },
                    ]}
                    onChange={(lineHeight) => onChange({ lineHeight })}
                  />
                </Row>
              </>
            )}

            {tab === "reading" && (
              <>
                <Row label="집중 효과">
                  <Range
                    value={settings.focus}
                    max={BLUR_CLASSES.length}
                    onChange={(focus) => onChange({ focus })}
                    start={
                      <span className="text-xs text-muted-foreground">끔</span>
                    }
                    end={
                      <span className="text-xs text-muted-foreground">
                        강하게
                      </span>
                    }
                  />
                </Row>
                <Toggle
                  label="오래 보면 부가 설명"
                  checked={settings.explain}
                  onChange={(explain) => onChange({ explain })}
                />
              </>
            )}

            {tab === "pdf" && (
              <>
                <Row label="형광펜">
                  <div
                    role="radiogroup"
                    aria-label="형광펜 색"
                    className="flex items-center gap-2"
                  >
                    <Swatch
                      label="없음"
                      selected={settings.pdfHighlightColor === "none"}
                      onSelect={() => onChange({ pdfHighlightColor: "none" })}
                      className="flex items-center justify-center bg-muted text-muted-foreground"
                    >
                      <BanIcon className="size-3" />
                    </Swatch>
                    {HIGHLIGHT_SWATCHES.map((swatch) => (
                      <Swatch
                        key={swatch.value}
                        label={swatch.label}
                        selected={settings.pdfHighlightColor === swatch.value}
                        onSelect={() =>
                          onChange({ pdfHighlightColor: swatch.value })
                        }
                        className={HIGHLIGHT_CLASSES[swatch.value]}
                      />
                    ))}
                  </div>
                </Row>
                <Toggle
                  label="읽는 페이지 따라가기"
                  checked={settings.syncPdf}
                  onChange={(syncPdf) => onChange({ syncPdf })}
                />
              </>
            )}

            {tab === "theme" && (
              <>
                <Row label="화면">
                  <Segmented
                    value={theme}
                    options={[
                      { value: "light", label: "라이트" },
                      { value: "dark", label: "다크" },
                      { value: "system", label: "시스템" },
                    ]}
                    onChange={setTheme}
                  />
                </Row>
                <Row label="다크에서 PDF">
                  <Segmented
                    value={settings.darkPdf ? "dark" : "original"}
                    options={[
                      { value: "original", label: "원본 색" },
                      { value: "dark", label: "어둡게" },
                    ]}
                    onChange={(value) =>
                      onChange({ darkPdf: value === "dark" })
                    }
                  />
                </Row>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-4">
      <span className="shrink-0 text-muted-foreground">{label}</span>
      {children}
    </div>
  );
}

function Segmented<T extends string>({
  value,
  options,
  onChange,
}: {
  value: T;
  options: { value: T; label: string }[];
  onChange: (value: T) => void;
}) {
  return (
    <div className="flex gap-1 rounded-lg bg-muted p-1">
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          aria-pressed={value === option.value}
          onClick={() => onChange(option.value)}
          className={cn(
            "rounded-md px-2.5 py-1 text-xs text-muted-foreground transition-colors",
            value === option.value && "bg-background text-foreground shadow-sm",
          )}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}

function Range({
  value,
  max,
  onChange,
  start,
  end,
}: {
  value: number;
  max: number;
  onChange: (value: number) => void;
  start: ReactNode;
  end: ReactNode;
}) {
  return (
    <div className="flex min-w-0 flex-1 items-center gap-2">
      {start}
      <input
        type="range"
        min={0}
        max={max}
        step={1}
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
        className="min-w-0 flex-1 accent-primary"
      />
      {end}
    </div>
  );
}

function Swatch({
  label,
  selected,
  onSelect,
  className,
  children,
}: {
  label: string;
  selected: boolean;
  onSelect: () => void;
  className: string;
  children?: ReactNode;
}) {
  return (
    <button
      type="button"
      role="radio"
      aria-label={label}
      title={label}
      aria-checked={selected}
      onClick={onSelect}
      className={cn(
        "size-6 rounded-full ring-1 ring-foreground/10 ring-offset-2 ring-offset-popover transition-shadow",
        selected && "ring-2 ring-ring",
        className,
      )}
    >
      {children}
    </button>
  );
}

function Toggle({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <label className="flex cursor-pointer items-center justify-between gap-4">
      <span>{label}</span>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={cn(
          "relative h-5 w-9 shrink-0 rounded-full transition-colors",
          checked ? "bg-primary" : "bg-input",
        )}
      >
        <span
          className={cn(
            "absolute top-0.5 left-0.5 size-4 rounded-full bg-background shadow-sm transition-transform",
            checked && "translate-x-4",
          )}
        />
      </button>
    </label>
  );
}
