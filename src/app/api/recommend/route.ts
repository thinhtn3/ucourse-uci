import { APICallError, generateText, Output, RetryError } from "ai";
import { google } from "@ai-sdk/google";
import { z } from "zod";
import { cached, HOUR } from "@/lib/cache";
import { parseCourse, usualQuarters, type CourseRef } from "@/lib/courses";
import { fetchCatalog, fetchCourseTerms, fetchOffering, fetchTerms, type Offering, type Term } from "@/lib/sources/anteater";
import { lookupProfessor } from "@/lib/sources/rmp";
import { MAX_RANKED, type ApiError, type ProfessorOption, type Quarter, type Result, type Row, type Source, type Verdict } from "@/lib/types";
// Reddit is a placeholder for now (PullPush rate-limits automated access); re-enable when a source is sorted out.
// import { searchReddit } from "@/lib/sources/reddit";

export const maxDuration = 300;

// Generous sanity cap (not a product limit): protects the free upstream APIs from a runaway request.
// Only the first MAX_RANKED are researched and ranked; the rest come back in `skipped`.
const MAX_COURSES = 200;
const CONCURRENCY = 5; // courses researched at a time (Anteater allows 1000 requests/hour; RMP is unofficial)
const BATCH = 15; // courses per model call
const BATCH_CONCURRENCY = 2;

async function mapPool<T, R>(items: T[], size: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const out: R[] = new Array(items.length);
  let next = 0;
  await Promise.all(
    Array.from({ length: Math.min(size, items.length) }, async () => {
      while (next < items.length) {
        const i = next++;
        out[i] = await fn(items[i]);
      }
    }),
  );
  return out;
}

// Gemini (free tier) when GOOGLE_GENERATIVE_AI_API_KEY is set; otherwise the Vercel AI Gateway
// (needs AI_GATEWAY_API_KEY). RECOMMENDER_MODEL / RECOMMENDER_FALLBACK_MODEL override the ids;
// the fallback is a cheaper model of the same provider, used when the primary is rate-limited or failing.
function models() {
  const fallback = process.env.RECOMMENDER_FALLBACK_MODEL;
  if (process.env.GOOGLE_GENERATIVE_AI_API_KEY) {
    return [google(process.env.RECOMMENDER_MODEL ?? "gemini-2.5-flash"), google(fallback ?? "gemini-2.5-flash-lite")] as const;
  }
  return [process.env.RECOMMENDER_MODEL ?? "anthropic/claude-sonnet-5.5", fallback ?? "anthropic/claude-haiku-5.5"] as const;
}

const Request = z.object({
  courses: z.array(z.string().min(1).max(40)).min(1).max(MAX_COURSES),
  preferences: z.string().max(1000).default(""),
  currentlyTaking: z.array(z.string().min(1).max(40)).max(20).default([]), // in-progress courses, for workload context
  term: z.union([z.object({ year: z.string(), quarter: z.string() }), z.literal("any")]).optional(), // defaults to the latest posted term
});

const Recommendation = z.object({
  course: z.string().describe("The course label exactly as given in the data, e.g. 'I&C SCI 33'"),
  verdict: z.enum(["take", "caveats", "skip"]).describe("take = strong fit; caveats = workable with real downsides; skip = poor fit or better to delay"),
  takeIf: z.array(z.string()).describe("2-3 short, concrete reasons to take this course, each a 'you' condition grounded in the data, e.g. 'You want a clear lecturer (4.6 on RateMyProfessors)'"),
  avoidIf: z.array(z.string()).describe("1-3 short, concrete reasons to avoid it, same style, grounded in the data, e.g. 'You need a light load: students call the weekly projects heavy'. Empty only if the data shows no real downside"),
  summary: z.string().describe("One or two sentences: the overall call for this student, tying the evidence to what they asked for"),
  warning: z.string().describe("One short warning (full section, prerequisite, required course, workload) or an empty string"),
  evidence: z.enum(["none", "limited", "some", "strong"]).describe("How much data backs this call"),
  professors: z
    .array(
      z.object({
        name: z.string().describe("Exact name from professorsThisQuarter"),
        verdict: z.enum(["take", "caveats", "skip"]).describe("Verdict for taking the course with this professor, grounded in their own data"),
        note: z.string().describe("One short line on why, from this professor's own data"),
      }),
    )
    .describe("Every professor teaching this course this quarter (exact name from professorsThisQuarter), best fit first, each with their own verdict and one short line why; empty if only STAFF"),
});

