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
    ? `Taste-graph picks (ranked by fairness across the group):\n${picks.map((p, i) => `${i + 1}. ${p.name} [${(p.tags ?? []).join(", ")}] fans: ${p.fans.join(", ") || "none"}`).join("\n")}`
    : "No taste-graph matches.";
  const [withQloo, withoutQloo] = await Promise.all([
    chat(llm, SYS, `${brief}\nChoose ONE ${input.domain} and say why it works for each person, using ONLY these picks.\n${grounded}`),
    chat(llm, SYS, `${brief}\nRecommend ONE ${input.domain}.`),
  ]);
  return {
    mode: src.mode,
    people,
    picks,
    withQloo: withQloo ?? templated(picks),
    withoutQloo: withoutQloo ?? "(Set LLM_API_KEY to see the plain-LLM answer here.)",
  };
}

function templated(picks: Pick[]): string {
  if (!picks.length) return "No grounded pick found.";
  const p = picks[0];
  return `${p.name}: best worst-case fit for the group (fans: ${p.fans.join(", ")}).`;
}
