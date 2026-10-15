import type { Domain, Entity, TasteSource } from "./types";

/**
 * SAMPLE DATA MODE. Hand-written fixtures, NOT Qloo output.
 * Used only when no QLOO_API_KEY is configured so the UI and tests run offline.
 * Every response from this source is labeled mode="sample" and the UI shows a banner.
 */
const CATALOG: Entity[] = [
  { id: "s-art-1", name: "Burna Boy", type: "artist", tags: ["afrobeats", "afro-fusion"] },
  { id: "s-art-2", name: "Tems", type: "artist", tags: ["afro-soul", "r&b"] },
  { id: "s-art-3", name: "Black Sherif", type: "artist", tags: ["afro-drill", "highlife"] },
  { id: "s-art-4", name: "Sade", type: "artist", tags: ["smooth jazz", "soul"] },
  { id: "s-mov-1", name: "Black Panther", type: "movie", tags: ["superhero", "afrofuturism"] },
  { id: "s-mov-2", name: "The Woman King", type: "movie", tags: ["historical", "epic"] },
  { id: "s-brd-1", name: "Zara", type: "brand", tags: ["fashion", "minimal"] },
  { id: "s-brd-2", name: "Free the Youth", type: "brand", tags: ["streetwear", "ghana"] },
  { id: "s-plc-1", name: "Skybar rooftop lounge", type: "place", tags: ["rooftop", "cocktails", "live DJ"] },
  { id: "s-plc-2", name: "Buka Restaurant", type: "place", tags: ["west african", "casual", "groups"] },
  { id: "s-plc-3", name: "Jazz night supper club", type: "place", tags: ["live jazz", "dinner", "quiet"] },
  { id: "s-plc-4", name: "Kokrobite beach bar", type: "place", tags: ["beach", "reggae", "casual"] },
];

const NAME_TO_ID = new Map(CATALOG.map((e) => [e.name.toLowerCase(), e.id]));

export class SampleSource implements TasteSource {
  mode = "sample" as const;

  async resolve(name: string, domainHint?: Domain): Promise<Entity | null> {
    const q = name.trim().toLowerCase();
    const hit = CATALOG.find((e) => e.name.toLowerCase() === q) ?? CATALOG.find((e) => e.name.toLowerCase().includes(q) || q.includes(e.name.toLowerCase()));
    if (hit && (!domainHint || hit.type === domainHint)) return hit;
    return null;
  }

  async recommend(opts: { domain: Domain; signalEntityIds: string[]; take?: number }): Promise<Entity[]> {
    const signals = CATALOG.filter((e) => opts.signalEntityIds.includes(e.id));
    const signalTags = new Set(signals.flatMap((e) => e.tags ?? []));
    return CATALOG.filter((e) => e.type === opts.domain && !opts.signalEntityIds.includes(e.id))
      .map((e) => ({ ...e, score: Math.min(1, 0.4 + 0.2 * (e.tags ?? []).filter((t) => signalTags.has(t)).length) }))
      .sort((a, b) => (b.score ?? 0) - (a.score ?? 0))
      .slice(0, opts.take ?? 6);
  }
}

export const SAMPLE_IDS = NAME_TO_ID;
