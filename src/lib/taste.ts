import type { Domain, Entity, Person, TasteSource } from "./types";

export interface ResolvedPerson {
  name: string;
  anchors: Entity[];
  unresolved: string[];
}

export async function resolvePeople(src: TasteSource, people: Person[]): Promise<ResolvedPerson[]> {
  return Promise.all(
    people.map(async (p) => {
      const found = await Promise.all(p.likes.map((l) => src.resolve(l)));
      return {
        name: p.name,
        anchors: found.filter((e): e is Entity => !!e),
        unresolved: p.likes.filter((_, i) => !found[i]),
      };
    }),
  );
}

export interface Pick extends Entity {
  /** people whose own taste ranks this entity */
  fans: string[];
  /** min across people: a pick is only as good as its least-served person */
  fairness: number;
}

/**
 * Group consensus: run Qloo once per person, then rank by fairness (worst-served person)
 * with mean affinity as tiebreaker. This is what an LLM alone cannot do: it has no
 * per-person taste signal, only stereotypes.
 */
export async function groupPicks(
  src: TasteSource,
  people: ResolvedPerson[],
  domain: Domain,
  location?: string,
  take = 5,
): Promise<Pick[]> {
  const perPerson = await Promise.all(
    people.map(async (p) => ({
      name: p.name,
      recs: p.anchors.length ? await src.recommend({ domain, signalEntityIds: p.anchors.map((a) => a.id), location, take: 20 }) : [],
    })),
  );
  const byId = new Map<string, { e: Entity; scores: Record<string, number> }>();
  for (const { name, recs } of perPerson)
    for (const r of recs) {
      const cur = byId.get(r.id) ?? { e: r, scores: {} };
      cur.scores[name] = r.score ?? 0.5;
      byId.set(r.id, cur);
    }
  const picks: Pick[] = [...byId.values()].map(({ e, scores }) => {
    const vals = people.map((p) => scores[p.name] ?? 0);
    return {
      ...e,
      fans: people.filter((p) => (scores[p.name] ?? 0) > 0).map((p) => p.name),
      fairness: Math.min(...vals),
      score: vals.reduce((a, b) => a + b, 0) / vals.length,
    };
  });
  return picks.sort((a, b) => b.fairness - a.fairness || (b.score ?? 0) - (a.score ?? 0)).slice(0, take);
}
