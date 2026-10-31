// 기하 모델: 얼굴 3D 자세와 홍채 위치로 시선 광선을 만들고, 그 광선이 화면과 만나는 점을 입력값으로 쓴다.
// 홍채 좌표를 바로 회귀에 넣으면 고개를 돌리거나 앉은 거리가 바뀔 때마다 관계가 달라지지만,
// 광선이 화면과 만나는 점은 자세가 바뀌어도 같은 곳을 보면 같은 값이 나온다. 보정은 이 점(cm)을 화면 픽셀로
// 옮기는 선형 변환만 배우면 된다(카메라와 화면의 위치 관계, 눈마다 다른 시축 차이를 흡수).
// 참고: 눈알 중심 + 홍채로 시선 방향을 구하는 모델 기반 방법 (Wood & Bulling, "EyeTab", ETRA 2014;
// Sun 외, "Real-Time Gaze Estimation with Online Calibration", IEEE MultiMedia 2014).
// 좌표계는 MediaPipe 얼굴 기하 파이프라인을 따른다: 정규 얼굴 모델 단위(cm), 오른손 좌표계, 카메라는 -z를 보고
// 세로 화각 63도의 원근 카메라로 투영한다 (face_geometry/libs/geometry_pipeline.cc, 기본 환경).

type Landmark = { x: number; y: number };
type Vector = [number, number, number];

// MediaPipe 기본 환경의 세로 화각
const VERTICAL_FOV_DEGREES = 63;

// 정규 얼굴 모델(canonical_face_model.obj)의 눈꼬리·눈꺼풀 좌표 (cm). 얼굴 앞쪽이 +z다.
const EYES = [
  {
    outer: [-4.445859, 2.663991, 3.173422],
    inner: [-1.856432, 2.585245, 3.757904],
    lidZ: (3.876973 + 3.775704) / 2,
    outerIndex: 33,
    innerIndex: 133,
    iris: [469, 470, 471, 472],
  },
  {
    outer: [4.445859, 2.663991, 3.173422],
    inner: [1.856432, 2.585245, 3.757904],
    lidZ: (3.876973 + 3.775704) / 2,
    outerIndex: 263,
    innerIndex: 362,
    iris: [474, 475, 476, 477],
  },
];

export type EyeballModel = {
  // 눈꺼풀 높이에서 눈알 회전 중심까지의 깊이 (cm)
  depth: number;
  // 회전 중심에서 홍채(동공) 중심까지의 거리 (cm)
  radius: number;
};

const sub = (a: Vector, b: Vector): Vector => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const dot = (a: Vector, b: Vector) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const scale = (a: Vector, s: number): Vector => [a[0] * s, a[1] * s, a[2] * s];
const normalize = (a: Vector): Vector => scale(a, 1 / Math.hypot(...a));

// 열 우선 4x4 행렬로 정규 얼굴 좌표를 카메라 좌표로 옮긴다.
function transform(m: number[], [x, y, z]: Vector): Vector {
  return [
    m[0] * x + m[4] * y + m[8] * z + m[12],
    m[1] * x + m[5] * y + m[9] * z + m[13],
    m[2] * x + m[6] * y + m[10] * z + m[14],
  ];
}

// 정규화 이미지 좌표(왼쪽 위 원점)를 지나는 카메라 광선의 방향
function cameraRay(point: Landmark, width: number, height: number): Vector {
  const halfHeight = Math.tan((VERTICAL_FOV_DEGREES * Math.PI) / 360);
  const halfWidth = (halfHeight * width) / height;
  return normalize([(2 * point.x - 1) * halfWidth, (1 - 2 * point.y) * halfHeight, -1]);
}

// 카메라 좌표의 점을 정규화 이미지 좌표로 투영한다 (cameraRay의 역).
export function projectToImage(point: Vector, width: number, height: number): Landmark {
  const halfHeight = Math.tan((VERTICAL_FOV_DEGREES * Math.PI) / 360);
  const halfWidth = (halfHeight * width) / height;
  const depth = -point[2];
  return {
    x: (point[0] / depth / halfWidth + 1) / 2,
    y: (1 - point[1] / depth / halfHeight) / 2,
  };
}

