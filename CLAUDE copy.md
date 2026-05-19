# CLAUDE.md — SmartMove AI

> **Αυτό το αρχείο διαβάζεται από κάθε νέα Claude Code session.**
> Περιέχει τα project conventions, το stack, και τους κανόνες που πρέπει να ακολουθούνται.

---

## 1. Τι είναι το SmartMove AI

Cross-sided marketplace μετακομίσεων με:
- **AI Computer Vision** (Gemini 1.5 Flash) → m³ inventory σε 10 δευτερόλεπτα
- **Shared-Load Algorithm** (PostGIS) → ομαδοποίηση δρομολογίων, −27% empty miles
- **Fintech-native** → Viva Wallet escrow + split + BNPL, AADE myDATA e-invoicing
- **Three-sided platform**: Ιδιώτες · Μεταφορικές · Ιδιώτες Δ.Χ.

Πλήρες business context: βλ. `SmartMove_AI_WhitePaper.docx` (100 σελίδες).

---

## 2. Tech Stack (LOCKED — μην το αλλάζεις)

| Layer | Τεχνολογία | Έκδοση |
|---|---|---|
| Framework | Next.js (App Router) | **16.2.4+** |
| Language | TypeScript | 5.6+ (strict) |
| ORM | Prisma | **6.x** |
| Database | **PostgreSQL + PostGIS** (Aiven managed) | 16 + 3.4 |
| Auth | **Auth.js v5** (NextAuth) | 5.x |
| UI | **shadcn/ui** + Tailwind CSS | TW 4.1 |
| Animation | **GSAP** + Framer Motion | latest |
| Forms | react-hook-form + zod | latest |
| State | Zustand (client) + React Server Actions | — |
| Queue | BullMQ + Redis | 7+ |
| Storage | AWS S3 (eu-central-1) | — |
| Maps | Google Maps Routing/Geocoding API | — |
| AI/Vision | Google Gemini 1.5 Flash | — |
| Payments | Viva Wallet API v2 | — |
| Invoicing | AADE myDATA REST | — |
| Testing | Vitest + Playwright | latest |
| Hosting | Vercel (web) + Railway (workers) | — |

---

## 3. Project Structure

```
smartmove-ai/
├── CLAUDE.md                  ← αυτό το αρχείο (πάντα διάβαζε πρώτο)
├── README.md
├── PROMPTS.md                 ← reusable prompts για Claude Code
├── .env.example
├── package.json
├── tsconfig.json
├── next.config.ts
├── tailwind.config.ts
├── components.json            ← shadcn config
│
├── prisma/
│   ├── schema.prisma          ← PostgreSQL + PostGIS (single)
│   ├── seed.ts
│   └── migrations/
│
├── docs/
│   ├── 00-getting-started.md
│   ├── 01-architecture.md
│   ├── 02-database.md
│   ├── 03-auth.md
│   ├── 04-ai-vision.md
│   ├── 05-shared-load.md
│   ├── 06-fintech.md
│   ├── 07-frontend.md
│   ├── 08-deployment.md
│   └── 09-sprint-plan.md
│
├── src/
│   ├── app/                   ← Next.js 16 App Router
│   │   ├── (marketing)/       ← public landing pages
│   │   ├── (auth)/            ← sign-in/up
│   │   ├── (consumer)/        ← ιδιώτες
│   │   │   ├── scan/
│   │   │   ├── quotes/
│   │   │   └── bookings/
│   │   ├── (carrier)/         ← μεταφορικές dashboard
│   │   │   ├── leads/
│   │   │   ├── fleet/
│   │   │   └── billing/
│   │   ├── (admin)/           ← internal ops
│   │   └── api/
│   │       ├── auth/[...nextauth]/
│   │       ├── vision/scan/
│   │       ├── routing/
│   │       ├── shared-load/match/
│   │       ├── payments/viva/webhook/
│   │       └── mydata/issue/
│   │
│   ├── components/
│   │   ├── ui/                ← shadcn primitives (do not edit by hand)
│   │   ├── consumer/          ← scan flow, quote cards, booking timeline
│   │   ├── carrier/           ← lead inbox, fleet board, dispatch
│   │   ├── shared/            ← Logo, Header, Footer, ThemeProvider
│   │   └── motion/            ← GSAP wrappers + Framer presets
│   │
│   ├── lib/
│   │   ├── auth.ts            ← Auth.js v5 config
│   │   ├── db.ts              ← Prisma client singleton (PG + PostGIS)
│   │   ├── env.ts             ← zod-validated env
│   │   ├── viva.ts            ← Viva Wallet SDK wrapper
│   │   ├── mydata.ts          ← AADE myDATA client
│   │   ├── gemini.ts          ← Gemini Vision client
│   │   └── gsap.ts            ← GSAP plugins registration
│   │
│   ├── server/
│   │   ├── actions/           ← Server Actions (mutations)
│   │   ├── services/
│   │   │   ├── inventory.service.ts
│   │   │   ├── routing.service.ts
│   │   │   ├── shared-load.service.ts
│   │   │   ├── marketplace.service.ts
│   │   │   ├── payment.service.ts
│   │   │   └── invoice.service.ts
│   │   └── queues/
│   │       ├── vision.queue.ts
│   │       ├── match.queue.ts
│   │       └── notification.queue.ts
│   │
│   ├── types/                 ← Shared TS types (mirrors Prisma types where possible)
│   └── utils/                 ← Pure helpers
│
├── scripts/
│   ├── seed-carriers.ts
│   └── load-greek-postal-codes.ts
│
└── tests/
    ├── e2e/                   ← Playwright
    └── unit/                  ← Vitest
```

