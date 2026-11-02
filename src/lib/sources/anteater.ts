import { cached, HOUR } from "../cache";
import { courseId, usualQuarters, type CourseRef } from "../courses";
import type { Mode, Quarter, Term } from "../types";

const BASE = "https://anteaterapi.com/v2/rest";

async function get<T>(path: string): Promise<T> {
  const res = await fetch(`${BASE}${path}`, { signal: AbortSignal.timeout(15000) });
  const body = await res.json();
  if (!res.ok || !body.ok) throw new Error(body.message ?? `Anteater ${res.status}`);
  return body.data as T;
}

// ---------- Terms ----------

export type { Term };

export function fetchTerms(): Promise<Term[]> {
  return cached("anteater:terms", HOUR, async () => {
    const rows = await get<{ year: string; quarter: string; longName: string }[]>("/websoc/terms");
    return rows.filter((t) => ["Fall", "Winter", "Spring"].includes(t.quarter)).slice(0, 4).map((t) => ({ year: t.year, quarter: t.quarter, label: `${t.quarter} ${t.year}` }));
  });
}

// ---------- Who is teaching this quarter (WebSoc) ----------

export type OfferedSection = {
  code: string;
  type: string;
  instructors: string[];
  days: string;
  time: string;
  status: string;
  enrolled: number | null;
  capacity: number | null;
  waitlist: number | null;
  mode: Mode;
};

// Per instructor, across all their primary sections this term (for the professor picker).
export type InstructorSections = { sections: number; seats: "Open" | "Full"; mode: Mode };

export type Offering = {
  offered: boolean;
  sections: OfferedSection[]; // lectures/seminars/studios only (not labs/discussions)
  instructors: string[]; // distinct primary instructors this quarter, STAFF removed
  hasStaffOnly: boolean;
  mode: Mode; // across primary sections
  byInstructor: Record<string, InstructorSections>;
};

type WebSocSection = {
  sectionCode: string;
  sectionType: string;
  instructors: string[];
  status: string;
  maxCapacity: string;
  numOnWaitlist: string;
  numCurrentlyEnrolled: { totalEnrolled: string };
  sectionNum: string;
  units: string;
  sectionComment?: string;
  meetings: { timeIsTBA: boolean; bldg?: string[]; days?: string; startTime?: Clock; endTime?: Clock }[];
  finalExam: { examStatus: string; month?: number; day?: number; startTime?: Clock; endTime?: Clock };
  isCancelled: boolean;
};
type Clock = { hour: number; minute: number };
type WebSocCourse = { courseNumber: string; courseTitle: string; sections: WebSocSection[] };

// One cached WebSoc call per course and term, shared by the recommender and the planner.
function fetchWebSoc(course: CourseRef, term: Term): Promise<WebSocCourse[]> {
  return cached(`websoc:${term.year}${term.quarter}:${courseId(course)}`, HOUR / 2, async () => {
    const q = `year=${term.year}&quarter=${term.quarter}&department=${encodeURIComponent(course.department)}&courseNumber=${encodeURIComponent(course.number)}`;
    const data = await get<{ schools: { departments: { courses: WebSocCourse[] }[] }[] }>(`/websoc?${q}`);
    return data.schools.flatMap((s) => s.departments.flatMap((d) => d.courses)).filter((c) => c.courseNumber.toUpperCase() === course.number);
  });
}

const SECONDARY = new Set(["Lab", "Dis", "Qui", "Quiz", "Tap", "Tut", "Act", "Fld"]);
const num = (v: string | undefined) => (v && v.trim() !== "" && !Number.isNaN(Number(v)) ? Number(v) : null);
const hhmm = (t?: { hour: number; minute: number }) => (t ? `${t.hour}:${String(t.minute).padStart(2, "0")}` : "");

// WebSoc lists online meetings in building "ON LINE"; async sections are often just TBA, so "unknown" is common.
const ONLINE_NOTE = /\b(online|remote|zoom|asynchronous)\b/i;
function sectionMode(s: WebSocSection): Mode {
  const bldgs = s.meetings.flatMap((m) => m.bldg ?? []).filter((b) => b.trim() !== "" && b.trim().toUpperCase() !== "TBA");
  if (bldgs.some((b) => b.toUpperCase().includes("ON LINE")) || ONLINE_NOTE.test(s.sectionComment ?? "")) return "online";
  return bldgs.length ? "in-person" : "unknown";
}

// Mixed known modes => hybrid; unknown is ignored.
export function combineModes(modes: Mode[]): Mode {
  const known = new Set(modes.filter((m) => m !== "unknown"));
  if (known.has("hybrid") || (known.has("online") && known.has("in-person"))) return "hybrid";
  return known.has("online") ? "online" : known.has("in-person") ? "in-person" : "unknown";
}

const seatsOf = (statuses: string[]): "Open" | "Full" => (statuses.length > 0 && statuses.every((st) => st !== "OPEN") ? "Full" : "Open");

