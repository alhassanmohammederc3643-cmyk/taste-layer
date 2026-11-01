import { describe, expect, it } from "vitest";
import { FallbackSource } from "../src/lib/fallback";
import { SampleSource } from "../src/lib/sample";
import { QlooClient } from "../src/lib/qloo";
import { getTasteSource } from "../src/lib/source";
import { planOuting } from "../src/lib/plan";

const searchOk = async () =>
  new Response(
    JSON.stringify({
      results: [{ entity_id: "q1", name: "Burna Boy", types: ["urn:entity:artist"], popularity: 0.9 }],
    }),
  );

describe("fallback source", () => {
  it("serves live data while the API works (valid key)", async () => {
    const src = new FallbackSource(new QlooClient("k", "https://hackathon.api.qloo.com", searchOk as any), new SampleSource());
    expect(src.mode).toBe("live");
    const hit = await src.resolve("Burna Boy", "artist");
    expect(hit?.id).toBe("q1");
    expect(src.mode).toBe("live");
    expect(src.degradedReason).toBeUndefined();
  });

  it("degrades to labeled fixtures on a revoked key (401), without throwing", async () => {
    const unauthorized = async () => new Response(JSON.stringify({ error: { code: 401 } }), { status: 401 });
    const src = new FallbackSource(new QlooClient("dead", "https://hackathon.api.qloo.com", unauthorized as any), new SampleSource());
    expect(src.mode).toBe("live");
    const hit = await src.resolve("Burna Boy", "artist");
    expect(hit?.id).toBe("s-art-1"); // fixture, not Qloo
    expect(src.mode).toBe("sample"); // consumers now label results as fixtures
    expect(src.degradedReason).toContain("401");
    // stays degraded: later calls go straight to fixtures
    const again = await src.resolve("Sade", "artist");
    expect(again?.id).toBe("s-art-4");
  });

  it("degrades to labeled fixtures on network failure/timeout", async () => {
    const down = async () => {
      throw new TypeError("fetch failed");
    };
    const src = new FallbackSource(new QlooClient("k", "https://hackathon.api.qloo.com", down as any), new SampleSource());
    const picks = await src.recommend({ domain: "place", signalEntityIds: [] });
    expect(picks.length).toBeGreaterThan(0);
    expect(src.mode).toBe("sample");
  });

  it("getTasteSource wraps a keyed client in the fallback and stays keyless-sample without one", () => {
    expect(getTasteSource({}).mode).toBe("sample");
    expect(getTasteSource({ QLOO_API_KEY: "k" }).mode).toBe("live");
  });

  it("planOuting survives a dead key end to end and labels sample copy honestly", async () => {
    const unauthorized = async () => new Response("{}", { status: 401 });
    const src = new FallbackSource(new QlooClient("dead", "https://hackathon.api.qloo.com", unauthorized as any), new SampleSource());
    const out = await planOuting(src, {}, {
      people: [{ name: "A", likes: ["Burna Boy"] }, { name: "B", likes: ["Sade"] }],
      domain: "place",
    });
    expect(out.mode).toBe("sample");
    expect(out.picks.length).toBeGreaterThan(0);
    expect(out.withoutQloo).toContain("sample fixtures");
    expect(out.withoutQloo).not.toContain("are live");
  });
});
