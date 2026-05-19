import Link from "next/link";
import { ArrowRight, BarChart3, Calendar, TrendingUp, Users } from "lucide-react";

import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";

const BENEFITS = [
  { icon: Users, title: "Νέοι πελάτες κάθε μέρα", desc: "Λάμβανε αιτήματα από την περιοχή σου χωρίς κόπο." },
  { icon: TrendingUp, title: "Καλύτερη πληρότητα", desc: "Γέμισε τα κενά δρομολόγια με shared loads." },
  { icon: Calendar, title: "Έλεγχος προγράμματος", desc: "Επίλεξε ποιες δουλειές αναλαμβάνεις και πότε." },
  { icon: BarChart3, title: "Στατιστικά & insights", desc: "Δες αξιολογήσεις, response time, conversion." },
] as const;

export function CarrierCta() {
  return (
    <section
      id="carriers"
      className="relative overflow-hidden border-b border-border bg-[var(--color-brand-blue-deep)] py-20 text-white sm:py-24"
    >
      <div
        className="absolute inset-0 -z-10 opacity-30"
        style={{
          backgroundImage:
            "radial-gradient(circle at 20% 20%, rgba(255,255,255,0.18), transparent 40%), radial-gradient(circle at 80% 80%, rgba(239,68,68,0.18), transparent 40%)",
        }}
        aria-hidden
      />

      <div className="mx-auto grid max-w-[1280px] gap-12 px-4 sm:px-6 lg:grid-cols-[1.1fr_0.9fr] lg:items-center lg:px-8">
        <div>
          <Badge className="bg-white/10 text-white border-transparent gap-2">
            Για επαγγελματίες μεταφορείς
          </Badge>
          <h2 className="mt-3 font-display text-3xl font-bold leading-tight tracking-tight sm:text-4xl">
            Νέα αιτήματα κάθε μέρα. Εσύ επιλέγεις ποια θα κερδίσεις.
          </h2>
          <p className="mt-3 max-w-lg text-base text-white/80">
            Εγγραφή σε λίγα λεπτά, επαλήθευση ΑΦΜ, και ξεκινάς να βλέπεις
            αιτήματα στην περιοχή σου. Πληρώνεσαι μέσα από την πλατφόρμα,
            με αυτόματη έκδοση παραστατικού μέσω AADE myDATA.
          </p>

          <div className="mt-6 flex flex-col gap-3 sm:flex-row">
            <Link
              href="/sign-up?as=carrier"
              className={cn(
                buttonVariants({ variant: "default" }),
                "h-12 bg-[var(--color-brand-red)] px-6 text-base text-white shadow-[var(--shadow-cta-red)] hover:bg-[var(--color-brand-red-deep)]",
              )}
            >
              Γίνε μεταφορέας
              <ArrowRight className="ml-1 size-4" />
            </Link>
            <Link
              href="/sign-in"
              className={cn(
                buttonVariants({ variant: "outline" }),
                "h-12 border-white/30 bg-transparent px-6 text-base text-white hover:bg-white/10",
              )}
            >
              Έχω ήδη λογαριασμό
            </Link>
          </div>
        </div>

        <ul className="grid gap-3 sm:grid-cols-2">
          {BENEFITS.map((b) => (
            <li
              key={b.title}
              className="flex h-full flex-col gap-3 rounded-2xl border border-white/10 bg-white/[0.06] p-5 backdrop-blur"
            >
              <span className="grid size-10 place-items-center rounded-xl bg-white/10 text-white">
                <b.icon className="size-5" />
              </span>
              <div>
                <h3 className="text-base font-semibold text-white">{b.title}</h3>
                <p className="mt-1 text-sm leading-relaxed text-white/75">
                  {b.desc}
                </p>
              </div>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
