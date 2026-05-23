import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import { ArrowRight, Construction } from "lucide-react";

interface Props {
  icon: LucideIcon;
  title: string;
  description: string;
  /** Optional bullet list of what's coming */
  features?: string[];
  /** Suggest a related, working page so the user isn't stranded. */
  alternate?: { label: string; href: string };
}

export function ComingSoonPanel({
  icon: Icon,
  title,
  description,
  features,
  alternate,
}: Props) {
  return (
    <div className="rounded-3xl border border-border bg-gradient-to-br from-[var(--color-brand-blue-light)]/20 via-white to-amber-50/30 p-8 sm:p-12">
      <div className="mx-auto max-w-2xl text-center">
        <span className="mb-4 inline-flex size-16 items-center justify-center rounded-2xl bg-white shadow-[var(--shadow-card)] ring-1 ring-border">
          <Icon className="size-7 text-[var(--color-brand-blue)]" />
        </span>
        <div className="mb-2 inline-flex items-center gap-1.5 rounded-full border border-amber-300 bg-amber-50 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-amber-800">
          <Construction className="size-3" />
          Έρχεται σύντομα
        </div>
        <h2 className="font-display text-2xl font-extrabold text-foreground sm:text-3xl">
          {title}
        </h2>
        <p className="mt-2 text-sm text-muted-foreground sm:text-base">
          {description}
        </p>

        {features && features.length > 0 && (
          <ul className="mx-auto mt-6 grid max-w-md gap-2 text-left text-sm sm:grid-cols-2">
            {features.map((f) => (
              <li
                key={f}
                className="flex items-start gap-2 rounded-lg border border-border bg-white/70 px-3 py-2"
              >
                <span className="mt-0.5 grid size-4 shrink-0 place-items-center rounded-full bg-[var(--color-brand-blue)] text-[10px] font-bold text-white">
                  ✓
                </span>
                <span className="text-foreground">{f}</span>
              </li>
            ))}
          </ul>
        )}

        {alternate && (
          <Link
            href={alternate.href}
            className="mt-6 inline-flex h-10 items-center gap-1.5 rounded-lg bg-foreground px-4 text-sm font-bold text-background hover:bg-foreground/90"
          >
            {alternate.label}
            <ArrowRight className="size-4" />
          </Link>
        )}
      </div>
    </div>
  );
}
