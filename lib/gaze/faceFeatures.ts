import { headPoseFromMatrix } from "@/lib/gaze/headPose";

type Landmark = { x: number; y: number };

const EYES = [
  { outer: 33, inner: 133, top: 159, bottom: 145, iris: [469, 470, 471, 472] },
  { outer: 263, inner: 362, top: 386, bottom: 374, iris: [474, 475, 476, 477] },
];

// extractGazeFeatures가 반환하는 배열의 구성
export const IRIS_FEATURE_INDICES = [0, 1];
export const HEAD_FEATURE_INDICES = [2, 3];
export const YAW_FEATURE_INDEX = 2;
export const PITCH_FEATURE_INDEX = 3;

function center(points: Landmark[]): Landmark {
  return {
    x: points.reduce((sum, point) => sum + point.x, 0) / points.length,
    y: points.reduce((sum, point) => sum + point.y, 0) / points.length,
  };
}

// 얼굴 랜드마크를 시선 회귀의 입력값으로 바꾼다. 눈을 감고 있으면 null을 반환한다.
export function extractGazeFeatures(
  landmarks: Landmark[],
  width: number,
  height: number,
  minEyeOpenRatio: number,
  matrix: number[],
): number[] | null {
  // 정규화 좌표는 가로세로 비율이 달라 각도와 거리를 재려면 픽셀로 바꿔야 한다.
  const at = (index: number): Landmark => ({
    x: landmarks[index].x * width,
    y: landmarks[index].y * height,
  });

  const irisFeatures: number[] = [];
  for (const eye of EYES) {
    const outer = at(eye.outer);
    const inner = at(eye.inner);
    const iris = center(eye.iris.map(at));
    const axisX = inner.x - outer.x;
    const axisY = inner.y - outer.y;
    const lengthSquared = axisX * axisX + axisY * axisY;
    if (lengthSquared === 0) return null;

    const top = at(eye.top);
    const bottom = at(eye.bottom);
    const openRatio =
      Math.hypot(top.x - bottom.x, top.y - bottom.y) /
      Math.sqrt(lengthSquared);
    if (openRatio < minEyeOpenRatio) return null;

    // 눈꼬리 선을 기준으로 재서 머리 위치, 크기, 기울기에 영향받지 않는다.
    const offsetX = iris.x - outer.x;
    const offsetY = iris.y - outer.y;
    irisFeatures.push(
      (offsetX * axisX + offsetY * axisY) / lengthSquared,
      (offsetY * axisX - offsetX * axisY) / lengthSquared,
    );
  }

  // 눈 하나만 믿으면 작은 떨림이 시선을 크게 흔들어 양쪽을 평균한다.
  // 눈꼬리 축이 두 눈에서 반대 방향이라 빼야 같은 방향이 된다.
  const [firstX, firstY, secondX, secondY] = irisFeatures;
  const { yaw, pitch } = headPoseFromMatrix(matrix);
  return [(firstX - secondX) / 2, (firstY - secondY) / 2, yaw, pitch];
}

// 실험: MediaPipe 표정 점수의 눈 위·아래 보기(eyeLookUp/Down) 차이. 눈꺼풀에 가려 홍채 좌표가 약한 세로 방향을 보완할 수 있는지 본다.
// 시선 입력 끝에 붙이므로 이 값 없이 모은 데이터(저장된 데이터셋)와는 함께 쓸 수 없다.
export function eyeLookVertical(
  categories: { categoryName: string; score: number }[],
): number {
  const score = (name: string) =>
    categories.find((c) => c.categoryName === name)?.score ?? 0;
  const up = (score("eyeLookUpLeft") + score("eyeLookUpRight")) / 2;
  const down = (score("eyeLookDownLeft") + score("eyeLookDownRight")) / 2;
  return up - down;
}
