"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BarChart3,
  Building2,
  CalendarDays,
  ClipboardCheck,
  ClipboardList,
  FolderKanban,
  Handshake,
  Inbox,
  LayoutDashboard,
  LayoutGrid,
  LogOut,
  MapPin,
  Receipt,
  Tag,
  Settings,
  ShieldCheck,
  Star,
  Truck,
  UserCog,
  Users,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

import { cn } from "@/lib/utils";
import { Logo } from "@/components/brand/logo";
import { signOutAction } from "@/server/actions/auth-providers.action";

interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
  exact?: boolean;
  /** Badge key resolved against `badges` prop. */
  badgeKey?: keyof Badges;
}

interface NavGroup {
  label: string;
  items: NavItem[];
}

export interface Badges {
  newLeads?: number;
  openOffers?: number;
  activeJobs?: number;
  pendingReviews?: number;
}

const NAV_GROUPS: NavGroup[] = [
  {
    label: "Έργο",
    items: [
      { href: "/carrier", label: "Επισκόπηση", icon: LayoutDashboard, exact: true },
      { href: "/carrier/leads", label: "Νέα αιτήματα", icon: Inbox, badgeKey: "newLeads" },
      { href: "/carrier/offers", label: "Προσφορές μου", icon: Receipt, badgeKey: "openOffers" },
      { href: "/carrier/jobs", label: "Μεταφορές", icon: Truck, badgeKey: "activeJobs" },
      { href: "/carrier/projects", label: "Projects", icon: FolderKanban },
      { href: "/carrier/tasks", label: "Εργασίες", icon: ClipboardCheck },
      { href: "/carrier/calendar", label: "Ημερολόγιο", icon: CalendarDays },
      { href: "/carrier/reviews", label: "Αξιολογήσεις", icon: Star, badgeKey: "pendingReviews" },
      { href: "/carrier/reports", label: "Αναφορές", icon: BarChart3 },
    ],
  },
  {
    label: "Ομάδα & Στόλος",
    items: [
      { href: "/carrier/fleet", label: "Στόλος", icon: Truck },
      { href: "/carrier/employees", label: "Υπάλληλοι", icon: UserCog },
      { href: "/carrier/partners", label: "Συνεργάτες", icon: Handshake },
      { href: "/carrier/pricing", label: "Τιμολόγιο", icon: Tag },
    ],
  },
  {
    label: "Εταιρεία",
    items: [
      { href: "/carrier/branches", label: "Υποκαταστήματα", icon: MapPin },
      { href: "/carrier/team", label: "Διαχείριση χρηστών", icon: Users },
      { href: "/carrier/billing", label: "Συνδρομή", icon: ClipboardList },
      { href: "/carrier/settings", label: "Ρυθμίσεις", icon: Settings },
    ],
  },
];

interface Props {
  user: { name?: string | null; email?: string | null; role: string };
  tenantName?: string | null;
  canAccessAdmin?: boolean;
  badges?: Badges;
}

