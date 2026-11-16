"use client";

import { useEffect, useId, useRef, useState, type ReactNode } from "react";

// Toggle chips for "What matters". Each adds or removes a fixed phrase in the free-text box.
export const PRESETS = [
  { label: "Easy A", text: "Easy A, high average GPA." },
  { label: "Good lecturer", text: "A clear, engaging lecturer." },
  { label: "Light workload", text: "Light workload." },
  { label: "Online", text: "Prefer online classes." },
  { label: "In person", text: "Prefer in-person classes." },
];

export const EXAMPLES = [
  { label: "lower-div ICS", courses: ["ICS 33", "ICS 45C", "IN4MATX 43", "STATS 67"] },
  { label: "upper-div CS", courses: ["COMPSCI 161", "COMPSCI 171", "COMPSCI 178", "COMPSCI 122A"] },
];

export function togglePhrase(text: string, phrase: string): string {
  if (text.includes(phrase)) return text.replace(phrase, "").replace(/\s{2,}/g, " ").trim();
  return text.trim() ? `${text.trim()} ${phrase}` : phrase;
}

export function Presets({ prefText, onChange, compact }: { prefText: string; onChange: (next: string) => void; compact: boolean }) {
  return (
    <div role="group" aria-label="Priority presets" className="flex flex-wrap items-center gap-1.5">
      {PRESETS.map((p) => {
        const active = prefText.includes(p.text);
        return (
          <button
            key={p.label}
            type="button"
            aria-pressed={active}
            onClick={() => onChange(togglePhrase(prefText, p.text))}
            className={`cursor-pointer rounded-full border ${compact ? "px-2.5 py-0.5 text-[12px]" : "px-3 py-[5px] text-[13px]"} ${
              active ? "border-transparent bg-chip-pref text-chip-pref-fg" : "border-dashed border-line-btn bg-transparent text-fg-3 hover:border-accent"
            }`}
          >
            <span aria-hidden>{active ? "✓ " : "+ "}</span>
            {p.label}
          </button>
        );
      })}
    </div>
  );
}

const link = "cursor-pointer border-0 bg-transparent p-0 text-fg-2 underline decoration-line-btn underline-offset-4 hover:text-accent hover:decoration-accent";

// Quiet secondary actions under the bar on the empty screen.
export function Extras({ onImport, onPick }: { onImport: () => void; onPick: (courses: string[]) => void }) {
  return (
    <div className="flex flex-col gap-2 pb-4">
      <div className="m-0 flex flex-wrap items-center gap-x-2 gap-y-2 text-sm text-fg-muted">
        <span className="mr-2 flex items-center gap-2">
          <button
            type="button"
            onClick={onImport}
            className="cursor-pointer rounded-[10px] border border-btn2-border bg-btn2-bg px-4 py-2 text-[14px] font-medium text-fg hover:bg-[var(--btn-secondary-bg-hover)]"
          >
            Import from DegreeWorks
          </button>
          <InfoTip label="DegreeWorks import">{TIPS.import}</InfoTip>
        </span>
        <span>or try</span>
        {EXAMPLES.map((e, i) => (
          <span key={e.label} className="flex items-center gap-2">
            <button type="button" onClick={() => onPick(e.courses)} title={e.courses.join(", ")} className={link}>
              {e.label}
            </button>
            {i < EXAMPLES.length - 1 && <span>or</span>}
          </span>
        ))}
      </div>
      <p className="m-0 text-[13px] text-fg-label">
        To import: in DegreeWorks press <Key>⌘/Ctrl+A</Key>, <Key>⌘/Ctrl+C</Key>, then paste it in.
      </p>
    </div>
  );
}

function Key({ children }: { children: ReactNode }) {
  return <kbd className="font-code rounded border border-line-btn bg-chip-code px-1.5 py-px text-[11px] text-fg-2">{children}</kbd>;
}

// Explanations behind the (i) icons next to each box label.
export const TIPS = {
  term: "The quarter you're planning. We check who's actually teaching each course then and whether seats are open. Pick Any quarter to use the next quarter each course is offered.",
  courses:
    "The classes you're deciding between. Type a code or name (ICS 33, informatics 43, mgmt 30a) and pick from the list, or paste a whole list. Up to 60 get ranked.",
  prefs: "Optional. Say what you care about in plain words, or tap a preset below. Courses are ranked against it.",
  import:
    "Open your DegreeWorks worksheet, select all (⌘/Ctrl+A), copy (⌘/Ctrl+C) and paste it in. We pull out the courses you still need. It's read in your browser and never uploaded.",
};