// 눈알 중심. 행렬의 위치값은 0.5cm만 틀려도 홍채(1cm 앞)와의 방향이 크게 바뀌므로,
// 이미지의 눈꼬리 중점을 기준으로 잡고 행렬에서는 그 깊이와 고개 회전만 가져온다.
function eyeballCenters(
  landmarks: Landmark[],
  width: number,
  height: number,
  matrix: number[],
  eyeball: EyeballModel,
): Vector[] {
  return EYES.map((eye) => {
    // 두 눈꼬리를 각자의 깊이로 되돌린 뒤 3D 중점을 잡는다 (고개를 돌리면 두 눈꼬리 깊이가 다르다).
    const [outer, inner] = (
      [
        [eye.outer, landmarks[eye.outerIndex]],
        [eye.inner, landmarks[eye.innerIndex]],
      ] as const
    ).map(([canonical, image]) => {
      const ray = cameraRay(image, width, height);
      return scale(ray, transform(matrix, canonical as Vector)[2] / ray[2]);
    });
    const anchorInCamera = scale(
      [outer[0] + inner[0], outer[1] + inner[1], outer[2] + inner[2]],
      0.5,
    );
    const anchorZ = (eye.outer[2] + eye.inner[2]) / 2;
    // 눈꼬리 중점에서 눈알 중심까지(얼굴 안쪽으로)를 고개 회전만 적용해 더한다.
    const back: Vector = [0, 0, eye.lidZ - eyeball.depth - anchorZ];
    const rotated: Vector = [matrix[8] * back[2], matrix[9] * back[2], matrix[10] * back[2]];
    return [anchorInCamera[0] + rotated[0], anchorInCamera[1] + rotated[1], anchorInCamera[2] + rotated[2]];
  });
}

// 두 눈의 시선 광선이 화면 평면(카메라가 있는 z = 0 평면)과 만나는 점의 평균 (cm).
// 눈을 감았는지는 호출하는 쪽에서 먼저 확인한다. 시선이 화면 쪽을 향하지 않으면 null.
export function extractGeometricFeatures(
  landmarks: Landmark[],
  width: number,
  height: number,
  matrix: number[],
  eyeball: EyeballModel,
): number[] | null {
  // 행렬에 크기 변화가 섞여 있으면 눈알 크기도 같이 맞춘다.
  const size = Math.hypot(matrix[0], matrix[1], matrix[2]);
  const radius = eyeball.radius * size;
  const centers = eyeballCenters(landmarks, width, height, matrix, eyeball);

  const hits = EYES.map((eye, index) => {
    const center = centers[index];
    const iris = eye.iris.map((i) => landmarks[i]);
    const ray = cameraRay(
      {
        x: iris.reduce((sum, point) => sum + point.x, 0) / iris.length,
        y: iris.reduce((sum, point) => sum + point.y, 0) / iris.length,
      },
      width,
      height,
    );
    // 카메라에서 홍채 쪽으로 쏜 광선이 눈알 구와 만나는 앞쪽 점이 홍채 중심이다.
    // 잡음으로 구를 비껴가면 구에서 가장 가까운 점을 쓴다.
    const along = dot(ray, center);
    const discriminant = along * along - (dot(center, center) - radius * radius);
    const closest = scale(ray, discriminant >= 0 ? along - Math.sqrt(discriminant) : along);
    const irisCenter: Vector =
      discriminant >= 0
        ? closest
        : (() => {
            const offset = normalize(sub(closest, center));
            return [center[0] + offset[0] * radius, center[1] + offset[1] * radius, center[2] + offset[2] * radius];
          })();
    const gaze = normalize(sub(irisCenter, center));
    if (gaze[2] <= 1e-3) return null;
    const distance = -center[2] / gaze[2];
    return [center[0] + gaze[0] * distance, center[1] + gaze[1] * distance];
  });
  if (hits.some((hit) => hit === null)) return null;
  const [first, second] = hits as number[][];
  return [(first[0] + second[0]) / 2, (first[1] + second[1]) / 2];
}
