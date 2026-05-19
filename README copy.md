# SmartMove AI

> Το Λειτουργικό Σύστημα των Logistics στην Ελλάδα.

AI-native marketplace μετακομίσεων: Computer Vision inventory, Shared-Load αλγόριθμος, Viva Wallet escrow, AADE myDATA e-invoicing.

## Quick Start

```bash
# 1. Clone & install
git clone <repo>
cd smartmove-ai
pnpm install

# 2. Setup environment
cp .env.example .env.local
# Συμπλήρωσε τα secrets — βλ. docs/00-getting-started.md

# 3. Database
docker compose up -d mysql postgres redis
pnpm prisma migrate dev
pnpm prisma db seed

# 4. Dev server
pnpm dev
# → http://localhost:3000
```

## Documentation

| Doc | Τι περιγράφει |
|---|---|
| [CLAUDE.md](./CLAUDE.md) | **Project rules & conventions — διάβασέ το πρώτο** |
| [docs/00-getting-started.md](./docs/00-getting-started.md) | Local dev setup |
| [docs/01-architecture.md](./docs/01-architecture.md) | High-level architecture |
| [docs/02-database.md](./docs/02-database.md) | Prisma schema + migration playbook |
| [docs/03-auth.md](./docs/03-auth.md) | Auth.js v5 (NextAuth) |
| [docs/04-ai-vision.md](./docs/04-ai-vision.md) | Gemini Vision pipeline |
| [docs/05-shared-load.md](./docs/05-shared-load.md) | PostGIS Shared-Load algorithm |
| [docs/06-fintech.md](./docs/06-fintech.md) | Viva Wallet + AADE myDATA |
| [docs/07-frontend.md](./docs/07-frontend.md) | shadcn/ui + Tailwind + GSAP |
| [docs/08-deployment.md](./docs/08-deployment.md) | Vercel + Railway + AWS |
| [docs/09-sprint-plan.md](./docs/09-sprint-plan.md) | 12-sprint MVP roadmap |
| [PROMPTS.md](./PROMPTS.md) | Reusable Claude Code prompts |

## Stack

Next.js 16.2.4 · TypeScript · Prisma 6 · MySQL 8 · PostgreSQL + PostGIS · Auth.js v5 · shadcn/ui · Tailwind 4.1 · GSAP · BullMQ · Vitest · Playwright.

## License

Proprietary — © 2026 SmartMove AI. All rights reserved.
