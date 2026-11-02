"use client";

import { useEffect, useState } from "react";
import type { PlanItem, Term } from "@/lib/types";

// Units like "4" or "1-4": count the minimum, so the total is never overstated.
const unitsOf = (u: string) => parseFloat(u) || 0;
const termKey = (t: Term) => `${t.year}|${t.quarter}`;
const totalUnits = (items: PlanItem[]) => items.reduce((n, i) => n + unitsOf(i.units), 0);
const csvCell = (v: string) => (/[",\r\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v);

function planText(quarters: [Term, PlanItem[]][]) {
  return quarters
    .map(([t, items]) =>
      [
        `${t.label} (${items.length} ${items.length === 1 ? "course" : "courses"}, ${totalUnits(items)} units)`,
        ...items.map((i) => ["", i.code, i.title, `${i.units} units`, i.instructor ?? ""].join("  ").trimEnd()),
      ].join("\n"),
    )
    .join("\n\n");
}

function planCsv(quarters: [Term, PlanItem[]][]) {
  const rows = [["Quarter", "Code", "Title", "Units", "Instructor"], ...quarters.flatMap(([t, items]) => items.map((i) => [t.label, i.code, i.title, i.units, i.instructor ?? ""]))];
  return rows.map((r) => r.map(csvCell).join(",")).join("\r\n") + "\r\n";
}

export function Planner({
  terms,
  plans,
  current,
  open,
  onClose,
  onMove,
  onRemove,
  highlight,
}: {
  terms: Term[];
  plans: Record<string, PlanItem[]>; // term key ("2026|Fall") -> courses planned for it
  current: string;
  open: boolean;
  onClose: () => void;
  onMove: (code: string, from: string, to: string) => void;
  onRemove: (code: string, from: string) => void;
  highlight?: string; // code of a just-added item: gets a brief accent ring
}) {
  const [copied, setCopied] = useState(false);
  const [faded, setFaded] = useState<string | null>(null); // highlight whose ring has timed out

  useEffect(() => {
    if (!highlight) return;
    const t = setTimeout(() => setFaded(highlight), 2000);
    return () => clearTimeout(t);
  }, [highlight]);
  const ringed = highlight && faded !== highlight ? highlight : null;

  const withItems = terms.flatMap((t): [Term, PlanItem[]][] => (plans[termKey(t)]?.length ? [[t, plans[termKey(t)]]] : []));

  async function copyPlan() {
    try {
      await navigator.clipboard.writeText(planText(withItems));
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  }

  function downloadCsv() {
    const url = URL.createObjectURL(new Blob(["\uFEFF" + planCsv(withItems)], { type: "text/csv;charset=utf-8" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = "uci-course-plan.csv";
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  // The selected quarter first, then every other quarter that has courses.
  const shown = terms.filter((t) => termKey(t) === current || plans[termKey(t)]?.length).sort((a, b) => Number(termKey(b) === current) - Number(termKey(a) === current));

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  return (
    <aside
      id="plan"
      aria-label="Your plan"
      aria-hidden={!open}
      inert={!open}
      className={`fixed inset-y-0 right-0 z-10 flex w-[min(420px,100vw)] flex-col gap-5 overflow-y-auto border-l border-line bg-page px-6 py-6 xl:shadow-none shadow-[-12px_0_32px_rgba(0,0,0,0.35)] transition-transform duration-200 ${
        open ? "translate-x-0" : "translate-x-full"
      }`}
    >
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="m-0 text-[22px] font-medium">Your plan</h2>
        <button type="button" onClick={onClose} aria-label="Close plan" className="cursor-pointer border-0 bg-transparent p-1 text-lg leading-none text-fg-muted hover:text-fg">
          ✕
        </button>
      </div>
      <div className="flex flex-col gap-5">
        {shown.map((t) => {
          const k = termKey(t);
          const items = plans[k] ?? [];
          const units = totalUnits(items);
          return (
            <div key={k} className="flex flex-col overflow-hidden rounded-[14px] border border-line">
              <div className="flex items-baseline justify-between gap-3 bg-table-head px-5 py-3">
                <span className="font-medium">{t.label}</span>
                <span className={`text-sm ${units > 18 ? "text-seat-full" : "text-fg-muted"}`}>
                  {items.length} {items.length === 1 ? "course" : "courses"} · {units} units
                </span>
              </div>
              {items.length === 0 && <p className="m-0 px-5 py-3.5 text-sm text-fg-muted">Nothing planned yet. Add courses from the ranking above.</p>}
              {items.map((i) => (
                <div key={i.code} className={`flex flex-col gap-2.5 border-t border-line px-5 py-4 text-sm transition-shadow ${ringed === i.code ? "ring-1 ring-accent ring-inset" : ""}`}>
                  <div className="flex items-baseline justify-between gap-3">
                    <span className="font-code text-[13px] font-semibold">{i.code}</span>
                    <span className="flex-none text-fg-muted">{i.units} units</span>
                  </div>
                  <span className="text-pretty text-fg-3">{i.title}</span>
                  {i.instructor && <span className="-mt-1.5 text-[13px] text-fg-muted">{i.instructor}</span>}
                  <div className="flex items-center justify-between gap-3">
                    <select
                      aria-label={`Move ${i.code} to another quarter`}
                      value=""
                      onChange={(e) => e.target.value && onMove(i.code, k, e.target.value)}
                      className="cursor-pointer rounded-lg border border-line-bar bg-panel px-2.5 py-1.5 text-[13px] text-fg-muted outline-none"
                    >
                      <option value="">Move to…</option>
                      {terms
                        .filter((o) => termKey(o) !== k)
                        .map((o) => (
                          <option key={termKey(o)} value={termKey(o)} className="text-black">
                            {o.label}
                          </option>
                        ))}
                    </select>
                    <button type="button" onClick={() => onRemove(i.code, k)} className="cursor-pointer border-0 bg-transparent p-0 text-[13px] text-fg-muted underline">
                      Remove
                    </button>
                  </div>
                </div>
              ))}
            </div>
          );
        })}
      </div>
      <div className="mt-auto flex gap-2 border-t border-line pt-4">
        <button
          type="button"
          onClick={copyPlan}
          disabled={!withItems.length}
          className="cursor-pointer rounded-[10px] border border-line-btn bg-transparent px-3.5 py-2 text-[13px] text-fg-2 hover:text-fg disabled:cursor-default disabled:opacity-40"
        >
          {copied ? "Copied" : "Copy plan"}
        </button>
        <button
          type="button"
          onClick={downloadCsv}
          disabled={!withItems.length}
          className="cursor-pointer rounded-[10px] border border-line-btn bg-transparent px-3.5 py-2 text-[13px] text-fg-2 hover:text-fg disabled:cursor-default disabled:opacity-40"
        >
          Download CSV
        </button>
        <span className="sr-only" aria-live="polite">
          {copied ? "Plan copied to clipboard" : ""}
        </span>
      </div>
    </aside>
  );
}
