# 09 — Sprint Plan (12 Sprints → MVP Launch)

> 2-εβδομαδιαία sprints, ~24 εβδομάδες (~6 μήνες) από kick-off έως MVP launch.
> Στο τέλος: production-ready Q3 2026.

## Sprint 0 (Pre-kickoff)

- [ ] Aiven PostgreSQL service provisioned + PostGIS enabled
- [ ] Vercel team + Railway workspace
- [ ] GitHub org + repo (`smartmove-ai/smartmove-ai`)
- [ ] Sentry + PostHog accounts (EU region)
- [ ] AWS account + IAM + S3 buckets
- [ ] Google Cloud project + Gemini API + Maps API keys
- [ ] Viva Wallet demo merchant account
- [ ] AADE myDATA dev portal registration

## Sprint 1 — Foundations & Auth

**Goal**: Scaffold + Auth.js v5 + Prisma + DB connection working end-to-end.

- [ ] `pnpm create next-app smartmove-ai --typescript --app --tailwind`
- [ ] Setup CLAUDE.md, README, docs/ structure
- [ ] Install: Prisma 6, Auth.js v5, shadcn/ui, GSAP, react-hook-form, zod, sonner, lucide-react
- [ ] `prisma/schema.prisma` (User, Account, Session, VerificationToken, Authenticator)
- [ ] Connect to Aiven PostgreSQL, enable postgis extension
- [ ] First migration
- [ ] `src/lib/db.ts`, `src/lib/auth.ts`, `src/lib/auth.config.ts`, `src/middleware.ts`
- [ ] Sign-in με Google OAuth + magic link via Resend
- [ ] `/sign-in`, `/sign-up`, `/dashboard` (placeholder)
- [ ] Vercel deployment (preview)

**DoD**: User μπορεί να κάνει sign-in με Google ή magic link σε preview environment.

## Sprint 2 — Domain Schema + Consumer Profile

- [ ] Full Prisma schema: Carrier, Driver, Vehicle, MoveRequest, Inventory, Auction, Bid, Booking, Payment, Invoice, Review, SharedLoad, etc.
- [ ] Migration applied σε dev + staging
- [ ] Seed script: 5 demo carriers σε `APPROVED` state, 10 demo users
- [ ] Consumer onboarding: profile completion, phone verification (SMS via Twilio later — fake στο sprint 2)
- [ ] Greek + English i18n setup με next-intl

**DoD**: Consumer μπορεί να ολοκληρώσει profile, βλέπει empty dashboard στα ελληνικά.

## Sprint 3 — Move Request Flow (No AI yet)

- [ ] `/scan/new` με χειροκίνητη φόρμα (πριν το AI)
- [ ] Address autocomplete μέσω Google Maps Places
- [ ] Geocoding server-side: από address σε lat/lng
- [ ] zod validators σε `src/lib/validators/move.schemas.ts`
- [ ] Server Action `createMoveRequest`
- [ ] Move Request list page + detail page
- [ ] Status state machine (DRAFT → AWAITING_SCAN → ...)
- [ ] GSAP intro animation σε `/scan/new`

**DoD**: Consumer μπορεί να δημιουργήσει move request με addresses + date + notes.

## Sprint 4 — AI Inventory Scanner (μέρος 1)

- [ ] Camera capture component (mobile-first)
- [ ] S3 upload με presigned URLs
- [ ] Edge compression + EXIF strip
- [ ] Face/document blurring service (πρώτη version, basic OpenCV ή Cloudflare AI)
- [ ] `src/lib/gemini/client.ts` + structured prompt
- [ ] BullMQ vision queue worker
- [ ] Inventory table + InventoryRoom + InventoryItem CRUD

**DoD**: Consumer φωτογραφίζει ένα δωμάτιο και βλέπει list of detected items μέσα σε <5s.

## Sprint 5 — AI Inventory Scanner (μέρος 2) + Review UI

- [ ] Volumetric algorithm
- [ ] Inventory review screen: edit items, change quantities, add notes
- [ ] Suggested vehicle type
- [ ] Multi-room flow: scan room 1 → save → scan room 2
- [ ] Total volume + weight display
- [ ] Digital Inventory Wallet (πρώτη version): save inventory για επόμενη χρήση

**DoD**: Consumer ολοκληρώνει inventory με ακρίβεια. Έχει συνολικό m³, λίστα αντικειμένων ανά δωμάτιο.

## Sprint 6 — Carrier Onboarding + KYC

- [ ] `/sign-up?as=carrier` flow με extra fields
- [ ] KYC document upload (S3) με statusing
- [ ] Carrier dashboard skeleton: `/carrier/dashboard`, `/carrier/fleet`, `/carrier/leads`
- [ ] Admin panel `/admin/carriers/[id]` για approval/rejection
- [ ] Vehicle CRUD: add/edit/remove vehicles από fleet
- [ ] Driver invitations (carrier owner invites drivers via email)

**DoD**: Admin μπορεί να κάνει approve μια pilot μεταφορική, ο carrier owner βλέπει το dashboard.

## Sprint 7 — Marketplace & Auction

