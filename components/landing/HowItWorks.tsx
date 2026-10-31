const STEPS = [
  {
    title: "PDF 올리기",
    description:
      "문서를 문맥 단위 블록으로 다시 배치해요. 줄 간격을 넉넉하게 벌려 시선이 어느 문단에 있는지 정확히 잡아내요.",
  },
  {
    title: "시선 맞추기",
    description:
      "화면에 나타나는 점 몇 개를 차례로 바라보면 내 눈에 맞게 보정돼요. 웹캠 하나면 돼요.",
  },
  {
    title: "읽기만 하세요",
    description:
      "읽는 문단만 선명해지고 나머지는 흐려져 집중이 흩어지지 않아요. 막히는 문단을 오래 보면 설명이 떠요.",
  },
];

export function HowItWorks() {
  return (
    <section className="border-y border-border bg-muted/50">
      <div className="mx-auto flex max-w-6xl flex-col gap-10 px-6 py-22 md:px-8">
        <div className="flex flex-col gap-2.5">
          <h2 className="text-3xl font-bold tracking-tight md:text-[34px]">
            세 단계면 충분해요
          </h2>
          <p className="text-[17px] text-muted-foreground">
            설치도, 회원가입도 없어요. 브라우저에서 바로 시작해요.
          </p>
        </div>
        <ol className="flex flex-wrap gap-5">
          {STEPS.map((step, index) => (
            <li
              key={step.title}
              className="flex min-w-0 flex-[1_1_300px] flex-col gap-3.5 rounded-2xl border border-border bg-background p-7"
            >
              <span className="text-sm font-bold text-muted-foreground">
                {String(index + 1).padStart(2, "0")}
              </span>
              <h3 className="text-xl font-bold">{step.title}</h3>
              <p className="leading-7 text-foreground/80">{step.description}</p>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}
