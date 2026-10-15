import { NextResponse } from "next/server";
import { z } from "zod";
import { llmFromEnv } from "@/lib/llm";
import { planOuting } from "@/lib/plan";
import { getTasteSource } from "@/lib/source";

const Body = z.object({
  people: z.array(z.object({ name: z.string().min(1).max(40), likes: z.array(z.string().min(1).max(60)).min(1).max(8) })).min(1).max(6),
  domain: z.enum(["place", "artist", "movie", "brand", "destination", "book", "podcast"]).default("place"),
  location: z.string().max(80).optional(),
  occasion: z.string().max(120).optional(),
});

export async function POST(req: Request) {
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  try {
    return NextResponse.json(await planOuting(getTasteSource(), llmFromEnv(), parsed.data));
  } catch (e) {
    return NextResponse.json({ error: String((e as Error).message) }, { status: 502 });
  }
}
