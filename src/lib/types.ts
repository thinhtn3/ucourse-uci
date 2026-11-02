export type Verdict = "take" | "caveats" | "skip";
export type Source = { label: string; url: string };
export type Term = { year: string; quarter: string; label: string };

export type Mode = "in-person" | "online" | "hybrid" | "unknown";
export type Quarter = "Fall" | "Winter" | "Spring" | "Summer";

// Server ranks at most this many; extra courses come back in Result.skipped.
export const MAX_RANKED = 60;

// One instructor teaching the course in the row's term (for the per-row professor picker).
export type ProfessorOption = {
  name: string; // WebSoc form, e.g. "PATTIS, R."
  rating: string; // "4.6 (120)" | "No ratings" (same format as Row.rating)
  gpa: string; // "3.12" | "No data"  (this person's avg GPA in this course)
  difficulty: number | null; // RMP difficulty 1-5
  rmpUrl: string | null;
  sections: number; // primary sections they teach this term
  seats: "Open" | "Full"; // across their sections
  mode: Mode; // across their sections
};

export type Row = {
  code: string;
  title: string;
  units: string;
  instructor: string; // default display (lead + "/ second +N"), unchanged
  rating: string; // lead professor
  gpa: string; // lead professor
  seats: "Open" | "Full";
  verdict: Verdict;
  takeIf: string[];
  avoidIf: string[];
  summary: string;
  warning: string;
  evidence: 0 | 1 | 2 | 3;
  sources: Source[];
  assessed: boolean; // false = model gave no assessment (rate limit / omitted): show a neutral "Not assessed" pill, not the verdict
  term: Term; // term whose live data this row uses (== Result.term unless any-quarter)
  usuallyOffered: Quarter[]; // quarters offered in the last 3 years, order Fall, Winter, Spring, Summer
  mode: Mode; // across primary (lecture-type) sections
  instructorCount: number; // distinct non-STAFF instructors this term; 1 => "only one lecturer"
  professors: ProfessorOption[]; // same order as Row.instructor; [] if STAFF / not announced; professors[0] matches rating/gpa
};

export type Result = {
  term: { label: string; any?: boolean }; // any=true => label "Any quarter"
  rows: Row[]; // ranked, best first
  notOffered: string[];
  noData: string[];
  skipped: string[]; // over MAX_RANKED, not ranked, input order
  usualTerms: Record<string, Quarter[]>; // for notOffered labels: when they are usually offered
  notice?: string; // non-fatal, e.g. "8 courses couldn't be assessed (model rate limit). Showing their data only."
};

export type RecommendRequest = {
  courses: string[]; // 1..200 course labels ("I&C SCI 33"); server ranks the first MAX_RANKED
  preferences?: string;
  currentlyTaking?: string[];
  term?: { year: string; quarter: string } | "any"; // omitted => latest posted term
};

export type ApiErrorCode = "rate_limit" | "no_key" | "bad_request" | "not_found" | "upstream" | "server";
export type ApiError = { error: string; code?: ApiErrorCode; notOffered?: string[]; noData?: string[]; unparsed?: string[]; skipped?: string[] };

// A course saved to a quarter's plan. instructor = professor picked in the row, if any.
export type PlanItem = { code: string; title: string; units: string; instructor?: string };

// /api/courses (autocomplete)
export type CourseOption = { department: string; number: string; label: string; title: string; units: string; usuallyOffered: Quarter[] };
export type CourseSearchResponse = { results: CourseOption[]; error?: string };

// DegreeWorks dialog -> page
export type ImportSummary = { courses: number; requirements: number; electiveGroups: number; inProgress: number; completed: number; unmatched: number };
