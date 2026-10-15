import { describe, expect, it } from "vitest";
import { SampleSource } from "../src/lib/sample";
import { QlooClient, toEntity } from "../src/lib/qloo";
import { groupPicks, resolvePeople } from "../src/lib/taste";
import { getTasteSource } from "../src/lib/source";

describe("sample mode", () => {
  it("is selected without a key and labeled sample", () => {
    expect(getTasteSource({}).mode).toBe("sample");
    expect(getTasteSource({ QLOO_API_KEY: "k" }).mode).toBe("live");
  });
  it("resolves anchors and flags unknown ones", async () => {
    const r = await resolvePeople(new SampleSource(), [{ name: "A", likes: ["Burna Boy", "Nonexistent Thing"] }]);
    expect(r[0].anchors.map((a) => a.name)).toEqual(["Burna Boy"]);
    expect(r[0].unresolved).toEqual(["Nonexistent Thing"]);
  });
  it("ranks by fairness (worst-served person)", async () => {
    const src = new SampleSource();
    const people = await resolvePeople(src, [
      { name: "A", likes: ["Burna Boy"] },
      { name: "B", likes: ["Sade"] },
    ]);
    const picks = await groupPicks(src, people, "place");
    expect(picks.length).toBeGreaterThan(0);
    for (let i = 1; i < picks.length; i++) expect(picks[i - 1].fairness).toBeGreaterThanOrEqual(picks[i].fairness);
  });
});

describe("qloo client", () => {
  it("sends key header, type URN and signals", async () => {
    let seen: URL | undefined; let hdr: any;
    const f = (async (u: URL, init: any) => { seen = u; hdr = init.headers; return new Response(JSON.stringify({ results: { entities: [{ entity_id: "1", name: "X", query: { affinity: 0.9 } }] } })); }) as any;
    const c = new QlooClient("secret", "https://hackathon.api.qloo.com", f, 0);
    const out = await c.recommend({ domain: "place", signalEntityIds: ["a", "b"], location: "Accra" });
    expect(seen!.pathname).toBe("/v2/insights");
    expect(seen!.searchParams.get("filter.type")).toBe("urn:entity:place");
    expect(seen!.searchParams.get("signal.interests.entities")).toBe("a,b");
    expect(hdr["X-Api-Key"]).toBe("secret");
    expect(out[0].score).toBe(0.9);
  });
  it("maps entities defensively", () => {
    expect(toEntity({ id: 5, name: "N" }, "artist")).toMatchObject({ id: "5", name: "N", type: "artist" });
  });
});
