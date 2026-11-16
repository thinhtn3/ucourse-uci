import { findCourses, parseCourse, type CourseRef } from "./courses";

// Parses text copied from a UCI Degree Works worksheet (Cmd/Ctrl+A, Cmd/Ctrl+C). Runs in the browser only.
// The check-mark icons don't survive copy/paste, but the row text still tells the cases apart:
//   completed:    "MATH 2A  CALCULUS  A-  4  2021 WINTER"              (letter grade, plain units, term)
//   in progress:  "IN4MATX 151  PROJECT MANAGEMENT  IP  (4)  2026 FALL" (grade IP, units in parentheses)
//   still needed: "Still needed:  1 Class in IN4MATX 191A", "2 Classes in IN4MATX 1@", "8 Units in COMPSCI 113:199",
//                 "1 Class in MATH 2A or 2B" (department carries forward), or free text ("Select four ... courses")

// "DEPT 1@" = any DEPT course numbered 1xx (prefix "1"); "DEPT @" = any DEPT course; "DEPT 113:199" = a number range.
export type Wildcard = { department: string; prefix?: string; min?: number; max?: number };
export type NeededItem = {
  count: number; // classes still needed from this group
  options: CourseRef[]; // named courses that satisfy it
  kind: "required" | "elective"; // elective = choose from more options than needed, or any wildcard
  label: string; // the requirement text, for display
  wildcards: Wildcard[];
};
export type DegreeWorksResult = {
  needed: NeededItem[];
  inProgress: CourseRef[];
  completed: CourseRef[];
  completedCount: number;
  needsInput: string[]; // "Still needed" requirements that name no course or wildcard (GE, ...)
};

const TERM = /\b20\d\d\s*(FALL|WINTER|SPRING|SSI|SSII|SS10|SUMMER)\b/i;
const NUMBER = /^[A-Z]?\d{1,3}[A-Z]{0,4}$/i;
const NEED = /(\d+(?:\.\d+)?)\s+(class(?:es)?|units?|credits?)\s+in\s+(.+)/i;

const deptOf = (raw: string) => (raw.trim() ? (parseCourse(`${raw.trim()} 100`)?.department ?? null) : null);
export const courseNumber = (n: string) => parseInt(n.replace(/^\D+/, ""), 10);

/** Courses and wildcards in the "… in A, B or 2C" part of a requirement. */
function parseOptions(text: string): { options: CourseRef[]; wildcards: Wildcard[] } {
  const options: CourseRef[] = [];
  const wildcards: Wildcard[] = [];
  let dept: string | null = null;
  const body = text.split(/\b(?:except|with|including)\b/i)[0];

  for (const piece of body.split(/\s*(?:,|;|\bor\b|\band\b)\s*/i)) {
    const p = piece.replace(/[()]/g, " ").trim();
    if (!p) continue;

    const wild = p.match(/^(.*?)\s*(\d{0,3})@$/);
    const range = p.match(/^(.*?)\s*(\d{1,3})[A-Z]*\s*:\s*(\d{1,3})[A-Z]*$/i);
    if (wild || range) {
      const d: string | null = deptOf((wild ?? range)![1]) ?? dept;
      if (!d) continue;
      dept = d;
      if (wild) wildcards.push(wild[2] ? { department: d, prefix: wild[2] } : { department: d, prefix: "" });
      else wildcards.push({ department: d, min: Number(range![2]), max: Number(range![3]) });
      continue;
    }

    const found = findCourses(p);
    if (found.length) {
      for (const c of found) if (!options.some((o) => o.label === c.label)) options.push(c);
      dept = found[found.length - 1].department;
    } else if (dept && NUMBER.test(p)) {
      const label = `${dept} ${p.toUpperCase()}`;
      if (!options.some((o) => o.label === label)) options.push({ department: dept, number: p.toUpperCase(), label });
    }
  }
  return { options, wildcards };
}

export function matchesWildcard(c: CourseRef, w: Wildcard) {
  if (c.department !== w.department) return false;
  if (w.prefix === "") return true;
  if (w.prefix !== undefined) return /^\d/.test(c.number) && c.number.startsWith(w.prefix);
  const n = courseNumber(c.number);
  return n >= (w.min ?? 0) && n <= (w.max ?? 999);
}

export function parseDegreeWorks(raw: string): DegreeWorksResult {
  // Keep each line whole (tab-separated cells become one row); some browsers put every cell on its own line,
  // so rows are also rebuilt from the lines that precede a term ("2026 FALL").
  const lines = raw
    .split(/\r?\n/)
    .map((l) => l.replace(/\t+/g, "  ").replace(/\s+/g, " ").trim())
    .filter(Boolean);

  const needed: NeededItem[] = [];
  const inProgress: CourseRef[] = [];
  const needsInput: string[] = [];
  const done = new Map<string, CourseRef>();
  let row: string[] = []; // lines since the last row boundary

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    if (/still needed/i.test(line)) {
      let text = line.replace(/^.*?still needed:?/i, "").trim();
      if (!text) {
        // requirement text is on the following line(s)
        const next = lines[i + 1] ?? "";
        if (/^\d+(\.\d+)?\s+(class|unit|credit)/i.test(next)) {
          text = next;
          i += 1;
        } else {
          while (i + 1 < lines.length && text.length < 500 && lines[i + 1].length > 20 && !TERM.test(lines[i + 1]) && !/still needed/i.test(lines[i + 1])) {
            text += (text ? " " : "") + lines[++i];
          }
        }
      }
      row = [];
      const m = text.match(NEED);
      const { options, wildcards } = m ? parseOptions(m[3]) : { options: [], wildcards: [] };
      if (m && (options.length || wildcards.length)) {
        const n = Number(m[1]);
        const count = /^class/i.test(m[2]) ? n : Math.max(1, Math.ceil(n / 4));
        const label = text.slice(0, 200);
        const kind = wildcards.length || options.length > count ? "elective" : "required";
        if (!needed.some((x) => x.label === label)) needed.push({ count, options, kind, label, wildcards });
      } else if (text) needsInput.push(text.slice(0, 300));
      continue;
    }

    row.push(line);
    if (row.length > 8) row.shift();

    if (TERM.test(line)) {
      const text = row.join("  ");
      row = [];
      const ref = findCourses(text.replace(new RegExp(TERM, "gi"), ""))[0];
      if (!ref) continue;
      const isIP = /\bIP\b/.test(text) || /\(\s*\d+(\.\d+)?\s*\)/.test(text);
      if (isIP) {
        if (!inProgress.some((c) => c.label === ref.label)) inProgress.push(ref);
      } else done.set(ref.label, ref);
    }
  }

  // Don't ask for something already done or in progress: drop those options and lower the count by the matches.
  const taken = (c: CourseRef) => done.has(c.label) || inProgress.some((p) => p.label === c.label);
  const remaining: NeededItem[] = [];
  for (const n of needed) {
    const options = n.options.filter((o) => !taken(o));
    const count = n.count - (n.options.length - options.length);
    if (count <= 0 || (!options.length && !n.wildcards.length)) continue;
    const kind = n.wildcards.length || options.length > count ? "elective" : "required";
    remaining.push({ ...n, options, count, kind });
  }
  const completed = [...done.values()];
  return { needed: remaining, inProgress, completed, completedCount: completed.length, needsInput: [...new Set(needsInput)] };
}
