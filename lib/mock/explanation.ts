// 데모용 PDF(public/samples/demo-ko.pdf)의 어려운 문단에 맞춘 목업 설명.
// LLM_API_KEY가 없을 때도 데모 장면이 자연스럽게 보이게 한다.
const DEMO_EXPLANATIONS: { keyword: string; explanation: string }[] = [
  {
    keyword: "단속운동 억제",
    explanation:
      "눈이 다음 위치로 휙 옮겨 가는 아주 짧은 순간에는 뇌가 들어오는 장면을 거의 처리하지 않아요. 그래서 시선을 옮길 때 세상이 흔들려 보이지 않아요.",
  },
  {
    keyword: "지각 폭",
    explanation:
      "한 번 눈을 멈췄을 때 실제로 읽어 들이는 글자 범위예요. 읽는 방향 쪽으로 더 넓어서, 다음에 올 글자를 미리 엿보며 읽는 셈이에요.",
  },
  {
    keyword: "추미근",
    explanation:
      "어려운 걸 붙잡고 있으면 동공이 살짝 커지고, 미간을 찌푸리는 근육(추미근)이 움직여요. 얼굴이 '지금 버겁다'는 신호를 보내는 거예요.",
  },
];

export function getMockExplanation(blockText?: string): string {
  if (blockText) {
    const match = DEMO_EXPLANATIONS.find(({ keyword }) =>
      blockText.includes(keyword),
    );
    if (match) return match.explanation;
  }
  return "목업 부가 설명입니다.";
}
