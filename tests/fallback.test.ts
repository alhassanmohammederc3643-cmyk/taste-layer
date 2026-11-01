import { describe, expect, it } from "vitest";
import { withFixtureFallback } from "../src/lib/fallback";
import { SampleSource } from "../src/lib/sample";
import { QlooClient } from "../src/lib/qloo";
import { getTasteSource } from "../src/lib/source";
import { planOuting } from "../src/lib/plan";
import type { TasteSource } from "../src/lib/types";

const PEOPLE = [{ name: "A", likes: ["Burna Boy"] }, { name: "B", likes: ["Sade"] }];

const liveQloo = (fetchImpl: typeof fetch) => new QlooClient("k", "https://hackathon.api.qloo.com", fetchImpl);

const okFetch = (async (u: URL) =>
  u.pathname === "/search"
    ? new Response(JSON.stringify({ results: [{ entity_id: "q1", name: "Burna Boy", types: ["urn:entity:artist"], popularity: 0.9 }] }))
    : new Response(JSON.stringify({ results: { entities: [{ entity_id: "qp1", name: "Q Place", types: ["urn:entity:place"], query: { affinity: 0.8 } }] } }))) as any;

const failFetch = (status = 401) => (async () => new Response(JSON.stringify({ error: { code: status } }), { status })) as any;

describe("withFixtureFallback", () => {
  it("returns the live result unchanged when the operation succeeds", async () => {
    const out = await withFixtureFallback(liveQloo(okFetch), async (s) => ({ mode: s.mode, entity: await s.resolve("Burna Boy", "artist") }));
    expect(out).toMatchObject({ mode: "live", entity: { id: "q1" } });
  });

  it("reruns the whole operation on fixtures when the live source fails (MCP pattern)", async () => {
    const out = await withFixtureFallback(liveQloo(failFetch()), async (s) => ({ mode: s.mode, entity: await s.resolve("Burna Boy", "artist") }));
    expect(out).toMatchObject({ mode: "sample", entity: { id: "s-art-1" } });
  });

  it("does not mask failures of the sample source itself", async () => {
    const broken: TasteSource = { mode: "sample", resolve: async () => { throw new Error("bug"); }, recommend: async () => [] };
    await expect(withFixtureFallback(broken, (s) => s.resolve("x"))).rejects.toThrow("bug");
  });
});

describe("planOuting fallback", () => {
  it("valid key: fully live result, live copy", async () => {
    const out = await planOuting(liveQloo(okFetch), {}, { people: PEOPLE, domain: "place" });
    expect(out.mode).toBe("live");
    expect(out.picks[0].id).toBe("qp1");
    expect(out.withoutQloo).toContain("are live");
  });

  it("revoked key (401): whole plan reruns on fixtures, labeled sample, honest copy", async () => {
    const out = await planOuting(liveQloo(failFetch(401)), {}, { people: PEOPLE, domain: "place" });
    expect(out.mode).toBe("sample");
    expect(out.picks.length).toBeGreaterThan(0);
    expect(out.picks.every((p) => p.id.startsWith("s-"))).toBe(true);
    expect(out.withoutQloo).toContain("sample fixtures");
    expect(out.withoutQloo).not.toContain("are live");
  });

  it("mid-plan failure (resolve ok, recommend fails) recomputes a coherent all-fixture plan", async () => {
    let recommends = 0;
    const flaky: TasteSource = {
      mode: "live",
      resolve: async (name) => ({ id: "q-live-anchor", name, type: "artist" }),
      recommend: async () => { recommends++; throw new Error("Qloo /v2/insights failed: 401"); },
    };
    const out = await planOuting(flaky, {}, { people: PEOPLE, domain: "place" });
    expect(recommends).toBeGreaterThan(0); // failed on the live source, then the rerun used fixtures
    expect(out.mode).toBe("sample");
    // no mixed provenance: every anchor and every pick is fixture data
    expect(out.people.flatMap((p) => p.anchors).every((a) => a.id.startsWith("s-"))).toBe(true);
    expect(out.picks.every((p) => p.id.startsWith("s-"))).toBe(true);
  });

  it("transient failure is not sticky: the next request on a healthy source is live again", async () => {
    const first = await planOuting(liveQloo(failFetch(503)), {}, { people: PEOPLE, domain: "place" });
    expect(first.mode).toBe("sample");
    const second = await planOuting(liveQloo(okFetch), {}, { people: PEOPLE, domain: "place" });
    expect(second.mode).toBe("live");
    expect(second.picks[0].id).toBe("qp1");
  });
});

describe("getTasteSource", () => {
  it("is sample without a key and live with one", () => {
    expect(getTasteSource({}).mode).toBe("sample");
    expect(getTasteSource({ QLOO_API_KEY: "k" }).mode).toBe("live");
  });
});
