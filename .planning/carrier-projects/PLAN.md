# Carrier Projects — Phase Plan

**Goal:** Convert accepted MoveRequests into first-class carrier-internal Projects with per-stop service breakdown, ad-hoc pricing, employee/vehicle scheduling, and soft-warning availability conflicts.

**Scope:** 100% carrier-internal. Zero customer UX changes.

---

## Decisions (locked)

| # | Decision | Choice |
|---|---|---|
| 1 | Model | Full Project model (CarrierProject → ProjectStop → ProjectStopService → JobTask) |
| 2 | Customer-visible | No — `/dashboard/*` untouched |
| 3 | Availability conflict | Soft warning + override, with audit log |
| 4 | Pricing | Ad-hoc per service (optional partnerId for external) |
| 5 | Migration strategy | Expand → backfill → contract (zero-downtime, reversible) |

---

## Tasks

### T1. Schema expand (additive only)
- Add `CarrierProject`, `ProjectStop`, `ProjectStopService` models
- Add `JobTask.projectStopServiceId String?` (optional, alongside existing `moveRequestId`)
- Add `ServiceType` and `ProjectStatus` enums
- Add `AvailabilityOverride` audit table (taskId, overriddenBy, overriddenAt, conflictDetails JSON)
- Run `prisma migrate dev --name carrier_projects_expand`

**Acceptance:** Migration applies cleanly. Existing data untouched. No code references new fields yet.

### T2. Dual-write on offer acceptance
- Locate `server/actions/accept-offer.action.ts`
- After offer acceptance: create `CarrierProject` + `ProjectStop[]` (from `MoveRequestStop[]`) + default `ProjectStopService` entries derived from `move.crane`/`move.packing`/items
- Link generated `JobTask`s to both `moveRequestId` (legacy) and `projectStopServiceId` (new)
- Update `lib/build-job-tasks.ts` → `lib/build-project-tasks.ts` that iterates `project.stops[].services[]`

**Acceptance:** Accepting a new offer creates a complete CarrierProject tree with linked JobTasks.

### T3. Backfill script
- `scripts/backfill-carrier-projects.ts` — idempotent CLI
- For each accepted MoveRequest without a CarrierProject: create the tree, attach existing JobTasks under a default `OTHER` service per stop
- Dry-run mode (`--dry`) prints summary without writing
- Verification query: count accepted-without-project, count tasks-without-service

**Acceptance:** Running twice produces no changes on second run. Verification counts go to 0.

### T4. Availability check helper
- `lib/check-resource-availability.ts` — `checkConflicts({ employeeId?, vehicleId?, startAt, durationMinutes, excludeTaskId? }): Conflict[]`
- Cross-project, tenant-scoped, excludes CANCELLED/DONE
- Returns array with `{ taskId, projectCode, projectId, otherStart, otherEnd, resourceName }`

**Acceptance:** Unit-tested with overlap edge cases (touching, contained, identical).

### T5. Carrier UI — Project tree editor
- `/carrier/projects/[id]/page.tsx` — project detail with stops → services accordion
- `components/carrier/project-services-editor.tsx` — add/remove services per stop, set qty + unitPrice + optional partnerId
- `components/carrier/project-task-assigner.tsx` — assign employee/vehicle + startAt + duration to each service; on save, call availability check → if conflict, show warning modal with "Override" + reason field
- Update `/carrier/jobs` listing to show "Project" badge linking to project detail

**Acceptance:** Carrier can open a project, edit services per stop, assign tasks, override conflicts with logged reason.

### T6. Reporting
- `/carrier/reports/page.tsx` — three views:
  - Revenue per ServiceType (month/quarter)
  - Employee utilization (assigned hours per period)
  - Top services by count and revenue
- Server actions in `server/actions/carrier-reports.action.ts`

**Acceptance:** Reports render with real data from at least one completed project.

### T7. Contract migration (gated, separate deploy)
- After all data confirmed migrated: make `JobTask.projectStopServiceId` required
- Drop `JobTask.moveRequestId` (or keep as denormalized cache)
- Remove dual-write code

**Acceptance:** App functions identically; old field gone.

---

## Out of scope (future)
- Carrier pricing catalog (`CarrierServicePricing`)
- Recurring task templates per service type
- Mobile crew-facing app
- Customer-visible project status
