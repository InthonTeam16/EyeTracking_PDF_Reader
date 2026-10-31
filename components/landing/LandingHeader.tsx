import Link from "next/link";
import { NungilLogo } from "@/components/landing/NungilLogo";

import { ThemeToggle } from "@/components/reader/theme";

export function LandingHeader() {
  return (
    <header className="border-b border-border">
      <div className="mx-auto flex h-18 max-w-6xl items-center px-6 md:px-8">
        <Link
          href="/"
          className="flex items-center gap-2.5 text-[17px] font-bold text-foreground"
        >
          <NungilLogo className="h-7 w-auto" />
          눈길
        </Link>
        <div className="ml-auto">
          <ThemeToggle />
        </div>
      </div>
    </header>
  );
}