export function fetchOffering(course: CourseRef, term: Term): Promise<Offering> {
  return fetchWebSoc(course, term).then((courses) => {
    const all = courses.flatMap((c) => c.sections).filter((s) => !s.isCancelled);
    if (!all.length) return { offered: false, sections: [], instructors: [], hasStaffOnly: false, mode: "unknown", byInstructor: {} };

    const primary = all.filter((s) => !SECONDARY.has(s.sectionType));
    const sections: OfferedSection[] = primary.slice(0, 10).map((s) => {
      const m = s.meetings[0];
      return {
        code: s.sectionCode,
        type: s.sectionType,
        instructors: s.instructors,
        days: m?.days ?? "TBA",
        time: m && !m.timeIsTBA ? `${hhmm(m.startTime)}-${hhmm(m.endTime)}` : "TBA",
        status: s.status,
        enrolled: num(s.numCurrentlyEnrolled?.totalEnrolled),
        capacity: num(s.maxCapacity),
        waitlist: num(s.numOnWaitlist),
        mode: sectionMode(s),
      };
    });

    const names = [...new Set(primary.flatMap((s) => s.instructors))];
    const instructors = names.filter((n) => n.toUpperCase() !== "STAFF");
    const byInstructor: Record<string, InstructorSections> = {};
    for (const name of instructors) {
      const mine = primary.filter((s) => s.instructors.includes(name));
      byInstructor[name] = { sections: mine.length, seats: seatsOf(mine.map((s) => s.status)), mode: combineModes(mine.map(sectionMode)) };
    }
    return { offered: true, sections, instructors, hasStaffOnly: names.length > 0 && instructors.length === 0, mode: combineModes(primary.map(sectionMode)), byInstructor };
  });
}

// ---------- Catalog + grade history ----------

export type InstructorHistory = {
  name: string;
  sectionsTaughtOfThisCourse: number; // all-time in grade records
  avgGPA: number | null; // null = no grade history for this course (new or first time)
  lastTaught: string | null;
};

export type CatalogInfo = {
  title: string;
  description: string;
  units: string;
  prerequisiteText: string;
  recentCourseGPA: { value: number | null; sections: number };
  currentInstructors: InstructorHistory[];
  usuallyOffered: Quarter[];
};

type RawSection = {
  year: string;
  quarter: string;
  averageGPA: number | null;
  instructors: string[];
};

const QUARTER_ORDER: Record<string, number> = { Winter: 1, Spring: 2, Summer1: 3, Summer10wk: 3, Summer2: 4, Fall: 5 };
const when = (s: RawSection) => Number(s.year) * 10 + (QUARTER_ORDER[s.quarter] ?? 0);
const round2 = (n: number) => Math.round(n * 100) / 100;

export function fetchCatalog(course: CourseRef, currentInstructors: string[]): Promise<CatalogInfo> {
  return cached(`catalog:${courseId(course)}:${currentInstructors.join("|")}`, 6 * HOUR, async () => {
    const dept = encodeURIComponent(course.department);
    const [info, raw] = await Promise.all([
      get<{ title: string; description: string; minUnits: number; maxUnits: number; prerequisiteText: string; terms?: string[] }>(`/courses/${encodeURIComponent(courseId(course))}`),
      get<RawSection[]>(`/grades/raw?department=${dept}&courseNumber=${encodeURIComponent(course.number)}`).catch(() => [] as RawSection[]),
    ]);

    const graded = raw.filter((s) => s.averageGPA != null);
    const newest = graded.reduce((m, s) => Math.max(m, when(s)), 0);
    const recent = graded.filter((s) => when(s) >= newest - 40);
    const recentGPA = recent.length ? recent.reduce((t, s) => t + s.averageGPA!, 0) / recent.length : null;

    // Grade history ONLY for the people teaching this quarter.
    const history: InstructorHistory[] = currentInstructors.map((name) => {
      const mine = graded.filter((s) => s.instructors.includes(name));
      const last = mine.reduce<RawSection | null>((m, s) => (!m || when(s) > when(m) ? s : m), null);
      return {
        name,
        sectionsTaughtOfThisCourse: mine.length,
        avgGPA: mine.length ? round2(mine.reduce((t, s) => t + s.averageGPA!, 0) / mine.length) : null,
        lastTaught: last ? `${last.quarter} ${last.year}` : null,
      };
    });

    return {
      title: info.title,
      description: info.description,
      units: info.minUnits === info.maxUnits ? String(info.minUnits) : `${info.minUnits}-${info.maxUnits}`,
      prerequisiteText: info.prerequisiteText,
      recentCourseGPA: { value: recentGPA == null ? null : round2(recentGPA), sections: recent.length },
      currentInstructors: history,
      usuallyOffered: usualQuarters(info.terms ?? []),
    };
  });
}

// Every term the catalog lists for this course (past and posted), e.g. "2026 Fall", "2025 Summer1".
export function fetchCourseTerms(course: CourseRef): Promise<string[]> {
  return cached(`courseTerms:${courseId(course)}`, 24 * HOUR, () =>
    get<{ terms?: string[] }>(`/courses/${encodeURIComponent(courseId(course))}`).then((c) => c.terms ?? []),
  ).catch(() => []);
}
