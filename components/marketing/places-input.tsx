"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { Loader2, MapPin } from "lucide-react";

import { cn } from "@/lib/utils";

interface Suggestion {
  placeId: string;
  text: string;
  secondary?: string;
}

interface PlacesInputProps {
  name: string;
  label: string;
  icon?: ReactNode;
  placeholder?: string;
  className?: string;
  defaultValue?: string;
  required?: boolean;
  onChange?: (value: string) => void;
}

export function PlacesInput({
  name,
  label,
  icon,
  placeholder,
  className,
  defaultValue = "",
  required = false,
  onChange,
}: PlacesInputProps) {
  const [value, setValue] = useState(defaultValue);

  function setAndEmit(v: string) {
    setValue(v);
    onChange?.(v);
  }
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [activeIdx, setActiveIdx] = useState(-1);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const reqIdRef = useRef(0);

  // Debounced fetch
  useEffect(() => {
    if (value.trim().length < 2) {
      setSuggestions([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    const myReqId = ++reqIdRef.current;
    const t = setTimeout(async () => {
      try {
        const r = await fetch("/api/places/autocomplete", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ input: value }),
        });
        const data = (await r.json()) as { suggestions?: Suggestion[] };
        if (reqIdRef.current !== myReqId) return; // outdated
        const s = data.suggestions ?? [];
        setSuggestions(s);
        if (s.length > 0 && document.activeElement === inputRef.current) {
          setOpen(true);
          // Auto-highlight first suggestion so Enter picks it
          setActiveIdx(0);
        }
      } catch {
        if (reqIdRef.current === myReqId) setSuggestions([]);
      } finally {
        if (reqIdRef.current === myReqId) setLoading(false);
      }
    }, 280);
    return () => clearTimeout(t);
  }, [value]);

  // Click outside closes
  useEffect(() => {
    function onPointer(e: MouseEvent) {
      if (!wrapperRef.current?.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onPointer);
    return () => document.removeEventListener("mousedown", onPointer);
  }, []);

  const select = useCallback(
    (s: Suggestion) => {
      const full = s.secondary ? `${s.text}, ${s.secondary}` : s.text;
      setValue(full);
      onChange?.(full);
      setSuggestions([]);
      setOpen(false);
      inputRef.current?.focus();
    },
    [onChange],
  );

  function onKey(e: React.KeyboardEvent<HTMLInputElement>) {
    // Never allow Enter on this input to bubble up — would submit the host form
    // before the user has a chance to pick a suggestion.
    if (e.key === "Enter") {
      if (open && suggestions.length > 0) {
        e.preventDefault();
        const idx = activeIdx >= 0 ? activeIdx : 0;
        select(suggestions[idx]);
      } else {
        // No open dropdown: still prevent accidental form submit when the user
        // is mid-type and the API simply hasn't responded yet.
        e.preventDefault();
      }
      return;
    }
    if (!open || suggestions.length === 0) {
      if (e.key === "ArrowDown" && suggestions.length > 0) {
        setOpen(true);
        setActiveIdx(0);
        e.preventDefault();
      }
      return;
    }
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIdx((i) => Math.min(suggestions.length - 1, i + 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIdx((i) => Math.max(0, i - 1));
    } else if (e.key === "Escape") {
      e.preventDefault();
      setOpen(false);
    }
  }

  return (
    <div
      ref={wrapperRef}
      className={cn(
        "group relative flex items-center gap-3 rounded-xl border border-input bg-background px-3 py-2.5 transition-colors focus-within:border-[var(--color-brand-blue)] focus-within:ring-2 focus-within:ring-ring/30",
        className,
      )}
    >
      <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-secondary/70">
        {icon ?? <MapPin className="size-4 text-[var(--color-brand-blue)]" />}
      </span>
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
          {label}
        </span>
        <input
          ref={inputRef}
          name={name}
          value={value}
          onChange={(e) => setAndEmit(e.target.value)}
          onFocus={() => suggestions.length > 0 && setOpen(true)}
          onKeyDown={onKey}
          placeholder={placeholder}
          autoComplete="off"
          required={required}
          className="w-full border-0 bg-transparent p-0 text-sm font-medium text-foreground outline-none placeholder:font-normal placeholder:text-muted-foreground/70"
        />
      </span>
      {loading && (
        <Loader2 className="size-4 shrink-0 animate-spin text-muted-foreground" />
      )}

      {open && suggestions.length > 0 && (
        <ul
          role="listbox"
          className="absolute inset-x-0 top-full z-[60] mt-1.5 max-h-[280px] overflow-y-auto rounded-xl border border-border bg-card py-1 shadow-[var(--shadow-pop)]"
        >
          {suggestions.map((s, i) => {
            const active = i === activeIdx;
            return (
              <li key={s.placeId} role="option" aria-selected={active}>
                <button
                  type="button"
                  onMouseDown={(e) => {
                    e.preventDefault();
                    select(s);
                  }}
                  onMouseEnter={() => setActiveIdx(i)}
                  className={cn(
                    "flex w-full items-start gap-2.5 px-3 py-2.5 text-left transition-colors",
                    active
                      ? "bg-[var(--color-brand-blue-light)] text-[var(--color-brand-blue-deep)]"
                      : "text-foreground hover:bg-secondary",
                  )}
                >
                  <MapPin
                    className={cn(
                      "mt-0.5 size-4 shrink-0",
                      active
                        ? "text-[var(--color-brand-blue)]"
                        : "text-muted-foreground",
                    )}
                  />
                  <span className="flex min-w-0 flex-col leading-tight">
                    <span className="truncate text-sm font-medium">
                      {s.text}
                    </span>
                    {s.secondary && (
                      <span className="truncate text-xs text-muted-foreground">
                        {s.secondary}
                      </span>
                    )}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
