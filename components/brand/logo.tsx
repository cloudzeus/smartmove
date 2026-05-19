import { cn } from "@/lib/utils";

interface LogoProps {
  className?: string;
  /** Inline mark only (no wordmark) */
  markOnly?: boolean;
  /** Color the mark on a dark background */
  invert?: boolean;
}

/**
 * SmartMove logo: minimal rounded mark combining an arrow + moving box,
 * paired with the wordmark `Smart` (blue) + `Move` (deep navy) + red dot accent.
 *
 * Per brand directive: blue is dominant, red appears only as accent.
 */
export function Logo({ className, markOnly = false, invert = false }: LogoProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-2 select-none",
        className,
      )}
      aria-label="SmartMove"
    >
      <LogoMark invert={invert} />
      {!markOnly && (
        <span
          className={cn(
            "font-display text-[1.15rem] font-extrabold tracking-tight leading-none",
            invert ? "text-white" : "text-foreground",
          )}
        >
          <span className="text-[var(--color-brand-blue)]">Smart</span>
          <span className={invert ? "text-white" : "text-foreground"}>Move</span>
          <span className="text-[var(--color-brand-red)]">.</span>
        </span>
      )}
    </span>
  );
}

function LogoMark({ invert }: { invert: boolean }) {
  const blue = "var(--color-brand-blue)";
  const blueDeep = "var(--color-brand-blue-deep)";
  const red = "var(--color-brand-red)";
  return (
    <span
      className={cn(
        "relative inline-flex items-center justify-center size-8 rounded-[10px]",
        invert ? "bg-white/10" : "bg-[var(--color-brand-blue-light)]",
      )}
    >
      <svg
        viewBox="0 0 24 24"
        fill="none"
        className="size-5"
        aria-hidden="true"
      >
        {/* Moving box */}
        <rect
          x="3.5"
          y="7.5"
          width="13"
          height="10"
          rx="2"
          stroke={invert ? "#fff" : blueDeep}
          strokeWidth="1.8"
          fill="none"
        />
        <path
          d="M3.5 11h13"
          stroke={invert ? "#fff" : blueDeep}
          strokeWidth="1.8"
          strokeLinecap="round"
        />
        {/* Arrow accent (movement) */}
        <path
          d="M14 12.5 L20.5 12.5"
          stroke={blue}
          strokeWidth="2"
          strokeLinecap="round"
        />
        <path
          d="M18.5 10 L21 12.5 L18.5 15"
          stroke={red}
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          fill="none"
        />
      </svg>
    </span>
  );
}
