import { SampleSource } from "./sample";
import type { TasteSource } from "./types";

/**
 * Runs one whole operation (a plan, an MCP tool call) against `src`.
 * If `src` is a live source and any part of the operation fails
 * (revoked/expired key, outage, timeout), the ENTIRE operation is
 * rerun against the sample fixtures, so a result never mixes live
 * anchors with fixture picks. The rerun reports mode "sample" through
 * the operation's own labeling, so the UI and MCP clients mark the
 * result as fixtures, not Qloo output.
 *
 * Per-request, not sticky: a transient failure degrades only that
 * request; the next request tries the live source again.
 */
export async function withFixtureFallback<T>(src: TasteSource, fn: (s: TasteSource) => Promise<T>): Promise<T> {
  try {
    return await fn(src);
  } catch (e) {
    if (src.mode === "sample") throw e; // fixtures failing is a real bug, not a fallback case
    return fn(new SampleSource());
  }
}
