import { DEFAULT_TAGS, type Domain, type Entity, type Person, type TasteSource } from "./types";

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
  const withAnchors = people.filter((p) => p.anchors.length);
  const perPerson = await Promise.all(
    withAnchors.map(async (p) => ({
      name: p.name,
      recs: await src.recommend({ domain, signalEntityIds: p.anchors.map((a) => a.id), location, take: 50, tags: DEFAULT_TAGS[domain] }),
    })),
  );
  // Joint query blends everyone's anchors; it supplies the candidate pool and a group-level affinity.
  const allIds = [...new Set(withAnchors.flatMap((p) => p.anchors.map((a) => a.id)))];
  const joint = allIds.length ? await src.recommend({ domain, signalEntityIds: allIds, location, take: 30, tags: DEFAULT_TAGS[domain] }) : [];

  const scoreByPerson = new Map<string, Record<string, number>>();
  for (const { name, recs } of perPerson)
    for (const r of recs) scoreByPerson.set(r.id, { ...(scoreByPerson.get(r.id) ?? {}), [name]: r.score ?? 0.5 });

  const pool = new Map<string, Entity>();
  for (const e of joint) pool.set(e.id, e);
  for (const { recs } of perPerson) for (const e of recs.slice(0, 10)) if (!pool.has(e.id)) pool.set(e.id, e);

  const picks: Pick[] = [...pool.values()].map((e) => {
    const sc = scoreByPerson.get(e.id) ?? {};
    const fans = withAnchors.filter((p) => (sc[p.name] ?? 0) > 0).map((p) => p.name);
    const present = Object.values(sc);
    const inJoint = joint.find((j) => j.id === e.id);
    // coverage = share of people whose own taste list contains it
    const coverage = withAnchors.length ? fans.length / withAnchors.length : 0;
    const mean = present.length ? present.reduce((a, b) => a + b, 0) / present.length : 0;
    return { ...e, fans, fairness: coverage, score: Math.max(mean, inJoint?.score ?? 0) };
  });
  return picks.sort((a, b) => b.fairness - a.fairness || (b.score ?? 0) - (a.score ?? 0)).slice(0, take);
}
