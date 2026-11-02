import { resolveDept } from "./departments";
import type { Quarter } from "./types";

export type CourseRef = { department: string; number: string; label: string };

const NUMBER = /^[A-Z]?\d{1,3}[A-Z]{0,4}$/;

function ref(department: string, number: string): CourseRef {
  return { department, number, label: `${department} ${number}` };
}

type Split = { department: string; number: string; spaced: boolean; at: number };

// Every way to read `s` as dept + number where the dept resolves (e.g. "CSE41" -> CSE 41 and CS E41).
function splits(s: string): Split[] {
  const out: Split[] = [];
  for (let i = 1; i < s.length; i++) {
    const num = s.slice(i).trim();
    if (!NUMBER.test(num)) continue;
    const department = resolveDept(s.slice(0, i));
    if (department) out.push({ department, number: num, spaced: /\s/.test(s[i - 1] + s[i]), at: i });
  }
  return out.sort((a, b) => Number(b.spaced) - Number(a.spaced) || b.at - a.at);
}

/** Reads one course code, forgiving about case, spacing and shorthand ("ics33", "informatics 43", "CSE41"). */
export function parseCourse(input: string): CourseRef | null {
  const s = input.trim().replace(/\s+/g, " ").toUpperCase();
  const best = splits(s)[0];
  if (best) return ref(best.department, best.number);
  // Departments missing from the snapshot: take the raw code as typed.
  const m = s.match(/^([A-Z&]{2,8}) ([A-Z]?\d{1,3}[A-Z]{0,4})$/);
  return m ? ref(m[1], m[2]) : null;
}

/** Splits a search query into a known department and a (possibly partial) course number: "mgmt 30" -> MGMT, "30". */
export function splitQuery(input: string): { department: string; number: string } | null {
  const s = input.trim().replace(/\s+/g, " ").toUpperCase();
  const whole = resolveDept(s);
  if (whole) return { department: whole, number: "" };
  const best = splits(s)[0];
  return best ? { department: best.department, number: best.number } : null;
}

export function courseId(c: CourseRef) {
  return `${c.department.replace(/ /g, "")}${c.number}`;
}

// A course code such as "I&CSCI 51", "IN4MATX 191A", "COMPSCI 141", "MATH 2A", "I&C Sci 6N"
export const CODE = /\b(I&C ?Sci|[A-Za-z][A-Za-z&0-9]{1,9})\s+(\d{1,3}[A-Za-z]{0,3})\b/gi;

// Words that often sit before a number in plain text but are never meant as courses.
const NOT_DEPT = new Set(
  "take need needs needed class classes course courses unit units credit credits in of for at to the a an and or only top first last about around under over than with by week weeks hour hours quarter quarters year years fall winter spring summer max min no".split(" "),
);

type Token = { text: string; start: number; end: number };

function tokenize(text: string): Token[][] {
  const pieces: Token[][] = [];
  let current: Token[] = [];
  let last = 0;
  for (const m of text.matchAll(/[^\s,;/|]+/g)) {
    if (/[,;/|\n]/.test(text.slice(last, m.index))) {
      if (current.length) pieces.push(current);
      current = [];
    }
    last = m.index + m[0].length;
    const lead = m[0].match(/^[("'[]*/)![0].length;
    const trail = m[0].match(/[)"'\].:!?]*$/)![0].length;
    const clean = m[0].slice(lead, m[0].length - trail);
    if (clean) current.push({ text: clean, start: m.index + lead, end: m.index + m[0].length - trail });
  }
  if (current.length) pieces.push(current);
  return pieces;
}

/** Splits text into the course codes it mentions, the remaining words, and word+number pairs that look like codes but didn't resolve. */
export function extractCourses(text: string): { courses: CourseRef[]; rest: string; unrecognized: string[] } {
  const courses: CourseRef[] = [];
  const unrecognized: string[] = [];
  const cut: [number, number][] = [];
  const add = (r: CourseRef, start: number, end: number) => {
    if (!courses.some((c) => c.label === r.label)) courses.push(r);
    cut.push([start, end]);
  };

  for (const tokens of tokenize(text)) {
    let i = 0;
    while (i < tokens.length) {
      let matched = 0;
      // Multi-word departments first ("computer science 161", "I&C SCI 33"), longest wins.
      for (let k = Math.min(4, tokens.length - 1 - i); k >= 1 && !matched; k--) {
        const num = tokens[i + k].text.toUpperCase();
        if (!NUMBER.test(num)) continue;
        const department = resolveDept(tokens.slice(i, i + k).map((t) => t.text).join(" "));
        if (department) {
          add(ref(department, num), tokens[i].start, tokens[i + k].end);
          matched = k + 1;
        }
      }
      // Glued codes ("ics33", "IN4MATX151", "CSE41").
      if (!matched) {
        const best = splits(tokens[i].text.toUpperCase()).find((s) => !s.spaced);
        if (best) {
          add(ref(best.department, best.number), tokens[i].start, tokens[i].end);
          matched = 1;
        }
      }
      if (matched) {
        i += matched;
        continue;
      }
      const next = tokens[i + 1];
      const word = tokens[i].text;
      if (next && /^[A-Za-z&]{2,8}$/.test(word) && !NOT_DEPT.has(word.toLowerCase()) && NUMBER.test(next.text.toUpperCase())) {
        unrecognized.push(`${word} ${next.text}`);
      }
      i++;
    }
  }

  let stripped = text;
  for (const [start, end] of cut.sort((a, b) => b[0] - a[0])) stripped = stripped.slice(0, start) + stripped.slice(end);
  const rest = stripped
    .replace(/(\s*[,;]\s*){2,}/g, ", ")
    .replace(/\s+/g, " ")
    .replace(/^[\s,;:.\-–—&]+|[\s,;:\-–—&]+$/g, "")
    .replace(/^(and|or)\s+|\s+(and|or)$/gi, "")
    .trim();
  return { courses, rest, unrecognized };
}

export function findCourses(text: string): CourseRef[] {
  return extractCourses(text).courses;
}

const QUARTERS: Quarter[] = ["Fall", "Winter", "Spring", "Summer"];

/** "2025 Summer1", "2026 Winter", ... -> distinct quarters offered in the last 3 years, ordered Fall, Winter, Spring, Summer. */
export function usualQuarters(terms: string[], now = new Date()): Quarter[] {
  const seen = new Set<Quarter>();
  for (const t of terms) {
    const m = t.match(/^(\d{4})\s+(Fall|Winter|Spring|Summer)/i);
    if (!m || Number(m[1]) < now.getFullYear() - 3) continue;
    seen.add((m[2][0].toUpperCase() + m[2].slice(1).toLowerCase()) as Quarter);
  }
  return QUARTERS.filter((q) => seen.has(q));
}
