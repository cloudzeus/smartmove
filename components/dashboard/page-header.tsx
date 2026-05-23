import Link from "next/link";
import { ChevronRight } from "lucide-react";

interface Crumb {
  href?: string;
  label: string;
}

interface PageHeaderProps {
  title: string;
  description?: string;
  crumbs?: Crumb[];
  action?: React.ReactNode;
}

export function PageHeader({
  title,
  description,
  crumbs,
  action,
}: PageHeaderProps) {
  return (
    <div className="border-b border-border bg-card">
      <div className="mx-auto max-w-[1400px] px-4 py-5 sm:px-6 sm:py-6 lg:px-8 lg:py-8">
        {crumbs && crumbs.length > 0 && (
          <nav className="mb-3 flex items-center gap-1 text-xs text-muted-foreground">
            {crumbs.map((c, i) => (
              <span key={`${c.label}-${i}`} className="flex items-center gap-1">
                {c.href ? (
                  <Link
                    href={c.href}
                    className="transition-colors hover:text-foreground"
                  >
                    {c.label}
                  </Link>
                ) : (
                  <span className="text-foreground">{c.label}</span>
                )}
                {i < crumbs.length - 1 && (
                  <ChevronRight className="size-3.5 text-muted-foreground/60" />
                )}
              </span>
            ))}
          </nav>
        )}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 className="font-display text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
              {title}
            </h1>
            {description && (
              <p className="mt-1 max-w-2xl text-sm text-muted-foreground sm:text-base">
                {description}
              </p>
            )}
          </div>
          {action && <div className="flex shrink-0 gap-2">{action}</div>}
        </div>
      </div>
    </div>
  );
}
