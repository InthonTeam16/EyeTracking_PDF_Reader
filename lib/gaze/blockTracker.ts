// 읽는 순서를 아는 블록 추적기.
// Kaltenberger 외 (2026), "Sure About That Line? Approaching Confidence-Based, Real-Time Line
// Assignment in Reading Gaze Data"(CONF-LA, arXiv:2605.00033)의 방법을 줄 대신 블록 단위로 옮겼다.
//  - 숨은 상태는 블록, 관측은 짧은 구간의 평균 시선 좌표인 은닉 마르코프 모델(HMM)
//  - 관측 확률: 블록 영역에서 벗어난 거리에 대한 정규분포 (영역 안이면 최대)
//  - 전이 확률: 대부분 같은 블록에 머물고, 다음 블록으로 넘어가기 쉽고, 앞 블록으로 돌아가기는 드물다
//  - 가장 높은 사후 확률이 확신 기준을 넘을 때만 블록을 바꾼다 (넘지 못하면 판단을 미룬다)
//  - 판단 미루기(lag): 논문처럼 뒤따르는 관측 몇 개까지 본 뒤(전후향 평활, forward-backward) 그 시점의 블록을 정한다.
//    논문에서 바로 판단(S=1)은 기준 방법과 비슷했고 S≈5~10에서 크게 나아졌다. 대신 lag × windowMs만큼 늦게 바뀐다.
//    지금 관측만으로도 확신이 immediateConfidence 이상이면 기다리지 않고 바로 바꾼다.
// 논문의 드리프트 보정(세로 보정값 학습)은 가상 읽기 실험에서 웹캠 오차가 클 때 엉뚱한 블록에 고정되게 만들어 뺐다.

export type BlockBox = {
  id: string;
  // 읽는 순서 (DOM 순서)
  index: number;
  top: number;
  bottom: number;
  left: number;
  right: number;
};

export type BlockTrackerOptions = {
  // 관측 오차의 표준편차 (px)
  sigmaX: number;
  sigmaY: number;
  // 관측 한 번(windowMs)마다의 전이 확률. 나머지는 멀리 떨어진 블록들에 고르게 나눈다.
  stay: number;
  next: number;
  previous: number;
  // 이 사후 확률을 넘어야 블록을 바꾼다
  confidence: number;
  // 이 시간(ms)마다 모은 좌표의 평균을 관측 하나로 쓴다
  windowMs: number;
  // 판단 전에 기다릴 관측 수 (0이면 바로 판단)
  lag: number;
  // 지금 관측만으로 이 확신 이상이면 기다리지 않는다 (1보다 크면 항상 기다린다)
  immediateConfidence: number;
};

// 관측 하나의 기록: 그때 보이던 블록, 관측 확률, 그 시점까지의 사후 확률(전향)
type Step = { blocks: BlockBox[]; likelihoods: number[]; filtered: number[] };

export type BlockTrackerResult = {
  activeBlockId: string | null;
  confidence: number;
};

// 모든 블록이 이 정도 이하로 설명하면 시선이 글 밖(메뉴, 화면 밖)에 있다고 보고 관측을 버린다.
const OFF_TEXT_SIGMAS = 3;

