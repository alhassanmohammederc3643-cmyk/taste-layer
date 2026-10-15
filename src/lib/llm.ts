export interface LlmConfig { apiKey?: string; baseUrl?: string; model?: string }

export function llmFromEnv(env: Record<string, string | undefined> = process.env): LlmConfig {
  return { apiKey: env.LLM_API_KEY, baseUrl: env.LLM_BASE_URL || "https://api.groq.com/openai/v1", model: env.LLM_MODEL || "llama-3.3-70b-versatile" };
}

/** OpenAI-compatible chat call. Returns null when no key is set so callers can fall back to templates. */
export async function chat(cfg: LlmConfig, system: string, user: string, fetchImpl: typeof fetch = fetch): Promise<string | null> {
  if (!cfg.apiKey) return null;
  const res = await fetchImpl(`${cfg.baseUrl}/chat/completions`, {
    method: "POST",
    headers: { Authorization: `Bearer ${cfg.apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({ model: cfg.model, temperature: 0.4, messages: [{ role: "system", content: system }, { role: "user", content: user }] }),
  });
  if (!res.ok) throw new Error(`LLM failed: ${res.status}`);
  const j = await res.json();
  return j.choices?.[0]?.message?.content ?? null;
}
