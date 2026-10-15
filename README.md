# Taste Layer for agents

Agents are good at reasoning and bad at taste. This project gives any agent a taste layer built on the [Qloo](https://qloo.com) taste graph, as:

1. **An MCP server** (`mcp/server.ts`) with two tools: `resolve_taste_anchor` and `recommend_for_group`.
2. **A hosted demo** (Next.js) that answers the same question twice, once from a plain LLM and once grounded in Qloo, side by side.

The key idea is **group coverage ranking**. Qloo is queried once per person from what that person likes, plus once for the whole group. Picks are ranked by coverage (how many people the pick fits), then affinity. A plain LLM has no per-person signal, only stereotypes.

## Status

Built for the Qloo Agentic Hackathon 2026. Without `QLOO_API_KEY` the app runs in clearly labeled **SAMPLE DATA mode** (local fixtures, not Qloo output) so it can be tested offline. With a key it calls Qloo's `/search` and `/v2/insights` endpoints on the hackathon base URL.

## Run

```bash
cp .env.example .env.local   # add QLOO_API_KEY (hackathon key), optional LLM_API_KEY
npm install
npm run dev                  # demo at http://localhost:3000
npm test                     # unit tests
npm run mcp                  # MCP server over stdio
```

MCP client config:

```json
{ "mcpServers": { "taste-layer": { "command": "npx", "args": ["tsx", "mcp/server.ts"], "env": { "QLOO_API_KEY": "..." } } } }
```

## Layout

- `src/lib/qloo.ts` Qloo client (search + insights, `X-Api-Key` header)
- `src/lib/taste.ts` anchor resolution and group coverage ranking
- `src/lib/plan.ts` runs the with/without-Qloo comparison
- `src/lib/sample.ts` offline fixtures (sample mode only)
- `mcp/server.ts` MCP server

## License

MIT