const Output_ = z.object({
  recommendations: z.array(Recommendation).describe("Every course given, ordered best fit first"),
});

const EVIDENCE = { none: 0, limited: 1, some: 2, strong: 3 } as const;


// The first term (latest first) that offers the course. Errors only count if no term could be checked.
async function findOffering(course: CourseRef, terms: Term[]): Promise<{ term: Term; offering: Offering } | { error: string } | null> {
  let errors = 0;
  let last = "";
  for (const term of terms) {
    try {
      const offering = await fetchOffering(course, term);
      if (offering.offered) return { term, offering };
    } catch (e) {
      errors++;
      last = String(e instanceof Error ? e.message : e);
    }
  }
  return errors === terms.length ? { error: last } : null;
}

async function gatherCourse(course: CourseRef, terms: Term[], compact: boolean) {
  const hit = await findOffering(course, terms);
  if (hit && "error" in hit) return { course: course.label, status: "schedule-error" as const, error: hit.error };
  if (!hit) return { course: course.label, status: "not-offered" as const };
  const { term, offering } = hit;

  const catalog = await fetchCatalog(course, offering.instructors).catch((e) => ({ error: String(e.message ?? e) }));
  if ("error" in catalog) return { course: course.label, status: "catalog-error" as const, error: catalog.error };

  // RateMyProfessors research for the people actually teaching this quarter, and only them.
  const professors = await Promise.all(
    catalog.currentInstructors.map(async (i) => {
      const rmp = await lookupProfessor(i.name, course.label).catch(() => null);
      if (rmp && compact) rmp.comments = rmp.comments.slice(0, 2).map((c) => ({ ...c, text: c.text.slice(0, 220) }));
      return { ...i, rmp };
    }),
  );

  return {
    course: course.label,
    status: "ok" as const,
    term: term.label,
    title: catalog.title,
    description: compact ? catalog.description.slice(0, 200) : catalog.description,
    units: catalog.units,
    prerequisites: catalog.prerequisiteText,
    format: offering.mode, // in-person | online | hybrid | unknown, across lectures
    recentCourseGPA: catalog.recentCourseGPA,
    sectionsThisQuarter: offering.sections,
    professorsThisQuarter: professors,
    instructorCount: offering.instructors.length,
    onlyStaffListed: offering.hasStaffOnly,
    // Not sent to the model.
    meta: { term, offering, usuallyOffered: catalog.usuallyOffered },
  };
}

type Gathered = Awaited<ReturnType<typeof gatherCourse>>;
type Found = Extract<Gathered, { status: "ok" }>;
type Assessment = z.infer<typeof Recommendation>;

const fmtRating = (rmp: { rating: number; numRatings: number } | null) => (rmp ? `${rmp.rating.toFixed(1)} (${rmp.numRatings})` : "No ratings");
const fmtGpa = (gpa: number | null) => (gpa != null ? gpa.toFixed(2) : "No data");

// The table columns come straight from the fetched data (not from the model), so they can't be invented.
function facts(g: Found, r?: Assessment): Omit<Row, "verdict" | "takeIf" | "avoidIf" | "summary" | "warning" | "evidence" | "assessed"> {
  const profs = g.professorsThisQuarter;
  const lead = profs[0];
  const names = profs.slice(0, 2).map((p) => p.name).join(" / ") + (profs.length > 2 ? ` +${profs.length - 2}` : "");
  const { term, offering, usuallyOffered } = g.meta;
  const norm = (n: string) => n.toLowerCase().replace(/\s+/g, " ").trim();
  const opinions = new Map<string, { verdict: Verdict; note: string }>();
  for (const o of r?.professors ?? []) if (!opinions.has(norm(o.name))) opinions.set(norm(o.name), { verdict: o.verdict as Verdict, note: o.note.trim() });
  const rankOf = (n: string) => [...opinions.keys()].indexOf(norm(n));
  const options: ProfessorOption[] = profs.map((p) => {
    const mine = offering.byInstructor[p.name];
    const op = opinions.get(norm(p.name));
    return {
      ...(op && { verdict: op.verdict, note: op.note }),
      name: p.name,
      rating: fmtRating(p.rmp),
      gpa: fmtGpa(p.avgGPA),
      difficulty: p.rmp?.difficulty ?? null,
      rmpUrl: p.rmp?.url ?? null,
      sections: mine?.sections ?? 0,
      seats: mine?.seats ?? "Open",
      mode: mine?.mode ?? "unknown",
    };
  });
  // Best first: verdict tier, then the model's order; professors the model omitted go last.
  const professors = options
    .map((o, i) => ({ o, i }))
    .sort((a, b) => (a.o.verdict ? TIER[a.o.verdict] : 3) - (b.o.verdict ? TIER[b.o.verdict] : 3) || (rankOf(a.o.name) - rankOf(b.o.name)) || a.i - b.i)
    .map((x) => x.o);
  const top = professors[0];
  const topProf = profs.find((p) => p.name === top?.name) ?? lead;
  return {
    code: g.course,
    title: g.title,
    units: g.units,
    instructor: (topProf && profs.length > 1 ? [topProf, ...profs.filter((p) => p !== topProf)].slice(0, 2).map((p) => p.name).join(" / ") + (profs.length > 2 ? ` +${profs.length - 2}` : "") : names) || (g.onlyStaffListed ? "STAFF" : "Not announced"),
    rating: fmtRating(topProf?.rmp ?? null),
    gpa: fmtGpa(topProf?.avgGPA ?? null),
    seats: g.sectionsThisQuarter.length > 0 && g.sectionsThisQuarter.every((s) => s.status !== "OPEN") ? "Full" : "Open",
    sources: sourcesFor(g, term),
    term,
    usuallyOffered,
    mode: offering.mode,
    instructorCount: offering.instructors.length,
    professors,
  };
}

