# PROMPTS.md — Reusable Claude Code Prompts

> Copy-paste prompts για συνηθισμένες εργασίες ανάπτυξης. Πάντα διασφάλιζε ότι το Claude Code έχει διαβάσει το `CLAUDE.md` πρώτα.

---

## 0. Bootstrap session

```
Διάβασε το CLAUDE.md, το docs/01-architecture.md, και το docs/02-database.md.
Μετά πες μου σε ποιο sprint είμαστε (βλ. docs/09-sprint-plan.md) και τι έχει
ολοκληρωθεί μέχρι τώρα.
```

---

## 1. Bootstrap Next.js 16.2 project

```
Δημιούργησε ένα Next.js 16.2.4 project με App Router, TypeScript strict mode,
Tailwind CSS 4.1, και shadcn/ui. Ακολούθησε τη δομή φακέλων στο
docs/01-architecture.md. Εγκατάστησε τις εξής εξαρτήσεις:

- @prisma/client, prisma
- next-auth@beta (v5), @auth/prisma-adapter
- @hookform/resolvers, react-hook-form, zod
- @google/generative-ai
- gsap, @gsap/react
- bullmq, ioredis
- @aws-sdk/client-s3
- bcryptjs, @types/bcryptjs
- sonner, lucide-react, date-fns
- next-intl
- @sentry/nextjs, posthog-js
- pino, pino-pretty

Setup tsconfig.json paths (@/* alias), eslint, prettier, husky pre-commit hook.
```

---

## 2. Initial Prisma + DB setup

```
1. Αντίγραψε το prisma/schema.prisma από το deliverable στο current project.
2. Δημιούργησε src/lib/db.ts με singleton pattern.
3. Δημιούργησε src/lib/env.ts με zod-validated process.env.
4. Έλεγξε ότι DATABASE_URL είναι postgres://… και ότι το postgis extension
   είναι enabled στο Aiven.
5. Run: pnpm prisma generate && pnpm prisma migrate dev --name init
6. Δημιούργησε μια manual migration για τα GIST indexes (βλ. docs/02-database.md).
7. Γράψε prisma/seed.ts με 3 admin users, 5 carrier accounts, 10 demo consumers.
```

---

## 3. Auth.js v5 setup

```
Setup το Auth.js v5 σύμφωνα με το docs/03-auth.md. Δημιούργησε:

- src/lib/auth.config.ts (edge-compatible)
- src/lib/auth.ts (full config με Prisma adapter, Credentials, Google, Resend)
- src/middleware.ts
- src/types/next-auth.d.ts
- src/app/api/auth/[...nextauth]/route.ts
- src/app/(auth)/sign-in/page.tsx με shadcn Form
- src/app/(auth)/sign-up/page.tsx
- Server Action src/server/actions/auth.action.ts με createConsumerAccount

Όλα τα UI strings στα Ελληνικά (next-intl).
```

---

## 4. Δημιουργία νέου feature

```
Sprint X, ticket Υ — [Feature name]

Context:
- [Σε ποιον user role απευθύνεται]
- [User story]
- [Business rules]

Acceptance criteria:
- [ ] [...]
- [ ] [...]

Παρακαλώ:
1. Διάβασε CLAUDE.md και τα relevant docs.
2. Σχεδίασε σύντομα: ποια schema αλλάζει, ποιο service γράφεις, ποιο route.
3. Implement:
   - Prisma migration (αν χρειάζεται)
   - zod validator στο src/lib/validators/
   - Service function στο src/server/services/
   - Server Action στο src/server/actions/
   - UI component στο src/components/<role>/
   - Page αν χρειάζεται
4. Γράψε ένα Vitest test για το service.
5. Γράψε ένα Playwright E2E αν είναι user-facing.
6. Run typecheck + lint + tests.
```

---

## 5. Add a shadcn component

```
Χρειαζόμαστε το <ComponentName> από shadcn/ui. Run:
  pnpm dlx shadcn@latest add <name>

Μετά χρησιμοποίησέ το στο <file path>, ακολουθώντας το design language του
docs/07-frontend.md (Calibri/Inter, brand cyan #3DA9FC accent, etc.).
```

---

## 6. AI vision integration

```
Implement το AI vision scan flow σύμφωνα με docs/04-ai-vision.md:

1. Mobile camera component με 3 angles overlay
2. Upload σε S3 με presigned URL
3. Edge function: face blur + EXIF strip
4. Trigger vision.queue job
5. Worker: καλεί Gemini, parse JSON, compute volumetric, save στο DB
6. Real-time UI updates: status badges, item list emerging

UX rules:
- Friction στο upload < 30 sec total
- Αν AI confidence < 0.85, prompt user να ξανα-φωτογραφήσει
- Πάντα δείξε raw photos στον carrier πριν την προσφορά
```

---

## 7. Viva Wallet payment integration

```
Σύμφωνα με docs/06-fintech.md, implement το Viva escrow flow:

1. src/lib/viva/client.ts (OAuth)
2. src/lib/viva/checkout.ts (createPaymentOrder, captureCharge, refund)
3. src/lib/viva/webhooks.ts (signature verification)
4. src/app/api/payments/viva/webhook/route.ts
5. src/server/services/payment.service.ts (state machine)
6. €1 entry fee flow στο /scan/[id]/checkout
7. Booking pre-auth flow στο /quotes/[id]/accept
8. QR code generation + scan για delivery confirmation

Test με Viva demo merchant. Όλες οι transactions logged στο audit_log.
```

