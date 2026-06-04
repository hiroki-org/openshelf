import { useCallback, useRef, useState } from "react";
import type { TouchEvent } from "react";

export const ZOOM_PRESETS = [
  0.5, 0.67, 0.75, 0.9, 1, 1.1, 1.25, 1.5, 1.75, 2,
] as const;
export const MIN_ZOOM = ZOOM_PRESETS[0];
export const MAX_ZOOM = ZOOM_PRESETS[ZOOM_PRESETS.length - 1];

export function clampZoom(value: number): number {
  return Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, value));
}

export function snapZoom(value: number): (typeof ZOOM_PRESETS)[number] {
  const clamped = clampZoom(value);
  const nearest = ZOOM_PRESETS.reduce((previous, current) =>
    Math.abs(current - clamped) < Math.abs(previous - clamped)
      ? current
      : previous,
  );
  return nearest;
}

export function touchDistance(
  a: { clientX: number; clientY: number },
  b: { clientX: number; clientY: number },
): number {
  const dx = a.clientX - b.clientX;
  const dy = a.clientY - b.clientY;
  return Math.sqrt(dx * dx + dy * dy);
}

export function usePdfZoom(initialZoom = 1) {
  const [zoom, setZoom] = useState(initialZoom);
  const [isPinching, setIsPinching] = useState(false);

  const pinchStateRef = useRef<{
    startDistance: number;
    startZoom: number;
  } | null>(null);

  const zoomIn = useCallback(() => {
    const currentIndex = ZOOM_PRESETS.indexOf(snapZoom(zoom));
    if (currentIndex < ZOOM_PRESETS.length - 1) {
      setZoom(ZOOM_PRESETS[currentIndex + 1]);
    }
  }, [zoom]);

  const zoomOut = useCallback(() => {
    const currentIndex = ZOOM_PRESETS.indexOf(snapZoom(zoom));
    if (currentIndex > 0) {
      setZoom(ZOOM_PRESETS[currentIndex - 1]);
    }
  }, [zoom]);

  const handleTouchStart = useCallback(
    (event: TouchEvent<HTMLDivElement>) => {
      if (event.touches.length !== 2) return;
      const first = event.touches[0];
      const second = event.touches[1];
      pinchStateRef.current = {
        startDistance: touchDistance(first, second),
        startZoom: zoom,
      };
      setIsPinching(true);
    },
    [zoom],
  );

  const handleTouchMove = useCallback((event: TouchEvent<HTMLDivElement>) => {
    const state = pinchStateRef.current;
    if (!state || event.touches.length !== 2) return;
    event.preventDefault();
    const first = event.touches[0];
    const second = event.touches[1];
    const nextDistance = touchDistance(first, second);
    if (nextDistance <= 0 || state.startDistance <= 0) return;
    const nextZoom = state.startZoom * (nextDistance / state.startDistance);
    setZoom(clampZoom(nextZoom));
  }, []);

  const handleTouchEnd = useCallback((event: TouchEvent<HTMLDivElement>) => {
    if (event.touches.length >= 2) return;
    if (!pinchStateRef.current) return;
    pinchStateRef.current = null;
    setZoom((current) => snapZoom(current));
    setIsPinching(false);
  }, []);

  return {
    zoom,
    setZoom,
    isPinching,
    zoomIn,
    zoomOut,
    handleTouchStart,
    handleTouchMove,
    handleTouchEnd,
  };
}
