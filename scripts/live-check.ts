import { QlooClient } from "../src/lib/qloo";
import { resolvePeople, groupPicks } from "../src/lib/taste";
const c = new QlooClient(process.env.QLOO_API_KEY!, process.env.QLOO_BASE_URL);
(async () => {
const people = await resolvePeople(c, [{name:"Ama",likes:["Burna Boy","Black Panther"]},{name:"Kojo",likes:["Sade","Zara"]}]);
console.log(people.map(p=>({n:p.name,a:p.anchors.map(a=>a.name+":"+a.type),u:p.unresolved})));
for (const d of ["place","artist"] as const) { const picks = await groupPicks(c, people, d, d==="place"?"Accra":undefined); console.log(d, picks.map(p=>`${p.name} f=${p.fairness.toFixed(2)} fans=${p.fans}`)); }
})();
