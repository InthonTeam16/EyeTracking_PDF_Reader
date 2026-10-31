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

export const TASKS_VISION_WASM_PATH = "/mediapipe/tasks-vision";
export const FACE_LANDMARKER_MODEL_PATH = "/models/face_landmarker.task";
