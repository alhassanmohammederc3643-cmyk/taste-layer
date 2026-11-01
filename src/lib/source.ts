import { FallbackSource } from "./fallback";
import { QlooClient } from "./qloo";
import { SampleSource } from "./sample";
import type { TasteSource } from "./types";

export function getTasteSource(env: Record<string, string | undefined> = process.env): TasteSource {
  // Key present: serve live Qloo data, degrading to labeled sample fixtures if the API fails.
  if (env.QLOO_API_KEY) return new FallbackSource(new QlooClient(env.QLOO_API_KEY, env.QLOO_BASE_URL || undefined), new SampleSource());
  return new SampleSource();
}