// Small (i) button that shows a tooltip on hover, keyboard focus or tap.
// The tip is position: fixed so the command bar's overflow-hidden doesn't clip it.
export function InfoTip({ label, children }: { label: string; children: ReactNode }) {
  const id = useId();
  const ref = useRef<HTMLButtonElement>(null);
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);
  const show = () => {
    const r = ref.current?.getBoundingClientRect();
    if (!r) return;
    const width = Math.min(280, window.innerWidth - 32);
    setPos({ top: r.bottom + 8, left: Math.max(16, Math.min(r.left - 12, window.innerWidth - width - 16)) });
  };
  const hideTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const hide = () => {
    clearTimeout(hideTimer.current);
    setPos(null);
  };
  // Pointer leaving waits a beat so the tooltip itself can be hovered (WCAG 1.4.13).
  const hideSoon = () => {
    clearTimeout(hideTimer.current);
    hideTimer.current = setTimeout(() => setPos(null), 200);
  };
  const keep = () => clearTimeout(hideTimer.current);
  useEffect(() => () => clearTimeout(hideTimer.current), []);
  return (
    <>
      <button
        ref={ref}
        type="button"
        aria-label={`About ${label}`}
        aria-describedby={id}
        onMouseEnter={() => {
          keep();
          show();
        }}
        onMouseLeave={hideSoon}
        onFocus={show}
        onBlur={hide}
        onClick={() => (pos ? hide() : show())}
        onKeyDown={(e) => {
          if (e.key === "Escape" && pos) {
            e.preventDefault();
            hide();
          }
        }}
        className="relative inline-flex h-[15px] w-[15px] flex-none before:absolute before:-inset-[5px] before:content-[''] cursor-help items-center justify-center rounded-full border border-line-btn bg-transparent p-0 align-[-2px] font-serif text-[10px] italic leading-none text-fg-label hover:border-accent hover:text-accent focus-visible:border-accent focus-visible:text-accent"
      >
        i
      </button>
      {/* Always in the DOM (hidden) so the description is read the moment the button is focused. */}
      <span id={id} hidden>
        {children}
      </span>
      {pos && (
        <span
          aria-hidden
          onMouseEnter={keep}
          onMouseLeave={hideSoon}
          style={{ top: pos.top, left: pos.left }}
          className="fixed z-40 w-[min(280px,calc(100vw-32px))] rounded-lg border border-line-bar bg-panel px-3 py-2 text-left text-[13px] font-normal normal-case leading-snug tracking-normal text-fg-2 shadow-xl"
        >
          {children}
        </span>
      )}
    </>
  );
}

const START = [
  { title: "Pick your quarter", body: "Choose a term, or Any quarter for each course's next offering." },
  { title: "Add your courses", body: "Type a code or name, paste a list, or import from DegreeWorks." },
  { title: "Say what matters", body: "Optional. Plain words, or tap a preset like Easy A." },
  { title: "Press Rank", body: "Click a row for reviews, professors, grades and sources." },
  { title: "Save to your plan", body: "Add to plan, then open Your plan to copy or download it." },
];

export function GettingStarted() {
  return (
    <section aria-labelledby="start-heading" className="mt-6 border-t border-line pt-8 pb-10">
      <h2 id="start-heading" className="m-0 mb-5 text-[13px] font-medium uppercase tracking-[0.05em] text-fg-label">
        Getting started
      </h2>
      <ol className="m-0 grid list-none grid-cols-1 gap-x-6 gap-y-6 p-0 sm:grid-cols-2 lg:grid-cols-5">
        {START.map((s, i) => (
          <li key={s.title} className="flex flex-col gap-2.5">
            <div className="flex items-center gap-3">
              <span aria-hidden className="font-code flex h-7 w-7 flex-none items-center justify-center rounded-full bg-chip-code text-[13px] text-accent">
                {i + 1}
              </span>
              {/* Connector to the next step, only when the steps sit in one row */}
              {i < START.length - 1 && <span aria-hidden className="hidden h-px flex-1 bg-line lg:block" />}
            </div>
            <span className="text-[15px] font-medium text-fg">{s.title}</span>
            <span className="text-sm leading-relaxed text-fg-3">{s.body}</span>
          </li>
        ))}
      </ol>
    </section>
  );
}
