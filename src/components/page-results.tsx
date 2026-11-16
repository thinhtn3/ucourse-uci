"use client";

import { useState } from "react";
import type { Mode, ProfessorOption, Quarter, Result, Row, Verdict } from "@/lib/types";

const VERDICT: Record<Verdict, { label: string; fg: string; bg: string; meaning: string }> = {
  take: { label: "Take it", fg: "text-take-fg", bg: "bg-take-bg", meaning: "strong fit for what you asked" },
  caveats: { label: "Take with caveats", fg: "text-caveat-fg", bg: "bg-caveat-bg", meaning: "workable, read the downsides" },
  skip: { label: "Skip / delay", fg: "text-skip-fg", bg: "bg-skip-bg", meaning: "poor fit this quarter" },
};

const EVIDENCE_LABEL = ["No evidence", "Limited evidence", "Some evidence", "Strong evidence"];

const MODE_LABEL: Record<Mode, string | null> = { "in-person": "In person", online: "Online", hybrid: "Hybrid", unknown: null };

export type ModeFilter = "all" | "in-person" | "online";

const FILTERS: { value: ModeFilter; label: string }[] = [
  { value: "all", label: "All" },
  { value: "in-person", label: "In person" },
  { value: "online", label: "Online" },
];

const COLS = "grid grid-cols-[36px_minmax(0,2fr)_minmax(0,1.3fr)_90px_70px_70px_150px_90px] gap-x-3";

export const quarters = (q: Quarter[]) => q.join(" · ");

function matches(mode: Mode, filter: ModeFilter) {
  if (filter === "all") return true;
  return mode === filter || mode === "hybrid";
}

type Props = {
  result: Result;
  understood: string[];
  open: string | null;
  onToggleOpen: (code: string) => void;
  planInstructor: (row: Row) => string | undefined;
  onAddWithProfessor: (row: Row, name: string) => void;
  modeFilter: ModeFilter;
  onModeFilter: (f: ModeFilter) => void;
  inPlan: (row: Row) => boolean;
  onTogglePlan: (row: Row) => void;
  onAddTakes: (rows: Row[]) => void;
  onRankSkipped: () => void;
};

