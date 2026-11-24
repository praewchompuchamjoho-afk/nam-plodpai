// ดึงข่าวสารหนูจาก Google News RSS ฝั่งเซิร์ฟเวอร์ แล้วเขียนเป็น news.json (รันโดย GitHub Actions)
import fs from "node:fs";
const OUT = "news.json";
const Q = ["สารหนู when:1d", "สารหนู น้ำ แม่น้ำ when:3d", "สารหนู when:7d", "แม่น้ำกก สารหนู when:7d"];
const url = q => "https://news.google.com/rss/search?q=" + encodeURIComponent(q) + "&hl=th&gl=TH&ceid=TH:th";
const dec = s => s.replace(/<!\[CDATA\[|\]\]>/g, "").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#39;|&apos;/g, "'").replace(/&amp;/g, "&").trim();
const tag = (x, t) => { const m = x.match(new RegExp("<" + t + "[^>]*>([\\s\\S]*?)</" + t + ">")); return m ? dec(m[1]) : ""; };
function parse(xml) {
  return [...xml.matchAll(/<item>([\s\S]*?)<\/item>/g)].map(m => {
    const d = new Date(tag(m[1], "pubDate"));
    return isNaN(d) ? null : { title: tag(m[1], "title"), link: tag(m[1], "link"), t: d.toISOString() };
  }).filter(Boolean);
}
async function get(q) {
  if (process.env.MOCK) return parse(fs.readFileSync(process.env.MOCK, "utf8"));
  const r = await fetch(url(q), { headers: { "user-agent": "Mozilla/5.0 (compatible; nam-plodpai-news/1.0)" }, signal: AbortSignal.timeout(20000) });
  if (!r.ok) throw new Error(q + " -> HTTP " + r.status);
  return parse(await r.text());
}
const res = await Promise.allSettled(Q.map(get));
res.forEach((r, i) => { if (r.status === "rejected") console.warn("fail:", Q[i], String(r.reason)); });
const seen = new Set();
const items = res.flatMap(r => r.status === "fulfilled" ? r.value : [])
  .filter(n => n.t <= new Date(Date.now() + 36e5).toISOString())
  .sort((a, b) => b.t.localeCompare(a.t))
  .filter(n => { const k = n.title.replace(/\s+/g, "").slice(0, 40); if (seen.has(k)) return false; seen.add(k); return true; })
  .slice(0, 40);
if (!items.length) { console.warn("ไม่ได้ข่าวเลย ใช้ไฟล์เดิมต่อ"); process.exit(0); }
const next = JSON.stringify({ items }, null, 1);
if (fs.existsSync(OUT) && fs.readFileSync(OUT, "utf8") === next) { console.log("ไม่มีข่าวใหม่"); process.exit(0); }
fs.writeFileSync(OUT, next);
console.log("เขียน", items.length, "ข่าว ล่าสุด", items[0].t);