export function createBlockTracker(options: BlockTrackerOptions) {
  let posterior = new Map<string, number>();
  let active: string | null = null;
  let activeConfidence = 0;
  let windowStart = -1;
  let sum = { x: 0, y: 0, n: 0 };

  const distanceOutside = (value: number, from: number, to: number) =>
    value < from ? value - from : value > to ? value - to : 0;

  const farFor = (count: number) =>
    count > 3 ? (1 - options.stay - options.next - options.previous) / (count - 3) : 0;
  const transition = (from: BlockBox, to: BlockBox, far: number) => {
    const step = to.index - from.index;
    return step === 0 ? options.stay : step === 1 ? options.next : step === -1 ? options.previous : far;
  };
  let history: Step[] = [];

  // 확률이 가장 높은 블록을 고르고, 확신 기준을 넘을 때만 바꾼다.
  function decide(blocks: BlockBox[], probabilities: number[]) {
    let best = 0;
    for (let k = 1; k < blocks.length; k++) if (probabilities[k] > probabilities[best]) best = k;
    const bestId = blocks[best].id;
    if (bestId === active) {
      activeConfidence = probabilities[best];
    } else if (probabilities[best] >= options.confidence || active === null) {
      active = bestId;
      activeConfidence = probabilities[best];
    } else {
      const k = blocks.findIndex((block) => block.id === active);
      activeConfidence = k >= 0 ? probabilities[k] : 0;
    }
  }

  // 기록의 첫 관측 시점의 사후 확률을 그 뒤 관측까지 반영해 구한다 (후향 메시지를 곱한다).
  function smoothOldest(): number[] {
    let backward = history[history.length - 1].blocks.map(() => 1);
    for (let k = history.length - 2; k >= 0; k--) {
      const next = history[k + 1];
      const far = farFor(next.blocks.length);
      const weighted = next.blocks.map((_, j) => next.likelihoods[j] * backward[j]);
      backward = history[k].blocks.map((from) =>
        next.blocks.reduce((total, to, j) => total + transition(from, to, far) * weighted[j], 0),
      );
      const total = backward.reduce((a, b) => a + b, 0) || 1;
      backward = backward.map((value) => value / total);
    }
    const smoothed = history[0].filtered.map((value, k) => value * backward[k]);
    const total = smoothed.reduce((a, b) => a + b, 0) || 1;
    return smoothed.map((value) => value / total);
  }

  function observe(point: { x: number; y: number }, blocks: BlockBox[]) {
    const likelihoods = blocks.map((block) => {
      const dx = distanceOutside(point.x, block.left, block.right) / options.sigmaX;
      const dy = distanceOutside(point.y, block.top, block.bottom) / options.sigmaY;
      return Math.exp(-0.5 * (dx * dx + dy * dy));
    });
    if (Math.max(...likelihoods) < Math.exp(-0.5 * OFF_TEXT_SIGMAS ** 2)) return;

    // 사후 확률이 없던 블록(처음, 스크롤로 새로 보인 블록)은 작은 값에서 시작한다.
    const prior = blocks.map((block) => posterior.get(block.id) ?? 1e-3);
    const priorSum = prior.reduce((a, b) => a + b, 0);
    const far = farFor(blocks.length);

    // 예측: 이전 사후 확률을 전이 확률로 옮긴다.
    const predicted = blocks.map((to) =>
      blocks.reduce((total, from, k) => total + (prior[k] / priorSum) * transition(from, to, far), 0),
    );
    // 갱신: 관측 확률을 곱하고 정규화한다.
    const unnormalized = predicted.map((p, k) => p * likelihoods[k]);
    const total = unnormalized.reduce((a, b) => a + b, 0) || 1;
    const filtered = unnormalized.map((value) => value / total);
    posterior = new Map(blocks.map((block, k) => [block.id, filtered[k]]));

    if (options.lag === 0 || Math.max(...filtered) >= options.immediateConfidence) {
      history = [];
      decide(blocks, filtered);
      return;
    }
    history = [...history, { blocks, likelihoods, filtered }].slice(-(options.lag + 1));
    if (history.length > options.lag) decide(history[0].blocks, smoothOldest());
  }

  return {
    // time은 ms. 블록 목록은 화면 좌표 기준이어야 한다 (스크롤하면 다시 구해서 넘긴다).
    add(point: { x: number; y: number }, time: number, getBlocks: () => BlockBox[]): BlockTrackerResult {
      if (windowStart < 0) windowStart = time;
      sum = { x: sum.x + point.x, y: sum.y + point.y, n: sum.n + 1 };
      if (time - windowStart >= options.windowMs) {
        const blocks = getBlocks();
        if (blocks.length > 0) observe({ x: sum.x / sum.n, y: sum.y / sum.n }, blocks);
        windowStart = time;
        sum = { x: 0, y: 0, n: 0 };
      }
      return { activeBlockId: active, confidence: activeConfidence };
    },
    reset() {
      posterior = new Map();
      active = null;
      activeConfidence = 0;
      history = [];
      windowStart = -1;
      sum = { x: 0, y: 0, n: 0 };
    },
  };
}

// 화면에 보이는(또는 곧 보일) 블록들의 위치를 DOM 순서대로 구한다.
export function readBlockBoxes(margin: number): BlockBox[] {
  const elements = document.querySelectorAll<HTMLElement>("[data-block-id]");
  const boxes: BlockBox[] = [];
  elements.forEach((element, index) => {
    const rect = element.getBoundingClientRect();
    if (rect.bottom < -margin || rect.top > window.innerHeight + margin) return;
    if (rect.width === 0 || rect.height === 0) return;
    boxes.push({
      id: element.getAttribute("data-block-id") ?? "",
      index,
      top: rect.top,
      bottom: rect.bottom,
      left: rect.left,
      right: rect.right,
    });
  });
  return boxes;
}
