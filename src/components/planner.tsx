"use client";

import { useEffect, useRef, useState } from "react";
import type { PlanItem, Term } from "@/lib/types";

// Units like "4" or "1-4": count the minimum, so the total is never overstated.
const unitsOf = (u: string) => parseFloat(u) || 0;
const termKey = (t: Term) => `${t.year}|${t.quarter}`;
const totalUnits = (items: PlanItem[]) => items.reduce((n, i) => n + unitsOf(i.units), 0);

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
  const [announce, setAnnounce] = useState("");
  const asideRef = useRef<HTMLElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const returnTo = useRef<HTMLElement | null>(null);
  const wasOpen = useRef(false);

  // Focus moves into the drawer on open and goes back to whatever opened it on close.
  useEffect(() => {
    const aside = asideRef.current;
    if (open && !wasOpen.current) {
      returnTo.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
      closeRef.current?.focus({ preventScroll: true });
    } else if (!open && wasOpen.current) {
      const active = document.activeElement;
      const lost = !active || active === document.body || !!aside?.contains(active);
      if (lost) {
        const back = returnTo.current?.isConnected ? returnTo.current : document.querySelector<HTMLElement>('[aria-controls="plan"]');
        back?.focus();
      }
    }
    wasOpen.current = open;
  }, [open]);

  // Removing or moving a card unmounts the control that had focus: keep focus inside the drawer and say what happened.
  function keepFocus(message: string) {
    setAnnounce(message);
    asideRef.current?.focus({ preventScroll: true });
  }

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

  async function downloadPdf() {
    // jsPDF is loaded on demand so it stays out of the initial bundle.
    const { jsPDF } = await import("jspdf");
    const doc = new jsPDF({ unit: "in", format: "letter", orientation: "portrait" });
    const M = 0.75; // margin (inches)
    const BOTTOM = 11 - M;
    const WIDTH = 8.5 - 2 * M;
    const LEAD = 1.3; // line height as a multiple of font size
    const COL = { code: 1.1, title: 3.5, units: 0.9 }; // course row columns (inches)
    const INSTR_W = WIDTH - COL.code - COL.title - COL.units;
    let y = M;

    const lineH = (size: number) => (size * LEAD) / 72;
    // Start a new page when a line of this size would run past the bottom margin.
    const room = (h: number) => {
      if (y + h > BOTTOM) {
        doc.addPage();
        y = M;
      }
    };
    // Wrap text to a width at the given size; returns the lines.
    const write = (s: string, w: number, size: number, bold = false) => {
      doc.setFont("helvetica", bold ? "bold" : "normal");
      doc.setFontSize(size);
      return doc.splitTextToSize(s, w) as string[];
    };

    // Title and generated date
    for (const l of write("UCI course plan", WIDTH, 18, true)) {
      room(lineH(18));
      doc.text(l, M, y + 18 / 72);
      y += lineH(18);
    }
    const generated = new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });
    for (const l of write(`Generated ${generated}`, WIDTH, 9, false)) {
      room(lineH(9));
      doc.text(l, M, y + 9 / 72);
      y += lineH(9);
    }
    y += 0.25;

    for (const [t, items] of withItems) {
      const units = totalUnits(items);
      const heading = `${t.label} \u2014 ${items.length} ${items.length === 1 ? "course" : "courses"}, ${units} units`;
      for (const l of write(heading, WIDTH, 13, true)) {
        room(lineH(13));
        doc.text(l, M, y + 13 / 72);
        y += lineH(13);
      }
      y += 0.05;

      for (const i of items) {
        doc.setFontSize(10);
        const cols = [
          write(i.code, COL.code - 0.1, 10, true),
          write(i.title, COL.title - 0.1, 10),
          write(`${i.units} units`, COL.units - 0.1, 10),
          write(i.instructor ?? "", INSTR_W - 0.1, 10),
        ];
        const rows = Math.max(...cols.map((c) => c.length));
        room(lineH(10) * rows + 0.1);
        const xs = [M, M + COL.code, M + COL.code + COL.title, M + COL.code + COL.title + COL.units];
        cols.forEach((lines, c) => {
          doc.setFont("helvetica", c === 0 ? "bold" : "normal");
          doc.setFontSize(10);
          lines.forEach((l, n) => doc.text(l, xs[c], y + 10 / 72 + n * lineH(10)));
        });
        y += lineH(10) * rows + 0.1;
      }
      y += 0.2;
    }

    doc.save("uci-course-plan.pdf");
  }

  // The selected quarter first, then every other quarter that has courses.
  const shown = terms.filter((t) => termKey(t) === current || plans[termKey(t)]?.length).sort((a, b) => Number(termKey(b) === current) - Number(termKey(a) === current));

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      // Skip Escapes already used by a combobox/tooltip, or aimed at the modal import dialog.
      if (e.key !== "Escape" || e.defaultPrevented || document.querySelector("dialog[open]")) return;
      onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  return (
    <aside
      ref={asideRef}
      id="plan"
      aria-label="Your plan"
      tabIndex={-1}
      aria-hidden={!open}
      inert={!open}
      className={`fixed inset-y-0 right-0 z-10 flex w-[min(420px,100vw)] flex-col gap-5 overflow-y-auto border-l border-line bg-page px-6 py-6 xl:shadow-none shadow-[-12px_0_32px_rgba(0,0,0,0.35)] transition-transform duration-200 ${
        open ? "translate-x-0" : "translate-x-full"
      }`}
    >
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="m-0 text-[22px] font-medium">Your plan</h2>
        <button
          ref={closeRef}
          type="button"
          onClick={onClose}
          aria-label="Close plan"
          className="grid h-8 w-8 flex-none cursor-pointer place-items-center rounded-lg border-0 bg-transparent p-0 text-lg leading-none text-fg-muted hover:text-fg"
        >
          <span aria-hidden>✕</span>
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
                      onChange={(e) => {
                        const to = e.target.value;
                        if (!to) return;
                        onMove(i.code, k, to);
                        keepFocus(`Moved ${i.code} to ${terms.find((o) => termKey(o) === to)?.label ?? "another quarter"}.`);
                      }}
                      className="cursor-pointer rounded-lg border border-line-input bg-panel px-2.5 py-1.5 text-[13px] text-fg-muted"
                    >
                      <option value="">Move to…</option>
                      {terms
                        .filter((o) => termKey(o) !== k)
                        .map((o) => (
                          <option key={termKey(o)} value={termKey(o)}>
                            {o.label}
                          </option>
                        ))}
                    </select>
                    <button
                      type="button"
                      onClick={() => {
                        onRemove(i.code, k);
                        keepFocus(`Removed ${i.code} from ${t.label} plan.`);
                      }}
                      className="-mr-1.5 min-h-6 cursor-pointer rounded-md border-0 bg-transparent px-1.5 py-1 text-[13px] text-fg-muted underline"
                    >
                      Remove<span className="sr-only"> {i.code}</span>
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
          onClick={downloadPdf}
          disabled={!withItems.length}
          className="cursor-pointer rounded-[10px] border-0 bg-accent px-3.5 py-2 text-[13px] font-medium text-on-accent disabled:cursor-default disabled:opacity-40"
        >
          Download PDF
        </button>
        <button
          type="button"
          onClick={copyPlan}
          disabled={!withItems.length}
          className="cursor-pointer rounded-[10px] border border-line-btn bg-transparent px-3.5 py-2 text-[13px] text-fg-2 hover:text-fg disabled:cursor-default disabled:opacity-40"
        >
          {copied ? "Copied" : "Copy plan"}
        </button>
        <span className="sr-only" role="status">
          {copied ? "Plan copied to clipboard" : announce}
        </span>
      </div>
    </aside>
  );
}
