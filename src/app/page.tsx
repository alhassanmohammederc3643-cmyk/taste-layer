"use client";
import { useState } from "react";

type Person = { name: string; likes: string };
const card = { background: "#171a21", border: "1px solid #272b36", borderRadius: 12, padding: 16 } as const;

export default function Home() {
  const [people, setPeople] = useState<Person[]>([
    { name: "Ama", likes: "Burna Boy, Black Panther" },
    { name: "Kojo", likes: "Sade, Zara" },
  ]);
  const [location, setLocation] = useState("New York");
  const [res, setRes] = useState<any>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  async function run() {
    setBusy(true); setErr(""); setRes(null);
    const r = await fetch("/api/plan", {
      method: "POST",
      body: JSON.stringify({
        domain: "place", location, occasion: "group night out",
        people: people.map((p) => ({ name: p.name, likes: p.likes.split(",").map((s) => s.trim()).filter(Boolean) })),
      }),
    });
    const j = await r.json();
    if (!r.ok) setErr(JSON.stringify(j.error)); else setRes(j);
    setBusy(false);
  }

  return (
    <main style={{ maxWidth: 900, margin: "0 auto", padding: 24, display: "grid", gap: 16 }}>
      <h1 style={{ margin: 0 }}>Taste Layer for agents</h1>
      <p style={{ margin: 0, opacity: 0.8 }}>Same LLM, same question. One answer guessed, one grounded in Qloo's taste graph and ranked by how many people in the group it actually fits.</p>
      {res?.mode === "sample" && (
        <div style={{ ...card, borderColor: "#b7791f" }}>SAMPLE DATA mode: no Qloo key configured, results come from local fixtures, not Qloo.</div>
      )}
      <section style={{ ...card, display: "grid", gap: 8 }}>
        {people.map((p, i) => (
          <div key={i} style={{ display: "grid", gridTemplateColumns: "120px 1fr", gap: 8 }}>
            <input aria-label="name" value={p.name} onChange={(e) => setPeople(people.map((x, j) => (j === i ? { ...x, name: e.target.value } : x)))} />
            <input aria-label="likes" value={p.likes} onChange={(e) => setPeople(people.map((x, j) => (j === i ? { ...x, likes: e.target.value } : x)))} />
          </div>
        ))}
        <div style={{ display: "flex", gap: 8 }}>
          <button onClick={() => setPeople([...people, { name: "", likes: "" }])} disabled={people.length >= 6}>+ person</button>
          <input aria-label="location" value={location} onChange={(e) => setLocation(e.target.value)} />
          <button onClick={run} disabled={busy}>{busy ? "Asking the taste graph (~10s)..." : "Plan the night"}</button>
        </div>
      </section>
      {err && <pre style={{ color: "#f88" }}>{err}</pre>}
      {res && (
        <section style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
          <div style={card}><h3>Without Qloo</h3><Md text={res.withoutQloo} /></div>
          <div style={{ ...card, borderColor: "#4c6ef5" }}><h3>With Qloo taste layer</h3><Md text={res.withQloo} /></div>
          <div style={{ ...card, gridColumn: "1 / -1" }}>
            <h3>Ranked picks</h3>
            <ol>{res.picks.map((p: any) => (<li key={p.id}>{p.name} <small>fans: {p.fans.join(", ")} | covers {Math.round(p.fairness * 100)}% of group</small></li>))}</ol>
          </div>
        </section>
      )}
    </main>
  );
}

function Md({ text }: { text: string }) {
  const parts = String(text).split(/(\*\*[^*]+\*\*)/g);
  return (
    <p style={{ whiteSpace: "pre-wrap" }}>
      {parts.map((seg, i) => (seg.startsWith("**") && seg.endsWith("**") ? <strong key={i}>{seg.slice(2, -2)}</strong> : seg))}
    </p>
  );
}
