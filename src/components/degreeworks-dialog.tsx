"use client";

import { useEffect, useRef, useState } from "react";
import { matchesWildcard, parseDegreeWorks, type DegreeWorksResult, type NeededItem } from "@/lib/degreeworks";
import type { CourseOption, CourseSearchResponse, ImportSummary } from "@/lib/types";

type Props = {
  open: boolean;
  onClose: () => void;
  onUse: (courses: string[], inProgress: string[], summary: ImportSummary) => void;
};

type Loaded = { status: "loading" | "error" | "ok"; options: CourseOption[] };

const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;
const optKey = (group: number, label: string) => `${group}|${label}`;

function LockIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 16 16" fill="none" aria-hidden="true" className="flex-none">
      <rect x="3" y="7" width="10" height="7" rx="1.5" stroke="currentColor" strokeWidth="1.5" />
      <path d="M5.5 7V5a2.5 2.5 0 0 1 5 0v2" stroke="currentColor" strokeWidth="1.5" />
    </svg>
  );
}

async function loadWildcardOptions(n: NeededItem, taken: Set<string>): Promise<CourseOption[]> {
  const lists = await Promise.all(
    n.wildcards.map(async (w) => {
      const params = new URLSearchParams({ department: w.department, limit: "300" });
      if (w.prefix) params.set("prefix", w.prefix);
      const res = await fetch(`/api/courses?${params}`);
      const body = (await res.json()) as CourseSearchResponse;
      if (!res.ok || body.error) throw new Error(body.error ?? `HTTP ${res.status}`);
      return body.results.filter((c) => matchesWildcard({ department: c.department, number: c.number, label: c.label }, w));
    }),
  );
  const seen = new Set([...taken, ...n.options.map((o) => o.label)]);
  const out: CourseOption[] = [];
  for (const c of lists.flat()) {
    if (seen.has(c.label)) continue;
    seen.add(c.label);
    out.push(c);
  }
  return out;
}

