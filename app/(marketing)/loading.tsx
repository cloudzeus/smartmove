export default function Loading() {
  return (
    <div className="mx-auto flex h-[60vh] max-w-[1280px] flex-col items-center justify-center gap-4 px-4">
      <div className="size-10 animate-spin rounded-full border-2 border-border border-t-[var(--color-brand-blue)]" />
      <p className="text-sm text-muted-foreground">Φόρτωση…</p>
    </div>
  );
}