- [ ] Pricing service: από inventory + route → base price
- [ ] Auction model lifecycle (OPEN → CLOSED → AWARDED)
- [ ] Server Action για opening auction (consumer presses "Get quotes")
- [ ] Carrier notifications για νέο lead (in-app + email)
- [ ] Bid submission flow: carrier views inventory, submits price + valid until
- [ ] Consumer auction view: live updates μέσω polling (WebSocket στο sprint 11)
- [ ] Bid acceptance: σε booking, escrow pre-auth

**DoD**: Full auction loop end-to-end με χειροκίνητη carrier participation.

## Sprint 8 — Payments (Viva Wallet Escrow)

- [ ] `src/lib/viva/client.ts`, OAuth grant
- [ ] €1 entry fee flow (pre-auction)
- [ ] Booking escrow pre-auth (όλο το ποσό)
- [ ] Viva webhooks: signature verification + event handlers
- [ ] Payment service state machine
- [ ] Refund flow για ακυρώσεις
- [ ] QR code generation για delivery confirmation
- [ ] Mobile QR scanner για carrier driver (web-based, MediaDevices API)

**DoD**: Full payment flow: €1 entry → booking escrow → QR scan → capture.

## Sprint 9 — Shared-Load Algorithm (PostGIS)

- [ ] GIST indexes migration για PostGIS
- [ ] `publishSharedLoad` Server Action (carrier δηλώνει διαθεσιμότητα)
- [ ] Spatial matching service (`findMatchCandidates`)
- [ ] Dynamic pricing με shared discounts
- [ ] Carrier UI για Shared-Load opportunities
- [ ] Auto-submission queue: κάθε 30s για OPEN auctions

**DoD**: Όταν ένας consumer ανοίγει auction, ένας carrier με συμβατή ήδη-δηλωμένη διαδρομή βλέπει το lead με σήμα "Shared-Load opportunity, -32% pricing".

## Sprint 10 — myDATA Invoicing

- [ ] AADE myDATA REST client
- [ ] Invoice XML builder
- [ ] Auto-issue invoice μετά από booking completion
- [ ] Invoice queue με exponential backoff retry
- [ ] PDF generation (PDFKit ή Puppeteer)
- [ ] Carrier billing dashboard: invoices issued, status, mark numbers
- [ ] Customer invoice receipt στο email

**DoD**: Όταν ολοκληρώνεται booking, εκδίδεται tax-compliant invoice αυτόματα μέσω AADE dev sandbox.

## Sprint 11 — Real-Time + Notifications

- [ ] WebSocket integration (Vercel Edge → server-sent events ή Pusher)
- [ ] Live auction updates: ο consumer βλέπει νέα bids σε real-time
- [ ] Push notifications (web push API)
- [ ] Email templates: confirmation, reminder, payment, review request
- [ ] SMS gateway integration (Twilio)
- [ ] In-app notification center

**DoD**: Έχουμε world-class real-time experience σε όλα τα ταξίδια του χρήστη.

## Sprint 12 — Polish + Pilot Launch

- [ ] Performance audit (Lighthouse > 90 σε όλες τις key pages)
- [ ] Accessibility audit (WCAG 2.1 AA)
- [ ] Sentry integration σε όλα τα critical paths
- [ ] PostHog event tracking
- [ ] Production cutover plan
- [ ] Pilot launch με 5 μεταφορικές της Αττικής
- [ ] Marketing landing page polished με GSAP animations
- [ ] Press kit + Y1 launch comms

**DoD**: MVP live σε production. 5 πιστοποιημένες μεταφορικές, 100+ early-access users, full payment flow working.

## Post-MVP (Q4 2026 — Q2 2027)

| Sprint | Theme |
|---|---|
| 13-14 | BNPL integration (Viva BNPL + Klarna) |
| 15-16 | Insurance Embedded (Eurolife) |
| 17-18 | Carrier mobile app (React Native) |
| 19-20 | Multi-stop routing UI + VRP optimizer |
| 21-22 | Series A push: investor reports, financial dashboards |
| 23-24 | Cyprus & Bulgaria expansion plumbing |

## Sprint workflow

1. **Sprint planning** (Δευτέρα): tickets από backlog → sprint board.
2. **Daily standups** (15 λεπτά): yesterday / today / blockers.
3. **Mid-sprint check** (μέρα 5): scope adjustment αν χρειάζεται.
4. **Sprint review + demo** (Παρασκευή σπριντ 2ης εβδομάδας).
5. **Retro** (1 ώρα): keep / drop / try.
6. **Sprint planning για επόμενο sprint** (αμέσως μετά).

## Definition of Done (κάθε ticket)

- [ ] Pull Request approved από ≥1 reviewer
- [ ] TypeScript clean (`pnpm typecheck`)
- [ ] ESLint clean (`pnpm lint`)
- [ ] Unit tests προστέθηκαν / passing
- [ ] E2E tests για user-facing flows
- [ ] Prisma migration tested σε staging
- [ ] Greek copy review
- [ ] Mobile QA
- [ ] Sentry instrumentation σε critical paths
