const OUTLETS = [
  "Καθημερινή",
  "ΣΚΑΪ",
  "in.gr",
  "Naftemporiki",
  "Reporter.gr",
  "FORTUNE Greece",
] as const;

export function PressStrip() {
  return (
    <section
      aria-label="Έχουμε αναφερθεί σε"
      className="border-b border-border bg-background py-10"
    >
      <div className="mx-auto max-w-[1280px] px-4 sm:px-6 lg:px-8">
        <p className="text-center text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
          Όπως αναφέρθηκε σε
        </p>
        <ul className="mt-5 flex flex-wrap items-center justify-center gap-x-10 gap-y-4">
          {OUTLETS.map((name) => (
            <li
              key={name}
              className="font-display text-base font-semibold text-muted-foreground/70 transition-colors hover:text-foreground sm:text-lg"
            >
              {name}
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
