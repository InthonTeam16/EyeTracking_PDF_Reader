// 미간 찡그림 감지. MediaPipe 얼굴 표정 점수(blendshape)를 쓴다.
// 사람마다 평소 표정이 달라 고정 기준 대신 평소 점수(기준선)를 따라가며, 그보다 크게 오른 상태가 이어질 때만 알린다.

type Category = { categoryName: string; score: number };

export type SquintOptions = {
  // 기준선보다 이만큼 높아야 찡그림으로 본다
  threshold: number;
  // 이 시간(ms) 이상 이어져야 한다 (눈 깜빡임, 순간 표정 제외)
  holdMs: number;
  // 한 번 알린 뒤 이 시간(ms) 동안은 다시 알리지 않는다
  cooldownMs: number;
  // 찡그리지 않은 프레임에서 기준선을 따라가는 비율
  baselineRate: number;
};

export function squintScore(categories: Category[]): number {
  const score = (name: string) => categories.find((c) => c.categoryName === name)?.score ?? 0;
  const brow = (score("browDownLeft") + score("browDownRight")) / 2;
  const eye = (score("eyeSquintLeft") + score("eyeSquintRight")) / 2;
  return brow + eye / 2;
}

export function createSquintDetector({ threshold, holdMs, cooldownMs, baselineRate }: SquintOptions) {
  let baseline: number | null = null;
  let since = -1;
  let lastFired = -Infinity;

  return {
    // time은 ms. 찡그림이 확인된 순간 한 번 true를 반환한다.
    add(categories: Category[], time: number): boolean {
      const score = squintScore(categories);
      if (baseline === null) baseline = score;
      if (score - baseline < threshold) {
        baseline += (score - baseline) * baselineRate;
        since = -1;
        return false;
      }
      if (since < 0) since = time;
      if (time - since < holdMs || time - lastFired < cooldownMs) return false;
      lastFired = time;
      // 계속 찡그리고 있으면 다시 알리지 않는다. 표정을 풀었다가 다시 찡그려야 한다.
      since = Infinity;
      return true;
    },
    reset() {
      baseline = null;
      since = -1;
    },
  };
}
