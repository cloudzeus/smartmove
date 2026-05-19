"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Building2,
  Inbox,
  LayoutDashboard,
  LayoutGrid,
  LogOut,
  Receipt,
  Tag,
  Settings,
  ShieldCheck,
  Star,
  Truck,
  Users,
} from "lucide-react";

import { cn } from "@/lib/utils";
import { Logo } from "@/components/brand/logo";
import { signOutAction } from "@/server/actions/auth-providers.action";

interface NavItem {
  href: string;
  label: string;
  icon: typeof LayoutDashboard;
  exact?: boolean;
  badge?: string | number;
}

interface NavGroup {
  label: string;
  items: NavItem[];
}

const NAV_GROUPS: NavGroup[] = [
  {
    label: "Marketplace",
    items: [
      { href: "/carrier", label: "Επισκόπηση", icon: LayoutDashboard, exact: true },
      { href: "/carrier/leads", label: "Νέα αιτήματα", icon: Inbox },
      { href: "/carrier/offers", label: "Οι προσφορές μου", icon: Receipt },
      { href: "/carrier/jobs", label: "Μεταφορές", icon: Truck },
    ],
  },
  {
    label: "Ρυθμίσεις",
    items: [
      { href: "/carrier/fleet", label: "Στόλος", icon: Truck },
      { href: "/carrier/pricing", label: "Τιμολόγιο", icon: Tag },
      { href: "/carrier/team", label: "Ομάδα", icon: Users },
      { href: "/carrier/branches", label: "Υποκαταστήματα", icon: Building2 },
      { href: "/carrier/reviews", label: "Αξιολογήσεις", icon: Star },
      { href: "/carrier/billing", label: "Συνδρομή", icon: Receipt },
      { href: "/carrier/settings", label: "Ρυθμίσεις", icon: Settings },
    ],
  },
];

interface Props {
  user: { name?: string | null; email?: string | null; role: string };
  tenantName?: string | null;
  canAccessAdmin?: boolean;
}

export function CarrierSidebar({ user, tenantName, canAccessAdmin }: Props) {
  const path = usePathname();
  const initials = (user.name ?? user.email ?? "??")
    .split(/[\s@]/)
    .map((p) => p[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();

  return (
    <aside className="hidden h-screen w-[280px] shrink-0 flex-col border-r border-border bg-[#FBFCFE] lg:flex">
      <div className="relative flex h-16 items-center gap-2 border-b border-border px-5">
        <Link href="/" className="-m-1.5 rounded-md p-1.5">
          <Logo />
        </Link>
        <span className="ml-auto inline-flex items-center gap-1 rounded-full bg-gradient-to-r from-[var(--color-brand-blue)] to-[#3B82F6] px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white shadow-sm">
          <Truck className="size-3" />
          Carrier
        </span>
      </div>

      {tenantName && (
        <div className="border-b border-border bg-white/60 px-5 py-3">
          <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-muted-foreground/70">
            Εταιρεία
          </p>
          <p className="mt-0.5 truncate text-sm font-semibold text-foreground">
            {tenantName}
          </p>
        </div>
      )}

      <div className="border-b border-border px-3 py-3">
        <Link
          href="/dashboard"
          className="group flex items-center gap-2 rounded-xl border border-border bg-white px-3 py-2 text-xs font-medium text-muted-foreground transition-colors hover:border-[var(--color-brand-blue)]/40 hover:text-foreground"
        >
          <LayoutGrid className="size-3.5 text-[var(--color-brand-blue)]" />
          Customer view
          <span className="ml-auto rounded-full bg-secondary px-1.5 py-0.5 text-[9px] font-bold uppercase text-muted-foreground transition-colors group-hover:bg-[var(--color-brand-blue-light)] group-hover:text-[var(--color-brand-blue-deep)]">
            Switch
          </span>
        </Link>
        {canAccessAdmin && (
          <Link
            href="/admin"
            className="mt-2 inline-flex w-full items-center gap-2 rounded-xl border border-[var(--color-brand-red)]/40 bg-gradient-to-r from-[var(--color-brand-red)]/10 via-transparent to-transparent px-3 py-2 text-xs font-semibold text-[var(--color-brand-red-deep)] transition-colors hover:from-[var(--color-brand-red)]/20"
          >
            <ShieldCheck className="size-3.5" />
            Πίνακας διαχείρισης
            <span className="ml-auto text-[9px] font-bold uppercase tracking-wide text-[var(--color-brand-red)]">
              Admin
            </span>
          </Link>
        )}
      </div>

      <nav className="flex flex-1 flex-col gap-4 overflow-y-auto px-3 py-4">
        {NAV_GROUPS.map((group) => (
          <div key={group.label}>
            <p className="mb-1.5 px-3 text-[10px] font-bold uppercase tracking-[0.12em] text-muted-foreground/70">
              {group.label}
            </p>
            <ul className="flex flex-col gap-0.5">
              {group.items.map((item) => {
                const active = item.exact
                  ? path === item.href
                  : path === item.href || path.startsWith(`${item.href}/`);
                return (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      className={cn(
                        "group/item relative flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-all",
                        active
                          ? "bg-white text-foreground shadow-[0_1px_2px_rgba(15,23,42,0.05),0_1px_3px_rgba(15,23,42,0.08)] ring-1 ring-border"
                          : "text-muted-foreground hover:bg-white/70 hover:text-foreground",
                      )}
                    >
                      <span
                        className={cn(
                          "absolute left-0 top-1/2 h-5 w-0.5 -translate-x-3 -translate-y-1/2 rounded-r-full bg-[var(--color-brand-blue)] transition-opacity",
                          active ? "opacity-100" : "opacity-0",
                        )}
                        aria-hidden
                      />
                      <item.icon
                        className={cn(
                          "size-4 transition-colors",
                          active
                            ? "text-[var(--color-brand-blue)]"
                            : "text-muted-foreground group-hover/item:text-foreground",
                        )}
                      />
                      <span className="flex-1">{item.label}</span>
                      {item.badge && (
                        <span className="rounded-full bg-[var(--color-brand-red)] px-1.5 py-0.5 text-[10px] font-bold text-white">
                          {item.badge}
                        </span>
                      )}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </nav>

      <div className="border-t border-border bg-white p-3">
        <div className="flex items-center gap-3 rounded-xl border border-border bg-gradient-to-br from-[var(--color-brand-blue-light)]/40 to-white p-3">
          <span
            aria-hidden
            className="grid size-10 shrink-0 place-items-center rounded-full bg-gradient-to-br from-[var(--color-brand-blue)] to-[#3B82F6] text-xs font-bold text-white shadow-md"
          >
            {initials || "C"}
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold text-foreground">
              {user.name ?? user.email ?? "Carrier"}
            </p>
            <p className="truncate text-[10px] font-bold uppercase tracking-wide text-muted-foreground">
              {user.role.toLowerCase()}
            </p>
          </div>
          <form action={signOutAction}>
            <button
              type="submit"
              title="Αποσύνδεση"
              className="grid size-8 place-items-center rounded-lg text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
            >
              <LogOut className="size-4" />
            </button>
          </form>
        </div>
      </div>
    </aside>
  );
}