// Links to the places the numbers came from, only for data we actually found for this course.
function sourcesFor(g: Found, term: Term): Source[] {
  const out: Source[] = [];
  for (const p of g.professorsThisQuarter.slice(0, 3)) {
    if (p.rmp) out.push({ label: `RateMyProfessors · ${p.name.split(",")[0]}`, url: p.rmp.url });
  }
  if (g.recentCourseGPA.value != null || g.professorsThisQuarter.some((p) => p.avgGPA != null)) {
    out.push({ label: "Grade history · PeterPortal", url: `https://peterportal.org/course/${encodeURIComponent(g.course.replace(/\s+/g, ""))}` });
  }
  out.push({ label: `Schedule · WebSoc ${term.label}`, url: "https://www.reg.uci.edu/perl/WebSoc" });
  return out;
}

const key = (s: string) => s.toUpperCase().replace(/[^A-Z0-9]/g, "");

const SYSTEM =
  "You rank UC Irvine courses for ONE specific quarter. You receive pre-fetched data per course: catalog info, the " +
  "sections and professors actually teaching THIS quarter (from the live schedule, including whether sections are open or full " +
  "and the format: in-person, online, hybrid or unknown), each current professor's grade history in this course, and their " +
  "RateMyProfessors ratings and student reviews. Use ONLY that data; never invent professors, ratings, or opinions, and only mention " +
  "professors listed for this quarter. A professor with no grade history or no RMP data is new/unknown: say so. If only STAFF is " +
  "listed, say the instructor isn't announced yet. Do not mention that only one professor or lecturer teaches the course. Rank every course for this student's stated " +
  "preferences, best fit first, and set evidence honestly (few sections, few ratings, or no RMP data means limited or none). GPA is " +
  "a proxy for difficulty, not quality. If several candidates satisfy the same requirement, rank them against each other. Keep every " +
  "line short and concrete; the summary must not repeat the takeIf/avoidIf lines. For each course, fill `professors` with every " +
  "professor in professorsThisQuarter (exact names), best fit first, each with their own verdict and a one-line note grounded in THAT " +
  "professor's own grade history and ratings (not blended with the others). The course-level verdict is the verdict for the best " +
  "professor option, and takeIf/avoidIf describe that option. With one professor, professors has just that person; with only STAFF, leave it empty.";

const isAuthError = (err: unknown) => /API key|api_key|unauthori[sz]ed|\b401\b|\b403\b/i.test(err instanceof Error ? err.message : String(err));
const isRateLimit = (err: unknown): boolean => {
  if (RetryError.isInstance(err)) return isRateLimit(err.lastError);
  if (APICallError.isInstance(err) && (err.statusCode === 429 || err.statusCode === 503 || err.statusCode === 529)) return true;
  return /429|quota|rate.?limit|RESOURCE_EXHAUSTED|overloaded|UNAVAILABLE/i.test(err instanceof Error ? err.message : String(err));
};

type Ctx = { quarter: string; preferences: string; currentlyTaking: string[] };

