# 01 — Architecture

## High-Level Topology

```
                      ┌─────────────────────────────────────────┐
                      │              VERCEL EDGE                │
                      │  Next.js 16.2 (App Router)              │
                      │  - SSR / RSC                            │
                      │  - Server Actions                       │
                      │  - Edge middleware (auth, rate-limit)   │
                      └────────────┬────────────────────────────┘
                                   │
            ┌──────────────────────┼─────────────────────────────┐
            │                      │                             │
   ┌────────▼──────────────────────▼──────┐         ┌────────────▼────────┐
   │   PostgreSQL 16 + PostGIS 3.4        │         │  Redis              │
   │   (Aiven managed, single cluster)    │         │  (sessions, queues) │
   │   Prisma 6 client                    │         │  BullMQ             │
   └──────────────────────────────────────┘         └─────────────────────┘

   ┌──────────────┐    ┌──────────────────────┐     ┌─────────────────────┐
   │   Workers    │    │  S3 (eu-central-1)   │     │  Sentry / PostHog   │
   │  (Railway)   │    │  Photos, invoices    │     │  Observability      │
   │  BullMQ      │    │  KMS encrypted       │     │                     │
   └──────────────┘    └──────────────────────┘     └─────────────────────┘

                      ┌─────────────────────────────────────────┐
                      │           External APIs                  │
                      │  Gemini 1.5  │  Google Maps  │  Viva    │
                      │  AADE myDATA │  Resend mail  │  ...     │
                      └─────────────────────────────────────────┘
```

## Δομικά μοτίβα

### 1. Server-first
Default είναι **React Server Components**. Client Components μόνο όπου χρειάζεται event handlers ή hooks. Σήμα ότι κάτι θέλει RSC ή RCC:

| Symptom | Decision |
|---|---|
| `useState` / `useEffect` / `onClick` | RCC (`"use client"`) |
| `await db.user.findMany()` | RSC |
| GSAP/Framer animations | RCC |
| Form με Server Action | και τα δύο (form = RCC, action = server) |

### 2. Server Actions πάνω από REST routes
Mutations γίνονται μέσω Server Actions. REST/JSON API μόνο για:
- Webhooks (`api/payments/viva/webhook`)
- Mobile clients (μελλοντικό)
- Third-party integrations

### 3. Services Layer (business logic)
Όλη η business logic ζει στο `src/server/services/`. Τα Server Actions είναι λεπτό adapter που κάνει zod validation + auth + κάλεσμα service. Έτσι:
- Τα services είναι testable χωρίς Next runtime.
- Workers (background jobs) ξανα-χρησιμοποιούν τα ίδια services.

### 4. Queue-based για βαριά πράγματα
- AI scan → `vision.queue`
- Shared-Load matching → `match.queue` (κάθε 30 sec ή on-demand)
- Email/SMS notifications → `notification.queue`
- myDATA submission → `invoice.queue` (retry με exponential backoff)

### 5. Single-database pattern (PostgreSQL + PostGIS)
- Ένα μόνο cluster (Aiven managed PostgreSQL 16 με `postgis` extension ενεργό).
- Όλα τα domain + spatial models στο ίδιο Prisma schema.
- Spatial queries μέσω `db.$queryRaw` με PostGIS functions.
- Spatial indexes (GIST) προστίθενται manual στο migration SQL — βλ. `docs/02-database.md`.

## Folder Structure (αναλυτικά)

