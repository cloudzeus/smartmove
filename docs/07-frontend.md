# 07 — Frontend (Next.js 16.2 · shadcn/ui · Tailwind 4.1 · GSAP)

## Tailwind setup (v4.1, CSS-first config)

```css
/* src/app/globals.css */
@import "tailwindcss";

@theme {
  /* === SmartMove brand tokens === */
  --color-navy:       #0A1A3E;
  --color-navy-dark:  #050E25;
  --color-cyan:       #3DA9FC;
  --color-cyan-light: #7FCAFF;
  --color-bg:         #F4F7FB;
  --color-text:       #1A1A1A;
  --color-grey:       #8D9BB5;
  --color-success:    #23A87B;
  --color-warning:    #E07A2F;
  --color-danger:     #C94A5E;

  --font-display: "Calibri", "Inter", system-ui, sans-serif;
  --font-body:    "Inter", system-ui, sans-serif;

  --radius-card:   12px;
  --radius-button: 8px;
  --radius-input:  6px;

  --shadow-card:    0 1px 3px rgb(10 26 62 / 0.08);
  --shadow-popover: 0 10px 30px rgb(10 26 62 / 0.12);
}

@layer base {
  body {
    @apply bg-bg text-text font-body antialiased;
    font-feature-settings: "ss01", "cv11";
  }
  h1, h2, h3 { @apply font-display tracking-tight; }
}
```

## shadcn/ui setup

```bash
pnpm dlx shadcn@latest init
# Style: default
# Base color: slate
# CSS variables: yes
```

### Πρώτα components να εγκαταστήσεις

```bash
pnpm dlx shadcn@latest add button input form label dialog dropdown-menu \
  card avatar badge separator skeleton sonner toast tabs sheet \
  select textarea checkbox radio-group switch \
  navigation-menu hover-card popover progress \
  table calendar command
```

Αυτά καλύπτουν 90% των UI needs. Για ιδιαίτερα features:
- File uploader: `react-dropzone` + custom shadcn wrapper
- Date range picker: shadcn calendar + manual range logic
- Map: `@vis.gl/react-google-maps`

## GSAP integration

```typescript
// src/lib/gsap.ts
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { ScrollToPlugin } from "gsap/ScrollToPlugin";
import { useGSAP } from "@gsap/react";

if (typeof window !== "undefined") {
  gsap.registerPlugin(ScrollTrigger, ScrollToPlugin, useGSAP);
}

export { gsap, ScrollTrigger, useGSAP };
```

### Παράδειγμα GSAP component

```typescript
// src/components/motion/AnimatedHero.tsx
"use client";
import { useGSAP } from "@gsap/react";
import { gsap } from "@/lib/gsap";
import { useRef } from "react";

export function AnimatedHero({ children }: { children: React.ReactNode }) {
  const root = useRef<HTMLDivElement>(null);

  useGSAP(() => {
    const tl = gsap.timeline({ defaults: { ease: "power3.out" } });
    tl.from(".hero-title",   { y: 60, opacity: 0, duration: 1 })
      .from(".hero-sub",     { y: 30, opacity: 0, duration: 0.8 }, "-=0.5")
      .from(".hero-cta",     { y: 20, opacity: 0, duration: 0.6, stagger: 0.15 }, "-=0.4");
  }, { scope: root });

  return <div ref={root}>{children}</div>;
}
```

### Page transitions

```typescript
// src/components/motion/PageTransition.tsx
"use client";
import { gsap } from "@/lib/gsap";
import { useGSAP } from "@gsap/react";
import { useRef } from "react";
import { usePathname } from "next/navigation";

export function PageTransition({ children }: { children: React.ReactNode }) {
  const root = useRef<HTMLDivElement>(null);
  const path = usePathname();

  useGSAP(() => {
    gsap.fromTo(root.current,
      { opacity: 0, y: 8 },
      { opacity: 1, y: 0, duration: 0.4, ease: "power2.out" },
    );
  }, { scope: root, dependencies: [path] });

  return <div ref={root}>{children}</div>;
}
```

## i18n (Greek-first)

```bash
pnpm add next-intl
```

```typescript
// src/i18n/messages/el.json (default locale)
{
  "common": {
    "signIn": "Σύνδεση",
    "signOut": "Αποσύνδεση",
    "save": "Αποθήκευση",
    "cancel": "Άκυρο"
  },
  "consumer": {
    "scan": {
      "title": "Σκάναρε τον χώρο σου",
      "subtitle": "Σε λιγότερο από 10 δευτερόλεπτα, μάθε την τιμή",
      "cta": "Ξεκίνα σκανάρισμα"
    }
  }
}
```

