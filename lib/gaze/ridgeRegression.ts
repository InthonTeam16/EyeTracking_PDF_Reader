export type GazeSample = { features: number[]; x: number; y: number };

export type GazeModel = (features: number[]) => { x: number; y: number };

function mean(values: number[]): number {
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

// 가우스 소거법으로 matrix * solution = target을 푼다.
function solve(matrix: number[][], target: number[]): number[] {
  const rows = matrix.map((row, index) => [...row, target[index]]);
  const size = rows.length;

  for (let column = 0; column < size; column++) {
    let pivot = column;
    for (let row = column + 1; row < size; row++) {
      if (Math.abs(rows[row][column]) > Math.abs(rows[pivot][column])) {
        pivot = row;
      }
    }
    [rows[column], rows[pivot]] = [rows[pivot], rows[column]];

    for (let row = column + 1; row < size; row++) {
      const factor = rows[row][column] / rows[column][column];
      for (let cell = column; cell <= size; cell++) {
        rows[row][cell] -= factor * rows[column][cell];
      }
    }
  }

  const solution = new Array<number>(size).fill(0);
  for (let row = size - 1; row >= 0; row--) {
    let value = rows[row][size];
    for (let column = row + 1; column < size; column++) {
      value -= rows[row][column] * solution[column];
    }
    solution[row] = value / rows[row][row];
  }
  return solution;
}

// 입력값은 단위가 제각각이라 표준화한 뒤 릿지 회귀로 화면 좌표를 학습한다.
export function fitGazeModel(samples: GazeSample[], lambda: number): GazeModel {
  const size = samples[0].features.length;
  const means = Array.from({ length: size }, (_, index) =>
    mean(samples.map((sample) => sample.features[index])),
  );
  const scales = means.map((average, index) => {
    const variance = mean(
      samples.map((sample) => (sample.features[index] - average) ** 2),
    );
    // 변하지 않은 입력값은 0으로 나누지 않게 그대로 둔다.
    return Math.sqrt(variance) || 1;
  });
  const standardize = (features: number[]) =>
    features.map((value, index) => (value - means[index]) / scales[index]);

  const inputs = samples.map((sample) => standardize(sample.features));
  const normal = Array.from({ length: size }, (_, row) =>
    Array.from({ length: size }, (_, column) => {
      const sum = inputs.reduce(
        (total, input) => total + input[row] * input[column],
        0,
      );
      return row === column ? sum + lambda : sum;
    }),
  );

  const fitAxis = (targets: number[]) => {
    const average = mean(targets);
    const weights = solve(
      normal,
      Array.from({ length: size }, (_, row) =>
        inputs.reduce(
          (total, input, index) =>
            total + input[row] * (targets[index] - average),
          0,
        ),
      ),
    );
    return (input: number[]) =>
      average +
      input.reduce((total, value, index) => total + value * weights[index], 0);
  };

  const predictX = fitAxis(samples.map((sample) => sample.x));
  const predictY = fitAxis(samples.map((sample) => sample.y));

  return (features) => {
    const input = standardize(features);
    return { x: predictX(input), y: predictY(input) };
  };
}
