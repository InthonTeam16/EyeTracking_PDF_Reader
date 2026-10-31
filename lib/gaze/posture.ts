import type { HeadPose } from "@/lib/gaze/headPose";

export type PostureIssue = "far" | "near" | "moved" | "turned";

export type PostureDrift = {
  // 보정 때 거리 대비 지금 거리 (1이면 같음)
  distanceRatio: number;
  // 옮겨 간 거리(cm)
  moved: number;
  // 돌아간 각도(도)
  yaw: number;
  pitch: number;
};

export type Posture = { drift: PostureDrift; issue: PostureIssue | null };

export type PostureConfig = {
  distanceRatio: number;
  movedCm: number;
  yawDegrees: number;
  pitchDegrees: number;
  holdMs: number;
  clearMs: number;
};

export const POSTURE_MESSAGES: Record<PostureIssue, string> = {
  far: "보정할 때보다 화면에서 멀어졌어요. 조금 앞으로 와 주세요.",
  near: "보정할 때보다 화면에 가까워졌어요. 조금 뒤로 가 주세요.",
  moved: "보정할 때와 앉은 위치가 달라졌어요. 원래 위치로 돌아와 주세요.",
  turned: "보정할 때와 고개 방향이 달라졌어요. 화면 정면을 봐 주세요.",
};

// 영상 안 얼굴 위치. 보정 전 시작 자세를 맞출 때 쓴다.
export type FaceFrame = {
  // 거울처럼 뒤집은 화면 기준 양쪽 눈 가운데 (영상 크기 대비 0~1)
  x: number;
  y: number;
  // 양쪽 눈 바깥쪽 사이 거리 (영상 폭 대비). 가까울수록 크다.
  eyeDistance: number;
  yaw: number;
  pitch: number;
};

export type FaceGuideConfig = {
  x: number;
  y: number;
  xRange: number;
  yRange: number;
  minEyeDistance: number;
  maxEyeDistance: number;
  yawDegrees: number;
  pitchDegrees: number;
};

export type FaceIssue =
  | "moveLeft"
  | "moveRight"
  | "moveUp"
  | "moveDown"
  | "moveBack"
  | "moveCloser"
  | "faceScreen";

export const FACE_MESSAGES: Record<FaceIssue, string> = {
  moveLeft: "조금 왼쪽으로 와 주세요.",
  moveRight: "조금 오른쪽으로 와 주세요.",
  moveUp: "얼굴을 조금 위로 올려 주세요.",
  moveDown: "얼굴을 조금 아래로 내려 주세요.",
  moveBack: "조금 뒤로 가 주세요.",
  moveCloser: "조금 앞으로 와 주세요.",
  faceScreen: "화면 정면을 봐 주세요.",
};

const LEFT_EYE_OUTER = 33;
const RIGHT_EYE_OUTER = 263;

export function faceFrameFrom(
  landmarks: { x: number; y: number }[],
  pose: HeadPose,
): FaceFrame {
  const first = landmarks[LEFT_EYE_OUTER];
  const second = landmarks[RIGHT_EYE_OUTER];
  return {
    x: 1 - (first.x + second.x) / 2,
    y: (first.y + second.y) / 2,
    eyeDistance: Math.abs(first.x - second.x),
    yaw: pose.yaw,
    pitch: pose.pitch,
  };
}

// 위치, 거리, 각도 순서로 먼저 고칠 것 하나만 알린다. 맞으면 null.
export function findFaceIssue(
  face: FaceFrame,
  config: FaceGuideConfig,
): FaceIssue | null {
  if (face.x < config.x - config.xRange) return "moveRight";
  if (face.x > config.x + config.xRange) return "moveLeft";
  if (face.y < config.y - config.yRange) return "moveDown";
  if (face.y > config.y + config.yRange) return "moveUp";
  if (face.eyeDistance > config.maxEyeDistance) return "moveBack";
  if (face.eyeDistance < config.minEyeDistance) return "moveCloser";
  if (
    Math.abs(face.yaw) > config.yawDegrees ||
    Math.abs(face.pitch) > config.pitchDegrees
  )
    return "faceScreen";
  return null;
}

export function averagePose(poses: HeadPose[]): HeadPose {
  const average = (key: keyof HeadPose) =>
    poses.reduce((sum, pose) => sum + pose[key], 0) / poses.length;
  return {
    yaw: average("yaw"),
    pitch: average("pitch"),
    roll: average("roll"),
    x: average("x"),
    y: average("y"),
    z: average("z"),
  };
}

export function comparePosture(base: HeadPose, pose: HeadPose): PostureDrift {
  return {
    distanceRatio: pose.z / base.z,
    moved: Math.hypot(pose.x - base.x, pose.y - base.y),
    yaw: pose.yaw - base.yaw,
    pitch: pose.pitch - base.pitch,
  };
}

// 거리를 먼저 본다. 거리가 달라지면 위치 값도 함께 달라져서다.
function findIssue(
  drift: PostureDrift,
  config: PostureConfig,
): PostureIssue | null {
  if (drift.distanceRatio > 1 + config.distanceRatio) return "far";
  if (drift.distanceRatio < 1 - config.distanceRatio) return "near";
  if (drift.moved > config.movedCm) return "moved";
  if (
    Math.abs(drift.yaw) > config.yawDegrees ||
    Math.abs(drift.pitch) > config.pitchDegrees
  )
    return "turned";
  return null;
}

// 잠깐 기대거나 고개를 돌린 정도로는 알리지 않는다. 같은 문제가 holdMs 이어져야 알리고,
// 문제가 없는 상태가 clearMs 이어져야 지운다.
export function createPostureMonitor(config: PostureConfig) {
  let issue: PostureIssue | null = null;
  let candidate: PostureIssue | null = null;
  let since = 0;

  return {
    add(base: HeadPose, pose: HeadPose, now: number): Posture {
      const drift = comparePosture(base, pose);
      const current = findIssue(drift, config);
      if (current !== candidate) {
        candidate = current;
        since = now;
      }
      if (candidate !== issue) {
        const wait = candidate ? config.holdMs : config.clearMs;
        if (now - since >= wait) issue = candidate;
      }
      return { drift, issue };
    },
    reset() {
      issue = null;
      candidate = null;
    },
  };
}
