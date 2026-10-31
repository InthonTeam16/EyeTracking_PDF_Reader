type Landmark = { x: number; y: number };

const EYES = [
  { outer: 33, inner: 133, top: 159, bottom: 145, iris: [469, 470, 471, 472] },
  { outer: 263, inner: 362, top: 386, bottom: 374, iris: [474, 475, 476, 477] },
];
const NOSE_TIP = 1;

// extractGazeFeatures가 반환하는 배열의 구성
export const IRIS_FEATURE_INDICES = [0, 1, 2, 3];
export const HEAD_FEATURE_INDICES = [4, 5, 6, 7, 8, 9];

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

  const [firstEye, secondEye] = EYES.map((eye) =>
    center([at(eye.outer), at(eye.inner)]),
  );
  const eyesCenter = center([firstEye, secondEye]);
  const eyeLineX = secondEye.x - firstEye.x;
  const eyeLineY = secondEye.y - firstEye.y;
  const eyeDistanceSquared = eyeLineX * eyeLineX + eyeLineY * eyeLineY;
  if (eyeDistanceSquared === 0) return null;

  // 눈 사이 중점에서 코끝까지의 거리로 고개 돌림(좌우)과 끄덕임(상하)을 근사한다.
  const nose = at(NOSE_TIP);
  const noseX = nose.x - eyesCenter.x;
  const noseY = nose.y - eyesCenter.y;

  return [
    ...irisFeatures,
    (noseX * eyeLineX + noseY * eyeLineY) / eyeDistanceSquared,
    (noseY * eyeLineX - noseX * eyeLineY) / eyeDistanceSquared,
    Math.atan2(eyeLineY, eyeLineX),
    eyesCenter.x / width,
    eyesCenter.y / height,
    Math.sqrt(eyeDistanceSquared) / width,
  ];
}
