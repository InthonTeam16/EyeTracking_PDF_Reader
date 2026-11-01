"use client";

import { useEffect, useRef, useState, type RefObject } from "react";

import { GAZE_CENTER_READING } from "@/lib/gaze/config";
import type { GazeState } from "@/types";

// "가운데 고정" 읽기: 읽는 블록을 칸 한가운데에 고정하고, 눈짓으로 한 블록씩 넘긴다.
// 칸 아래쪽을 보면 다음 블록이 올라와 가운데에 서고, 위쪽을 보면 이전 블록이 내려온다.
// 시선이 위·아래·가운데 중 어디인지만 알면 돼서 웹캠 좌표 오차에 강하다.

const { nextZone, previousZone, glanceMs, repeatMs } = GAZE_CENTER_READING;
// 사람이 직접 스크롤했는지 가리기 위해, 넘기며 스크롤한 뒤 이 시간(ms)은 직접 스크롤로 보지 않는다.
const AUTO_SCROLL_MS = 700;
// 기준점: 읽는 블록은 늘 칸 가운데에 있으니, 읽는 동안의 시선 높이를 그 사람의 "가운데"로 본다.
// 보정 뒤에도 남는 일정한 위아래 치우침(자세가 바뀌면 천천히 변함)을 이걸로 상쇄하고,
// 넘김은 칸 안의 절대 위치가 아니라 기준점에서 얼마나 벗어났는지로 판단한다.
// TODO(demo): 임시값. 실제 웹캠으로 읽어 보고 조정한다.
// 기준점이 시선을 따라가는 시간 상수(ms). 클수록 눈짓에 덜 끌려간다.
const BASELINE_TAU_MS = 3000;
// 기준점에서 이만큼(칸 높이 비율) 안쪽일 때만 "읽는 중"으로 보고 기준점을 옮긴다.
const BASELINE_FOLLOW_RANGE = 0.2;
// 기준점이 갈 수 있는 범위. 너무 끝으로 가면 그쪽 눈짓을 알아챌 수 없다.
const BASELINE_MIN = 0.2;
const BASELINE_MAX = 0.8;
// 눈짓 구역에 들어간 뒤에는 이만큼 더 돌아와야 가운데로 본다. 경계에서 흔들려 눈짓 타이머가
// 자꾸 처음부터 다시 시작되지 않게 한다 (가상 시뮬레이션에서 놓친 눈짓 30~100/129 → 0~12/129).
const ZONE_HYSTERESIS = 0.1;
// 칸 위아래로 이만큼(칸 높이 비율) 벗어난 시선까지는 눈짓으로 본다. 치우침이 큰 사람 대비.
const VERTICAL_TOLERANCE = 0.4;
const NEXT_OFFSET = nextZone - 0.5;
const PREVIOUS_OFFSET = previousZone - 0.5;
// 눈짓 구역에 이만큼(ms) 머문 뒤부터 넘김 타이머 막대를 보여준다. 넘기는 시간은 그대로고,
// 시선이 구역을 잠깐 스칠 때 막대가 깜빡이지 않게 표시만 늦춘다.
// TODO(demo): 임시값. 실제 웹캠으로 읽어 보고 조정한다.
const TIMER_SHOW_DELAY_MS = 150;

// 매 프레임 바뀌는 값이라 리렌더 없이 막대의 DOM만 직접 고친다.
function drawStepTimer(
  timer: HTMLElement | null,
  side: "next" | "previous" | null,
  progress = 0,
) {
  if (!timer) return;
  if (!side) {
    delete timer.dataset.side;
    return;
  }
  timer.dataset.side = side;
  timer.style.setProperty("--step-progress", String(Math.min(progress, 1)));
}

function blockElements(container: HTMLElement): HTMLElement[] {
  return [...container.querySelectorAll<HTMLElement>("[data-block-id]")];
}

// 블록 중심이 칸 중심보다 아래에 있는 거리(px)
function centerOffset(container: HTMLElement, element: HTMLElement): number {
  const box = element.getBoundingClientRect();
  const view = container.getBoundingClientRect();
  return box.top - view.top + box.height / 2 - view.height / 2;
}

function centerOn(container: HTMLElement, element: HTMLElement) {
  container.scrollTo({
    top: container.scrollTop + centerOffset(container, element),
    behavior: "smooth",
  });
}