```
src/
├── app/                            # Next.js routes (App Router)
│   ├── layout.tsx                  # root layout (HTML, ThemeProvider, AuthProvider)
│   ├── page.tsx                    # landing
│   ├── (marketing)/                # public pages — no auth
│   │   ├── about/
│   │   ├── pricing/
│   │   ├── for-carriers/
│   │   └── blog/[slug]/
│   ├── (auth)/                     # auth pages — middleware redirects authenticated users away
│   │   ├── sign-in/
│   │   ├── sign-up/
│   │   └── verify/
│   ├── (consumer)/                 # role: CONSUMER
│   │   ├── layout.tsx              # consumer-specific nav
│   │   ├── dashboard/page.tsx
│   │   ├── scan/                   # AI scan flow
│   │   │   ├── new/page.tsx
│   │   │   └── [id]/page.tsx
│   │   ├── quotes/[id]/page.tsx
│   │   ├── bookings/
│   │   │   ├── page.tsx            # list
│   │   │   └── [id]/page.tsx       # detail (timeline + QR)
│   │   └── wallet/page.tsx         # Digital Inventory Wallet
│   ├── (carrier)/                  # role: CARRIER_OWNER
│   │   ├── layout.tsx
│   │   ├── dashboard/page.tsx
│   │   ├── leads/                  # incoming auctions
│   │   ├── fleet/
│   │   ├── drivers/
│   │   ├── billing/                # invoices issued, payouts received
│   │   └── settings/
│   ├── (admin)/                    # role: ADMIN
│   │   ├── carriers/               # KYC approval
│   │   ├── moves/                  # all move requests
│   │   ├── disputes/
│   │   └── analytics/
│   └── api/
│       ├── auth/[...nextauth]/route.ts
│       ├── health/route.ts
│       ├── vision/scan/route.ts
│       ├── routing/optimize/route.ts
│       ├── shared-load/match/route.ts
│       ├── payments/viva/webhook/route.ts
│       └── mydata/issue/route.ts
│
├── components/
│   ├── ui/                         # shadcn — auto-generated, μη edit
│   ├── consumer/
│   │   ├── ScanCameraCapture.tsx   # camera AR overlay
│   │   ├── InventoryReviewList.tsx
│   │   ├── QuoteCard.tsx
│   │   ├── BookingTimeline.tsx
│   │   └── QRDeliveryScanner.tsx
│   ├── carrier/
│   │   ├── LeadInbox.tsx
│   │   ├── FleetBoard.tsx
│   │   ├── DispatchModal.tsx
│   │   ├── SharedLoadFeed.tsx
│   │   └── PayoutCalendar.tsx
│   ├── shared/
│   │   ├── Logo.tsx
│   │   ├── Header.tsx
│   │   ├── Footer.tsx
│   │   ├── ThemeToggle.tsx
│   │   ├── LocaleToggle.tsx
│   │   ├── BrandStatBlock.tsx      # για landing pages
│   │   └── CTAButton.tsx           # primary GSAP CTA
│   └── motion/
│       ├── GSAPProvider.tsx        # registers all plugins
│       ├── AnimatedHero.tsx        # GSAP timeline for landing
│       ├── FadeInOnScroll.tsx
│       └── MagneticButton.tsx
│
├── lib/
│   ├── auth.ts                     # Auth.js v5 config
│   ├── auth.config.ts              # edge-compatible (middleware uses this)
│   ├── db.ts                       # Prisma singleton (single PG+PostGIS cluster)
│   ├── env.ts                      # zod-validated process.env
│   ├── viva/
│   │   ├── client.ts               # OAuth + fetch wrapper
│   │   ├── checkout.ts             # createOrder, captureCharge, refund
│   │   ├── webhooks.ts             # signature verification
│   │   └── types.ts
│   ├── mydata/
│   │   ├── client.ts
│   │   ├── invoice.builder.ts      # builds AADE XML
│   │   └── types.ts
│   ├── gemini/
│   │   ├── client.ts
│   │   ├── inventory.prompt.ts     # structured prompt
│   │   └── types.ts
│   ├── maps/
│   │   ├── routing.ts
│   │   └── geocoding.ts
│   ├── s3.ts
│   ├── redis.ts
│   ├── logger.ts                   # pino
│   ├── validators/                 # zod schemas (shared)
│   │   ├── auth.schemas.ts
│   │   ├── move.schemas.ts
│   │   ├── inventory.schemas.ts
│   │   ├── bid.schemas.ts
│   │   └── payment.schemas.ts
│   └── gsap.ts                     # plugin registration
│
├── server/
│   ├── actions/
│   │   ├── auth.action.ts
│   │   ├── move-request.action.ts
│   │   ├── inventory.action.ts
│   │   ├── auction.action.ts
│   │   ├── bid.action.ts
│   │   ├── booking.action.ts
│   │   └── payment.action.ts
│   ├── services/
│   │   ├── inventory.service.ts    # AI scan orchestration
│   │   ├── routing.service.ts      # Google Maps + VRP
│   │   ├── shared-load.service.ts  # spatial matching
│   │   ├── marketplace.service.ts  # auction lifecycle
│   │   ├── pricing.service.ts      # dynamic pricing + shared discounts
│   │   ├── payment.service.ts      # Viva integration
│   │   ├── invoice.service.ts      # myDATA integration
│   │   └── notification.service.ts
│   └── queues/
│       ├── index.ts
│       ├── vision.queue.ts
│       ├── match.queue.ts
│       ├── notification.queue.ts
│       └── invoice.queue.ts
│
├── middleware.ts                   # Auth.js v5 edge middleware + i18n + rate-limit
├── types/
│   └── next-auth.d.ts              # extends Session.user with role
└── utils/
    ├── format.ts                   # currency, date, distance
    ├── slug.ts
    └── retry.ts
```

## Pull Request Checklist

Πριν ανοίξεις PR:

- [ ] `pnpm typecheck` clean
- [ ] `pnpm lint` clean
- [ ] `pnpm test` clean
- [ ] Νέο feature έχει τουλάχιστον ένα unit test
- [ ] Νέο user flow έχει E2E test
- [ ] Prisma migration έχει name που εξηγεί τι κάνει
- [ ] Δεν committed `.env*`, no secrets
- [ ] Greek copy review (όχι αγγλικά strings hardcoded)
- [ ] Mobile viewport tested (Chrome DevTools)
- [ ] Lighthouse score > 90 σε νέες σελίδες
- [ ] PR description: τι, γιατί, screenshots, breaking changes
