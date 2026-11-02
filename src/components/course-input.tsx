"use client";

import { useEffect, useId, useRef, useState, type ClipboardEvent, type KeyboardEvent } from "react";
import { extractCourses, parseCourse, type CourseRef } from "@/lib/courses";
import { resolveDept } from "@/lib/departments";
import type { CourseOption, CourseSearchResponse, Quarter } from "@/lib/types";

export type CourseInputProps = {
  value: CourseRef[];
  onChange: (next: CourseRef[]) => void;
  onSubmit?: () => void;
  onParsed?: (info: { added: CourseRef[]; unrecognized: string[]; source: "paste" | "type" | "pick" }) => void;
  max?: number;
  placeholder?: string;
  id?: string;
  describedBy?: string;
  disabled?: boolean;
};

const SHOWN = 8;
const QUARTER_ABBR: Record<Quarter, string> = { Fall: "F", Winter: "W", Spring: "S", Summer: "Su" };
const lookups = new Map<string, Promise<CourseOption[]>>();

function lookup(q: string): Promise<CourseOption[]> {
  const key = q.trim().toLowerCase().replace(/\s+/g, " ");
  let hit = lookups.get(key);
  if (!hit) {
    hit = fetch(`/api/courses?q=${encodeURIComponent(key)}&limit=${SHOWN}`)
      .then((r) => r.json() as Promise<CourseSearchResponse>)
      .then((r) => {
        if (r.error) lookups.delete(key);
        return r.results ?? [];
      })
      .catch(() => {
        lookups.delete(key);
        return [];
      });
    lookups.set(key, hit);
  }
  return hit;
}

type Anchor = { top: number; left: number; width: number };

function anchorFor(el: HTMLElement | null): Anchor | null {
  const r = el?.getBoundingClientRect();
  if (!r) return null;
  const width = Math.min(440, window.innerWidth - 16);
  return { top: r.bottom + 6, left: Math.max(8, Math.min(r.left, window.innerWidth - width - 8)), width };
}