function nearestToCenter(container: HTMLElement): number {
  const view = container.getBoundingClientRect();
  const center = view.top + view.height / 2;
  let best = 0;
  let bestDistance = Infinity;
  blockElements(container).forEach((element, index) => {
    const box = element.getBoundingClientRect();
    const distance = Math.abs(box.top + box.height / 2 - center);
    if (distance < bestDistance) {
      best = index;
      bestDistance = distance;
    }
  });
  return best;
}

// enabled가 아니면 아무것도 하지 않는다.
// lookingAtText가 false면 분할 보기에서 원본 PDF를 손으로 조작하는 중이라 넘기지 않는 중이다.
// timerRef 요소에는 넘기기까지 남은 시간을 data-side와 --step-progress(0~1)로 알려 준다.
// holdUntilRef(performance.now() 기준 시각)까지 조작 중으로 본다.
export function useCenterReading(
  point: GazeState["point"],
  scrollRef: RefObject<HTMLElement | null>,
  timerRef: RefObject<HTMLElement | null>,
  holdUntilRef: RefObject<number>,
  enabled = true,
): { activeBlockId: string | null; lookingAtText: boolean } {
  const [index, setIndex] = useState(0);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [lookingAtText, setLookingAtText] = useState(true);
  const pointRef = useRef(point);
  const indexRef = useRef(index);
  const autoScrollUntil = useRef(0);
  // 휠·스크롤바로 옮겨 읽는 블록이 가운데에서 벗어나 있는지
  const manualScrolled = useRef(false);

  useEffect(() => {
    pointRef.current = point;
  }, [point]);

  useEffect(() => {
    indexRef.current = index;
  }, [index]);

  // 읽는 블록이 바뀌면 그 블록을 가운데로 데려온다.
  useEffect(() => {
    const container = scrollRef.current;
    if (!enabled || !container) return;
    const elements = blockElements(container);
    const element = elements[Math.min(index, elements.length - 1)];
    if (!element) return;
    manualScrolled.current = false;
    autoScrollUntil.current = performance.now() + AUTO_SCROLL_MS;
    centerOn(container, element);
    const frame = requestAnimationFrame(() =>
      setActiveId(element.getAttribute("data-block-id")),
    );
    return () => cancelAnimationFrame(frame);
  }, [enabled, index, scrollRef]);

  // 팝업이 닫히거나 칸 폭·글자 크기가 바뀌면 본문 높이가 달라져 읽는 블록이 가운데에서 밀린다.
  // 직접 옮긴 위치는 그대로 둔다.
  useEffect(() => {
    const container = scrollRef.current;
    const content = container?.firstElementChild;
    if (!enabled || !container || !content) return;
    const observer = new ResizeObserver(() => {
      if (manualScrolled.current) return;
      const elements = blockElements(container);
      const element = elements[Math.min(indexRef.current, elements.length - 1)];
      if (!element) return;
      autoScrollUntil.current = performance.now() + AUTO_SCROLL_MS;
      centerOn(container, element);
    });
    observer.observe(container);
    observer.observe(content);
    return () => observer.disconnect();
  }, [enabled, scrollRef]);

  // 눈짓을 보고 넘긴다.
  useEffect(() => {
    if (!enabled) return;
    let frame = 0;
    // 지금 보고 있는 쪽과 그쪽을 보기 시작한 시각
    let zone: "next" | "previous" | "middle" = "middle";
    let since = 0;
    // 마지막으로 넘긴 시각. 눈이 가운데로 돌아오면 0으로 되돌린다.
    let lastStep = 0;
    // 원본 PDF를 조작하는 중이 아닌지. 조작하는 동안은 넘기지 않는다.
    let onText = true;
    // 이 사람의 "가운데" 시선 높이(칸 높이 비율)
    let baseline = 0.5;
    let lastTick = 0;

    const tick = (now: number) => {
      frame = requestAnimationFrame(tick);
      const dt = lastTick === 0 ? 0 : Math.min(now - lastTick, 100);
      lastTick = now;
      const container = scrollRef.current;
      const target = pointRef.current;
      if (!container) return;
      const view = container.getBoundingClientRect();

      // 원본 PDF를 조작하는 동안만 멈춘다. 시선만으로는 멈추지 않는다
      // (시선 가로 위치로 칸을 가리는 방식은 웹캠 오차로 엉뚱하게 멈춰 뺐다).
      const held = now < holdUntilRef.current;
      if (held === onText) {
        onText = !held;
        setLookingAtText(onText);
        // 조작을 마친 직후 눈의 위치 때문에 바로 넘어가지 않게 잠깐 쉰다.
        if (onText) {
          zone = "middle";
          since = now;
          lastStep = now;
        }
      }

      // 시선이 칸 밖(원본 PDF 등)에 있으면 넘기지 않는다.
      const inside =
        onText &&
        target &&
        target.x >= view.left &&
        target.x <= view.right &&
        target.y >= view.top - view.height * VERTICAL_TOLERANCE &&
        target.y <= view.bottom + view.height * VERTICAL_TOLERANCE;
      // 얼굴을 놓치거나 칸 밖·원본 PDF를 보면 넘기지 않는다.
      const offset = inside
        ? (target.y - view.top) / view.height - baseline
        : 0;
      const nextAt = NEXT_OFFSET - (zone === "next" ? ZONE_HYSTERESIS : 0);
      const previousAt =
        PREVIOUS_OFFSET + (zone === "previous" ? ZONE_HYSTERESIS : 0);
      const current =
        offset > nextAt ? "next" : offset < previousAt ? "previous" : "middle";

      // 가운데를 보며 읽는 동안에만 기준점을 시선 쪽으로 천천히 옮긴다.
      // 눈짓하는 동안에는 멈춰서, 아래를 보는 걸 새 가운데로 착각하지 않는다.
      if (
        inside &&
        current === "middle" &&
        Math.abs(offset) < BASELINE_FOLLOW_RANGE
      ) {
        const rate = 1 - Math.exp(-dt / BASELINE_TAU_MS);
        baseline = Math.min(
          Math.max(baseline + offset * rate, BASELINE_MIN),
          BASELINE_MAX,
        );
      }

      if (current !== zone) {
        zone = current;
        since = now;
        if (zone === "middle") lastStep = 0;
      }
      if (zone === "middle") {
        drawStepTimer(timerRef.current, null);
        return;
      }

      // 처음 눈짓이면 그쪽을 본 시각부터, 넘긴 뒤 계속 보는 중이면 마지막으로 넘긴 시각부터 잰다.
      const repeating =
        lastStep !== 0 && lastStep + repeatMs > since + glanceMs;
      const start = repeating ? lastStep : since;
      const duration = repeating ? repeatMs : glanceMs;
      const count = blockElements(container).length;
      // 문서 끝에서는 더 넘어갈 곳이 없으니 막대를 보여주지 않는다.
      const canStep =
        zone === "next" ? indexRef.current < count - 1 : indexRef.current > 0;
      drawStepTimer(
        timerRef.current,
        canStep && now - since >= TIMER_SHOW_DELAY_MS ? zone : null,
        (now - start) / duration,
      );
      if (now - start < duration) return;

      lastStep = now;
      setIndex((value) =>
        zone === "next"
          ? Math.min(value + 1, count - 1)
          : Math.max(value - 1, 0),
      );
    };
    frame = requestAnimationFrame(tick);
    const timer = timerRef.current;
    return () => {
      cancelAnimationFrame(frame);
      drawStepTimer(timer, null);
    };
  }, [enabled, scrollRef, timerRef, holdUntilRef]);

  // 휠·스크롤바로 직접 옮기면 멈춘 곳에서 가운데에 가장 가까운 블록을 읽는 블록으로 삼는다.
  useEffect(() => {
    const container = scrollRef.current;
    if (!enabled || !container) return;
    let timer = 0;
    const handleScroll = () => {
      if (performance.now() < autoScrollUntil.current) return;
      window.clearTimeout(timer);
      timer = window.setTimeout(() => {
        const nearest = nearestToCenter(container);
        const element = blockElements(container)[nearest];
        // 긴 자동 스크롤이 끝난 경우도 여기로 오므로 실제로 벗어났는지 본다.
        manualScrolled.current =
          element !== undefined &&
          Math.abs(centerOffset(container, element)) > 2;
        setActiveId(element?.getAttribute("data-block-id") ?? null);
        // 같은 블록이면 다시 가운데로 끌어오지 않는다.
        setIndex(nearest);
      }, 150);
    };
    container.addEventListener("scroll", handleScroll, { passive: true });
    return () => {
      window.clearTimeout(timer);
      container.removeEventListener("scroll", handleScroll);
    };
  }, [enabled, scrollRef]);

  return {
    activeBlockId: enabled ? activeId : null,
    lookingAtText: !enabled || lookingAtText,
  };
}
