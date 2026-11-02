import catalog from "@/data/courses.json";
import { splitQuery } from "./courses";
import { matchDepartments, resolveDept } from "./departments";
import type { CourseOption, Quarter } from "./types";

// Full catalog snapshot (refresh with `npm run sync:courses`), indexed by department once per server instance.
type Entry = Omit<CourseOption, "label">;
const ALL: CourseOption[] = (catalog.courses as Entry[]).map((c) => ({
  ...c,
  label: `${c.department} ${c.number}`,
  usuallyOffered: c.usuallyOffered as Quarter[],
}));
const BY_DEPT = Map.groupBy(ALL, (c) => c.department);

export const catalogSyncedAt: string = catalog.syncedAt;

export function deptCourses(code: string): CourseOption[] {
  return BY_DEPT.get(code) ?? [];
}

export function titleSearch(q: string, limit = 20): CourseOption[] {
  const key = q.trim().toLowerCase();
  const hits: CourseOption[] = [];
  for (const c of ALL) if (c.title.toLowerCase().includes(key) && hits.push(c) >= limit) break;
  return hits;
}

function numberKey(n: string): [number, string] {
  const m = n.match(/^([A-Z]?)(\d+)(.*)$/);
  return m ? [Number(m[2]), m[1] + m[3]] : [Infinity, n];
}

function byCode(a: CourseOption, b: CourseOption) {
  const [an, as] = numberKey(a.number);
  const [bn, bs] = numberKey(b.number);
  return a.department.localeCompare(b.department) || an - bn || as.localeCompare(bs);
}

export function searchCourses(opts: { q?: string; department?: string; prefix?: string; limit: number }): CourseOption[] {
  const q = opts.q?.trim() ?? "";
  const prefix = (opts.prefix ?? "").toUpperCase();
  let depts: string[] = [];
  let number = prefix;
  let text = "";

  if (opts.department) {
    depts = [resolveDept(opts.department) ?? opts.department.trim().toUpperCase()];
    text = q.toLowerCase();
  } else {
    const split = splitQuery(q);
    if (split) {
      depts = [split.department];
      number = split.number || prefix;
    } else {
      // "comp", "info 4": partial department, optionally followed by a number prefix
      const m = q.match(/^(.*?)\s*(\d[0-9A-Za-z]*)?$/);
      const deptPart = m?.[1] ?? q;
      if (m?.[2]) number = m[2].toUpperCase();
      depts = matchDepartments(deptPart, 3).map((d) => d.code);
    }
  }

  let results: CourseOption[] = [];
  if (depts.length) {
    results = depts
      .flatMap(deptCourses)
      .filter((c) => c.number.startsWith(number))
      .filter((c) => !text || c.number.toLowerCase().startsWith(text) || c.title.toLowerCase().includes(text));
  }
  if (!results.length && !opts.department && q.length >= 3) results = titleSearch(q);
  // Best-matching department first ("comp" -> COMPSCI before COM LIT), then by course number.
  const rank = (c: CourseOption) => (depts.includes(c.department) ? depts.indexOf(c.department) : depts.length);
  // Exact code first; courses not offered in the last 3 years go last.
  const stale = (c: CourseOption) => (c.number === number ? -1 : c.usuallyOffered.length ? 0 : 1);
  return results.sort((a, b) => rank(a) - rank(b) || stale(a) - stale(b) || byCode(a, b)).slice(0, opts.limit);
}
