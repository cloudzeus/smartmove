import Link from "next/link";

import { Logo } from "@/components/brand/logo";
import { Separator } from "@/components/ui/separator";

const FOOTER_GROUPS: Array<{
  title: string;
  links: Array<{ href: string; label: string }>;
}> = [
  {
    title: "Πλατφόρμα",
    links: [
      { href: "/scan", label: "Δημιουργία αιτήματος" },
      { href: "/#how-it-works", label: "Πώς λειτουργεί" },
      { href: "/#categories", label: "Κατηγορίες μεταφοράς" },
      { href: "/#trust", label: "Εμπιστοσύνη & ασφάλεια" },
    ],
  },
  {
    title: "Για μεταφορείς",
    links: [
      { href: "/#carriers", label: "Γίνε μεταφορέας" },
      { href: "/sign-in", label: "Είσοδος μεταφορέα" },
      { href: "/#carriers", label: "Πώς λαμβάνεις αιτήματα" },
      { href: "/#carriers", label: "Προμήθειες & πληρωμές" },
    ],
  },
  {
    title: "Εταιρεία",
    links: [
      { href: "#", label: "Σχετικά με εμάς" },
      { href: "#", label: "Επικοινωνία" },
      { href: "#", label: "Καριέρα" },
      { href: "#", label: "Blog" },
    ],
  },
  {
    title: "Νομικά",
    links: [
      { href: "#", label: "Όροι χρήσης" },
      { href: "#", label: "Πολιτική απορρήτου" },
      { href: "#", label: "Cookies" },
      { href: "#", label: "GDPR" },
    ],
  },
];

export function SiteFooter() {
  const year = new Date().getFullYear();
  return (
    <footer className="mt-16 border-t border-border bg-card">
      <div className="mx-auto max-w-[1280px] px-4 py-12 sm:px-6 lg:px-8">
        <div className="grid grid-cols-2 gap-10 lg:grid-cols-6">
          <div className="col-span-2 max-w-sm">
            <Logo />
            <p className="mt-4 text-sm leading-relaxed text-muted-foreground">
              Marketplace μεταφορών και μετακομίσεων. Δημοσιεύεις, λαμβάνεις
              προσφορές, επιλέγεις τον μεταφορέα που σου ταιριάζει — γρήγορα,
              διαφανώς, με ασφάλεια.
            </p>
          </div>

          {FOOTER_GROUPS.map((group) => (
            <div key={group.title}>
              <h4 className="text-sm font-semibold text-foreground">
                {group.title}
              </h4>
              <ul className="mt-4 space-y-2.5">
                {group.links.map((link) => (
                  <li key={`${group.title}-${link.label}`}>
                    <Link
                      href={link.href}
                      className="text-sm text-muted-foreground transition-colors hover:text-foreground"
                    >
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <Separator className="my-10" />

        <div className="flex flex-col items-start justify-between gap-4 text-xs text-muted-foreground sm:flex-row sm:items-center">
          <p>© {year} SmartMove. Όλα τα δικαιώματα διατηρούνται.</p>
          <p className="flex items-center gap-2">
            <span className="inline-block size-2 rounded-full bg-emerald-500" />
            Λειτουργούμε στην Ελλάδα — σχεδιασμένο με προσοχή σε κάθε μεταφορά
          </p>
        </div>
      </div>
    </footer>
  );
}
