"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  LayoutDashboard,
  LogOut,
  PackageOpen,
  Settings,
  User,
} from "lucide-react";

import { cn } from "@/lib/utils";
import { buttonVariants } from "@/components/ui/button";
import { signOutAction } from "@/server/actions/auth-providers.action";

interface SessionUser {
  id: string;
  name?: string | null;
  email?: string | null;
  image?: string | null;
}

export function UserMenu({ user }: { user: SessionUser | null }) {
  const [open, setOpen] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (!wrapperRef.current?.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  if (!user) {
    return (
      <div className="hidden items-center gap-2 lg:flex">
        <Link
          href="/sign-in"
          className={cn(buttonVariants({ variant: "ghost" }), "h-10 px-4 text-sm")}
        >
          Σύνδεση
        </Link>
        <Link
          href="/scan"
          className={cn(
            buttonVariants({ variant: "default" }),
            "h-10 px-5 text-sm shadow-[var(--shadow-cta)]",
          )}
        >
          Δωρεάν αίτημα
        </Link>
      </div>
    );
  }

  const displayName = user.name ?? user.email ?? "Λογαριασμός";
  const initials = (user.name ?? user.email ?? "??")
    .split(/[\s@]/)
    .map((p) => p[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();

  return (
    <div className="hidden lg:flex" ref={wrapperRef}>
      <Link
        href="/scan"
        className={cn(
          buttonVariants({ variant: "default" }),
          "mr-2 h-10 px-5 text-sm shadow-[var(--shadow-cta)]",
        )}
      >
        Νέο αίτημα
      </Link>
      <div className="relative">
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          className="flex h-10 items-center gap-2 rounded-full border border-border bg-card px-2 pr-3 text-sm font-medium text-foreground transition-colors hover:border-[var(--color-brand-blue)]/40 hover:bg-secondary"
        >
          <span
            aria-hidden
            className="grid size-7 place-items-center rounded-full bg-[var(--color-brand-blue)] text-[11px] font-bold text-white"
          >
            {initials || "U"}
          </span>
          <span className="max-w-[160px] truncate">{displayName}</span>
        </button>

        {open && (
          <div className="absolute right-0 top-full z-50 mt-2 w-64 overflow-hidden rounded-2xl border border-border bg-card shadow-[var(--shadow-pop)]">
            <div className="border-b border-border p-4">
              <p className="truncate font-semibold text-foreground">
                {user.name ?? "Χωρίς όνομα"}
              </p>
              {user.email && (
                <p className="truncate text-xs text-muted-foreground">
                  {user.email}
                </p>
              )}
            </div>
            <ul className="p-1.5">
              <MenuItem
                href="/dashboard"
                icon={LayoutDashboard}
                label="Ο πίνακάς μου"
                onClick={() => setOpen(false)}
              />
              <MenuItem
                href="/dashboard/requests"
                icon={PackageOpen}
                label="Τα αιτήματά μου"
                onClick={() => setOpen(false)}
              />
              <MenuItem
                href="/dashboard/profile"
                icon={User}
                label="Προφίλ"
                onClick={() => setOpen(false)}
              />
              <MenuItem
                href="/dashboard/settings"
                icon={Settings}
                label="Ρυθμίσεις"
                onClick={() => setOpen(false)}
              />
              <li className="my-1 h-px bg-border" />
              <li>
                <form action={signOutAction}>
                  <button
                    type="submit"
                    className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left text-sm font-medium text-destructive transition-colors hover:bg-destructive/5"
                  >
                    <LogOut className="size-4" />
                    Αποσύνδεση
                  </button>
                </form>
              </li>
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}

function MenuItem({
  href,
  icon: Icon,
  label,
  onClick,
}: {
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  onClick?: () => void;
}) {
  return (
    <li>
      <Link
        href={href}
        onClick={onClick}
        className="flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium text-foreground transition-colors hover:bg-secondary"
      >
        <Icon className="size-4 text-muted-foreground" />
        {label}
      </Link>
    </li>
  );
}
