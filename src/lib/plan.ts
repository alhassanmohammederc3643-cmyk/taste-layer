import { chat, type LlmConfig } from "./llm";
import { groupPicks, resolvePeople, type Pick, type ResolvedPerson } from "./taste";
import type { Domain, Person, TasteSource } from "./types";

export interface PlanResult {
  mode: "live" | "sample";
  people: ResolvedPerson[];
  picks: Pick[];
  withQloo: string;
  withoutQloo: string;
}

const SYS = "You are a concise planning agent. Be specific and short (max 90 words).";

export async function planOuting(
  src: TasteSource,
  llm: LlmConfig,
  input: { people: Person[]; domain: Domain; location?: string; occasion?: string },
): Promise<PlanResult> {
  const people = await resolvePeople(src, input.people);
  const picks = await groupPicks(src, people, input.domain, input.location);
  const brief = `Occasion: ${input.occasion ?? "group outing"}. Location: ${input.location ?? "anywhere"}. People: ${input.people.map((p) => `${p.name} likes ${p.likes.join(", ")}`).join("; ")}.`;

  const grounded = picks.length
    ? `Taste-graph picks (ranked by group coverage then affinity):\n${picks.map((p, i) => `${i + 1}. ${p.name} [${(p.tags ?? []).join(", ")}] fans: ${p.fans.join(", ") || "none"}`).join("\n")}`
    : "No taste-graph matches.";
  const safeChat = (user: string) => chat(llm, SYS, user).catch(() => null);
  const [withQloo, withoutQloo] = await Promise.all([
    safeChat(`${brief}\nChoose ONE ${input.domain} and explain the fit using ONLY these picks. Each pick's "fans" list names exactly who it fits; never claim it fits anyone not in its fans list - if it does not fit the whole group, say so plainly.\n${grounded}`),
    safeChat(`${brief}\nRecommend ONE ${input.domain}.`),
  ]);
  return {
    mode: src.mode,
    people,
    picks,
    withQloo: withQloo ?? templated(picks),
    withoutQloo: withoutQloo ?? "The plain-LLM comparison is temporarily unavailable. The Qloo-grounded picks below are live.",
  };
}

function templated(picks: Pick[]): string {
  if (!picks.length) return "No grounded pick found.";
  const p = picks[0];
  return `${p.name}: best worst-case fit for the group (fans: ${p.fans.join(", ")}).`;
}
