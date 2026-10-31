"use client";

import { type ChangeEvent, useMemo, useState } from "react";
import { GazeDebugDot } from "@/components/gaze/GazeDebugDot";
import { ReaderView } from "@/components/reader/reader-view";
import { Button } from "@/components/ui/button";
import { BUILT_IN_SETS, DEFAULT_SET_NAMES } from "@/lib/gaze/datasets";
import {
  computeDatasetStats,
  crossSetError,
  type DatasetStats,
  judgeDataset,
} from "@/lib/gaze/datasetStats";
import { exportSamples } from "@/lib/gaze/exportSamples";
import {
  type AxisError,
  dedupeSamples,
  type GazeSample,
} from "@/lib/gaze/ridgeRegression";
import { type GazeStatus, useGaze } from "@/lib/gaze/useGaze";
import mockBlocks from "@/lib/mock/blocks.json";
import type { Block } from "@/types";

type SampleSet = { name: string; samples: GazeSample[] };

const FEATURE_COUNT = 10;
// 샘플 PDF를 읽을 때와 같은 화면에서 시험한다.
const blocks: Block[] = mockBlocks;

function parseSampleFile(text: string): GazeSample[] {
  const data: unknown = JSON.parse(text);
  const valid =
    Array.isArray(data) &&
    data.every(
      (sample) =>
        Array.isArray(sample?.features) &&
        sample.features.length === FEATURE_COUNT &&
        typeof sample.x === "number" &&
        typeof sample.y === "number",
    );
  if (!valid) throw new Error("샘플 형식이 아닙니다.");
  return data as GazeSample[];
}

function formatError(error: AxisError | null): string {
  if (!error) return "-";
  return `${(error.x * 100).toFixed(1)} / ${(error.y * 100).toFixed(1)}`;
}

function describeStatus(status: GazeStatus, selected: number): string {
  switch (status.phase) {
    case "loading":
      return "모델을 불러오는 중입니다.";
    case "camera":
      return "카메라 권한을 허용해 주세요.";
    case "error":
      return `시작하지 못했습니다: ${status.message}`;
    case "tracking":
      if (!status.faceVisible) return "얼굴이 보이지 않습니다.";
      return selected > 0
        ? "얼굴 인식됨 · 글을 읽으며 시선을 따라가는지 보세요."
        : "얼굴 인식됨 · 적용할 세트를 고르세요.";
  }
}

function StatsCells({
  stats,
  cross,
}: {
  stats: DatasetStats;
  cross: AxisError | null;
}) {
  return (
    <>
      <td className="p-2 tabular-nums">{formatError(stats.baseline)}</td>
      <td className="p-2 tabular-nums">{formatError(stats.all)}</td>
      <td className="p-2 tabular-nums">{formatError(stats.irisOnly)}</td>
      <td className="p-2 tabular-nums">{formatError(stats.headOnly)}</td>
      <td className="p-2 tabular-nums">{formatError(cross)}</td>
      <td className="p-2">{judgeDataset(stats)}</td>
    </>
  );
}

