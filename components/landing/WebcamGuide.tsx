import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import { Clock, Crosshair, Lock, Mouse } from "lucide-react";
import type { ReactNode } from "react";

type GuideItem = {
  icon: LucideIcon;
  title: string;
  description: ReactNode;
};

const ITEMS: GuideItem[] = [
  {
    icon: Lock,
    title: "영상은 브라우저 안에서만",
    description:
      "카메라 영상은 내 컴퓨터의 브라우저에서 바로 처리돼요. 서버로 보내지 않아요.",
  },
  {
    icon: Mouse,
    title: "웹캠이 없어도 괜찮아요",
    description:
      "권한을 허용하지 않거나 시선을 잡기 어려우면 마우스 모드로 자연스럽게 바뀌어요.",
  },
  {
    icon: Clock,
    title: "밝은 곳에서, 정면으로",
    description:
      "얼굴이 고르게 밝고 화면과 눈높이가 비슷할 때 가장 정확해요.",
  },
  {
    icon: Crosshair,
    title: "먼저 시험해 보기",
    description: (
      <>
        <Link
          href="/lab/gaze"
          className="font-medium text-foreground underline underline-offset-4 hover:text-foreground/70"
        >
          시선 엔진 테스트
        </Link>
        에서 내 시선이 잘 잡히는지 미리 확인할 수 있어요.
      </>
    ),
  },
];

export function WebcamGuide() {
  return (
    <section className="mx-auto flex max-w-6xl flex-wrap gap-12 px-6 py-22 md:px-8">
      <div className="flex min-w-0 flex-[1_1_320px] flex-col gap-2.5">
        <h2 className="text-3xl font-bold tracking-tight md:text-[34px]">
          웹캠, 이렇게 써요
        </h2>
        <p className="text-[17px] text-muted-foreground">
          시선을 읽기 위해서만 카메라를 켜요.
        </p>
      </div>
      <ul className="grid min-w-0 flex-[2_1_560px] grid-cols-1 gap-x-5 gap-y-6 sm:grid-cols-2">
        {ITEMS.map(({ icon: Icon, title, description }) => (
          <li key={title} className="flex gap-4">
            <Icon
              className="mt-0.5 size-6 flex-none"
              strokeWidth={1.8}
              aria-hidden="true"
            />
            <div className="flex flex-col gap-1.5">
              <h3 className="text-lg font-bold">{title}</h3>
              <p className="text-[15px] leading-7 text-foreground/80">
                {description}
              </p>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
