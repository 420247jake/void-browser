// Layout worker stub for web demo
// Uses sync calculation instead of web worker

import { calculateLayout, LayoutMode, LayoutOptions, DEFAULT_LAYOUT_OPTIONS } from "./layout";
import { VoidNode, VoidEdge } from "./types";

export async function calculateLayoutAsync(
  nodes: VoidNode[],
  edges: VoidEdge[],
  mode: LayoutMode,
  options?: Partial<LayoutOptions>,
  onProgress?: (progress: number) => void
): Promise<Map<number, [number, number, number]>> {
  // Just use sync calculation for demo
  if (onProgress) onProgress(50);
  const layoutOptions: LayoutOptions = { ...DEFAULT_LAYOUT_OPTIONS, mode, ...options };
  const result = calculateLayout(nodes, edges, layoutOptions);
  if (onProgress) onProgress(100);
  return result;
}

export function terminateLayoutWorker() {
  // No-op
}