export function Results({
  result,
  understood,
  open,
  onToggleOpen,
  planInstructor,
  onAddWithProfessor,
  modeFilter,
  onModeFilter,
  inPlan,
  onTogglePlan,
  onAddTakes,
  onRankSkipped,
}: Props) {
  const any = !!result.term.any;
  const ranked = result.rows.map((row, i) => ({ row, rank: i + 1 }));
  const visible = ranked.filter(({ row }) => matches(row.mode, modeFilter));
  const unknownHidden = modeFilter === "all" ? 0 : ranked.filter(({ row }) => row.mode === "unknown").length;
  const otherHidden = ranked.length - visible.length - unknownHidden;
  const takes = result.rows.filter((r) => r.assessed !== false && r.verdict === "take");
  const heading = result.rows.length
    ? `${result.rows.length} ranked ${any ? "across upcoming quarters" : `for ${result.term.label}`}`
    : `Nothing to rank ${any ? "in any upcoming quarter" : `for ${result.term.label}`}`;

  return (
    <div className="flex flex-col gap-4 pt-3 lg:min-h-0 lg:flex-1 lg:pb-5 lg:pt-0">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="m-0 text-[22px] font-medium leading-tight">{heading}</h2>
        <div className="flex flex-wrap items-center gap-3">
          {understood.length > 0 && (
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="text-[13px] text-fg-label">Understood</span>
              {understood.map((c) => (
                <span key={c} className="rounded-full bg-chip-pref px-2.5 py-[3px] text-[13px] text-chip-pref-fg">
                  {c}
                </span>
              ))}
            </div>
          )}
          {takes.some((r) => !inPlan(r)) && (
            <button
              type="button"
              onClick={() => onAddTakes(takes)}
              className="cursor-pointer rounded-full border border-dashed border-line-btn bg-transparent px-3 py-[5px] text-[13px] text-fg-3 hover:border-accent"
            >
              + Plan every &ldquo;Take it&rdquo;
            </button>
          )}
        </div>
      </div>

      {result.notice && (
        <p className="m-0 rounded-[10px] bg-warn-bg px-3.5 py-2.5 text-sm text-warn-fg">
          {result.notice}
        </p>
      )}

      {result.rows.length > 0 && (
        <>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="m-0 flex flex-wrap gap-x-4 gap-y-1 text-[13px] text-fg-muted">
              {(Object.keys(VERDICT) as Verdict[]).map((v) => (
                <span key={v}>
                  <span className={`font-medium ${VERDICT[v].fg}`}>{VERDICT[v].label}</span> = {VERDICT[v].meaning}
                </span>
              ))}
            </p>
            <div className="flex items-center gap-3">
              <div role="group" aria-label="Class format" className="flex rounded-full border border-line-btn p-0.5">
                {FILTERS.map((f) => (
                  <button
                    key={f.value}
                    type="button"
                    aria-pressed={modeFilter === f.value}
                    onClick={() => onModeFilter(f.value)}
                    className={`cursor-pointer rounded-full border-0 px-3 py-1 text-[13px] ${
                      modeFilter === f.value ? "bg-chip-code text-fg" : "bg-transparent text-fg-muted hover:text-fg"
                    }`}
                  >
                    {f.label}
                  </button>
                ))}
              </div>
            </div>
          </div>
          {(() => {
            const hiddenText = [otherHidden > 0 && `${otherHidden} hidden: not ${modeFilter === "online" ? "online" : "in person"}`, unknownHidden > 0 && `${unknownHidden} hidden: format not listed`]
              .filter(Boolean)
              .join(" · ");
            return (
              <>
                {hiddenText && <p className="m-0 text-[13px] text-fg-muted">{hiddenText}</p>}
                {/* Always mounted so filter changes are announced; the visible line above isn't a live region. */}
                <p role="status" className="sr-only">
                  {modeFilter === "all" ? "" : `Showing ${visible.length} of ${ranked.length} courses. ${hiddenText}`}
                </p>
              </>
            );
          })()}

          <div className="overflow-x-auto rounded-[14px] border border-line lg:min-h-0 lg:flex-[0_1_auto] lg:overflow-y-auto">
            <div className="min-w-[840px]">
              <div aria-hidden className={`${COLS} sticky top-0 z-[1] bg-table-head px-5 py-2.5 text-xs uppercase tracking-[0.05em] text-fg-label`}>
                <span>#</span>
                <span>Course</span>
                <span>Instructor</span>
                <span>Ratings</span>
                <span>GPA</span>
                <span>Seats</span>
                <span>Verdict</span>
                <span />
              </div>
              {visible.map(({ row, rank }) => (
                <TableRow
                  key={row.code}
                  row={row}
                  rank={rank}
                  any={any}
                  open={open === row.code}
                  onToggle={() => onToggleOpen(row.code)}
                  planInstructor={planInstructor(row)}
                  onAddWithProfessor={(name) => onAddWithProfessor(row, name)}
                  inPlan={inPlan(row)}
                  onTogglePlan={() => onTogglePlan(row)}
                />
              ))}
              {visible.length === 0 && <p className="m-0 border-t border-line px-5 py-4 text-sm text-fg-muted">No ranked course matches this format.</p>}
            </div>
          </div>
        </>
      )}

    </div>
  );
}

export function SideNotes({ result, onRankSkipped }: { result: Result; onRankSkipped: () => void }) {
  const any = !!result.term.any;
  return (
    <div className="flex flex-col gap-4">
      {result.skipped.length > 0 && (
        <div className="flex flex-col gap-2 rounded-xl border border-line-quiet px-[18px] py-3.5 text-sm text-fg-3">
          <span className="font-medium text-fg-2">Not ranked (over 60): {result.skipped.length}</span>
          <span className="font-code text-[13px] leading-[1.7]">{result.skipped.join(", ")}</span>
          <div>
            <button
              type="button"
              onClick={onRankSkipped}
              className="cursor-pointer rounded-[10px] border border-btn2-border bg-btn2-bg px-3.5 py-2 text-sm font-medium text-fg hover:bg-[var(--btn-secondary-bg-hover)]"
            >
              Rank these next
            </button>
          </div>
        </div>
      )}

      {result.notOffered.length > 0 && (
        <div className="flex flex-col gap-1.5 rounded-xl bg-panel px-[18px] py-3.5 text-sm text-fg-3">
          <span className="font-medium text-notoffered">Not offered {any ? "in any upcoming quarter" : `in ${result.term.label}`}</span>
          <ul className="m-0 flex list-none flex-col gap-0.5 p-0 text-[13px] leading-[1.7]">
            {result.notOffered.map((label) => {
              const usual = result.usualTerms?.[label] ?? [];
              return (
                <li key={label}>
                  <span className="font-code">{label}</span>
                  <span className="text-fg-muted"> · {usual.length ? `usually ${quarters(usual)}` : "no recent offerings"}</span>
                </li>
              );
            })}
          </ul>
        </div>
      )}
      {result.noData.length > 0 && (
        <div className="flex flex-col gap-1.5 rounded-xl border border-line-quiet px-[18px] py-3.5 text-sm text-fg-muted">
          <span className="font-medium">No {any ? "" : `${result.term.label} `}data yet</span>
          <span className="font-code text-[13px]">{result.noData.join(", ")}</span>
        </div>
      )}
    </div>
  );
}

