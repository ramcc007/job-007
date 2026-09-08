"use client";

import { useEffect, useId, useRef, useState } from "react";

export interface Suggestion { value: string; label: string; hint?: string }

/**
 * A text input with suggestions.
 *
 * Deliberately not a <select>: the list is a shortcut, never a constraint.
 * Whatever is typed is submitted, whether or not it appears in the list, so
 * an unusual job title or a town missing from the catalogue still searches.
 */
export function Combobox({
  name, kind, defaultValue = "", placeholder, icon, autoFocus,
}: {
  name: string;
  kind: "title" | "location";
  defaultValue?: string;
  placeholder: string;
  icon: React.ReactNode;
  autoFocus?: boolean;
}) {
  const [value, setValue] = useState(defaultValue);
  const [items, setItems] = useState<Suggestion[]>([]);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const boxRef = useRef<HTMLDivElement>(null);
  const listId = useId();

  useEffect(() => {
    const term = value.trim();
    if (term.length < 1) { setItems([]); return; }

    // Debounced so a fast typist makes one request, not one per keystroke.
    const timer = setTimeout(async () => {
      try {
        const res = await fetch(
          `/api/suggest?type=${kind}&q=${encodeURIComponent(term)}`,
          { cache: "force-cache" },
        );
        if (!res.ok) return;
        const data = (await res.json()) as { suggestions: Suggestion[] };
        setItems(data.suggestions ?? []);
      } catch {
        // Suggestions failing must never block typing or submitting.
        setItems([]);
      }
    }, 120);
    return () => clearTimeout(timer);
  }, [value, kind]);

  useEffect(() => {
    function onPointerDown(event: MouseEvent) {
      if (!boxRef.current?.contains(event.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onPointerDown);
    return () => document.removeEventListener("mousedown", onPointerDown);
  }, []);

  function choose(item: Suggestion) {
    setValue(item.value);
    setOpen(false);
    setActive(-1);
  }

  function onKeyDown(event: React.KeyboardEvent) {
    if (!open || items.length === 0) return;
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setActive((i) => (i + 1) % items.length);
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setActive((i) => (i <= 0 ? items.length - 1 : i - 1));
    } else if (event.key === "Enter" && active >= 0) {
      // Only intercept Enter when a suggestion is highlighted; otherwise the
      // form submits with exactly what was typed.
      event.preventDefault();
      choose(items[active]!);
    } else if (event.key === "Escape") {
      setOpen(false);
      setActive(-1);
    }
  }

  return (
    <div ref={boxRef} className="relative flex flex-1 items-center gap-2 px-3">
      {icon}
      <span className="sr-only">{placeholder}</span>
      <input
        type="text"
        name={name}
        value={value}
        autoFocus={autoFocus}
        autoComplete="off"
        role="combobox"
        aria-expanded={open && items.length > 0}
        aria-controls={listId}
        aria-autocomplete="list"
        placeholder={placeholder}
        onChange={(e) => { setValue(e.target.value); setOpen(true); setActive(-1); }}
        onFocus={() => setOpen(true)}
        onKeyDown={onKeyDown}
        className="w-full bg-transparent text-fg placeholder:text-fg-faint focus:outline-none"
      />

      {open && items.length > 0 ? (
        <ul
          id={listId}
          role="listbox"
          className="absolute left-0 top-full z-50 mt-1 max-h-72 w-full min-w-56 overflow-y-auto rounded-lg border border-line bg-elevated py-1 shadow-xl"
        >
          {items.map((item, index) => (
            <li key={`${item.value}-${index}`} role="option" aria-selected={index === active}>
              <button
                type="button"
                onMouseEnter={() => setActive(index)}
                onClick={() => choose(item)}
                className={`flex w-full items-baseline justify-between gap-3 px-3 py-1.5 text-left text-[13px] ${
                  index === active ? "bg-hover text-fg" : "text-fg-muted"
                }`}
              >
                <span className="truncate">{item.label}</span>
                {item.hint ? (
                  <span className="shrink-0 font-[family-name:var(--font-mono)] text-[10px] uppercase tracking-wide text-fg-faint">
                    {item.hint}
                  </span>
                ) : null}
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
