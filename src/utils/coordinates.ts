export type ViewTransform = {
  zoom: number;
  panX: number;
  panY: number;
};

export function screenToPage(
  clientX: number,
  clientY: number,
  containerRect: DOMRect,
  transform: ViewTransform
) {
  return {
    x: (clientX - containerRect.left - transform.panX) / transform.zoom,
    y: (clientY - containerRect.top - transform.panY) / transform.zoom,
  };
}