function Tag({ children, tone = "bg-chip-code text-fg-3" }: { children: React.ReactNode; tone?: string }) {
  return <span className={`whitespace-nowrap rounded-full px-1.5 py-px text-[11px] ${tone}`}>{children}</span>;
}

function Stat({ label, value, tone = "text-fg-2" }: { label: string; value: React.ReactNode; tone?: string }) {
  return (
    <span className="whitespace-nowrap">
      <span className="text-[12px] text-fg-label">{label} </span>
      <span className={`text-[13px] ${tone}`}>{value}</span>
    </span>
  );
}

function TableRow({
  row,
  rank,
  any,
  open,
  onToggle,
  planInstructor,
  onAddWithProfessor,
  inPlan,
  onTogglePlan,
}: {
  row: Row;
  rank: number;
  any: boolean;
  open: boolean;
  onToggle: () => void;
  planInstructor: string | undefined;
  onAddWithProfessor: (name: string) => void;
  inPlan: boolean;
  onTogglePlan: () => void;
}) {
  const v = VERDICT[row.verdict];
  const assessed = row.assessed !== false;
  const [more, setMore] = useState(false);
  const professors = row.professors ?? [];
  const multi = professors.length > 1;
  const top: ProfessorOption | undefined = professors[0];
  // Collapsed row shows the top-ranked professor's numbers (the row's own rating/gpa already match professors[0]).
  const s = { instructor: multi && top ? top.name : row.instructor, rating: row.rating, gpa: row.gpa, seats: multi && top ? top.seats : row.seats, mode: multi && top ? top.mode : row.mode };
  const modeLabel = MODE_LABEL[s.mode];
  const usual = row.usuallyOffered ?? [];
  const idBase = `row-panel-${row.code.replace(/[^A-Za-z0-9]/g, "")}`;
  const panelId = idBase;
  const moreId = `${idBase}-more`;
  const topTake = row.takeIf[0];
  const topAvoid = row.avoidIf[0];
  const hasMore = row.takeIf.length > 1 || row.avoidIf.length > 1 || assessed || row.sources.length > 0;

  return (
    <div className={`border-t border-line ${open ? "bg-row-open" : "hover:bg-row-open"}`}>
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        aria-controls={panelId}
        className={`${COLS} focus-inset w-full cursor-pointer items-center border-0 bg-transparent px-5 py-3.5 text-left text-sm text-inherit`}
      >
        <span className="font-code text-accent">
          <span className="sr-only">Rank </span>
          {rank}
        </span>
        <span className="min-w-0">
          <span className="font-code text-[13px] font-semibold">{row.code}</span>
          {inPlan && <span className="ml-2 rounded-full bg-chip-code px-2 py-px text-[11px] text-fg-2">In plan</span>}
          <br />
          <span className="text-fg-3">{row.title}</span>
          {(usual.length > 0 || any) && (
            <span className="mt-0.5 block text-[12px] text-fg-label">
              {usual.length > 0 && `Usually ${quarters(usual)}`}
              {usual.length > 0 && any && row.term && " · "}
              {any && row.term && `Data from ${row.term.label}`}
            </span>
          )}
        </span>
        {multi ? (
          <span className="col-span-5 text-[13px] text-fg-muted">
            <span className="sr-only">{professors.length} professors, expand to compare</span>
            <span aria-hidden>{professors.length} professors · open to compare</span>
          </span>
        ) : (
        <>
        <span className="flex min-w-0 flex-col items-start gap-1">
          <span className="break-words text-fg-2">
            <span className="sr-only">Instructor: </span>
            {s.instructor}
          </span>
          {(modeLabel || multi) && (
            <span className="flex flex-wrap gap-1">
              {multi && <Tag tone="bg-chip-pref text-chip-pref-fg">{professors.length === 2 ? "+1 more" : `${professors.length} professors`}</Tag>}
              {modeLabel && <Tag>{modeLabel}</Tag>}
            </span>
          )}
        </span>
        <span>
          <span className="sr-only">Rating: </span>
          {s.rating}
        </span>
        <span>
          <span className="sr-only">GPA: </span>
          {s.gpa}
        </span>
        <span className={s.seats === "Full" ? "text-seat-full" : "text-take-fg"}>
          <span className="sr-only">Seats: </span>
          {s.seats}
        </span>
        <span>
          <span className="sr-only">Verdict: </span>
          {assessed ? (
            <span className={`whitespace-nowrap rounded-full px-2.5 py-[3px] text-[13px] ${v.fg} ${v.bg}`}>{v.label}</span>
          ) : (
            <span className="whitespace-nowrap rounded-full bg-chip-code px-2.5 py-[3px] text-[13px] text-fg-3">Not assessed</span>
          )}
        </span>
        </>
        )}
        <span className="flex items-center justify-end gap-1 whitespace-nowrap text-[13px] text-fg-3">
          Reviews
          <svg
            aria-hidden
            width="14"
            height="14"
            viewBox="0 0 16 16"
            className={`transition-transform duration-200 motion-reduce:transition-none ${open ? "rotate-90" : ""}`}
          >
            <path d="M6 3l5 5-5 5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </span>
      </button>
      {open && (
        <div id={panelId} className="flex flex-col gap-3 pb-[18px] pl-[68px] pr-5">
          <p className="m-0 max-w-[70ch] text-pretty text-fg-2">{row.summary}</p>
          {(topTake || topAvoid) && (
            <div className="flex max-w-[70ch] flex-col gap-1 text-sm">
              {topTake && (
                <p className="m-0 text-fg-2">
                  <span className="mr-1.5 text-xs font-medium uppercase tracking-[0.05em] text-take-fg">Take if</span>
                  {topTake}
                </p>
              )}
              {topAvoid && (
                <p className="m-0 text-fg-2">
                  <span className="mr-1.5 text-xs font-medium uppercase tracking-[0.05em] text-skip-fg">Avoid if</span>
                  {topAvoid}
                </p>
              )}
            </div>
          )}
          {row.warning && <div className="max-w-[70ch] rounded-[10px] bg-warn-bg px-3.5 py-2.5 text-sm text-warn-fg">{row.warning}</div>}
          {multi && (
            <ol className="m-0 flex max-w-[860px] list-none flex-col gap-2.5 p-0" aria-label="Professors ranked best first">
              {professors.map((p, i) => {
                const pv = p.verdict ? VERDICT[p.verdict] : null;
                const pm = MODE_LABEL[p.mode];
                const chosen = planInstructor === p.name;
                return (
                  <li key={p.name} className="flex flex-col gap-2.5 rounded-[12px] border border-line bg-panel px-4 py-3.5">
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
                      <span className="font-code text-accent">{i + 1}</span>
                      <span className="text-[15px] font-medium text-fg">{p.name}</span>
                      {pv ? (
                        <span className={`whitespace-nowrap rounded-full px-2.5 py-[3px] text-[13px] ${pv.fg} ${pv.bg}`}>{pv.label}</span>
                      ) : (
                        assessed && <span className="whitespace-nowrap rounded-full bg-chip-code px-2.5 py-[3px] text-[13px] text-fg-3">Not assessed</span>
                      )}
                      <button
                        type="button"
                        onClick={() => onAddWithProfessor(p.name)}
                        className={`ml-auto cursor-pointer whitespace-nowrap rounded-[8px] px-2.5 py-1 text-[13px] font-medium ${
                          chosen ? "border border-line-btn bg-transparent text-fg-2" : "border border-line-btn bg-transparent text-fg hover:border-accent"
                        }`}
                      >
                        {chosen ? "In plan" : "Add to plan"}
                        <span className="sr-only">
                          {chosen ? `: remove ${row.code} with ${p.name} from plan` : ` ${row.code} with ${p.name}`}
                        </span>
                      </button>
                    </div>
                    <div className="flex flex-wrap items-center gap-x-5 gap-y-1">
                      <Stat label="Rating" value={p.rating} />
                      <Stat label="GPA" value={p.gpa} />
                      <Stat label="Seats" value={p.seats} tone={p.seats === "Full" ? "text-seat-full" : "text-take-fg"} />
                      {pm && <Tag>{pm}</Tag>}
                      {p.difficulty != null && <Stat label="Difficulty" value={`${p.difficulty} / 5`} />}
                      {p.rmpUrl && (
                        <a href={p.rmpUrl} target="_blank" rel="noopener noreferrer" className="text-[13px]">
                          RateMyProfessors<span className="sr-only"> profile for {p.name} (opens in new tab)</span>
                          <span aria-hidden> ↗</span>
                        </a>
                      )}
                    </div>
                    {p.note && <p className="m-0 max-w-[70ch] text-sm text-fg-2">{p.note}</p>}
                  </li>
                );
              })}
            </ol>
          )}
          {hasMore && (
            <div>
              <button
                type="button"
                onClick={() => setMore((m) => !m)}
                aria-expanded={more}
                aria-controls={moreId}
                className="cursor-pointer rounded-[8px] border-0 bg-transparent px-0 py-1 text-[13px] text-fg-3 underline decoration-dotted underline-offset-4 hover:text-fg"
              >
                {more ? "Fewer details" : "More details"}
              </button>
            </div>
          )}
          {more && (
            <div id={moreId} className="flex flex-col gap-3">
              {(row.takeIf.length > 0 || row.avoidIf.length > 0) && (
                <div className="grid max-w-[70ch] gap-3 sm:grid-cols-2">
                  <ReasonList title="Take this course if" tone="text-take-fg" items={row.takeIf} />
                  <ReasonList title="Avoid this course if" tone="text-skip-fg" items={row.avoidIf} />
                </div>
              )}
              {assessed && (
                <span className="flex items-center gap-1.5">
                  {[0, 1, 2].map((d) => (
                    <span key={d} aria-hidden className={`h-2 w-2 rounded-full ${d < row.evidence ? "bg-accent" : "bg-dot-off"}`} />
                  ))}
                  <span className="text-[13px] text-fg-muted">{EVIDENCE_LABEL[row.evidence]}</span>
                </span>
              )}
              {row.sources.length > 0 && (
                <div className="flex flex-wrap items-center gap-1.5">
                  <span className="text-[13px] text-fg-label">Sources</span>
                  {row.sources.map((src) => (
                    <a
                      key={src.url + src.label}
                      href={src.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="rounded-full border border-line-btn px-2.5 py-[3px] text-[13px] text-fg-3 no-underline hover:border-accent hover:text-fg"
                    >
                      {src.label}
                      <span className="sr-only"> (opens in new tab)</span>
                      <span aria-hidden> ↗</span>
                    </a>
                  ))}
                </div>
              )}
            </div>
          )}
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={onTogglePlan}
              className={`cursor-pointer rounded-[10px] px-3.5 py-2 text-sm font-medium ${
                inPlan ? "border border-line-btn bg-transparent text-fg-2" : "border-0 bg-accent text-on-accent"
              }`}
            >
              {inPlan ? "Remove from plan" : "Add to plan"}
            </button>
            {any && row.term && <span className="text-[13px] text-fg-muted">Goes to your {row.term.label} plan</span>}
          </div>
        </div>
      )}
    </div>
  );
}

function ReasonList({ title, tone, items }: { title: string; tone: string; items: string[] }) {
  return (
    <div className="flex flex-col gap-1.5 rounded-[10px] bg-panel px-3.5 py-3">
      <span className={`text-xs font-medium uppercase tracking-[0.05em] ${tone}`}>{title}</span>
      {items.length ? (
        <ul className="m-0 flex list-none flex-col gap-1.5 p-0 text-sm text-fg-2">
          {items.map((t) => (
            <li key={t}>{t}</li>
          ))}
        </ul>
      ) : (
        <span className="text-sm text-fg-muted">Nothing stands out.</span>
      )}
    </div>
  );
}
