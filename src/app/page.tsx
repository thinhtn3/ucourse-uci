"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { CourseInput } from "@/components/course-input";
import { DegreeWorksDialog } from "@/components/degreeworks-dialog";
import { Extras, GettingStarted, InfoTip, Presets, TIPS } from "@/components/page-home";
import { Results, type ModeFilter } from "@/components/page-results";
import { Toast, type ToastState } from "@/components/page-toast";
import { Planner } from "@/components/planner";
import { parseCourse, type CourseRef } from "@/lib/courses";
import { parsePriorities } from "@/lib/priorities";
import { MAX_RANKED, type ApiError, type ImportSummary, type PlanItem, type Result, type Row, type Term } from "@/lib/types";

const PLAN_KEY = "planner:plans";
const ANY = "any";

const keyOf = (t: { year: string; quarter: string }) => `${t.year}|${t.quarter}`;
const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;
const toRefs = (labels: string[]) => labels.map(parseCourse).filter((c): c is CourseRef => c !== null);

export default function Home() {
  const [term, setTerm] = useState(""); // "year|quarter" or "any"
  const [terms, setTerms] = useState<Term[]>([]);
  const [courses, setCourses] = useState<CourseRef[]>([]);
  const [prefText, setPrefText] = useState("");
  const [inProgress, setInProgress] = useState<string[]>([]);
  const [status, setStatus] = useState<"idle" | "loading" | "done">("idle");
  const [error, setError] = useState<{ message: string; code?: ApiError["code"] } | null>(null);
  const [result, setResult] = useState<Result | null>(null);
  const [understood, setUnderstood] = useState<string[]>([]);
  const [open, setOpen] = useState<string | null>(null);
  const [picked, setPicked] = useState<Record<string, string>>({}); // course code -> professor name
  const [modeFilter, setModeFilter] = useState<ModeFilter>("all");
  const [feedback, setFeedback] = useState("");
  const [importOpen, setImportOpen] = useState(false);
  const [plans, setPlansState] = useState<Record<string, PlanItem[]>>({}); // term key -> courses planned for it
  const [planOpen, setPlanOpen] = useState(false);
  const [toast, setToast] = useState<ToastState>(null);
  const [highlight, setHighlight] = useState<string | undefined>(undefined);
  const [pulse, setPulse] = useState(0);
  const planCount = Object.values(plans).reduce((n, p) => n + p.length, 0);

  // Saved plans live in this browser only. Read them after mount so the server and client render the same.
  useEffect(() => {
    let saved: Record<string, PlanItem[]> = {};
    try {
      saved = JSON.parse(localStorage.getItem(PLAN_KEY) ?? "{}");
    } catch {}
    void Promise.resolve().then(() => setPlansState(saved));
  }, []);

  useEffect(() => {
    fetch("/api/recommend")
      .then((r) => r.json())
      .then((b: { terms?: Term[] }) => {
        const list = b.terms ?? [];
        setTerms(list);
        if (list[0]) setTerm((t) => t || keyOf(list[0]));
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (!toast) return;
    const id = setTimeout(() => {
      setToast(null);
      setHighlight(undefined);
    }, 3000);
    return () => clearTimeout(id);
  }, [toast]);

  function setPlans(next: Record<string, PlanItem[]>) {
    setPlansState(next);
    try {
      localStorage.setItem(PLAN_KEY, JSON.stringify(next));
    } catch {}
  }

  const firstKey = terms[0] ? keyOf(terms[0]) : "";
  const planCurrent = term === ANY ? firstKey : term;
  const labelOf = (key: string) => terms.find((t) => keyOf(t) === key)?.label ?? "this term";
  // Rows carry the term their data came from; with "Any quarter" that differs per row.
  const rowKey = (r: Row) => (r.term ? keyOf(r.term) : planCurrent);
  const rowTermLabel = (r: Row) => r.term?.label ?? labelOf(planCurrent);
  const inPlan = (r: Row) => (plans[rowKey(r)] ?? []).some((p) => p.code === r.code);

  const toItem = (r: Row): PlanItem => {
    const profs = r.professors ?? [];
    const instructor = picked[r.code] ?? (profs.length === 1 ? profs[0].name : undefined);
    return { code: r.code, title: r.title, units: r.units, ...(instructor && { instructor }) };
  };

  function addToPlan(rows: Row[]) {
    const next = { ...plans };
    const added: Row[] = [];
    for (const r of rows) {
      const k = rowKey(r);
      const list = next[k] ?? [];
      if (list.some((p) => p.code === r.code)) continue;
      next[k] = [...list, toItem(r)];
      added.push(r);
    }
    if (!added.length) return;
    setPlans(next);
    const labels = new Set(added.map(rowTermLabel));
    const where = labels.size === 1 ? `${[...labels][0]} plan` : "your plan";
    setToast({ id: Date.now(), message: added.length === 1 ? `Added ${added[0].code} to ${where}` : `Added ${added.length} courses to ${where}` });
    setHighlight(added[added.length - 1].code);
    setPulse((p) => p + 1);
  }
  const removeFromPlan = (code: string, from: string) => setPlans({ ...plans, [from]: (plans[from] ?? []).filter((p) => p.code !== code) });
  const moveInPlan = (code: string, from: string, to: string) => {
    const item = (plans[from] ?? []).find((p) => p.code === code);
    if (!item) return;
    setPlans({ ...plans, [from]: plans[from].filter((p) => p.code !== code), [to]: [...(plans[to] ?? []).filter((p) => p.code !== code), item] });
  };

  const termLabel = term === ANY ? "upcoming quarters" : labelOf(term);
  const empty = status === "idle" && !result && !error;

  async function rank(override?: CourseRef[]) {
    const list = override ?? courses;
    if (status === "loading") return;

    setUnderstood(parsePriorities(prefText));
    setOpen(null);
    setError(null);
    if (!list.length) {
      setResult(null);
      setStatus("done");
      setError({ message: "Add at least one course, like ICS 33 or COMPSCI 161." });
      return;
    }

    setStatus("loading");
    try {
      const [year, quarter] = term.split("|");
      const res = await fetch("/api/recommend", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          courses: list.map((c) => c.label),
          preferences: prefText,
          currentlyTaking: inProgress,
          ...(term === ANY ? { term: ANY } : term && { term: { year, quarter } }),
        }),
      });
      // A platform error (timeout, crash) comes back as HTML, not JSON, so read it defensively.
      const raw = await res.text();
      let body: (Partial<Result> & Partial<ApiError>) | null = null;
      try {
        body = JSON.parse(raw);
      } catch {}
      if (!res.ok || !body) {
        setResult(null);
        setError({
          code: body?.code,
          message:
            body?.error ??
            (res.status === 504 || res.status === 408
              ? "Ranking took too long and timed out. Try fewer courses."
              : `The server returned an error (${res.status}). If this is your deployed site, check its function logs.`),
        });
      } else {
        setResult({ notOffered: [], noData: [], skipped: [], usualTerms: {}, ...body } as Result);
        setPicked({});
      }
    } catch {
      setResult(null);
      setError({ message: "Couldn't reach the server. Check your connection and try again." });
    } finally {
      setStatus("done");
    }
  }

  // The app is one page, so "home" means clearing the search back to the empty state.
  function goHome() {
    setCourses([]);
    setPrefText("");
    setInProgress([]);
    setResult(null);
    setError(null);
    setUnderstood([]);
    setOpen(null);
    setPicked({});
    setFeedback("");
    setStatus("idle");
  }

  function onImport(labels: string[], taking: string[], summary: ImportSummary) {
    // Fill in Courses only. The student can still add priorities before pressing Rank.
    if (labels.length) setCourses(toRefs(labels));
    setInProgress(taking);
    let msg = `Imported ${plural(summary.courses, "course")} from ${plural(summary.requirements, "requirement")}`;
    if (summary.electiveGroups) msg += ` (${plural(summary.electiveGroups, "elective group")})`;
    msg += ".";
    if (summary.inProgress) msg += ` Taking ${summary.inProgress} now.`;
    if (summary.unmatched) msg += ` ${plural(summary.unmatched, "requirement")} (like GEs) need courses you pick yourself.`;
    setFeedback(msg);
  }

  function onParsed(info: { added: CourseRef[]; unrecognized: string[]; source: "paste" | "type" | "pick" }) {
    const parts: string[] = [];
    if (info.source === "paste" || info.added.length > 1) parts.push(`Found ${plural(info.added.length, "course")}.`);
    else if (info.added.length === 1) parts.push(`Added ${info.added[0].label}.`);
    if (info.unrecognized.length) parts.push(`Couldn't read: ${info.unrecognized.join(", ")}`);
    setFeedback(parts.join(" "));
  }

  function pickExample(labels: string[]) {
    const refs = toRefs(labels);
    setCourses(refs);
    setFeedback(`Added ${plural(refs.length, "example course")}. Press Rank when ready.`);
  }

  function rankSkipped() {
    if (!result) return;
    const refs = toRefs(result.skipped);
    setCourses(refs);
    void rank(refs);
  }

  const cellLabel = "text-[11px] uppercase tracking-[0.05em] text-fg-label";
  // After a search, the bar becomes a left sidebar (stacked fields) on large screens.
  const side = !empty;
  // Sidebar: each field is its own card instead of one joined bar.
  const cell = side ? "lg:flex-none lg:rounded-xl lg:border lg:border-line-bar" : "";
  return (
    <div className={`min-h-screen transition-[padding] duration-200 motion-reduce:transition-none ${planOpen ? "xl:pr-[420px]" : ""}`}>
      <header className="flex items-center justify-between gap-4 border-b border-line px-4 py-4 sm:px-8">
        <div className="flex items-baseline gap-3">
          <Link
            href="/"
            onClick={(e) => {
              e.preventDefault();
              goHome();
            }}
            className="text-[17px] font-semibold text-accent no-underline hover:opacity-80"
          >
            Course Recommender
          </Link>
          <span className="text-sm text-fg-muted">UC Irvine</span>
        </div>
        <button
          type="button"
          onClick={() => setPlanOpen((o) => !o)}
          aria-expanded={planOpen}
          aria-controls="plan"
          aria-label={`Your plan, ${plural(planCount, "course")}`}
          className="flex cursor-pointer items-center gap-2 rounded-full border border-line-btn bg-transparent py-1 pl-3.5 pr-1.5 text-sm font-medium text-fg-2 hover:border-accent"
        >
          Your plan
          <span
            key={pulse}
            aria-hidden
            className={`font-code inline-flex h-[22px] min-w-[22px] items-center justify-center rounded-full px-1.5 text-[12px] ${
              planCount > 0 ? "bg-accent text-on-accent" : "bg-chip-code text-fg-muted"
            } ${pulse > 0 ? "plan-pulse" : ""}`}
          >
            {planCount}
          </span>
        </button>
      </header>

      <main
        className={`mx-auto px-4 pb-16 sm:px-8 ${
          // Sidebar mode spans the full width so its edges line up with the header (px-4 / sm:px-8)
          side ? "lg:grid lg:grid-cols-[300px_minmax(0,1fr)] lg:items-start lg:gap-8" : "max-w-[1040px]"
        }`}
      >
        {/* Command bar */}
        <div
          className={`sticky top-0 z-[2] flex flex-col gap-4 bg-page ${
            empty ? "pb-6 pt-12 sm:pt-[64px]" : "pb-2 pt-5 lg:max-h-screen lg:overflow-y-auto lg:pb-6"
          }`}
        >
          {empty && (
            <h1 className="m-0 max-w-[24ch] text-balance text-[30px] font-medium tracking-[-0.01em]">Rank the courses you&apos;re deciding between.</h1>
          )}

          <div
            className={`flex flex-wrap gap-px overflow-hidden rounded-[14px] border border-line-bar bg-line-bar ${
              side ? "lg:flex-col lg:gap-3 lg:overflow-visible lg:rounded-none lg:border-0 lg:bg-transparent" : ""
            }`}
          >
            <div className={`bar-cell flex flex-[1_0_150px] flex-col gap-0.5 bg-panel px-4 py-2.5 sm:flex-[0_0_160px] ${cell}`}>
              <span className="flex items-center gap-1.5">
                <label htmlFor="term-select" className={cellLabel}>
                  Term
                </label>
                <InfoTip label="Term">{TIPS.term}</InfoTip>
              </span>
              <select
                id="term-select"
                value={term}
                onChange={(e) => setTerm(e.target.value)}
                className="cursor-pointer border-0 bg-transparent p-0 text-inherit outline-none"
              >
                {terms.map((t) => (
                  <option key={t.label} value={keyOf(t)} className="text-black">
                    {t.label}
                  </option>
                ))}
                <option value={ANY} className="text-black">
                  Any quarter
                </option>
              </select>
            </div>
            <div className={`bar-cell flex min-w-0 flex-[1_1_300px] flex-col gap-0.5 bg-panel px-4 py-2.5 ${cell}`}>
              <span className="flex items-center gap-1.5">
                <label htmlFor="courses-input" className={cellLabel}>
                  Courses
                </label>
                <InfoTip label="Courses">{TIPS.courses}</InfoTip>
              </span>
              <CourseInput
                value={courses}
                onChange={setCourses}
                onSubmit={() => void rank()}
                onParsed={onParsed}
                max={MAX_RANKED}
                id="courses-input"
                placeholder="Type ICS 33, informatics 43…"
                disabled={status === "loading"}
              />
            </div>
            <div className={`bar-cell flex min-w-0 flex-[1_1_240px] flex-col gap-0.5 bg-panel px-4 py-2.5 ${cell}`}>
              <span className="flex items-center gap-1.5">
                <label htmlFor="prefs-input" className={cellLabel}>
                  What matters
                </label>
                <InfoTip label="What matters">{TIPS.prefs}</InfoTip>
              </span>
              <input
                id="prefs-input"
                value={prefText}
                onChange={(e) => setPrefText(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    void rank();
                  }
                }}
                placeholder="Optional: easy A, light workload…"
                className="border-0 bg-transparent p-0 text-inherit outline-none"
              />
            </div>
            <button
              type="button"
              onClick={() => void rank()}
              disabled={status === "loading"}
              className={`min-h-14 flex-[1_0_100%] cursor-pointer border-0 bg-accent px-[26px] text-[15px] font-medium text-on-accent disabled:cursor-default disabled:bg-accent-disabled sm:flex-none ${
                side ? "lg:min-h-12 lg:rounded-xl" : ""
              }`}
            >
              {status === "loading" ? "Ranking…" : "Rank"}
            </button>
          </div>

          <Presets prefText={prefText} onChange={setPrefText} compact={!empty} />

          <p aria-live="polite" className={`m-0 text-[13px] text-fg-3 ${feedback && !side ? "" : "sr-only"}`}>
            {feedback}
          </p>

          {inProgress.length > 0 && !side && (
            <p className="m-0 text-sm text-fg-muted">
              From DegreeWorks: taking {inProgress.join(", ")} now. We use that to judge your workload.{" "}
              <button type="button" onClick={() => setInProgress([])} className="cursor-pointer border-0 bg-transparent p-0 text-fg-muted underline">
                Clear
              </button>
            </p>
          )}
        </div>

        {empty && (
          <>
            <Extras onImport={() => setImportOpen(true)} onPick={pickExample} />
            <GettingStarted />
          </>
        )}

        {/* Results */}
        <div className={`min-w-0 ${side ? "lg:pt-5" : ""}`}>
          {status === "loading" && (
            <p role="status" className="pt-6 text-fg-muted">
              Checking who&apos;s teaching in {termLabel} and what students say about them…
            </p>
          )}

          {status !== "loading" && error && (
            <div role="alert" className="mt-4 flex flex-wrap items-center gap-3 rounded-xl border border-line-quiet px-[18px] py-3.5 text-sm text-skip-fg">
              <span>{error.message}</span>
              {error.code === "rate_limit" && (
                <button
                  type="button"
                  onClick={() => void rank()}
                  className="cursor-pointer rounded-[10px] border border-btn2-border bg-btn2-bg px-3.5 py-1.5 text-sm font-medium text-fg hover:bg-[var(--btn-secondary-bg-hover)]"
                >
                  Try again
                </button>
              )}
            </div>
          )}

          {status !== "loading" && result && (
            <Results
              result={result}
              understood={understood}
              open={open}
              onToggleOpen={(code) => setOpen((o) => (o === code ? null : code))}
              picked={picked}
              onPick={(code, name) => setPicked((p) => ({ ...p, [code]: name }))}
              modeFilter={modeFilter}
              onModeFilter={setModeFilter}
              inPlan={inPlan}
              onTogglePlan={(r) => (inPlan(r) ? removeFromPlan(r.code, rowKey(r)) : addToPlan([r]))}
              onAddTakes={addToPlan}
              onRankSkipped={rankSkipped}
            />
          )}
        </div>

        <Planner
          terms={terms}
          plans={plans}
          current={planCurrent}
          open={planOpen}
          onClose={() => setPlanOpen(false)}
          onMove={moveInPlan}
          onRemove={removeFromPlan}
          highlight={highlight}
        />
      </main>

      <Toast
        toast={toast}
        onView={() => {
          setPlanOpen(true);
          setToast(null);
        }}
      />

      <DegreeWorksDialog open={importOpen} onClose={() => setImportOpen(false)} onUse={onImport} />
    </div>
  );
}