export function CourseInput({ value, onChange, onSubmit, onParsed, max, placeholder, id, describedBy, disabled }: CourseInputProps) {
  const [text, setText] = useState("");
  const [bad, setBad] = useState(false);
  const [options, setOptions] = useState<CourseOption[]>([]);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const [anchor, setAnchor] = useState<Anchor | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const latest = useRef("");
  const listId = useId();

  const place = () => setAnchor(anchorFor(inputRef.current));

  useEffect(() => {
    if (!open) return;
    const place = () => setAnchor(anchorFor(inputRef.current));
    window.addEventListener("scroll", place, true);
    window.addEventListener("resize", place);
    return () => {
      window.removeEventListener("scroll", place, true);
      window.removeEventListener("resize", place);
    };
  }, [open]);

  useEffect(() => () => clearTimeout(timer.current), []);

  const close = () => {
    setOpen(false);
    setActive(-1);
  };

  const add = (refs: CourseRef[], unrecognized: string[], source: "paste" | "type" | "pick") => {
    const added = refs.filter((r, i) => !value.some((v) => v.label === r.label) && refs.findIndex((x) => x.label === r.label) === i);
    if (added.length) onChange([...value, ...added]);
    onParsed?.({ added, unrecognized, source });
  };

  const search = (q: string) => {
    latest.current = q;
    clearTimeout(timer.current);
    if (!q.trim()) {
      setOptions([]);
      close();
      return;
    }
    timer.current = setTimeout(async () => {
      const results = await lookup(q);
      if (latest.current !== q) return;
      setOptions(results);
      setActive(-1);
      setOpen(results.length > 0);
      if (results.length) place();
    }, 150);
  };

  const setInput = (next: string, flagged = false) => {
    setText(next);
    setBad(flagged);
    search(flagged ? "" : next);
  };

  const pick = (o: CourseOption) => {
    add([{ department: o.department, number: o.number, label: o.label }], [], "pick");
    setInput("");
    close();
  };

  // Typed text -> chips. Returns false when nothing in it reads as a course.
  const commit = (source: "paste" | "type", raw = text) => {
    const single = parseCourse(raw);
    // Only known departments, so "take 2" doesn't become a chip
    if (single && resolveDept(single.department) && !/[,;\n/|]/.test(raw)) {
      add([single], [], source);
      setInput("");
      return true;
    }
    const { courses, unrecognized } = extractCourses(raw);
    if (!courses.length) return false;
    add(courses, unrecognized, source);
    setInput(unrecognized.join(", "), unrecognized.length > 0);
    close();
    return true;
  };

  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    const shown = open ? options.slice(0, SHOWN) : [];
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      if (!shown.length) return;
      e.preventDefault();
      const step = e.key === "ArrowDown" ? 1 : -1;
      setActive((a) => (a + step + shown.length + (a < 0 && step < 0 ? 1 : 0)) % shown.length);
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (active >= 0 && shown[active]) pick(shown[active]);
      else if (!text.trim()) onSubmit?.();
      else if (!commit("type") && shown.length) pick(shown[0]);
    } else if (e.key === "Tab" && !e.shiftKey && text.trim()) {
      if (active >= 0 && shown[active]) {
        e.preventDefault();
        pick(shown[active]);
      } else if (commit("type")) e.preventDefault();
    } else if (e.key === ",") {
      if (commit("type")) e.preventDefault();
    } else if (e.key === "Backspace" && !text && value.length) {
      onChange(value.slice(0, -1));
    } else if (e.key === "Escape" && open) {
      e.preventDefault();
      close();
    }
  };

  const onPaste = (e: ClipboardEvent<HTMLInputElement>) => {
    const pasted = e.clipboardData.getData("text");
    if (!extractCourses(pasted).courses.length && !parseCourse(pasted)) return;
    e.preventDefault();
    commit("paste", text ? `${text}, ${pasted}` : pasted);
  };

  const shown = options.slice(0, SHOWN);
  const over = max !== undefined && value.length > max;

  return (
    <div className="flex w-full flex-wrap items-center gap-1.5" onClick={() => inputRef.current?.focus()}>
      {value.map((c) => (
        <span key={c.label} className="inline-flex items-center gap-1 rounded-full bg-chip-code py-0.5 pl-2.5 pr-1 font-code text-[13px] text-fg-2">
          {c.label}
          <button
            type="button"
            aria-label={`Remove ${c.label}`}
            disabled={disabled}
            onClick={(e) => {
              e.stopPropagation();
              onChange(value.filter((v) => v.label !== c.label));
            }}
            className="grid h-4 w-4 place-items-center rounded-full text-fg-muted hover:bg-line-btn hover:text-fg"
          >
            ×
          </button>
        </span>
      ))}
      <input
        ref={inputRef}
        id={id}
        value={text}
        disabled={disabled}
        onChange={(e) => setInput(e.target.value)}
        onKeyDown={onKeyDown}
        onPaste={onPaste}
        onBlur={close}
        onFocus={() => {
          if (shown.length && text.trim() && !bad) {
            setOpen(true);
            place();
          }
        }}
        placeholder={value.length ? "Add another…" : placeholder}
        role="combobox"
        aria-expanded={open}
        aria-controls={listId}
        aria-autocomplete="list"
        aria-activedescendant={open && active >= 0 ? `${listId}-${active}` : undefined}
        aria-describedby={describedBy}
        aria-invalid={bad || undefined}
        autoComplete="off"
        spellCheck={false}
        className={`min-w-[8ch] flex-1 border-0 bg-transparent p-0 text-inherit outline-none ${bad ? "text-warn-fg underline decoration-warn-fg decoration-wavy underline-offset-4" : ""}`}
      />
      {over && (
        <span className="text-[12px] text-fg-label">
          {value.length} courses · first {max} get ranked
        </span>
      )}
      <ul
        id={listId}
        role="listbox"
        aria-label="Matching courses"
        hidden={!open || !anchor}
        style={anchor ? { top: anchor.top, left: anchor.left, width: anchor.width } : undefined}
        className="fixed z-30 m-0 max-h-[320px] list-none overflow-y-auto rounded-lg border border-line-bar bg-panel p-1 shadow-xl"
      >
        {shown.map((o, i) => {
          const added = value.some((v) => v.label === o.label);
          return (
            <li
              key={o.label}
              id={`${listId}-${i}`}
              role="option"
              aria-selected={i === active}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => pick(o)}
              onMouseEnter={() => setActive(i)}
              className={`flex cursor-pointer items-baseline gap-2 rounded-md px-2.5 py-1.5 text-[14px] ${i === active ? "bg-row-open text-fg" : "text-fg-2"}`}
            >
              <span className="shrink-0 font-code text-[13px]">{o.label}</span>
              <span className="min-w-0 flex-1 truncate">· {o.title}</span>
              {added ? (
                <span className="shrink-0 text-[11px] text-fg-label">Added</span>
              ) : (
                o.usuallyOffered.length > 0 && (
                  <span className="shrink-0 text-[11px] text-fg-label">Usually {o.usuallyOffered.map((q) => QUARTER_ABBR[q]).join("·")}</span>
                )
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
