import Link from "next/link";
import { Upload } from "lucide-react";

import { buttonVariants } from "@/components/ui/button";
import { Hero } from "@/components/landing/Hero";
import { HowItWorks } from "@/components/landing/HowItWorks";
import { LandingFooter } from "@/components/landing/LandingFooter";
import { LandingHeader } from "@/components/landing/LandingHeader";
import { WebcamGuide } from "@/components/landing/WebcamGuide";
import { cn } from "@/lib/utils";

export default function Home() {
  return (
    <div className="flex flex-1 flex-col break-keep">
      <LandingHeader />
      <main className="flex-1">
        <Hero
          actions={
            <>
              {/* 업로드 UI: 김정인 담당. 업로드 컴포넌트가 나오면 아래 링크를 교체한다. */}
              {/* TODO(demo): 업로드 UI 연결 전까지 리더 화면으로 이동만 한다. */}
              <Link
                href="/reader"
                className={cn(
                  buttonVariants({ size: "lg" }),
                  "h-13 gap-2.5 rounded-xl px-6 text-base",
                )}
              >
                <Upload className="size-4.5" aria-hidden="true" />
                PDF 올리기
              </Link>
              {/* TODO(demo): 리더에서 ?sample=demo-ko 처리 필요 (public/samples/demo-ko.pdf) */}
              <Link
                href="/reader?sample=demo-ko"
                className={cn(
                  buttonVariants({ variant: "outline", size: "lg" }),
                  "h-13 rounded-xl px-5.5 text-base",
                )}
              >
                샘플 PDF로 체험하기
              </Link>
              {/* TODO(demo): 시선 학습 데이터를 다 모으면 수집 페이지와 함께 지운다. */}
              <Link
                href="/lab/gaze/collect"
                className={cn(
                  buttonVariants({ variant: "ghost", size: "lg" }),
                  "h-13 rounded-xl px-5.5 text-base",
                )}
              >
                데이터 학습
              </Link>
            </>
          }
        />
        <HowItWorks />
        <WebcamGuide />
      </main>
      <LandingFooter />
    </div>
  );
}
