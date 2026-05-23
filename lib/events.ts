import { revalidatePath } from "next/cache";

import { db } from "@/lib/db";
import type { NotificationSeverity, NotificationType } from "@prisma/client";

// ─────────────────────── SSE broker (in-memory, per-process) ───────────────────────
//
// Lightweight pub/sub for Server-Sent Events. Each connected client gets a
// listener registered for its tenantId. When something interesting happens
// (notification created, status changed) we publish a small "event" and every
// listener for that tenant gets it.
//
// Notes:
// • In-memory means: single Next.js process. Behind a load balancer with
//   multiple workers this won't broadcast across them — fine for now, swap
//   for Redis pub/sub later if we scale horizontally.
// • Per-tenant routing means cross-tenant leak is impossible.
// • Listeners are weakly held; an SSE handler that disconnects clears its slot.

type Listener = (event: BroadcastEvent) => void;

const listeners = new Map<string, Set<Listener>>(); // tenantId → listeners

export interface BroadcastEvent {
  /** Stable identifier so the client can correlate. */
  id: string;
  /** Event type — matches NotificationType when produced by emitNotification. */
  type: string;
  /** ISO timestamp. */
  at: string;
  /** Free-form payload (matches notification.payloadJson when applicable). */
  payload: Record<string, unknown>;
}

export function subscribe(tenantId: string, listener: Listener): () => void {
  let set = listeners.get(tenantId);
  if (!set) {
    set = new Set();
    listeners.set(tenantId, set);
  }
  set.add(listener);
  return () => {
    set?.delete(listener);
    if (set && set.size === 0) listeners.delete(tenantId);
  };
}

export function broadcast(tenantId: string, event: BroadcastEvent): void {
  const set = listeners.get(tenantId);
  if (!set) return;
  for (const fn of set) {
    try {
      fn(event);
    } catch (e) {
      console.warn("[events.broadcast] listener threw:", e);
    }
  }
}

// ─────────────────────── Notification emitter ───────────────────────

export interface EmitNotificationInput {
  tenantId: string;
  /** When set, only this user sees the notification. */
  userId?: string | null;
  type: NotificationType;
  severity?: NotificationSeverity;
  title: string;
  body?: string | null;
  href?: string | null;
  payload?: Record<string, unknown>;
  /**
   * Paths to revalidate after writing. Defaults to ["/carrier"] so the bell
   * count refreshes for users on plain server-rendered pages.
   */
  revalidate?: string[];
}

/**
 * Single entry point for "something interesting happened, tell the carrier".
 * Writes a Notification row, broadcasts an SSE event, and revalidates.
 * Future: also enqueues outbound webhooks and mobile push notifications.
 *
 * Always wrap calls in try/catch at the caller — emit failures should never
 * break the originating user action.
 */
export async function emitNotification(input: EmitNotificationInput): Promise<void> {
  const notification = await db.notification.create({
    data: {
      tenantId: input.tenantId,
      userId: input.userId ?? null,
      type: input.type,
      severity: input.severity ?? "INFO",
      title: input.title,
      body: input.body ?? null,
      href: input.href ?? null,
      payloadJson: (input.payload ?? {}) as object,
    },
  });

  broadcast(input.tenantId, {
    id: notification.id,
    type: input.type,
    at: notification.createdAt.toISOString(),
    payload: {
      ...input.payload,
      title: input.title,
      severity: input.severity ?? "INFO",
      href: input.href ?? null,
    },
  });

  const paths = input.revalidate ?? ["/carrier"];
  for (const p of paths) {
    try {
      revalidatePath(p);
    } catch {
      // revalidatePath may throw if called outside an action/route — swallow.
    }
  }
}
