import { QlooClient } from "./qloo";
import { SampleSource } from "./sample";
import type { TasteSource } from "./types";

export function getTasteSource(env: Record<string, string | undefined> = process.env): TasteSource {
  if (env.QLOO_API_KEY) return new QlooClient(env.QLOO_API_KEY, env.QLOO_BASE_URL || undefined);
  return new SampleSource();
}
