type Point = { x: number; y: number };

// 최근 좌표의 이동 평균을 낸다.
export function createPointSmoother(size: number) {
  let recent: Point[] = [];

  return {
    add(point: Point): Point {
      recent = [...recent, point].slice(-size);
      const sum = recent.reduce(
        (total, { x, y }) => ({ x: total.x + x, y: total.y + y }),
        { x: 0, y: 0 },
      );
      return {
        x: Math.round(sum.x / recent.length),
        y: Math.round(sum.y / recent.length),
      };
    },
    reset() {
      recent = [];
    },
  };
}
