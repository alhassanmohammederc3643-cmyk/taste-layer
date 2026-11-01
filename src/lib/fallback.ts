import type { Domain, Entity, TasteSource } from "./types";

/**
 * Live source with a labeled fixture safety net.
 * Serves the primary (Qloo) source while it works. On the first failure
 * (revoked/expired key, network error, timeout) it permanently degrades
 * this process to the fallback (sample fixtures) instead of throwing,
 * and `mode` then reports "sample" so the UI banner and MCP responses
 * label results as fixtures rather than Qloo output.
 */
export class FallbackSource implements TasteSource {
  private degraded = false;
  private reason?: string;

  constructor(
    private primary: TasteSource,
    private fallback: TasteSource,
  ) {}

  get mode(): "live" | "sample" {
    return this.degraded ? this.fallback.mode : this.primary.mode;
  }

  /** Set once the primary has failed; useful for logs and diagnostics. */
  get degradedReason(): string | undefined {
    return this.reason;
  }

  private async call<T>(fn: (s: TasteSource) => Promise<T>): Promise<T> {
    if (this.degraded) return fn(this.fallback);
    try {
      return await fn(this.primary);
    } catch (e) {
      this.degraded = true;
      this.reason = String((e as Error)?.message ?? e);
      return fn(this.fallback);
    }
  }

  resolve(name: string, domainHint?: Domain): Promise<Entity | null> {
    return this.call((s) => s.resolve(name, domainHint));
  }

  recommend(opts: Parameters<TasteSource["recommend"]>[0]): Promise<Entity[]> {
    return this.call((s) => s.recommend(opts));
  }
}
