import { DOMAIN_URN, type Domain, type Entity, type TasteSource } from "./types";

const DEFAULT_BASE = "https://hackathon.api.qloo.com";

/** Thin client over Qloo's documented Search + Insights endpoints (hackathon base URL only). */
export class QlooClient implements TasteSource {
  mode = "live" as const;
  constructor(
    private apiKey: string,
    private baseUrl: string = DEFAULT_BASE,
    private fetchImpl: typeof fetch = fetch,
  ) {}

  private async get(path: string, params: Record<string, string | number | boolean | undefined>) {
    const url = new URL(path, this.baseUrl);
    for (const [k, v] of Object.entries(params)) if (v !== undefined && v !== "") url.searchParams.set(k, String(v));
    const res = await this.fetchImpl(url, { headers: { "X-Api-Key": this.apiKey, Accept: "application/json" } });
    if (!res.ok) throw new Error(`Qloo ${path} failed: ${res.status} ${(await res.text()).slice(0, 200)}`);
    return res.json();
  }

  async resolve(name: string, domainHint?: Domain): Promise<Entity | null> {
    const json = await this.get("/search", {
      query: name,
      types: domainHint ? DOMAIN_URN[domainHint] : undefined,
      take: 1,
    });
    const hit = (json?.results ?? json?.entities ?? [])[0];
    return hit ? toEntity(hit, domainHint) : null;
  }

  async recommend(opts: { domain: Domain; signalEntityIds: string[]; location?: string; take?: number }): Promise<Entity[]> {
    const json = await this.get("/v2/insights", {
      "filter.type": DOMAIN_URN[opts.domain],
      "signal.interests.entities": opts.signalEntityIds.join(","),
      "filter.location.query": opts.location,
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
    type: domain ?? inferDomain(r.type ?? r.subtype),
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
