// TODO(demo): 임시값. 실제 웹캠으로 테스트한 뒤 조정한다.
export const DWELL_MS = 1500;

// TODO(demo): 임시값. 크면 안정적이지만 시선을 늦게 따라온다.
export const GAZE_SMOOTHING_SAMPLES = 10;

// TODO(demo): 아래 시선 추정 값은 모두 임시값. 실제 웹캠으로 테스트한 뒤 조정한다.
export const GAZE_MIN_TRAINING_CLICKS = 9;
export const GAZE_MAX_TRAINING_CLICKS = 60;
export const GAZE_RIDGE_LAMBDA = 1;
export const GAZE_FEATURE_AVERAGE_FRAMES = 5;
export const MIN_EYE_OPEN_RATIO = 0.1;
export const GAZE_CORRECTION_CLICKS = 5;
export const GAZE_DATASET_FOLDS = 5;
export const GAZE_OUTLIER_SIGMA = 2.5;
export const GAZE_MIN_DATASET_SAMPLES = 20;
export const GAZE_HEAD_FOLLOW_CORRELATION = 0.6;
// 고개를 1도 들 때 시선이 올라가는 양(화면 높이 비율)
export const GAZE_PITCH_Y_PER_DEGREE = -0.01;
// 고개를 1도 돌릴 때 시선이 옮겨 가는 양(화면 너비 비율). 사용자 왼쪽이 양수다.
export const GAZE_YAW_X_PER_DEGREE = -0.02;

// 가운데 고정 읽기. 칸 높이 대비 nextZone보다 아래(previousZone보다 위)를 보면 넘길 준비를 하고,
// glanceMs 동안 계속 그쪽을 봐야 넘긴다. 넘긴 뒤 계속 같은 쪽을 보면 repeatMs마다 넘긴다.
// TODO(demo): 임시값. 실제 웹캠으로 읽어 보고 조정한다.
export const GAZE_CENTER_READING = {
  nextZone: 0.8,
  previousZone: 0.2,
  glanceMs: 1200,
  repeatMs: 2000,
};

// 보정 때와 자세가 달라졌는지 볼 기준. 거리는 비율(0.2면 ±20%), 위치는 cm, 각도는 도.
// updateMs는 수치를 화면에 알리는 간격이다.
// TODO(demo): 임시값. 자세를 바꿔 가며 정확도를 재 보고 오차가 커지는 지점으로 조정한다.
export const GAZE_POSTURE = {
  distanceRatio: 0.2,
  movedCm: 6,
  yawDegrees: 15,
  pitchDegrees: 15,
  holdMs: 3000,
  clearMs: 1000,
  updateMs: 250,
};

// 보정 전 시작 자세를 맞추는 기준. x, y는 영상 안 눈 가운데 목표 위치(0~1)와 허용 범위,
// 눈 사이 거리는 영상 폭 대비 비율, 각도는 도. 맞은 상태가 holdMs 이어지면 보정을 시작한다.
// TODO(demo): 임시값. 카메라 화각이 노트북마다 달라 넉넉히 잡았다. 실제 웹캠으로 조정한다.
export const GAZE_FACE_GUIDE = {
  x: 0.5,
  y: 0.45,
  xRange: 0.12,
  yRange: 0.15,
  minEyeDistance: 0.1,
  maxEyeDistance: 0.26,
  yawDegrees: 12,
  pitchDegrees: 20,
  holdMs: 1000,
};

// 개인 보정 점의 위치(화면 %)
const CALIBRATION_COLUMNS = [4, 40.8, 59.2, 96];
const CALIBRATION_ROWS = [4, 50, 96];
export const GAZE_CALIBRATION_POINTS = CALIBRATION_ROWS.flatMap((top) =>
  CALIBRATION_COLUMNS.map((left) => ({ left, top })),
);

export const TASKS_VISION_WASM_PATH = "/mediapipe/tasks-vision";
export const FACE_LANDMARKER_MODEL_PATH = "/models/face_landmarker.task";

// ---- 읽기 모델 (실험: exp/gaze-reading-model) ----
// TODO(demo): 아래 값은 가상 읽기 시뮬레이션(실측 오차 수준)으로 고른 값이다. 실제 웹캠으로 다시 조정한다.
// One Euro 필터: 화면에 그리는 시선 점을 부드럽게 한다. beta는 px/s 기준.
export const GAZE_ONE_EURO = { minCutoff: 0.5, beta: 0.002, dCutoff: 1 };
// 블록 추적기: 관측 오차(화면 비율), 관측 한 번(windowMs)마다의 전이 확률, 블록을 바꾸는 확신 기준
export const GAZE_TRACKER = {
  sigmaX: 0.1,
  sigmaY: 0.15,
  stay: 0.95,
  next: 0.04,
  previous: 0.006,
  confidence: 0.5,
  windowMs: 100,
  lag: 0,
  immediateConfidence: 0.9,
};
// 판단 미루기를 켤 때 기다릴 관측 수 (× windowMs). 시뮬레이션에서는 블록 단위라 효과가 1~2%p에 그쳐 기본은 끈다.
export const GAZE_TRACKER_DEFER_LAG = 5;
// 화면 밖이라도 이 거리(px) 안의 블록은 후보로 둔다 (스크롤 직후 대비)
export const GAZE_TRACKER_MARGIN = 200;
// 시선 점 상태 갱신 간격(ms). 블록이 바뀔 때는 바로 갱신한다.
export const GAZE_POINT_UPDATE_MS = 100;

// 찡그림: (미간 찌푸림 + 눈 찡그림 절반) 점수가 평소보다 threshold 이상 높은 상태가 holdMs 이어지면 한 번 알린다.
// TODO(demo): 임시값. 실제 웹캠으로 테스트한 뒤 조정한다.
export const SQUINT = { threshold: 0.25, holdMs: 400, cooldownMs: 3000, baselineRate: 0.02 };

// 기하 모델의 눈알: 눈꺼풀 높이에서 회전 중심까지의 깊이, 회전 중심에서 홍채 중심까지의 거리 (정규 얼굴 모델 cm).
// 사람 눈알 반지름 약 1.2cm, 회전 중심~동공 약 1cm. 개인차는 보정의 선형 변환이 대부분 흡수한다.
// TODO(demo): 실제 웹캠 데이터(/lab/gaze/collect 원본)로 확인한 뒤 조정한다.
export const GAZE_EYEBALL = { depth: 1.0, radius: 1.0 };
