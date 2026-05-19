# 08 — Deployment

## Production Stack

| Layer | Πάροχος | Σχόλιο |
|---|---|---|
| Web (Next.js) | **Vercel** (Pro) | edge runtime, EU-Frankfurt region |
| Workers (BullMQ) | **Railway** | 1-2 nodes, autoscale by queue depth |
| Database | **Aiven PostgreSQL** | PG 16 + PostGIS, daily backups, multi-AZ |
| Redis | **Aiven Redis** | sessions + queue |
| Object storage | **AWS S3** (eu-central-1) | KMS encrypted |
| Email | **Resend** | EU residency |
| Monitoring | **Sentry** + **PostHog EU** | GDPR compliant |
| DNS | **Cloudflare** | + WAF + DDoS |

## CI/CD (GitHub Actions)

```yaml
# .github/workflows/deploy.yml
name: Deploy

on:
  push: { branches: [main] }
  pull_request: { branches: [main] }

jobs:
  test:
    runs-on: ubuntu-latest
    services:
      postgres:
        image: postgis/postgis:16-3.4
        env:
          POSTGRES_USER: smartmove
          POSTGRES_PASSWORD: smartmove
          POSTGRES_DB: smartmove_test
        ports: ["5432:5432"]
        options: --health-cmd pg_isready --health-interval 10s
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v3
        with: { version: 9 }
      - uses: actions/setup-node@v4
        with: { node-version: 22, cache: pnpm }
      - run: pnpm install
      - run: pnpm prisma migrate deploy
        env:
          DATABASE_URL: postgres://smartmove:smartmove@localhost:5432/smartmove_test
      - run: pnpm typecheck
      - run: pnpm lint
      - run: pnpm test
      - run: pnpm test:e2e

  deploy-web:
    needs: test
    if: github.ref == 'refs/heads/main'
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - run: pnpm prisma migrate deploy
        env: { DATABASE_URL: ${{ secrets.PROD_DATABASE_URL }} }
      - uses: vercel/action@v0.1
        with:
          vercel-token: ${{ secrets.VERCEL_TOKEN }}
          vercel-args: '--prod'
          vercel-org-id: ${{ secrets.VERCEL_ORG_ID }}
          vercel-project-id: ${{ secrets.VERCEL_PROJECT_ID }}

  deploy-workers:
    needs: test
    if: github.ref == 'refs/heads/main'
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: railwayapp/cli@v3
      - run: railway up --service=workers --token=${{ secrets.RAILWAY_TOKEN }}
```

## Environment promotion

| Env | URL | Database | Branch |
|---|---|---|---|
| **dev** (local) | localhost:3000 | docker / Aiven dev | feature branches |
| **preview** | `*.vercel.app` | Aiven staging | PRs |
| **staging** | staging.smartmove.ai | Aiven staging | `develop` |
| **production** | smartmove.ai | Aiven production | `main` |

## Pre-deploy checklist

- [ ] `pnpm typecheck` clean
- [ ] `pnpm test` και `pnpm test:e2e` clean
- [ ] Prisma migration tested σε staging
- [ ] Feature flag dependencies confirmed (πχ νέο feature OFF by default)
- [ ] Secrets ενημερωμένα σε Vercel + Railway dashboards
- [ ] Sentry release tagged
- [ ] PostHog feature flags updated
- [ ] Rollback plan documented

## Backup & DR

- **Aiven** automatic daily backups (retention 30 ημέρες).
- Manual snapshot πριν από κάθε migration σε production.
- **S3** versioning enabled + lifecycle rule για 90-day cleanup των draft uploads.
- **RTO** target: 4 ώρες.
- **RPO** target: 15 λεπτά (Aiven point-in-time recovery).

## Observability

- **Sentry**: error tracking + performance monitoring (`tracesSampleRate: 0.1` σε prod, 1.0 σε staging).
- **PostHog** EU: product analytics + feature flags + session replay.
- **Vercel Analytics**: web vitals.
- **Custom dashboards** στο Grafana για queue health, DB connections, payment success rates.

## Cost estimation (Y1 monthly)

| Service | Tier | €/μήνα |
|---|---|---|
| Vercel Pro | 1 team | €20 |
| Railway (2 workers) | hobby × 2 | €10-30 |
| Aiven PostgreSQL | startup-4 | €60-90 |
| Aiven Redis | hobbyist | €15 |
| AWS S3 | < 100GB | €5-15 |
| Resend | pro | €20 |
| Sentry | team | €26 |
| PostHog | growth | €0 (μέχρι 1M events) |
| Google Maps/Gemini | usage | €40-120 |
| **Σύνολο** | | **~€200-340/μήνα** |