export function CarrierSidebar({
  user,
  tenantName,
  canAccessAdmin,
  badges = {},
}: Props) {
  const path = usePathname();
  const initials = (user.name ?? user.email ?? "??")
    .split(/[\s@]/)
    .map((p) => p[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();

  return (
    <aside className="sticky top-0 hidden h-screen w-[244px] shrink-0 flex-col self-start border-r border-border bg-sidebar lg:flex">
      <div className="flex h-14 items-center gap-2 border-b border-border px-4">
        <Link href="/" className="-m-1.5 rounded-md p-1.5">
          <Logo />
        </Link>
        <span className="ml-auto inline-flex items-center gap-1 rounded-sm border border-border px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
          <Truck className="size-3" />
          Carrier
        </span>
      </div>

      {tenantName && (
        <div className="border-b border-border px-4 py-2.5">
          <p className="cx-eyebrow">Εταιρεία</p>
          <p className="mt-0.5 truncate text-sm font-medium text-foreground">
            {tenantName}
          </p>
        </div>
      )}

      <div className="border-b border-border px-3 py-2.5 space-y-1">
        <Link
          href="/dashboard"
          className="group flex h-8 items-center gap-2 rounded-sm px-2 text-xs font-medium text-muted-foreground cx-transition hover:bg-[var(--cx-hover)] hover:text-foreground"
        >
          <LayoutGrid className="size-3.5" />
          Customer view
          <span className="ml-auto text-[10px] uppercase tracking-wide text-muted-foreground/70 group-hover:text-foreground">
            Switch
          </span>
        </Link>
        {canAccessAdmin && (
          <Link
            href="/admin"
            className="flex h-8 items-center gap-2 rounded-sm px-2 text-xs font-medium text-muted-foreground cx-transition hover:bg-[var(--cx-hover)] hover:text-foreground"
          >
            <ShieldCheck className="size-3.5" />
            Πίνακας διαχείρισης
            <span className="ml-auto text-[10px] uppercase tracking-wide text-muted-foreground/70">
              Admin
            </span>
          </Link>
        )}
      </div>

      <nav className="flex flex-1 flex-col gap-3 overflow-y-auto px-2 py-3">
        {NAV_GROUPS.map((group) => (
          <div key={group.label}>
            <p className="cx-eyebrow mb-1 px-2">{group.label}</p>
            <ul className="flex flex-col">
              {group.items.map((item) => {
                const active = item.exact
                  ? path === item.href
                  : path === item.href || path.startsWith(`${item.href}/`);
                const badge = item.badgeKey ? badges[item.badgeKey] : undefined;
                return (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      className={cn(
                        "group/item relative flex h-8 items-center gap-2.5 rounded-sm px-2 text-[13px] font-medium cx-transition",
                        active
                          ? "bg-[var(--cx-accent-soft)] text-foreground"
                          : "text-muted-foreground hover:bg-[var(--cx-hover)] hover:text-foreground",
                      )}
                    >
                      <span
                        aria-hidden
                        className={cn(
                          "absolute left-0 top-1/2 h-4 w-0.5 -translate-y-1/2 rounded-r-full bg-[var(--cx-accent)] cx-transition",
                          active ? "opacity-100" : "opacity-0",
                        )}
                      />
                      <item.icon
                        className={cn(
                          "size-3.5",
                          active ? "text-[var(--cx-accent)]" : "text-muted-foreground/80",
                        )}
                      />
                      <span className="flex-1 truncate">{item.label}</span>
                      {badge !== undefined && badge > 0 && (
                        <span className="min-w-[18px] rounded-full px-1 text-center text-[10px] font-medium tabular-nums text-muted-foreground ring-1 ring-inset ring-border/70">
                          {badge > 99 ? "99+" : badge}
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

      <div className="border-t border-border p-2">
        <div className="flex items-center gap-2.5 rounded-sm px-2 py-1.5">
          <span
            aria-hidden
            className="grid size-7 shrink-0 place-items-center rounded-full bg-muted text-[10px] font-medium text-foreground"
          >
            {initials || "C"}
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-xs font-medium text-foreground">
              {user.name ?? user.email ?? "Carrier"}
            </p>
            <p className="truncate text-[10px] uppercase tracking-wide text-muted-foreground">
              {user.role.toLowerCase()}
            </p>
          </div>
          <form action={signOutAction}>
            <button
              type="submit"
              title="Αποσύνδεση"
              className="grid size-7 place-items-center rounded-sm text-muted-foreground cx-transition hover:bg-[var(--cx-hover)] hover:text-foreground"
            >
              <LogOut className="size-3.5" />
            </button>
          </form>
        </div>
      </div>
    </aside>
  );
}

// ---------------- Mobile bottom navigation ----------------

const MOBILE_NAV: { href: string; label: string; icon: LucideIcon; exact?: boolean; badgeKey?: keyof Badges }[] = [
  { href: "/carrier", label: "Επισκόπηση", icon: LayoutDashboard, exact: true },
  { href: "/carrier/leads", label: "Αιτήματα", icon: Inbox, badgeKey: "newLeads" },
  { href: "/carrier/offers", label: "Προσφορές", icon: Receipt, badgeKey: "openOffers" },
  { href: "/carrier/jobs", label: "Μεταφορές", icon: Truck, badgeKey: "activeJobs" },
  { href: "/carrier/fleet", label: "Στόλος", icon: BarChart3 },
];

export function CarrierBottomNav({ badges = {} }: { badges?: Badges }) {
  const path = usePathname();
  return (
    <nav
      aria-label="Πλοήγηση μεταφορέα"
      className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-card/95 backdrop-blur pb-[env(safe-area-inset-bottom)] lg:hidden"
    >
      <ul className="grid grid-cols-5 items-stretch">
        {MOBILE_NAV.map((item) => {
          const active = item.exact
            ? path === item.href
            : path === item.href || path.startsWith(`${item.href}/`);
          const badge = item.badgeKey ? badges[item.badgeKey] : undefined;
          return (
            <li key={item.href}>
              <Link
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "relative flex h-full min-h-[56px] flex-col items-center justify-center gap-1 px-1 text-[10px] font-semibold transition-colors active:bg-secondary/60",
                  active ? "text-[var(--color-brand-blue)]" : "text-muted-foreground",
                )}
              >
                {active && (
                  <span
                    aria-hidden
                    className="absolute inset-x-6 top-0 h-0.5 rounded-b-full bg-[var(--color-brand-blue)]"
                  />
                )}
                <span className="relative">
                  <item.icon className="size-[22px]" />
                  {badge !== undefined && badge > 0 && (
                    <span className="absolute -right-2 -top-1.5 min-w-[16px] rounded-full bg-[var(--color-brand-red)] px-1 text-center text-[9px] font-bold leading-4 text-white">
                      {badge > 9 ? "9+" : badge}
                    </span>
                  )}
                </span>
                <span className="truncate text-center leading-none">
                  {item.label}
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
