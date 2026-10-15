import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { getTasteSource } from "../src/lib/source";
import { groupPicks, resolvePeople } from "../src/lib/taste";

const server = new McpServer({ name: "taste-layer", version: "0.1.0" });
const src = getTasteSource();
const domain = z.enum(["place", "artist", "movie", "brand", "destination", "book", "podcast"]);

server.tool(
  "resolve_taste_anchor",
  "Resolve a free-text thing someone likes (artist, brand, film, venue) to a Qloo entity.",
  { name: z.string(), domain: domain.optional() },
  async ({ name, domain }) => ({ content: [{ type: "text", text: JSON.stringify({ mode: src.mode, entity: await src.resolve(name, domain) }) }] }),
);

server.tool(
  "recommend_for_group",
  "Rank recommendations in a domain for a group so the worst-served person is served best. Each person lists things they like.",
  { people: z.array(z.object({ name: z.string(), likes: z.array(z.string()) })).min(1), domain, location: z.string().optional() },
  async ({ people, domain, location }) => {
    const resolved = await resolvePeople(src, people);
    const picks = await groupPicks(src, resolved, domain, location);
    return { content: [{ type: "text", text: JSON.stringify({ mode: src.mode, unresolved: resolved.flatMap((p) => p.unresolved), picks }) }] };
  },
);

await server.connect(new StdioServerTransport());
