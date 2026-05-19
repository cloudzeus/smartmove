# 00 — Getting Started

> Local dev setup σε <15 λεπτά.

## Prerequisites

| Tool | Έκδοση | Εγκατάσταση |
|---|---|---|
| Node.js | **22 LTS** | `nvm install 22 && nvm use 22` |
| pnpm | 9.x | `corepack enable && corepack prepare pnpm@latest --activate` |
| Docker Desktop | latest | https://docs.docker.com/get-docker/ |
| Git | any recent | brew/apt |

## Step-by-step

### 1. Clone

```bash
git clone git@github.com:smartmove-ai/smartmove-ai.git
cd smartmove-ai
pnpm install
```

### 2. Environment

```bash
cp .env.example .env.local
```

Συμπλήρωσε τα required keys στο `.env.local`:

| Key | Πού το βρίσκεις |
|---|---|
| `AUTH_SECRET` | `openssl rand -base64 32` |
| `DATABASE_URL` | Aiven service URI (postgres) ή `postgres://smartmove:smartmove@localhost:5432/smartmove` αν είσαι σε docker |
| `GEMINI_API_KEY` | https://aistudio.google.com/apikey |
| `GOOGLE_MAPS_API_KEY` | Google Cloud Console, ενεργοποίησε Routing + Geocoding APIs |
| `AWS_*` | IAM user με S3 access σε `eu-central-1` |
| `VIVA_*` | https://www.viva.com/en/business/developers (demo account) |
| `MYDATA_*` | AADE developer portal — dev environment πρώτα |
| `AUTH_GOOGLE_*` | Google Cloud Console → OAuth credentials |
| `AUTH_RESEND_KEY` | https://resend.com/api-keys |

### 3. Database (Aiven PostgreSQL + Redis)

**Option A — Aiven managed (production-like, συνιστάται):**
1. Aiven console → PostgreSQL service → Extensions tab → ενεργοποίησε `postgis`.
2. Connection info → αντίγραψε σε `DATABASE_URL` (μορφή: `postgres://USER:PASS@HOST:PORT/defaultdb?sslmode=require`).
3. Redis service ή Aiven Redis ή τοπικό docker.

**Option B — Local docker (γρήγορη ανάπτυξη):**

```yaml
# docker-compose.yml
services:
  postgres:
    image: postgis/postgis:16-3.4
    ports: ["5432:5432"]
    environment:
      POSTGRES_USER: smartmove
      POSTGRES_PASSWORD: smartmove
      POSTGRES_DB: smartmove
  redis:
    image: redis:7-alpine
    ports: ["6379:6379"]
```

```bash
docker compose up -d
```

### 4. Migrations & seed

```bash
# Generate Prisma client
pnpm prisma generate

# Πρώτο migration (δημιουργεί όλα τα tables + ενεργοποιεί postgis)
pnpm prisma migrate dev --name init

# Manual: spatial GIST indexes (βλ. docs/02-database.md)
pnpm prisma migrate dev --create-only --name add_spatial_indexes
# → edit το SQL αρχείο για να προσθέσεις CREATE INDEX USING GIST
pnpm prisma migrate dev

# Seed: demo carriers, postal codes, test users
pnpm prisma db seed

# Optional: φόρτωση Ελληνικών ΤΚ
pnpm tsx scripts/load-greek-postal-codes.ts
```

### 5. Dev server

```bash
pnpm dev
```

→ Άνοιξε http://localhost:3000

### 6. Verify

- [ ] http://localhost:3000 → landing page
- [ ] http://localhost:3000/sign-in → Auth.js login
- [ ] http://localhost:3000/api/health → `{ ok: true }`
- [ ] `pnpm prisma studio` → DB explorer
- [ ] `pnpm test` → όλα passing

## Daily workflow

```bash
git pull
pnpm install            # αν άλλαξε package.json
pnpm prisma migrate dev # αν άλλαξε schema
pnpm dev
```

## Useful Scripts

```bash
pnpm dev               # next dev με turbopack
pnpm build             # production build
pnpm test              # vitest (unit)
pnpm test:e2e          # playwright (e2e)
pnpm lint              # eslint
pnpm typecheck         # tsc --noEmit
pnpm format            # prettier write

pnpm db:studio         # prisma studio
pnpm db:reset          # ΠΡΟΣΟΧΗ: drops & re-seeds
pnpm db:generate       # regenerate Prisma clients

pnpm worker            # background queue worker
pnpm worker:vision     # only vision queue
pnpm worker:match      # only Shared-Load match queue
```

## Troubleshooting

**Prisma generation failing με `EACCES`**
```bash
sudo chown -R $USER:$(id -gn) node_modules/.prisma
pnpm prisma generate
```

**MySQL connection refused**
- Docker τρέχει; `docker ps`
- Σωστό port; default `3306`. Αν έχεις άλλο MySQL τοπικά, άλλαξε στο `docker-compose.yml`.

**Gemini API quota errors**
- Demo project έχει 60 req/min. Για load testing, ζήτησε quota increase.

**myDATA dev sandbox δεν αποκρίνεται**
- Είναι Greek government endpoint — ώρες αιχμής (10:00-13:00) έχει latency.
- Δοκίμασε reproducibility με `scripts/mock-mydata.ts`.
