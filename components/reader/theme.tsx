"use client";

import { MoonIcon, SunIcon } from "lucide-react";
import { useEffect, useSyncExternalStore } from "react";

import { Button } from "@/components/ui/button";

// 사이트 공용 테마. 리더 설정과 따로 저장해서 랜딩·다른 페이지에서도 같은 값을 쓴다.
export type Theme = "light" | "dark" | "system";

const THEME_KEY = "theme";
const DARK_QUERY = "(prefers-color-scheme: dark)";
const listeners = new Set<() => void>();

function readTheme(): Theme {
  try {
    const saved = localStorage.getItem(THEME_KEY);
    return saved === "light" || saved === "dark" ? saved : "system";
  } catch {
    return "system";
  }
}

export function setTheme(theme: Theme) {
  try {
    localStorage.setItem(THEME_KEY, theme);
  } catch {
    // 저장이 막힌 브라우저에서는 이번 페이지에만 적용된다.
  }
  listeners.forEach((listener) => listener());
}

function subscribe(onChange: () => void) {
  listeners.add(onChange);
  const query = window.matchMedia(DARK_QUERY);
  query.addEventListener("change", onChange);
  // 다른 탭에서 바꾼 테마도 따라간다.
  window.addEventListener("storage", onChange);
  return () => {
    listeners.delete(onChange);
    query.removeEventListener("change", onChange);
    window.removeEventListener("storage", onChange);
  };
}

function resolveDark(theme: Theme) {
  return (
    theme === "dark" ||
    (theme === "system" && window.matchMedia(DARK_QUERY).matches)
  );
}

// 지금 테마와 실제로 어두운지 돌려주고, <html>에 dark 클래스를 맞춰 붙인다.
export function useTheme(): { theme: Theme; dark: boolean } {
  const theme = useSyncExternalStore(
    subscribe,
    readTheme,
    (): Theme => "system",
  );
  const dark = useSyncExternalStore(
    subscribe,
    () => resolveDark(readTheme()),
    () => false,
  );

  useEffect(() => {
    const root = document.documentElement;
    root.classList.toggle("dark", dark);
    // 스크롤바처럼 브라우저가 그리는 부분도 어둡게 한다.
    root.style.colorScheme = dark ? "dark" : "";
  }, [dark]);

  return { theme, dark };
}

// app/layout.tsx의 <head>에 넣으면 첫 화면이 그려지기 전에 테마를 적용해 밝게 깜빡이지 않는다.
// <html>에는 suppressHydrationWarning이 필요하다 (클래스를 미리 바꾸기 때문).
const THEME_SCRIPT = `try{var t=localStorage.getItem("${THEME_KEY}");var d=t==="dark"||(t!=="light"&&matchMedia("${DARK_QUERY}").matches);if(d){document.documentElement.classList.add("dark");document.documentElement.style.colorScheme="dark"}}catch(e){}`;

export function ThemeScript() {
  return <script dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }} />;
}

// 라이트 ↔ 다크 전환 버튼. 랜딩 헤더 등 어디에나 둘 수 있다.
export function ThemeToggle() {
  const { dark } = useTheme();
  return (
    <Button
      variant="ghost"
      size="icon-sm"
      aria-label={dark ? "라이트 모드로" : "다크 모드로"}
      title={dark ? "라이트 모드로" : "다크 모드로"}
      onClick={() => setTheme(dark ? "light" : "dark")}
    >
      {dark ? <SunIcon /> : <MoonIcon />}
    </Button>
  );
}
