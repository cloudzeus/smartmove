import Link from "next/link";
import { ArrowRight, HelpCircle, MessageCircle, Phone } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { FaqItem } from "./faq-item";

const FAQS = [
  {
    q: "Είναι δωρεάν η χρήση του SmartMove;",
    a: "Ναι, η δημοσίευση αιτήματος μεταφοράς και η λήψη προσφορών είναι 100% δωρεάν για τον πελάτη. Πληρώνεις μόνο τον μεταφορέα που θα επιλέξεις — και μόνο αφού συμφωνήσετε.",
  },
  {
    q: "Σε πόση ώρα θα λάβω προσφορές;",
    a: "Οι πρώτες προσφορές φτάνουν συνήθως μέσα σε 30-60 λεπτά. Μέσα στις πρώτες 24 ώρες λαμβάνεις κατά μέσο όρο 4-7 προσφορές από διαφορετικούς μεταφορείς.",
  },
  {
    q: "Πώς ξέρω ότι ο μεταφορέας είναι αξιόπιστος;",
    a: "Κάθε μεταφορέας στο SmartMove είναι επιβεβαιωμένος: έχουμε ελέγξει ΑΦΜ, άδειες, ασφαλιστική κάλυψη και στοιχεία εταιρείας. Επιπλέον βλέπεις πραγματικές αξιολογήσεις από προηγούμενες μεταφορές.",
  },
  {
    q: "Πώς είναι ασφαλής η πληρωμή;",
    a: "Χρησιμοποιούμε ασφαλές escrow: το ποσό δεσμεύεται μέσω Viva Wallet αλλά αποδίδεται στον μεταφορέα μόνο αφού επιβεβαιώσεις την παράδοση με QR code. Αν κάτι πάει στραβά, παίρνεις τα χρήματά σου πίσω.",
  },
  {
    q: "Τι κάνει το AI σκανάρισμα αντικειμένων;",
    a: "Φωτογραφίζεις τα έπιπλα ή τα κουτιά σου και η τεχνητή νοημοσύνη υπολογίζει αυτόματα διαστάσεις και συνολικό όγκο σε m³. Έτσι οι μεταφορείς δίνουν ακριβέστερες προσφορές χωρίς να χρειαστεί να έρθουν σπίτι σου.",
  },
  {
    q: "Τι είναι το Shared Load;",
    a: "Αν η διαδρομή σου ταιριάζει με άλλη ήδη προγραμματισμένη μεταφορά (π.χ. Αθήνα → Θεσσαλονίκη), μοιραζόμαστε το όχημα — εσύ πληρώνεις έως 50% λιγότερο και το περιβάλλον γλιτώνει εκπομπές CO₂.",
  },
  {
    q: "Μπορώ να ακυρώσω αφού δεχτώ προσφορά;",
    a: "Ναι. Μπορείς να ακυρώσεις δωρεάν μέχρι 48 ώρες πριν την προγραμματισμένη μεταφορά. Μετά εφαρμόζεται μικρή χρέωση κάλυψης εξόδων του μεταφορέα.",
  },
  {
    q: "Εκδίδεται τιμολόγιο ή απόδειξη;",
    a: "Φυσικά. Κάθε μεταφορέας στην πλατφόρμα μας εκδίδει νόμιμο παραστατικό αυτόματα μέσω AADE myDATA, το οποίο λαμβάνεις στο email σου μόλις ολοκληρωθεί η μεταφορά.",
  },
] as const;

export function Faq() {
  return (
    <section
      id="faq"
      className="border-b border-border bg-background py-20 sm:py-24"
    >
      <div className="mx-auto grid max-w-[1280px] gap-12 px-4 sm:px-6 lg:grid-cols-[0.85fr_1.15fr] lg:gap-16 lg:px-8">
        <div className="lg:sticky lg:top-24 lg:self-start">
          <Badge variant="default" className="gap-1.5">
            <HelpCircle className="size-3.5" />
            Συχνές ερωτήσεις
          </Badge>
          <h2 className="mt-3 font-display text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
            Όλα όσα θες να ξέρεις πριν ξεκινήσεις
          </h2>
          <p className="mt-3 text-base text-muted-foreground">
            Δεν βρίσκεις απάντηση; Η ομάδα μας είναι διαθέσιμη κάθε μέρα από
            08:00 έως 22:00.
          </p>

          <div className="mt-6 flex flex-col gap-3">
            <a
              href="tel:+302103000450"
              className="group flex items-center gap-3 rounded-2xl border border-border bg-card p-4 transition-all hover:border-[var(--color-brand-blue)]/40 hover:shadow-[var(--shadow-card)]"
            >
              <span className="grid size-11 place-items-center rounded-xl bg-[var(--color-brand-blue)] text-white">
                <Phone className="size-5" />
              </span>
              <span className="flex flex-col">
                <span className="text-xs text-muted-foreground">
                  Τηλεφωνική υποστήριξη
                </span>
                <span className="font-display text-base font-bold text-foreground">
                  210 3000 450
                </span>
              </span>
            </a>
            <Link
              href="#"
              className="group flex items-center gap-3 rounded-2xl border border-border bg-card p-4 transition-all hover:border-[var(--color-brand-blue)]/40 hover:shadow-[var(--shadow-card)]"
            >
              <span className="grid size-11 place-items-center rounded-xl bg-[var(--color-brand-blue-light)] text-[var(--color-brand-blue-deep)]">
                <MessageCircle className="size-5" />
              </span>
              <span className="flex flex-1 flex-col">
                <span className="text-xs text-muted-foreground">
                  Live chat
                </span>
                <span className="font-display text-base font-bold text-foreground">
                  Ξεκίνα συζήτηση
                </span>
              </span>
              <ArrowRight className="size-4 text-muted-foreground transition-transform group-hover:translate-x-1" />
            </Link>
          </div>
        </div>

        <ul className="flex flex-col gap-3">
          {FAQS.map((item, i) => (
            <li key={item.q}>
              <FaqItem q={item.q} a={item.a} defaultOpen={i === 0} />
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