---

## 8. PostGIS Shared-Load matching

```
Implement το Shared-Load Algorithm σύμφωνα με docs/05-shared-load.md.
Συγκεκριμένα:

1. Add GIST indexes στο migration (manual SQL)
2. publishSharedLoad Server Action για carrier
3. findMatchCandidates spatial query με ST_DWithin, ST_Intersects
4. Pricing service με tier-based discount calculation
5. Match queue job: κάθε 30s scans OPEN auctions, προσθέτει shared bids
6. Carrier UI: SharedLoadFeed component στο /carrier/dashboard

Validate με test data: 3 διαδρομές Αθήνα-Θεσσαλονίκη που πρέπει να
βρουν match εντός 15km buffer.
```

---

## 9. myDATA invoicing

```
Implement AADE myDATA integration σύμφωνα με docs/06-fintech.md μέρος Β:

1. src/lib/mydata/client.ts
2. src/lib/mydata/invoice.builder.ts (XML σύμφωνα με AADE XSD)
3. invoice.queue worker με exponential backoff retry
4. issueInvoiceForBooking service function
5. PDF generation με PDFKit (Greek fonts, brand template)
6. /carrier/billing UI: λίστα invoices, status, mark, PDF download
7. Customer email με invoice attachment

Test σε AADE dev sandbox. Αν fail, retry x5, μετά flag for manual review.
```

---

## 10. Add a Server Action

```
Δημιούργησε ένα νέο Server Action: <name>

Inputs: <fields>
Auth: <required role>
Validation: zod schema στο src/lib/validators/<area>.schemas.ts
Service call: <serviceName>(...)
Side effects: revalidatePath('/...'), notification, etc.
Result type: Result<T> = { ok: true; data: T } | { ok: false; error: string }

Greek error messages user-friendly. Audit log entry. Sentry breadcrumb.
```

---

## 11. Code review prompt

```
Κάνε review αυτό το PR/diff. Έλεγξε:

1. CLAUDE.md hard rules — δεν παραβιάστηκαν;
2. Prisma migration — naming, idempotency, reversibility
3. Zod validators — comprehensive, shared client+server
4. Server Action — auth check, validation, error handling, audit log
5. UI — από shadcn only, no custom buttons, accessibility, mobile viewport
6. Greek copy — όχι hardcoded αγγλικά strings
7. Tests — unit + E2E coverage για new code
8. Security — no leaked secrets, SQL injection safe, GDPR compliant
9. Performance — N+1 queries, missing indexes
10. Bundle size — αν προστέθηκε client lib > 10KB, justify
```

---

## 12. Refactor τρεχοντος feature

```
Refactor το <feature name>. Στόχοι:

- [...]
- [...]

Constraints:
- Όχι breaking changes σε public API
- Όχι data migrations σε production tables (μόνο additive)
- Πρέπει να περάσουν όλα τα υπάρχοντα tests
- Νέα tests αν βελτιώνεται κάλυψη

Παράδωσε:
1. Πλάνο refactoring (μικρά PRs ή ένα μεγάλο;)
2. Implementation
3. Updated tests
4. Migration plan για production (αν χρειάζεται feature flag)
```

---

## 13. Debug ένα production issue

```
Production incident. Sentry issue: <link or trace ID>

Symptoms:
- [...]

Σε ποιο service / route εμφανίζεται;
Πότε ξεκίνησε; (deployment, traffic spike, third-party outage;)

Παρακαλώ:
1. Reproduce locally αν είναι δυνατό
2. Root cause analysis (όχι μόνο symptom fix)
3. Hotfix με tests
4. Sentry breadcrumbs για observability
5. Post-mortem doc στο docs/postmortems/YYYY-MM-DD-<title>.md
```

---

## 14. Add observability

```
Στο <feature/path>:

1. Sentry breadcrumbs σε critical operations
2. Sentry custom errors με tagging (`scope.setTag('module', 'shared-load')`)
3. PostHog events: <list events>
4. Pino log entries σε key state transitions
5. Custom metric στο Grafana dashboard αν είναι volume-sensitive
```

---

## 15. Run quality checks πριν commit

```
Πριν κάνω commit:

1. pnpm typecheck
2. pnpm lint --fix
3. pnpm format
4. pnpm test
5. pnpm prisma format
6. Διάβασε τα changes ξανά (git diff --staged)

Αν όλα green, commit με conventional commit message.
```

---

## Tips για να μιλάς στο Claude Code

- **Πάντα στα Ελληνικά** εκτός από code identifiers.
- Όταν έχεις context-window space, κόλλησε ολόκληρο το ticket / acceptance criteria.
- Αν βλέπεις Claude να αλλάζει stack ή να εγκαθιστά νέο dependency: stop και ρώτα γιατί.
- Αν το PR γίνεται μεγάλο, σπάστο σε commits ανά layer (migration → service → action → ui → tests).
- Χρησιμοποίησε `Plan` agent (`Plan ...`) για σύνθετα tasks πριν την implementation.
- Όταν refactoring χωρίς proper test coverage, ζήτησε πρώτα να γραφτούν χαρακτηριστικά tests.
