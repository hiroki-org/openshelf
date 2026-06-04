import { useEffect, useMemo, useState } from "react";

const PAGE_ASPECT_RATIO = 1.414;

export function usePdfDimensions(
  containerRef: React.RefObject<HTMLDivElement | null>,
  zoom: number,
) {
  const [containerWidth, setContainerWidth] = useState(0);

  useEffect(() => {
    const node = containerRef.current;
    if (!node) return;

    const observer = new ResizeObserver((entries) => {
      const width = entries[0]?.contentRect.width ?? 0;
      setContainerWidth(Math.floor(width));
    });

    observer.observe(node);
    return () => observer.disconnect();
  }, [containerRef]);

  const pageWidth = useMemo(() => {
    if (containerWidth <= 0) return undefined;
    return Math.max(280, Math.floor(containerWidth * zoom));
  }, [containerWidth, zoom]);

  const placeholderHeight = Math.max(
    360,
    Math.floor((pageWidth ?? containerWidth ?? 420) * PAGE_ASPECT_RATIO),
  );

  return {
    pageWidth,
    placeholderHeight,
  };
}