// One model call for one batch; the primary with retries, then the cheaper fallback.
async function callModel(batch: Found[], ctx: Ctx): Promise<Assessment[]> {
  const [primary, fallback] = models();
  const data = batch.map(({ meta: _meta, ...g }) => g); // eslint-disable-line @typescript-eslint/no-unused-vars
  const request = {
    output: Output.object({ schema: Output_ }),
    system: SYSTEM,
    prompt:
      `Quarter: ${ctx.quarter}\nStudent preferences: ${ctx.preferences || "(none given)"}\n` +
      `Courses the student is already taking now (consider total workload, do not recommend them): ${ctx.currentlyTaking.join(", ") || "(none given)"}\n\n` +
      `Course data (JSON):\n${JSON.stringify(data, null, 1)}`,
  };
  try {
    const { output } = await generateText({ ...request, model: primary, maxRetries: 3, abortSignal: AbortSignal.timeout(90_000) });
    return output.recommendations;
  } catch (err) {
    if (isAuthError(err)) throw err;
    console.warn("primary model failed, trying fallback", err instanceof Error ? err.message : err);
    const { output } = await generateText({ ...request, model: fallback, maxRetries: 2, abortSignal: AbortSignal.timeout(60_000) });
    return output.recommendations;
  }
}

// Successful batches are cached for an hour, so a retry after a rate limit only re-asks the failed ones.
function rankBatch(batch: Found[], ctx: Ctx): Promise<Assessment[]> {
  const parts = [
    [...new Set(batch.map((g) => g.meta.term.label))].sort().join(","),
    ctx.preferences.trim().toLowerCase(),
    [...ctx.currentlyTaking].sort().join(","),
    batch.map((g) => `${g.course}:${g.professorsThisQuarter.map((p) => p.name).join("/")}`).sort().join(","),
  ];
  return cached(`rank3:${parts.join("|")}`, HOUR, () => callModel(batch, ctx));
}

const TIER: Record<Verdict, number> = { take: 0, caveats: 1, skip: 2 };

const fail = (status: number, body: ApiError) => Response.json(body, { status });

