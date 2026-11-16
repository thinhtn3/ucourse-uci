// Downloads the full UCI catalog from the Anteater API into src/data/courses.json,
// so course search never has to call the API at runtime. Run: npm run sync:courses
import { writeFileSync } from "node:fs";

const BASE = "https://anteaterapi.com/v2/rest/coursesCursor?take=100";
const QUARTERS = ["Fall", "Winter", "Spring", "Summer"];
const minYear = new Date().getFullYear() - 3;

// Same rule as usualQuarters() in src/lib/courses.ts: quarters offered in the last 3 years.
function usual(terms = []) {
  const seen = new Set();
  for (const t of terms) {
    const m = t.match(/^(\d{4})\s+(Fall|Winter|Spring|Summer)/i);
    if (m && Number(m[1]) >= minYear) seen.add(m[2][0].toUpperCase() + m[2].slice(1).toLowerCase());
  }
  return QUARTERS.filter((q) => seen.has(q));
}

const courses = [];
let cursor = "";
do {
  const res = await fetch(BASE + (cursor ? `&cursor=${encodeURIComponent(cursor)}` : ""));
  const body = await res.json();
  if (!res.ok || !body.ok) throw new Error(`Anteater API ${res.status}: ${JSON.stringify(body).slice(0, 200)}`);
  for (const c of body.data.items) {
    courses.push({
      department: c.department,
      number: c.courseNumber,
      title: c.title,
      units: c.minUnits === c.maxUnits ? String(c.maxUnits) : `${c.minUnits}-${c.maxUnits}`,
      usuallyOffered: usual(c.terms),
    });
  }
  cursor = body.data.nextCursor;
  process.stdout.write(`\r${courses.length} courses`);
} while (cursor);

courses.sort((a, b) => a.department.localeCompare(b.department) || a.number.localeCompare(b.number, "en", { numeric: true }));
const out = { syncedAt: new Date().toISOString().slice(0, 10), courses };
writeFileSync(new URL("../src/data/courses.json", import.meta.url), JSON.stringify(out));
console.log(`\nWrote ${courses.length} courses to src/data/courses.json`);