export function DegreeWorksDialog({ open, onClose, onUse }: Props) {
  const ref = useRef<HTMLDialogElement>(null);
  const [text, setText] = useState("");
  const [dw, setDw] = useState<DegreeWorksResult | null>(null);
  const [pickedReq, setPickedReq] = useState<Set<number>>(new Set()); // required groups (all their courses)
  const [pickedOpt, setPickedOpt] = useState<Set<string>>(new Set()); // elective options, optKey(group, label)
  const [loaded, setLoaded] = useState<Record<number, Loaded>>({});
  const [filters, setFilters] = useState<Record<number, string>>({});

  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);

  function find() {
    const r = parseDegreeWorks(text);
    setDw(r);
    setPickedReq(new Set(r.needed.flatMap((n, i) => (n.kind === "required" ? [i] : []))));
    setPickedOpt(new Set());
    setLoaded({});
    setFilters({});
  }

  function toggle<T>(set: (f: (prev: Set<T>) => Set<T>) => void, v: T) {
    set((prev) => {
      const next = new Set(prev);
      if (next.has(v)) next.delete(v);
      else next.add(v);
      return next;
    });
  }

  async function showOptions(i: number, n: NeededItem) {
    if (!dw) return;
    setLoaded((p) => ({ ...p, [i]: { status: "loading", options: [] } }));
    const taken = new Set([...dw.completed, ...dw.inProgress].map((c) => c.label));
    try {
      const options = await loadWildcardOptions(n, taken);
      setLoaded((p) => ({ ...p, [i]: { status: "ok", options } }));
    } catch {
      setLoaded((p) => ({ ...p, [i]: { status: "error", options: [] } }));
    }
  }

  function use() {
    if (!dw) return;
    const labels: string[] = [];
    let requirements = 0;
    let electiveGroups = 0;
    dw.needed.forEach((n, i) => {
      const chosen =
        n.kind === "required"
          ? pickedReq.has(i)
            ? n.options.map((o) => o.label)
            : []
          : [...pickedOpt].filter((k) => k.startsWith(`${i}|`)).map((k) => k.slice(k.indexOf("|") + 1));
      if (!chosen.length) return;
      requirements += 1;
      if (n.kind === "elective") electiveGroups += 1;
      labels.push(...chosen);
    });
    const courses = [...new Set(labels)];
    const inProgress = dw.inProgress.map((c) => c.label);
    onUse(courses, inProgress, {
      courses: courses.length,
      requirements,
      electiveGroups,
      inProgress: inProgress.length,
      completed: dw.completedCount,
      unmatched: dw.needsInput.length,
    });
    onClose();
  }

  const electives = dw?.needed.filter((n) => n.kind === "elective").length ?? 0;
  const nothingPicked = pickedReq.size === 0 && pickedOpt.size === 0;

  // Select every listed option in an elective group, or clear them when all are already selected.
  function toggleAll(i: number, labels: string[]) {
    setPickedOpt((prev) => {
      const next = new Set(prev);
      const keys = labels.map((l) => optKey(i, l));
      if (keys.every((k) => next.has(k))) keys.forEach((k) => next.delete(k));
      else keys.forEach((k) => next.add(k));
      return next;
    });
  }

  // Every checkbox currently listed: all required groups plus each elective option that is shown.
  const allReq = dw ? dw.needed.flatMap((n, i) => (n.kind === "required" ? [i] : [])) : [];
  const allOpt = dw
    ? dw.needed.flatMap((n, i) =>
        n.kind === "required" ? [] : [...n.options.map((o) => o.label), ...(loaded[i]?.options ?? []).map((c) => c.label)].map((l) => optKey(i, l)),
      )
    : [];
  const everythingPicked = allReq.length + allOpt.length > 0 && allReq.every((i) => pickedReq.has(i)) && allOpt.every((k) => pickedOpt.has(k));
  function toggleEverything() {
    setPickedReq(new Set(everythingPicked ? [] : allReq));
    setPickedOpt(new Set(everythingPicked ? [] : allOpt));
  }

  function optionBox(i: number, label: string, title?: string) {
    const k = optKey(i, label);
    return (
      <li key={k}>
        <label className="flex cursor-pointer items-start gap-2">
          <input type="checkbox" className="mt-1 accent-[var(--accent)]" checked={pickedOpt.has(k)} onChange={() => toggle(setPickedOpt, k)} />
          <span>
            <span className="font-code text-[13px]">{label}</span>
            {title && <span className="text-fg-muted"> · {title}</span>}
          </span>
        </label>
      </li>
    );
  }

  return (
    <dialog
      ref={ref}
      onClose={onClose}
      aria-labelledby="dw-title"
      className="m-auto w-[min(34rem,calc(100vw-2rem))] rounded-2xl border border-line-bar bg-panel p-0 text-fg shadow-2xl backdrop:bg-black/60"
    >
      <div className="max-h-[85dvh] space-y-4 overflow-y-auto p-5">
        <div>
          <p className="mb-3 inline-flex items-center gap-1.5 rounded-full bg-chip-pref px-2.5 py-1 text-[12px] text-chip-pref-fg">
            <LockIcon />
            Parsed in your browser, never uploaded. Only course codes are looked up.
          </p>
          <h2 id="dw-title" className="text-lg font-semibold">
            Import from Degree Works
          </h2>
          <p className="mt-1 text-sm text-fg-muted">Open your worksheet, select everything (Cmd/Ctrl+A), copy, and paste it here.</p>
        </div>

        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={5}
          placeholder="Paste your Degree Works page"
          aria-label="Degree Works text"
          className="w-full resize-y rounded-[10px] border border-line-input bg-page p-3 text-sm"
        />
        <button
          type="button"
          onClick={find}
          disabled={!text.trim()}
          className="rounded-[10px] bg-accent px-4 py-2 text-sm font-medium text-on-accent disabled:opacity-40"
        >
          Find my remaining courses
        </button>

        {/* Always mounted so the result of "Find my remaining courses" is announced. */}
        <p role="status" className="sr-only">
          {dw ? `${plural(dw.needed.length, "requirement")} left, ${plural(electives, "elective group")}, ${dw.inProgress.length} in progress, ${dw.completedCount} completed.` : ""}
        </p>

        {dw && (
          <div className="space-y-3 text-sm">
            <p className="font-medium">
              {plural(dw.needed.length, "requirement")} left · {plural(electives, "elective group")} · {dw.inProgress.length} in progress · {dw.completedCount} completed
            </p>
            {dw.needed.length === 0 && (
              <p className="rounded-lg bg-warn-bg px-3 py-2 text-warn-fg">No remaining courses found. Make sure you copied the whole worksheet.</p>
            )}
            {dw.needed.length > 0 && (
              <div className="flex items-center justify-between gap-3">
                <button
                  type="button"
                  onClick={toggleEverything}
                  className="rounded-lg border border-line-btn px-3 py-1 text-[13px] text-fg-2 hover:text-fg"
                >
                  {everythingPicked ? "Clear everything" : "Select all"}
                </button>
                <span className="text-[12px] text-fg-label">Covers every group, including loaded options</span>
              </div>
            )}
            {dw.needed.length > 0 && (
              <ul className="space-y-2">
                {dw.needed.map((n, i) => {
                  if (n.kind === "required")
                    return (
                      <li key={i}>
                        <label className="flex cursor-pointer items-start gap-2">
                          <input type="checkbox" className="mt-1 accent-[var(--accent)]" checked={pickedReq.has(i)} onChange={() => toggle(setPickedReq, i)} />
                          <span className="font-code text-[13px]">{n.options.map((o) => o.label).join(", ")}</span>
                        </label>
                      </li>
                    );
                  const l = loaded[i];
                  const filter = (filters[i] ?? "").trim().toLowerCase();
                  const fetched = (l?.options ?? []).filter((c) => !filter || `${c.label} ${c.title}`.toLowerCase().includes(filter));
                  const shown = [...n.options.map((o) => o.label), ...fetched.map((c) => c.label)];
                  const allPicked = shown.length > 0 && shown.every((lb) => pickedOpt.has(optKey(i, lb)));
                  const picks = [...pickedOpt].filter((k) => k.startsWith(`${i}|`)).length;
                  return (
                    <li key={i} className="rounded-[10px] border border-line px-3 py-2.5">
                      <p className="font-medium">
                        Elective: pick {n.count}
                        {picks > 0 && <span className="font-normal text-fg-muted"> · {picks} picked</span>}
                      </p>
                      <p className="mt-0.5 text-[12px] text-fg-label">{n.label}</p>
                      {shown.length > 1 && (
                        <button
                          type="button"
                          onClick={() => toggleAll(i, shown)}
                          className="mt-2 rounded-lg border border-line-btn px-3 py-1 text-[13px] text-fg-2 hover:text-fg"
                        >
                          {allPicked ? "Clear group" : filter ? "Select shown in group" : "Select group"}
                        </button>
                      )}
                      {n.options.length > 0 && <ul className="mt-2 space-y-1">{n.options.map((o) => optionBox(i, o.label))}</ul>}
                      {n.wildcards.length > 0 && !l && (
                        <button
                          type="button"
                          onClick={() => showOptions(i, n)}
                          className="mt-2 rounded-lg border border-line-btn px-3 py-1 text-[13px] text-fg-2 hover:text-fg"
                        >
                          Show options
                        </button>
                      )}
                      {l?.status === "loading" && (
                        <p role="status" className="mt-2 text-fg-muted">
                          Loading options…
                        </p>
                      )}
                      {l?.status === "error" && <p role="alert" className="mt-2 text-warn-fg">Couldn&apos;t load options; add them in Courses instead.</p>}
                      {l?.status === "ok" && (
                        <div className="mt-2 space-y-2">
                          {l.options.length === 0 && <p className="text-fg-muted">No other matching courses found.</p>}
                          {l.options.length > 15 && (
                            <input
                              type="search"
                              value={filters[i] ?? ""}
                              onChange={(e) => setFilters((p) => ({ ...p, [i]: e.target.value }))}
                              placeholder="Filter by code or title"
                              aria-label="Filter options"
                              className="w-full rounded-lg border border-line-input bg-page px-2.5 py-1.5 text-[13px]"
                            />
                          )}
                          <ul className="max-h-56 space-y-1 overflow-y-auto">{fetched.map((c) => optionBox(i, c.label, c.title))}</ul>
                        </div>
                      )}
                    </li>
                  );
                })}
              </ul>
            )}
            {dw.inProgress.length > 0 && <p className="text-fg-muted">Taking now, used to judge workload: {dw.inProgress.map((c) => c.label).join(", ")}</p>}
            {dw.needsInput.length > 0 && (
              <div className="rounded-lg bg-warn-bg px-3 py-2 text-warn-fg">
                <p>These requirements don&apos;t name a course. Add candidates in Courses:</p>
                <ul className="mt-1 list-disc space-y-1 pl-5">
                  {dw.needsInput.map((t) => (
                    <li key={t}>{t.length > 140 ? `${t.slice(0, 140)}…` : t}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}

        <div className="flex justify-end gap-2 pt-1">
          <button type="button" onClick={onClose} className="rounded-[10px] px-4 py-2 text-sm text-fg-muted hover:text-fg">
            Cancel
          </button>
          <button
            type="button"
            onClick={use}
            disabled={!dw || (nothingPicked && dw.inProgress.length === 0)}
            className="rounded-[10px] bg-accent px-4 py-2 text-sm font-medium text-on-accent disabled:opacity-40"
          >
            Use these courses
          </button>
        </div>
      </div>
    </dialog>
  );
}