async function handle(req: Request) {
  if (!process.env.GOOGLE_GENERATIVE_AI_API_KEY && !process.env.AI_GATEWAY_API_KEY) {
    return fail(500, {
      error: "The server has no model API key. Add GOOGLE_GENERATIVE_AI_API_KEY in your hosting environment variables (Vercel: Settings → Environment Variables), then redeploy.",
      code: "no_key",
    });
  }
  const parsed = Request.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    const why = parsed.error.issues.map((i) => `${i.path.join(".") || "body"}: ${i.message}`).join("; ");
    return fail(400, {
      error: `Invalid request (${why}). Send { courses: string[1-${MAX_COURSES}] (up to ${MAX_COURSES} courses; the first ${MAX_RANKED} get ranked), preferences?: string, currentlyTaking?: string[<=20], term?: {year, quarter} | "any" }`,
      code: "bad_request",
    });
  }

  const refs: CourseRef[] = [];
  const unparsed: string[] = [];
  const seen = new Set<string>();
  for (const raw of parsed.data.courses) {
    const ref = parseCourse(raw);
    if (!ref) unparsed.push(raw);
    else if (!seen.has(ref.label)) {
      seen.add(ref.label);
      refs.push(ref);
    }
  }
  if (!refs.length) return fail(400, { error: `Couldn't read any course codes (try "ICS 33" or "COMPSCI 161").`, code: "bad_request", unparsed });
  const skipped = refs.slice(MAX_RANKED).map((r) => r.label);
  const ranked = refs.slice(0, MAX_RANKED);

  const terms = await fetchTerms().catch(() => [] as Term[]);
  const want = parsed.data.term;
  const any = want === "any";
  const term = (want && want !== "any" && terms.find((t) => t.year === want.year && t.quarter === want.quarter)) || terms[0];
  if (!term) return fail(502, { error: "Couldn't load the quarter schedule right now.", code: "upstream" });
  const resultTerm: Result["term"] = any ? { label: "Any quarter", any: true } : { label: term.label };

  // With long lists, send less text per course so the model request stays within free-tier token limits.
  const compact = ranked.length > 12;
  const gathered = await mapPool(ranked, CONCURRENCY, (r) => gatherCourse(r, any ? terms : [term], compact));
  const found = gathered.filter((g): g is Found => g.status === "ok");
  const notOffered = gathered.filter((g) => g.status === "not-offered").map((g) => g.course);
  const noData = [...gathered.filter((g) => g.status === "schedule-error" || g.status === "catalog-error").map((g) => g.course), ...unparsed];

  // When the courses missing this quarter usually run.
  const byLabel = new Map(ranked.map((r) => [r.label, r]));
  const usual = await mapPool(notOffered, CONCURRENCY, async (label) => usualQuarters(await fetchCourseTerms(byLabel.get(label)!)));
  const usualTerms: Record<string, Quarter[]> = Object.fromEntries(notOffered.map((label, i) => [label, usual[i]]));

  // ?raw=1 returns the fetched data without calling the model (handy for dev / checking sources).
  if (new URL(req.url).searchParams.get("raw") === "1") return Response.json({ term: resultTerm, gathered, notOffered, noData, skipped, usualTerms });

  if (!found.length) {
    const where = any ? "any upcoming quarter" : term.label;
    return fail(404, {
      error: notOffered.length ? `None of those courses are offered in ${where}: ${notOffered.join(", ")}.` : "No course data found for those codes.",
      code: "not_found",
      notOffered,
      noData,
      skipped,
    });
  }

  const ctx: Ctx = {
    quarter: any ? "Varies per course (each course's `term` field is the quarter its data comes from)" : term.label,
    preferences: parsed.data.preferences,
    currentlyTaking: parsed.data.currentlyTaking,
  };
  const batches: Found[][] = [];
  for (let i = 0; i < found.length; i += BATCH) batches.push(found.slice(i, i + BATCH));

  // A batch that fails on both models keeps its data rows, marked unassessed; auth errors still fail the request.
  let failedCourses = 0;
  let rateLimited = false;
  const assessed = await mapPool(batches, BATCH_CONCURRENCY, async (batch) => {
    try {
      return await rankBatch(batch, ctx);
    } catch (err) {
      if (isAuthError(err)) throw err;
      console.error("ranking batch failed", err);
      failedCourses += batch.length;
      rateLimited ||= isRateLimit(err);
      return [] as Assessment[];
    }
  });

  // Merge: the model's judgment + the facts we fetched. Never drop a course the model forgot.
  type Ranked = { row: Row; order: number };
  const merged: Ranked[] = [];
  batches.forEach((batch, b) => {
    const byKey = new Map(batch.map((g) => [key(g.course), g]));
    const recs = assessed[b];
    recs.forEach((r, i) => {
      const g = byKey.get(key(r.course));
      if (!g) return;
      byKey.delete(key(r.course));
      merged.push({
        row: { ...facts(g, r), verdict: r.verdict as Verdict, takeIf: r.takeIf, avoidIf: r.avoidIf, summary: r.summary, warning: r.warning.trim(), evidence: EVIDENCE[r.evidence], assessed: true },
        order: i / Math.max(recs.length, 1),
      });
    });
    const failed = recs.length === 0;
    for (const g of byKey.values()) {
      merged.push({
        row: {
          ...facts(g),
          verdict: "caveats",
          takeIf: [],
          avoidIf: [],
          summary: failed ? `Couldn't get an assessment right now${rateLimited ? " (model rate limit)" : ""}. The data above is still current.` : "The ranking didn't return an assessment for this course.",
          warning: "",
          evidence: 0,
          assessed: false,
        },
        order: 1,
      });
    }
  });
  // One batch keeps the model's order; several are merged by verdict tier, then position within the batch.
  const sorted = batches.length === 1 ? merged : [...merged].sort((a, b) => Number(b.row.assessed) - Number(a.row.assessed) || TIER[a.row.verdict] - TIER[b.row.verdict] || a.order - b.order);
  const rows = sorted.map((r) => r.row);

  const result: Result = { term: resultTerm, rows, notOffered, noData, skipped, usualTerms };
  if (failedCourses) {
    result.notice = `${failedCourses} course${failedCourses === 1 ? "" : "s"} couldn't be assessed${rateLimited ? " (model rate limit)" : ""}. Showing their data only.`;
  }
  return Response.json(result);
}

function describe(err: unknown): ApiError {
  const msg = err instanceof Error ? err.message : String(err);
  if (isRateLimit(err)) return { error: "The model's rate limit was hit. Wait a minute and try again, or rank fewer courses.", code: "rate_limit" };
  if (isAuthError(err) || /permission/i.test(msg)) return { error: "The model rejected the server's API key. Check the key in your environment variables.", code: "no_key" };
  return { error: `Ranking failed: ${msg.slice(0, 200)}`, code: "server" };
}

export async function POST(req: Request) {
  try {
    return await handle(req);
  } catch (err) {
    console.error("recommend failed", err);
    return fail(500, describe(err));
  }
}

export async function GET() {
  return Response.json({ terms: await fetchTerms().catch(() => []) });
}
