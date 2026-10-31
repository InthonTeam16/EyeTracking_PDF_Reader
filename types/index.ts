export type Block = { id: string; text: string; page: number; order: number };

export type GazeState = {
  point: { x: number; y: number } | null; // 화면 좌표 (px)
  activeBlockId: string | null; // 지금 보고 있는 블록
  calibrated: boolean;
};

export type GazeEvents = {
  onDwell?: (blockId: string, ms: number) => void; // 한 블록을 기준 시간 이상 응시
  onSquint?: (blockId: string) => void; // 응시 중 찡그림 감지
};

export type ExplainRequest = { blockText: string; context?: string };

export type ExplainResponse = {
  data: { explanation: string } | null;
  error: string | null;
};
