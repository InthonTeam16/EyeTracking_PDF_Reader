export type HeadPose = {
  // 각도는 도, 위치는 카메라 기준 cm
  yaw: number;
  pitch: number;
  roll: number;
  x: number;
  y: number;
  z: number;
};

const toDegrees = (radians: number) => (radians * 180) / Math.PI;

// MediaPipe 얼굴 변환 행렬(열 우선 4x4)에서 고개 각도와 위치를 꺼낸다.
export function headPoseFromMatrix(matrix: number[]): HeadPose {
  const [right, up] = [matrix[0], matrix[1]];
  // 세 번째 열이 얼굴이 향한 방향이다.
  const [forwardX, forwardY, forwardZ] = [matrix[8], matrix[9], matrix[10]];
  return {
    yaw: toDegrees(Math.atan2(forwardX, forwardZ)),
    pitch: toDegrees(Math.atan2(forwardY, Math.hypot(forwardX, forwardZ))),
    roll: toDegrees(Math.atan2(up, right)),
    x: matrix[12],
    y: matrix[13],
    z: matrix[14],
  };
}

export function correlation(first: number[], second: number[]): number {
  const average = (values: number[]) =>
    values.reduce((sum, value) => sum + value, 0) / values.length;
  const firstAverage = average(first);
  const secondAverage = average(second);
  let covariance = 0;
  let firstVariance = 0;
  let secondVariance = 0;
  first.forEach((value, index) => {
    const a = value - firstAverage;
    const b = second[index] - secondAverage;
    covariance += a * b;
    firstVariance += a * a;
    secondVariance += b * b;
  });
  const scale = Math.sqrt(firstVariance * secondVariance);
  return scale === 0 ? 0 : covariance / scale;
}
