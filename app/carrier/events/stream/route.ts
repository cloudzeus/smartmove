import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { subscribe, type BroadcastEvent } from "@/lib/events";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Server-Sent Events stream for the carrier dashboard.
 *
 * Auth: must be a tenant member. Events are scoped to the user's tenant.
 *
 * Format: each event is a JSON-encoded BroadcastEvent. We send a heartbeat
 * comment every 25s so intermediaries (nginx, proxies) don't close the idle
 * connection.
 */
export async function GET(): Promise<Response> {
  const session = await auth();
  if (!session?.user?.id) {
    return new Response("Unauthorized", { status: 401 });
  }
  const role = session.user.role;
  if (role !== "TENANTADMIN" && role !== "TENANTEMPLOYEE") {
    return new Response("Forbidden", { status: 403 });
  }
  const membership = await db.tenantMembership.findFirst({
    where: { userId: session.user.id },
    select: { tenantId: true },
    orderBy: { createdAt: "asc" },
  });
  if (!membership) {
    return new Response("No tenant", { status: 403 });
  }
  const tenantId = membership.tenantId;

  const encoder = new TextEncoder();
  let heartbeat: ReturnType<typeof setInterval> | null = null;
  let unsubscribe: (() => void) | null = null;

  const stream = new ReadableStream({
    start(controller) {
      const send = (event: BroadcastEvent) => {
        try {
          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify(event)}\n\n`),
          );
        } catch {
          // Stream was closed mid-write; cleanup happens in cancel().
        }
      };

      // Initial hello so the client knows the stream is alive.
      send({
        id: `hello-${Date.now()}`,
        type: "STREAM_OPEN",
        at: new Date().toISOString(),
        payload: { tenantId },
      });

      // Heartbeat comment every 25s to keep the connection warm.
      heartbeat = setInterval(() => {
        try {
          controller.enqueue(encoder.encode(`: heartbeat\n\n`));
        } catch {
          // Ignore — cancel() will clean up.
        }
      }, 25_000);

      unsubscribe = subscribe(tenantId, send);
    },
    cancel() {
      if (heartbeat) clearInterval(heartbeat);
      if (unsubscribe) unsubscribe();
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
