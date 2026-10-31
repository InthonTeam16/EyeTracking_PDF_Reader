type Point = { x: number; y: number };

export type OneEuroOptions = {
  // 거의 멈춰 있을 때의 차단 주파수(Hz). 낮을수록 떨림을 많이 거르지만 늦게 따라온다.
  minCutoff: number;
  // 속도가 빠를수록 차단 주파수를 얼마나 올릴지. 클수록 빠른 이동을 덜 늦춘다.
  beta: number;
  // 속도 자체를 거르는 차단 주파수(Hz)
  dCutoff: number;
};

// One Euro 필터 (Casiez, Roussel, Vogel, CHI 2012).
// 이동 평균은 멈춰 있을 때의 떨림과 빠른 이동을 똑같이 늦춘다. 이 필터는 느리게 움직일 때 강하게,
// 빠르게 움직일 때 약하게 걸러서, 읽기의 멈춤(응시)은 안정적으로, 도약은 빨리 따라간다.
export function createOneEuroFilter({ minCutoff, beta, dCutoff }: OneEuroOptions) {
  let previous: Point | null = null;
  let previousSpeed: Point = { x: 0, y: 0 };
  let previousTime = 0;

  // 지수 평활 계수: 차단 주파수와 시간 간격으로 정해진다.
  const alpha = (cutoff: number, dt: number) => {
    const tau = 1 / (2 * Math.PI * cutoff);
    return 1 / (1 + tau / dt);
  };
  const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

  return {
    // time은 ms
    add(point: Point, time: number): Point {
      if (!previous) {
        previous = point;
        previousTime = time;
        return point;
      }
      const dt = Math.max((time - previousTime) / 1000, 1e-3);
      previousTime = time;

      const speedAlpha = alpha(dCutoff, dt);
      const speed = {
        x: lerp(previousSpeed.x, (point.x - previous.x) / dt, speedAlpha),
        y: lerp(previousSpeed.y, (point.y - previous.y) / dt, speedAlpha),
      };
      previousSpeed = speed;

      // 두 축을 함께 움직이므로 속력 하나로 차단 주파수를 정한다.
      const cutoff = minCutoff + beta * Math.hypot(speed.x, speed.y);
      const pointAlpha = alpha(cutoff, dt);
      previous = {
        x: lerp(previous.x, point.x, pointAlpha),
        y: lerp(previous.y, point.y, pointAlpha),
      };
      return previous;
    },
    reset() {
      previous = null;
      previousSpeed = { x: 0, y: 0 };
    },
  };
}
