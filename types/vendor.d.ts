declare module "webgazer/dist/webgazer.commonjs2.js" {
  type GazeListener = (
    data: { x: number; y: number } | null,
    elapsedTime: number,
  ) => void;

  type WebGazer = {
    params: { faceMeshSolutionPath: string };
    saveDataAcrossSessions(value: boolean): WebGazer;
    showPredictionPoints(value: boolean): WebGazer;
    setGazeListener(listener: GazeListener): WebGazer;
    clearGazeListener(): WebGazer;
    removeMouseEventListeners(): WebGazer;
    begin(onFail?: () => void): Promise<WebGazer>;
    stopVideo(): WebGazer;
    end(): WebGazer;
  };

  export const webgazer: WebGazer;
}
