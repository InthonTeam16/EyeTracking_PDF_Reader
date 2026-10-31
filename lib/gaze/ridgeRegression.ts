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

// 한 입력값이 세로 좌표에 주는 영향을 정해 두고 나머지 입력값만 학습한다.
export function fitGazeModelWithFixedY(
  samples: GazeSample[],
  lambda: number,
  featureIndex: number,
  yPerUnit: number,
): GazeModel {
  const rest = (features: number[]) =>
    features.filter((_, index) => index !== featureIndex);
  const model = fitGazeModel(
    samples.map((sample) => ({
      features: rest(sample.features),
      x: sample.x,
      y: sample.y - yPerUnit * sample.features[featureIndex],
    })),
    lambda,
  );
  return (features) => {
    const predicted = model(rest(features));
    return {
      x: predicted.x,
      y: predicted.y + yPerUnit * features[featureIndex],
    };
  };
}

// 저장된 데이터와 사용자의 차이를 최근 클릭의 평균 오차로 구한다.
export function computeOffset(
  model: GazeModel,
  samples: GazeSample[],
): { x: number; y: number } {
  if (samples.length === 0) return { x: 0, y: 0 };
  const errors = samples.map((sample) => {
    const predicted = model(sample.features);
    return { x: sample.x - predicted.x, y: sample.y - predicted.y };
  });
  return {
    x: mean(errors.map((error) => error.x)),
    y: mean(errors.map((error) => error.y)),
  };
}

// 샘플을 fold로 나눠, 각 샘플을 뺀 모델로 예측했을 때의 오차를 잰다.
function measureHoldoutErrors(
  samples: GazeSample[],
  lambda: number,
  folds: number,
  foldOf: (index: number) => number,
): { x: number; y: number }[] {
  const models = Array.from({ length: folds }, (_, fold) =>
    fitGazeModel(
      samples.filter((_, index) => foldOf(index) !== fold),
      lambda,
    ),
  );
  return samples.map((sample, index) => {
    const predicted = models[foldOf(index)](sample.features);
    return { x: predicted.x - sample.x, y: predicted.y - sample.y };
  });
}

export type GazeDataset = {
  samples: GazeSample[];
  removed: number;
  // 처음 보는 자세에서의 평균 오차 (화면 비율). 샘플이 부족하면 null.
  error: { x: number; y: number } | null;
};

// 다른 곳을 보며 클릭한 샘플을 버리고 남은 데이터의 오차를 잰다.
export function cleanDataset(
  samples: GazeSample[],
  lambda: number,
  folds: number,
  outlierSigma: number,
  minSamples: number,
): GazeDataset {
  if (samples.length < minSamples) {
    return { samples, removed: 0, error: null };
  }

  // 섞어서 나누면 같은 자세가 양쪽에 있어 자세 차이가 아닌 잘못된 클릭만 튄다.
  const distances = measureHoldoutErrors(
    samples,
    lambda,
    folds,
    (index) => index % folds,
  ).map((error) => Math.hypot(error.x, error.y));
  const average = mean(distances);
  const deviation = Math.sqrt(
    mean(distances.map((distance) => (distance - average) ** 2)),
  );
  const kept = samples.filter(
    (_, index) => distances[index] <= average + outlierSigma * deviation,
  );

  // 연속 구간을 통째로 빼면 그 자세를 학습하지 않은 모델의 오차가 된다.
  const errors = measureHoldoutErrors(kept, lambda, folds, (index) =>
    Math.floor((index * folds) / kept.length),
  );
  return {
    samples: kept,
    removed: samples.length - kept.length,
    error: {
      x: mean(errors.map((error) => Math.abs(error.x))),
      y: mean(errors.map((error) => Math.abs(error.y))),
    },
  };
}

export type AxisError = { x: number; y: number };

// 여러 세트를 합칠 때 같은 샘플이 이중으로 계산되지 않게 한다.
export function dedupeSamples(samples: GazeSample[]): GazeSample[] {
  const seen = new Set<string>();
  return samples.filter((sample) => {
    const key = JSON.stringify(sample);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export function pickFeatures(
  samples: GazeSample[],
  indices: number[],
): GazeSample[] {
  return samples.map((sample) => ({
    ...sample,
    features: indices.map((index) => sample.features[index]),
  }));
}

export function evaluateModel(
  model: GazeModel,
  samples: GazeSample[],
): AxisError {
  const errors = samples.map((sample) => {
    const predicted = model(sample.features);
    return {
      x: Math.abs(predicted.x - sample.x),
      y: Math.abs(predicted.y - sample.y),
    };
  });
  return {
    x: mean(errors.map((error) => error.x)),
    y: mean(errors.map((error) => error.y)),
  };
}

// 입력값 없이 항상 평균 좌표를 찍을 때의 오차. 이보다 나아야 학습된 것이다.
export function baselineError(samples: GazeSample[]): AxisError {
  const center = {
    x: mean(samples.map((sample) => sample.x)),
    y: mean(samples.map((sample) => sample.y)),
  };
  return evaluateModel(() => center, samples);
}

// 연속 구간을 통째로 빼고 학습해, 그 구간의 자세를 처음 볼 때의 오차를 잰다.
export function blockHoldoutError(
  samples: GazeSample[],
  lambda: number,
  folds: number,
): AxisError {
  const errors = measureHoldoutErrors(samples, lambda, folds, (index) =>
    Math.floor((index * folds) / samples.length),
  );
  return {
    x: mean(errors.map((error) => Math.abs(error.x))),
    y: mean(errors.map((error) => Math.abs(error.y))),
  };
}
