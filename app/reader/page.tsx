import { Suspense } from "react";

import { ReaderScreen } from "@/components/reader/reader-screen";

export default function ReaderPage() {
  return (
    <Suspense>
      <ReaderScreen />
    </Suspense>
  );
}