---

## 4. Hard Rules (μην παρακάμπτεις)

### 4.1 Database
- **Single DB = PostgreSQL 16 + PostGIS 3.4** (Aiven managed). Όλες οι κύριες οντότητες ΚΑΙ τα spatial data ζουν στο ίδιο cluster.
- Prisma 6 με `previewFeatures = ["postgresqlExtensions"]` για native PostGIS support.
- **Καμία raw SQL** εκτός από spatial queries που χρειάζονται PostGIS functions (`ST_Buffer`, `ST_Intersects`, `ST_DWithin`, `ST_MakeLine`).
- SSL/TLS required: όλες οι connections με `sslmode=require`.
- Όλα τα IDs είναι `String @id @default(cuid())` εκτός αν υπάρχει συγκεκριμένος λόγος.
- Soft deletes: `deletedAt DateTime?` σε όλες τις user-facing οντότητες.
- `createdAt` και `updatedAt` παντού.

### 4.2 Auth
- **Auth.js v5 (NextAuth) με Prisma adapter.**
- Sessions: JWT strategy (όχι DB) για edge runtime compatibility.
- 3 user roles: `CONSUMER`, `CARRIER_OWNER`, `CARRIER_DRIVER`, `ADMIN`.
- Magic link + Google OAuth + Email/Password (bcrypt 12 rounds).
- MFA από Y2 (TOTP).

### 4.3 Frontend
- **App Router only**. Όχι `pages/`.
- Default = Server Component. Client Components μόνο όταν χρειάζεται interaction.
- **Όλα τα UI primitives από shadcn/ui.** Μην ξαναγράφεις κουμπιά/inputs/dialogs.
- **Tailwind CSS 4.1**. Καμία custom CSS εκτός `globals.css` (μόνο για design tokens).
- **GSAP για page transitions και complex sequences.** Framer Motion για micro-interactions.
- **Greek-first UI.** English ως toggle, μέσω `next-intl`.

### 4.4 Forms & Validation
- **react-hook-form + zod** πάντα.
- Zod schemas στο `src/lib/validators/`, shared client+server.
- Server Actions επικυρώνουν ΞΑΝΑ — never trust client.

