import Link from "next/link";

export default function Home() {
  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-4">
      <h1 className="text-2xl font-semibold">EyeTracking PDF Reader</h1>
      <nav className="flex gap-4 text-muted-foreground">
        <Link href="/reader">리더</Link>
        <Link href="/lab/gaze">시선 엔진 테스트</Link>
      </nav>
    </main>
  );
}
