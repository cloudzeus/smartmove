import Link from "next/link";
import { Phone } from "lucide-react";

import { auth } from "@/lib/auth";
import { cn } from "@/lib/utils";
import { Logo } from "@/components/brand/logo";
import { MobileNav } from "./mobile-nav";
import { UserMenu } from "./user-menu";

const NAV_LINKS = [
  { href: "/#how-it-works", label: "Πώς λειτουργεί" },
  { href: "/#categories", label: "Κατηγορίες" },
  { href: "/#carriers", label: "Για μεταφορείς" },
  { href: "/#faq", label: "Συχνές ερωτήσεις" },
] as const;

export async function SiteHeader() {
  const session = await auth();

  return (
    <>
      {/* Slim utility bar — branded gradient */}
      <div className="hidden border-b border-[var(--color-brand-blue-deep)]/30 bg-gradient-to-r from-[var(--color-brand-blue-deep)] via-[var(--color-brand-blue)] to-[var(--color-brand-blue-deep)] text-xs text-white/90 lg:block">
        <div className="mx-auto flex h-9 max-w-[1280px] items-center justify-between px-4 sm:px-6 lg:px-8">
          <span className="flex items-center gap-2">
            <span className="relative inline-flex size-2 items-center justify-center">
              <span className="absolute inset-0 animate-ping rounded-full bg-emerald-400/70" />
              <span className="relative inline-block size-2 rounded-full bg-emerald-400" />
            </span>
            Online τώρα · ~127 αιτήματα μεταφοράς σήμερα
          </span>
          <span className="flex items-center gap-4">
            <a
              href="tel:+302103000450"
              className="flex items-center gap-1.5 font-semibold text-white transition-colors hover:text-[var(--color-brand-red-light)]"
            >
              <Phone className="size-3" />
              210 3000 450
            </a>
            <span className="text-white/50">·</span>
            <span>Δευ–Κυρ 08:00–22:00</span>
          </span>
        </div>
      </div>

      <header
        className={cn(
          "sticky top-0 z-40 w-full border-b border-border/60",
          "bg-background/85 backdrop-blur supports-[backdrop-filter]:bg-background/70",
        )}
      >
        <div className="mx-auto flex h-16 max-w-[1280px] items-center justify-between gap-4 px-4 sm:px-6 lg:px-8">
          <Link
            href="/"
            className="-m-1.5 rounded-md p-1.5 outline-none focus-visible:ring-2 focus-visible:ring-ring/40"
          >
            <Logo />
          </Link>

          <nav className="hidden items-center gap-7 lg:flex">
            {NAV_LINKS.map((link) => (
              <Link
                key={link.href + link.label}
                href={link.href}
                className="text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
              >
                {link.label}
              </Link>
            ))}
          </nav>

          <UserMenu user={session?.user ?? null} />

          <MobileNav links={NAV_LINKS} signedIn={!!session?.user} />
        </div>
      </header>
    </>
  );
}
