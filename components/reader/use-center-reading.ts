"use client";

import { useEffect, useRef, useState, type RefObject } from "react";

import { GAZE_CENTER_READING } from "@/lib/gaze/config";
import type { GazeState } from "@/types";

// "가운데 고정" 읽기: 읽는 블록을 칸 한가운데에 고정하고, 눈짓으로 한 블록씩 넘긴다.
// 칸 아래쪽을 보면 다음 블록이 올라와 가운데에 서고, 위쪽을 보면 이전 블록이 내려온다.
// 시선이 위·아래·가운데 중 어디인지만 알면 돼서 웹캠 좌표 오차에 강하다.

const { nextZone, previousZone, glanceMs, repeatMs } = GAZE_CENTER_READING;
// 분할 보기에서 어느 칸을 보는지: 시선 가로 위치가 칸 경계에서 화면 폭의 이 비율만큼
// 확실히 넘어간 상태가 PANE_SWITCH_MS 이어질 때만 바꾼다. 웹캠 가로 오차(화면 폭 7~10%)를 고려했다.
const PANE_MARGIN = 0.08;
const PANE_SWITCH_MS = 400;
// 가로 위치를 부드럽게 따라가는 정도(0~1). 작을수록 떨림에 강하다.
const X_EASING = 0.15;
// 사람이 직접 스크롤했는지 가리기 위해, 넘기며 스크롤한 뒤 이 시간(ms)은 직접 스크롤로 보지 않는다.
const AUTO_SCROLL_MS = 700;

function blockElements(container: HTMLElement): HTMLElement[] {
  return [...container.querySelectorAll<HTMLElement>("[data-block-id]")];
}

function centerOn(container: HTMLElement, element: HTMLElement) {
  const box = element.getBoundingClientRect();
  const view = container.getBoundingClientRect();
  container.scrollTo({
    top:
      container.scrollTop +
      (box.top - view.top) +
      box.height / 2 -
      view.height / 2,
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
// lookingAtText가 false면 시선이 집중 읽기 칸 밖(분할 보기의 원본 PDF 등)에 있어 넘기지 않는 중이다.
export function useCenterReading(
  point: GazeState["point"],
  scrollRef: RefObject<HTMLElement | null>,
  enabled = true,
): { activeBlockId: string | null; lookingAtText: boolean } {
  const [index, setIndex] = useState(0);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [lookingAtText, setLookingAtText] = useState(true);
  const pointRef = useRef(point);
  const autoScrollUntil = useRef(0);

  useEffect(() => {
    pointRef.current = point;
  }, [point]);

  // 읽는 블록이 바뀌면 그 블록을 가운데로 데려온다.
  useEffect(() => {
    const container = scrollRef.current;
    if (!enabled || !container) return;
    const elements = blockElements(container);
    const element = elements[Math.min(index, elements.length - 1)];
    if (!element) return;
    autoScrollUntil.current = performance.now() + AUTO_SCROLL_MS;
    centerOn(container, element);
    const frame = requestAnimationFrame(() =>
      setActiveId(element.getAttribute("data-block-id")),
    );
    return () => cancelAnimationFrame(frame);
  }, [enabled, index, scrollRef]);

  // 눈짓을 보고 넘긴다.
  useEffect(() => {
    if (!enabled) return;
    let frame = 0;
    // 지금 보고 있는 쪽과 그쪽을 보기 시작한 시각
    let zone: "next" | "previous" | "middle" = "middle";
    let since = 0;
    // 마지막으로 넘긴 시각. 눈이 가운데로 돌아오면 0으로 되돌린다.
    let lastStep = 0;
    // 집중 읽기 칸을 보고 있는지. 분할 보기에서 원본 PDF를 볼 때는 넘기지 않는다.
    let onText = true;
    let pendingSince = 0;
    let easedX: number | null = null;

    const tick = (now: number) => {
      frame = requestAnimationFrame(tick);
      const container = scrollRef.current;
      const target = pointRef.current;
      if (!container) return;
      const view = container.getBoundingClientRect();

      // 어느 칸을 보는지: 가로 위치를 부드럽게 거르고, 칸 경계에서 여유 폭만큼
      // 확실히 넘어간 상태가 이어질 때만 바꾼다 (경계 근처에서 왔다 갔다 하지 않게).
      if (target) {
        easedX =
          easedX === null ? target.x : easedX + (target.x - easedX) * X_EASING;
        // 여유 폭은 다른 칸과 맞닿은 쪽에만 둔다. 화면 끝에 붙은 쪽은 넘어갈 곳이 없다.
        const margin = window.innerWidth * PANE_MARGIN;
        const leftMargin = view.left <= 1 ? 0 : margin;
        const rightMargin = view.right >= window.innerWidth - 1 ? 0 : margin;
        const clearlyInside =
          view.width > 0 &&
          easedX >= view.left + leftMargin &&
          easedX <= view.right - rightMargin;
        const clearlyOutside =
          view.width === 0 ||
          easedX < view.left - leftMargin ||
          easedX > view.right + rightMargin;
        const wants = onText ? !clearlyOutside : clearlyInside;
        if (wants !== onText) {
          if (pendingSince === 0) pendingSince = now;
          if (now - pendingSince >= PANE_SWITCH_MS) {
            onText = wants;
            pendingSince = 0;
            setLookingAtText(onText);
            // 집중 읽기로 돌아온 직후 눈의 위치 때문에 바로 넘어가지 않게 잠깐 쉰다.
            zone = "middle";
            since = now;
            lastStep = now;
          }
        } else {
          pendingSince = 0;
        }
      }

      // 칸 판단이 바뀌기 전에도 지금 시선이 칸 밖이면 넘기지 않는다
      // (원본 PDF 쪽으로 시선을 옮기는 순간 넘어가지 않게).
      const inside =
        onText &&
        target &&
        target.x >= view.left &&
        target.x <= view.right &&
        target.y >= view.top - view.height * 0.2 &&
        target.y <= view.bottom + view.height * 0.2;
      // 얼굴을 놓치거나 칸 밖·원본 PDF를 보면 넘기지 않는다.
      const ratio = inside ? (target.y - view.top) / view.height : 0.5;
      const current =
        ratio > nextZone
          ? "next"
          : ratio < previousZone
            ? "previous"
            : "middle";

      if (current !== zone) {
        zone = current;
        since = now;
        if (zone === "middle") lastStep = 0;
      }
      if (zone === "middle" || now - since < glanceMs) return;
      if (lastStep !== 0 && now - lastStep < repeatMs) return;

      lastStep = now;
      const count = blockElements(container).length;
      setIndex((value) =>
        zone === "next"
          ? Math.min(value + 1, count - 1)
          : Math.max(value - 1, 0),
      );
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [enabled, scrollRef]);

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
