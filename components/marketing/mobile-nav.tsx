"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { LogOut, Menu, X } from "lucide-react";

import { cn } from "@/lib/utils";
import { buttonVariants } from "@/components/ui/button";
import { signOutAction } from "@/server/actions/auth-providers.action";

interface MobileNavProps {
  links: ReadonlyArray<{ href: string; label: string }>;
  signedIn?: boolean;
}

export function MobileNav({ links, signedIn = false }: MobileNavProps) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    document.body.style.overflow = open ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  return (
    <>
      <button
        type="button"
        aria-label={open ? "Κλείσιμο μενού" : "Άνοιγμα μενού"}
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className="inline-flex size-10 items-center justify-center rounded-lg border border-border bg-card text-foreground lg:hidden"
      >
        {open ? <X className="size-5" /> : <Menu className="size-5" />}
      </button>

      {open && (
        <div className="absolute inset-x-0 top-16 z-40 border-t border-border bg-background lg:hidden">
          <div className="mx-auto flex max-w-[1280px] flex-col gap-1 px-4 py-4 sm:px-6">
            {links.map((link) => (
              <Link
                key={link.href + link.label}
                href={link.href}
                onClick={() => setOpen(false)}
                className="rounded-md px-3 py-2 text-sm font-medium text-muted-foreground hover:bg-secondary hover:text-secondary-foreground"
              >
                {link.label}
              </Link>
            ))}
            <div className="mt-2 grid grid-cols-2 gap-2">
              {signedIn ? (
                <>
                  <Link
                    href="/dashboard"
                    onClick={() => setOpen(false)}
                    className={cn(buttonVariants({ variant: "outline" }), "h-11")}
                  >
                    Πίνακας
                  </Link>
                  <Link
                    href="/scan"
                    onClick={() => setOpen(false)}
                    className={cn(buttonVariants({ variant: "default" }), "h-11")}
                  >
                    Νέο αίτημα
                  </Link>
                </>
              ) : (
                <>
                  <Link
                    href="/sign-in"
                    onClick={() => setOpen(false)}
                    className={cn(buttonVariants({ variant: "outline" }), "h-11")}
                  >
                    Σύνδεση
                  </Link>
                  <Link
                    href="/scan"
                    onClick={() => setOpen(false)}
                    className={cn(buttonVariants({ variant: "default" }), "h-11")}
                  >
                    Νέο αίτημα
                  </Link>
                </>
              )}
            </div>
            {signedIn && (
              <form action={signOutAction} className="mt-2">
                <button
                  type="submit"
                  className="flex w-full items-center justify-center gap-2 rounded-lg border border-destructive/40 bg-destructive/5 px-3 py-2.5 text-sm font-semibold text-destructive"
                >
                  <LogOut className="size-4" />
                  Αποσύνδεση
                </button>
              </form>
            )}
          </div>
        </div>
      )}
    </>
  );
}
