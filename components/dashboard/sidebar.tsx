"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  CreditCard,
  LayoutDashboard,
  MapPin,
  PackageOpen,
  Receipt,
  Settings,
  ShieldCheck,
  Sparkles,
  Star,
  Truck,
} from "lucide-react";

import { cn } from "@/lib/utils";
import { Logo } from "@/components/brand/logo";
import { signOutAction } from "@/server/actions/auth-providers.action";

interface NavItem {
  href: string;
  label: string;
  icon: typeof LayoutDashboard;
  exact?: boolean;
}

const NAV: NavItem[] = [
  { href: "/dashboard", label: "Επισκόπηση", icon: LayoutDashboard, exact: true },
  { href: "/dashboard/requests", label: "Τα αιτήματά μου", icon: Truck },
  { href: "/dashboard/inventory", label: "Τα έπιπλά μου", icon: PackageOpen },
  { href: "/dashboard/locations", label: "Διευθύνσεις", icon: MapPin },
  { href: "/dashboard/offers", label: "Προσφορές", icon: Receipt },
  { href: "/dashboard/payments", label: "Πληρωμές", icon: CreditCard },
  { href: "/dashboard/reviews", label: "Αξιολογήσεις", icon: Star },
  { href: "/dashboard/settings", label: "Ρυθμίσεις", icon: Settings },
];

interface DashboardSidebarProps {
  user: { name?: string | null; email?: string | null; role: string };
}

export function DashboardSidebar({ user }: DashboardSidebarProps) {
  const path = usePathname();
  const initials = (user.name ?? user.email ?? "??")
    .split(/[\s@]/)
    .map((p) => p[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();

  return (
    <aside className="hidden h-screen w-[260px] shrink-0 flex-col border-r border-border bg-card lg:flex">
      <div className="flex h-16 items-center border-b border-border px-5">
        <Link href="/" className="-m-1.5 rounded-md p-1.5">
          <Logo />
        </Link>
      </div>

      <nav className="flex flex-1 flex-col gap-0.5 overflow-y-auto px-3 py-4">
        {(user.role === "SUPERADMIN" || user.role === "EMPLOYEE") && (
          <Link
            href="/admin"
            className="mb-2 inline-flex items-center gap-2 rounded-xl border border-[var(--color-brand-red)]/40 bg-gradient-to-r from-[var(--color-brand-red)]/10 via-transparent to-transparent px-3 py-2.5 text-sm font-semibold text-[var(--color-brand-red-deep)] transition-colors hover:from-[var(--color-brand-red)]/20"
          >
            <ShieldCheck className="size-4" />
            Πίνακας διαχείρισης
            <span className="ml-auto text-[10px] font-bold uppercase tracking-wide text-[var(--color-brand-red)]">
              Admin
            </span>
          </Link>
        )}
        <Link
          href="/scan"
          className="mb-3 inline-flex h-10 items-center justify-center gap-1.5 rounded-xl bg-[var(--color-brand-blue)] text-sm font-bold text-white shadow-[var(--shadow-cta)] transition-colors hover:bg-[var(--color-brand-blue-deep)]"
        >
          <Sparkles className="size-4" />
          Νέο αίτημα
        </Link>

        {NAV.map((item) => {
          const active = item.exact
            ? path === item.href
            : path === item.href || path.startsWith(`${item.href}/`);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
                active
                  ? "bg-[var(--color-brand-blue-light)] text-[var(--color-brand-blue-deep)]"
                  : "text-muted-foreground hover:bg-secondary hover:text-foreground",
              )}
            >
              <item.icon
                className={cn(
                  "size-4",
                  active && "text-[var(--color-brand-blue)]",
                )}
              />
              {item.label}
              {active && (
                <span className="ml-auto size-1.5 rounded-full bg-[var(--color-brand-blue)]" />
              )}
            </Link>
          );
        })}
      </nav>

      <div className="border-t border-border p-3">
        <div className="flex items-center gap-3 rounded-xl bg-secondary/40 p-3">
          <span
            aria-hidden
            className="grid size-9 shrink-0 place-items-center rounded-full bg-[var(--color-brand-blue)] text-xs font-bold text-white"
          >
            {initials || "U"}
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold text-foreground">
              {user.name ?? user.email ?? "Λογαριασμός"}
            </p>
            <p className="truncate text-[11px] uppercase tracking-wide text-muted-foreground">
              {user.role.toLowerCase()}
            </p>
          </div>
          <form action={signOutAction}>
            <button
              type="submit"
              title="Αποσύνδεση"
              className="grid size-8 place-items-center rounded-lg text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
            >
              <svg className="size-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                <polyline points="16 17 21 12 16 7" />
                <line x1="21" y1="12" x2="9" y2="12" />
              </svg>
            </button>
          </form>
        </div>
      </div>
    </aside>
  );
}

export function DashboardBottomNav() {
  const path = usePathname();
  const items = NAV.slice(0, 5);
  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-card/95 backdrop-blur lg:hidden">
      <ul className="grid grid-cols-5">
        {items.map((item) => {
          const active = item.exact
            ? path === item.href
            : path === item.href || path.startsWith(`${item.href}/`);
          return (
            <li key={item.href}>
              <Link
                href={item.href}
                className={cn(
                  "flex flex-col items-center gap-0.5 px-2 py-2.5 text-[10px] font-medium transition-colors",
                  active
                    ? "text-[var(--color-brand-blue)]"
                    : "text-muted-foreground",
                )}
              >
                <item.icon className="size-5" />
                <span className="truncate text-center leading-tight">
                  {item.label.split(" ")[0]}
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
