import Link from "next/link";
import { Eye } from "lucide-react";

import { ThemeToggle } from "@/components/reader/theme";

export function LandingHeader() {
  return (
    <header className="border-b border-border">
      <div className="mx-auto flex h-18 max-w-6xl items-center px-6 md:px-8">
        <Link
          href="/"
          className="flex items-center gap-2.5 text-[17px] font-bold text-foreground"
        >
          <Eye className="size-6" strokeWidth={1.8} aria-hidden="true" />
          눈길
        </Link>
        <div className="ml-auto">
          <ThemeToggle />
        </div>
      </div>
    </header>
  );
}
