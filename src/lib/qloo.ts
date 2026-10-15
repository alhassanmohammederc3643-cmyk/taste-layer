import { DOMAIN_URN, type Domain, type Entity, type TasteSource } from "./types";

const PREFERRED = ["urn:entity:artist", "urn:entity:brand", "urn:entity:movie", "urn:entity:place", "urn:entity:book", "urn:entity:podcast", "urn:entity:destination"];
const DEFAULT_BASE = "https://hackathon.api.qloo.com";

/** Thin client over Qloo's documented Search + Insights endpoints (hackathon base URL only). */
export class QlooClient implements TasteSource {
  mode = "live" as const;
  constructor(
    private apiKey: string,
    private baseUrl: string = DEFAULT_BASE,
    private fetchImpl: typeof fetch = fetch,
  ) {}

  private active = 0;
  private waiting: Array<() => void> = [];
  private cache = new Map<string, Promise<any>>();

  /** Max 3 concurrent calls, retry on 429 (hackathon keys are rate limited), per-instance response cache. */
  private get(path: string, params: Record<string, string | number | boolean | undefined>): Promise<any> {
    const url = new URL(path, this.baseUrl);
    for (const [k, v] of Object.entries(params)) if (v !== undefined && v !== "") url.searchParams.set(k, String(v));
    const key = url.toString();
    const hit = this.cache.get(key);
    if (hit) return hit;
    const p = this.limited(async () => {
      for (let attempt = 0; ; attempt++) {
        const res = await this.fetchImpl(url, { headers: { "X-Api-Key": this.apiKey, Accept: "application/json" } });
        if (res.status === 429 && attempt < 4) { await sleep(800 * 2 ** attempt); continue; }
        if (!res.ok) throw new Error(`Qloo ${path} failed: ${res.status} ${(await res.text()).slice(0, 200)}`);
        return res.json();
      }
    });
    p.catch(() => this.cache.delete(key));
    this.cache.set(key, p);
    return p;
  }

  private async limited<T>(fn: () => Promise<T>): Promise<T> {
    if (this.active >= 3) await new Promise<void>((r) => this.waiting.push(r));
    this.active++;
    try { return await fn(); } finally { this.active--; this.waiting.shift()?.(); }
  }

  async resolve(name: string, domainHint?: Domain): Promise<Entity | null> {
    const json = await this.get("/search", {
      query: name,
      types: domainHint ? DOMAIN_URN[domainHint] : undefined,
      take: 5,
    });
    const rows: any[] = json?.results ?? [];
    // Unfiltered search often returns the generic "person" record first; prefer a taste-bearing type.
    const rank = (r: any) => {
      const t: string[] = r.types ?? [];
      const i = PREFERRED.findIndex((u) => t.includes(u));
      return i === -1 ? 99 : i;
    };
    const usable = rows.filter((r) => rank(r) !== 99);
    const pool = usable.length ? usable : rows;
    const q = name.trim().toLowerCase();
    const exact = (r: any) => (String(r.name ?? "").toLowerCase() === q ? 1 : 0);
    const hit = [...pool].sort((a, b) => exact(b) - exact(a) || (b.popularity ?? 0) - (a.popularity ?? 0))[0];
    return hit ? toEntity(hit, domainHint) : null;
  }

  async recommend(opts: { domain: Domain; signalEntityIds: string[]; location?: string; take?: number; tags?: string[]; excludeTags?: string[] }): Promise<Entity[]> {
    const json = await this.get("/v2/insights", {
      "filter.type": DOMAIN_URN[opts.domain],
      "signal.interests.entities": opts.signalEntityIds.join(","),
      "filter.location.query": opts.location,
      "filter.tags": opts.tags?.join(","),
      "filter.exclude.tags": opts.excludeTags?.join(","),
      take: opts.take ?? 6,
      "feature.explainability": true,
    });
    const rows: any[] = json?.results?.entities ?? json?.results ?? json?.entities ?? [];
    return rows.map((r) => toEntity(r, opts.domain));
  }
}

export function toEntity(r: any, domain?: Domain): Entity {
  return {
    id: String(r.entity_id ?? r.id),
    name: String(r.name ?? "Unknown"),
    type: domain ?? inferDomain((r.types && r.types[0]) ?? r.type ?? r.subtype),
    description: r.properties?.short_description ?? r.properties?.description ?? undefined,
    tags: Array.isArray(r.tags) ? r.tags.map((t: any) => String(t.name ?? t)).slice(0, 6) : undefined,
    score: typeof r.query?.affinity === "number" ? r.query.affinity : undefined,
  };
}

function inferDomain(t?: string): Domain {
  const s = (t ?? "").toLowerCase();
  for (const d of Object.keys(DOMAIN_URN) as Domain[]) if (s.includes(d)) return d;
  return "place";
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