```typescript
// usage
import { useTranslations } from "next-intl";

export function ScanCTA() {
  const t = useTranslations("consumer.scan");
  return (
    <section>
      <h1>{t("title")}</h1>
      <p>{t("subtitle")}</p>
      <Button>{t("cta")}</Button>
    </section>
  );
}
```

## Forms (react-hook-form + zod + shadcn)

```typescript
// src/lib/validators/move.schemas.ts
import { z } from "zod";

export const createMoveRequestSchema = z.object({
  fromAddress: z.string().min(5, "Συμπλήρωσε διεύθυνση"),
  fromPostal:  z.string().regex(/^\d{3}\s?\d{2}$/, "Μη έγκυρος ΤΚ"),
  toAddress:   z.string().min(5),
  toPostal:    z.string().regex(/^\d{3}\s?\d{2}$/),
  preferredDate: z.coerce.date().min(new Date(), "Η ημερομηνία πρέπει να είναι μελλοντική"),
  flexibilityDays: z.number().int().min(0).max(7).default(0),
  notes: z.string().max(2000).optional(),
});

export type CreateMoveRequestInput = z.infer<typeof createMoveRequestSchema>;
```

```typescript
// src/components/consumer/CreateMoveRequestForm.tsx
"use client";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Form, FormField, FormItem, FormLabel, FormControl, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { createMoveRequest } from "@/server/actions/move-request.action";
import { createMoveRequestSchema, type CreateMoveRequestInput } from "@/lib/validators/move.schemas";
import { toast } from "sonner";

export function CreateMoveRequestForm() {
  const form = useForm<CreateMoveRequestInput>({
    resolver: zodResolver(createMoveRequestSchema),
    defaultValues: { flexibilityDays: 0 },
  });

  async function onSubmit(values: CreateMoveRequestInput) {
    const result = await createMoveRequest(values);
    if (result.error) toast.error(result.error);
    else toast.success("Δημιουργήθηκε. Συνέχισε στο σκανάρισμα.");
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        {/* fields */}
        <Button type="submit" disabled={form.formState.isSubmitting}>Συνέχεια</Button>
      </form>
    </Form>
  );
}
```

## Server Actions pattern

```typescript
// src/server/actions/move-request.action.ts
"use server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { createMoveRequestSchema } from "@/lib/validators/move.schemas";
import { revalidatePath } from "next/cache";

type Result<T> = { ok: true; data: T } | { ok: false; error: string };

export async function createMoveRequest(input: unknown): Promise<Result<{ id: string }>> {
  const session = await auth();
  if (!session?.user) return { ok: false, error: "Πρέπει να συνδεθείς" };

  const parsed = createMoveRequestSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.errors[0].message };

  try {
    // Geocode addresses (server-side)
    const fromCoords = await geocode(parsed.data.fromAddress);
    const toCoords   = await geocode(parsed.data.toAddress);

    const move = await db.moveRequest.create({
      data: {
        userId: session.user.id,
        fromAddress: parsed.data.fromAddress,
        fromPostal:  parsed.data.fromPostal,
        fromCity:    fromCoords.city,
        fromLat:     fromCoords.lat,
        fromLng:     fromCoords.lng,
        toAddress:   parsed.data.toAddress,
        toPostal:    parsed.data.toPostal,
        toCity:      toCoords.city,
        toLat:       toCoords.lat,
        toLng:       toCoords.lng,
        preferredDate: parsed.data.preferredDate,
        flexibilityDays: parsed.data.flexibilityDays,
        notes: parsed.data.notes,
        status: "AWAITING_SCAN",
      },
    });

    revalidatePath("/dashboard");
    return { ok: true, data: { id: move.id } };
  } catch (e) {
    console.error(e);
    return { ok: false, error: "Κάτι πήγε στραβά. Δοκίμασε ξανά." };
  }
}
```

## Component conventions

- Server components: default. No `"use client"` εκτός αν απαιτείται.
- One default export per file.
- Props interface ονομάζεται `<Component>Props`.
- Loading states με `<Skeleton />` ή `loading.tsx` σε route segments.
- Error boundaries: `error.tsx` ανά segment.

## Accessibility

- WCAG 2.1 AA baseline (μέσω shadcn defaults).
- `<Button>` έχει ήδη focus rings και aria attributes.
- Όλα τα forms με κατάλληλα labels και error messages.
- Camera scanner έχει fallback για manual upload.