### 4.5 Code Style
- TypeScript strict mode.
- ESLint + Prettier (auto-run pre-commit).
- Imports: absolute paths με `@/` alias.
- Naming:
  - Components: `PascalCase.tsx`
  - Server actions: `*.action.ts`
  - Services: `*.service.ts`
  - Types: `*.types.ts`
  - Utils: `*.util.ts`
- Comments: μόνο όταν το γιατί δεν είναι προφανές.

### 4.6 Money & Currency
- Όλα τα ποσά **σε λεπτά (cents)** στη DB (`Int`). Format μόνο στο UI.
- Currency: ISO 4217 string (default `"EUR"`).
- Χρήση `Intl.NumberFormat('el-GR', { style: 'currency', currency: 'EUR' })`.

### 4.7 Localization
- **Πρωτεύουσα γλώσσα: Ελληνικά.** Όλα τα UI strings μέσω `next-intl`.
- Dates: `Intl.DateTimeFormat('el-GR')`.
- Timezone: `Europe/Athens`.

### 4.8 Security
- **Δεν αποθηκεύουμε ποτέ raw card data.** Όλα μέσω Viva tokens.
- Φωτογραφίες περνούν από auto face/document blurring πριν την αποθήκευση.
- S3 buckets: encryption-at-rest (KMS), `eu-central-1`, server-side encryption obligatory.
- CSRF: built-in από Auth.js + Server Actions origin check.
- Rate limiting: middleware με Redis (10 req/sec ανά IP για auth, 100/sec για authenticated).
- Όλα τα secrets μέσω `process.env`. Validation με zod στο `src/lib/env.ts`.

---

## 5. Workflow για κάθε νέο feature

1. **Πριν γράψεις γραμμή κώδικα**: διάβασε το αντίστοιχο `docs/` αρχείο.
2. Άνοιξε ένα branch: `feat/sprint-<N>-<short-name>` ή `fix/...`
3. Update Prisma schema αν αλλάζει η DB. Run `npx prisma migrate dev --name <name>`.
4. Γράψε zod validator πρώτα.
5. Γράψε service function (pure logic, mockable).
6. Γράψε Server Action που καλεί το service.
7. Γράψε UI που καλεί το Server Action.
8. Γράψε ένα Vitest unit test για το service.
9. Γράψε ένα Playwright E2E αν είναι user-facing.
10. PR + self-review checklist (βλ. `docs/01-architecture.md`).

---

## 6. Σημαντικά Files να διαβάσεις (in this order)

1. `docs/00-getting-started.md` — local setup
2. `docs/01-architecture.md` — high-level system design
3. `docs/02-database.md` — Prisma schema explanation
4. `docs/03-auth.md` — Auth.js v5 setup
5. `docs/09-sprint-plan.md` — what to build, sprint by sprint
6. `PROMPTS.md` — πώς να μου ζητήσεις δουλειά

---

## 7. Επικοινωνία με τον χρήστη

- Όλα τα explanations στα **Ελληνικά**, εκτός αν ο χρήστης γράψει αγγλικά.
- Code identifiers και comments σε **αγγλικά**.
- Όταν προτείνεις αλλαγή stack/βιβλιοθήκης: **σταμάτα και ρώτα πρώτα.**
- Όταν προσθέτεις dependency: εξήγησε γιατί και ψάξε εναλλακτικές μέσα στις ήδη εγκατεστημένες.

---

## 8. Definition of Done

Ένα feature θεωρείται «done» μόνο όταν:

- [ ] Prisma migration applied & committed
- [ ] Server Action + zod validator
- [ ] UI components από shadcn (no custom buttons)
- [ ] Greek copy (no hardcoded English)
- [ ] At least 1 Vitest test
- [ ] At least 1 Playwright E2E αν είναι user-flow
- [ ] No TypeScript errors (`tsc --noEmit` clean)
- [ ] No ESLint errors
- [ ] Manual QA σε mobile viewport
- [ ] Sentry instrumentation σε critical paths

---

**Last updated:** Μάιος 2026
**Maintainer:** SmartMove AI Engineering Team