// TODO(demo): 학습 데이터 비교용 임시 페이지. 쓸 데이터를 정하면 지운다.
export default function GazeDatasetsPage() {
  const [sets, setSets] = useState<SampleSet[]>(BUILT_IN_SETS);
  const [selected, setSelected] = useState<string[]>(DEFAULT_SET_NAMES);
  const [loadErrors, setLoadErrors] = useState<string[]>([]);
  const [exportResult, setExportResult] = useState<string | null>(null);
  const [panelOpen, setPanelOpen] = useState(true);

  const selectedSamples = useMemo(
    () =>
      dedupeSamples(
        sets
          .filter((set) => selected.includes(set.name))
          .flatMap((set) => set.samples),
      ),
    [sets, selected],
  );
  const gaze = useGaze({}, { samples: selectedSamples });

  const rows = useMemo(
    () =>
      sets.map((set) => {
        const unique = dedupeSamples(set.samples);
        const keys = new Set(unique.map((sample) => JSON.stringify(sample)));
        const others = sets.filter((other) => other.name !== set.name);
        const containedIn = others.find((other) => {
          const otherKeys = new Set(
            other.samples.map((sample) => JSON.stringify(sample)),
          );
          return [...keys].every((key) => otherKeys.has(key));
        })?.name;
        // 겹치는 샘플이 학습에 남으면 오차가 실제보다 좋게 나온다.
        const otherSamples = dedupeSamples(
          others
            .filter((other) => selected.includes(other.name))
            .flatMap((other) => other.samples),
        ).filter((sample) => !keys.has(JSON.stringify(sample)));
        return {
          set,
          uniqueCount: unique.length,
          containedIn,
          stats: computeDatasetStats(unique),
          cross: crossSetError(unique, otherSamples),
        };
      }),
    [sets, selected],
  );
  const combinedStats = useMemo(
    () =>
      selectedSamples.length > 0 ? computeDatasetStats(selectedSamples) : null,
    [selectedSamples],
  );

  const handleFiles = async (event: ChangeEvent<HTMLInputElement>) => {
    const files = [...(event.target.files ?? [])];
    event.target.value = "";
    const loaded: SampleSet[] = [];
    const errors: string[] = [];
    for (const file of files) {
      try {
        loaded.push({
          name: file.name,
          samples: parseSampleFile(await file.text()),
        });
      } catch (error) {
        errors.push(`${file.name}: ${String(error)}`);
      }
    }
    const names = loaded.map((set) => set.name);
    setSets((current) => [
      ...current.filter((set) => !names.includes(set.name)),
      ...loaded,
    ]);
    setSelected((current) => [...new Set([...current, ...names])]);
    setLoadErrors(errors);
    setExportResult(null);
  };

  const toggle = (name: string) => {
    setSelected((current) =>
      current.includes(name)
        ? current.filter((item) => item !== name)
        : [...current, name],
    );
    setExportResult(null);
  };

  return (
    <main className="flex flex-1 flex-col bg-background pt-16">
      <div
        data-gaze-ignore
        className="fixed inset-x-0 top-0 z-40 max-h-screen overflow-y-auto border-b bg-background"
      >
        <div className="mx-auto flex w-full max-w-6xl flex-col gap-3 p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h1 className="text-lg font-semibold">학습 데이터 비교</h1>
            <div className="flex flex-wrap items-center gap-2">
              <label className="cursor-pointer rounded-lg border px-3 py-1.5 text-sm hover:bg-muted">
                JSON 추가
                <input
                  type="file"
                  accept="application/json,.json"
                  multiple
                  data-testid="dataset-files"
                  className="sr-only"
                  onChange={handleFiles}
                />
              </label>
              <Button
                variant="outline"
                data-testid="export-selected"
                disabled={selectedSamples.length === 0}
                onClick={() => setExportResult(exportSamples(selectedSamples))}
              >
                선택 세트 내보내기
              </Button>
              <Button
                data-testid="toggle-panel"
                onClick={() => setPanelOpen((open) => !open)}
              >
                {panelOpen ? "표 접고 시험하기" : "표 펼치기"}
              </Button>
            </div>
          </div>

          <p data-testid="gaze-status" className="text-sm font-medium">
            {describeStatus(gaze.status, selected.length)} 적용 중: 세트{" "}
            {selected.length}개, 샘플 {selectedSamples.length}개
          </p>
          {loadErrors.map((error) => (
            <p key={error} className="text-sm text-destructive">
              {error}
            </p>
          ))}
          {exportResult && (
            <p data-testid="export-result" className="text-sm">
              {exportResult}
            </p>
          )}

          {panelOpen && (
            <div>
              <table
                data-testid="dataset-table"
                className="w-full text-left text-xs"
              >
                <thead className="border-b text-muted-foreground">
                  <tr>
                    <th className="p-2">적용</th>
                    <th className="p-2">세트</th>
                    <th className="p-2">샘플</th>
                    <th className="p-2">가운데 찍기</th>
                    <th className="p-2">전체 입력</th>
                    <th className="p-2">홍채만</th>
                    <th className="p-2">머리만</th>
                    <th className="p-2">다른 세트로 학습</th>
                    <th className="p-2">판정</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map(
                    ({ set, uniqueCount, containedIn, stats, cross }) => (
                      <tr
                        key={set.name}
                        data-testid="dataset-row"
                        className="border-b"
                      >
                        <td className="p-2">
                          <input
                            type="checkbox"
                            aria-label={`${set.name} 적용`}
                            checked={selected.includes(set.name)}
                            onChange={() => toggle(set.name)}
                          />
                        </td>
                        <td className="p-2">
                          {set.name}
                          {containedIn && (
                            <span className="block text-muted-foreground">
                              {containedIn}에 모두 포함됨
                            </span>
                          )}
                        </td>
                        <td className="p-2 tabular-nums">{uniqueCount}</td>
                        <StatsCells stats={stats} cross={cross} />
                      </tr>
                    ),
                  )}
                  {combinedStats && (
                    <tr data-testid="dataset-combined" className="font-medium">
                      <td className="p-2" />
                      <td className="p-2">선택 합계</td>
                      <td className="p-2 tabular-nums">
                        {selectedSamples.length}
                      </td>
                      <StatsCells stats={combinedStats} cross={null} />
                    </tr>
                  )}
                </tbody>
              </table>
              <p className="mt-2 text-xs text-muted-foreground">
                오차는 화면 크기 대비 평균 % (가로 / 세로)이고 낮을수록
                좋습니다. 위아래로 읽을 때는 세로 값이 중요합니다. 가운데 찍기는
                입력 없이 항상 평균 좌표를 찍을 때의 기준입니다. 머리만이
                홍채만보다 낮으면 눈이 아니라 고개 방향을 배운 것입니다. 다른
                세트로 학습은 체크된 나머지 세트로만 학습해 이 세트를 맞힌
                오차입니다.
              </p>
            </div>
          )}
        </div>
      </div>

      <ReaderView blocks={blocks} activeBlockId={gaze.activeBlockId} />
      <GazeDebugDot point={gaze.point} />
    </main>
  );
}
