import { Star, ShieldCheck, Users, Award, Truck } from "lucide-react";

const ITEMS = [
  {
    icon: Star,
    iconClass: "fill-amber-400 stroke-amber-400",
    value: "4.8 / 5",
    label: "από 12.500+ πελάτες",
  },
  {
    icon: Truck,
    value: "1.200+",
    label: "επαληθευμένοι μεταφορείς",
  },
  {
    icon: Users,
    value: "85.000+",
    label: "μεταφορές έχουν ολοκληρωθεί",
  },
  {
    icon: ShieldCheck,
    value: "100%",
    label: "ασφάλεια πληρωμών μέσω escrow",
  },
  {
    icon: Award,
    value: "12 χρόνια",
    label: "εμπειρία στις μεταφορές",
  },
] as const;

export function TrustRibbon() {
  return (
    <section
      aria-label="Στατιστικά εμπιστοσύνης"
      className="border-b border-border bg-card"
    >
      <div className="mx-auto max-w-[1280px] px-4 sm:px-6 lg:px-8">
        <ul className="grid grid-cols-2 divide-y divide-border md:grid-cols-5 md:divide-y-0 md:divide-x">
          {ITEMS.map((item, i) => (
            <li
              key={item.value + i}
              className="flex items-center gap-3 py-5 md:justify-center md:px-4 md:py-6"
            >
              <span className="grid size-10 place-items-center rounded-xl bg-[var(--color-brand-blue-light)] text-[var(--color-brand-blue-deep)]">
                <item.icon
                  className={`size-5 ${"iconClass" in item ? item.iconClass : ""}`}
                />
              </span>
              <span className="flex flex-col leading-tight">
                <span className="font-display text-base font-bold text-foreground sm:text-lg">
                  {item.value}
                </span>
                <span className="text-xs text-muted-foreground">
                  {item.label}
                </span>
              </span>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
