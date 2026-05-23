"use client";

import { useEffect, useState, useTransition, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  Archive,
  Bell,
  BellOff,
  CheckCheck,
  ChevronRight,
  X,
} from "lucide-react";

import {
  archiveNotification,
  markAllNotificationsRead,
  markNotificationRead,
} from "@/server/actions/notifications.action";

export interface InitialNotification {
  id: string;
  type: string;
  severity: "INFO" | "SUCCESS" | "WARNING" | "CRITICAL";
  status: "UNREAD" | "READ" | "ARCHIVED";
  title: string;
  body: string | null;
  href: string | null;
  createdAt: string;
}

const SEVERITY_TONE: Record<
  InitialNotification["severity"],
  { dot: string; bg: string; ring: string }
> = {
  INFO:     { dot: "bg-sky-500",     bg: "bg-sky-50",     ring: "ring-sky-200" },
  SUCCESS:  { dot: "bg-emerald-500", bg: "bg-emerald-50", ring: "ring-emerald-200" },
  WARNING:  { dot: "bg-amber-500",   bg: "bg-amber-50",   ring: "ring-amber-200" },
  CRITICAL: { dot: "bg-rose-500",    bg: "bg-rose-50",    ring: "ring-rose-200" },
};

export function NotificationBell({
  initial,
  initialUnread,
}: {
  initial: InitialNotification[];
  initialUnread: number;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<InitialNotification[]>(initial);
  const [unread, setUnread] = useState(initialUnread);
  const [pulse, setPulse] = useState(false);
  const [pending, start] = useTransition();

  // Subscribe to SSE on mount. When a new notification event arrives, refresh
  // the server-rendered count by router.refresh() and locally bump the badge.
  useEffect(() => {
    const es = new EventSource("/carrier/events/stream");
    es.onmessage = (e) => {
      try {
        const data = JSON.parse(e.data);
        if (data.type === "STREAM_OPEN") return;
        // Increase the badge optimistically; the next router.refresh() will
        // bring the full payload.
        setUnread((u) => u + 1);
        setPulse(true);
        setTimeout(() => setPulse(false), 1500);
        // Pull the fresh notification + counts from the server.
        router.refresh();
      } catch {
        // Ignore parse errors.
      }
    };
    es.onerror = () => {
      // Browser auto-reconnects; we don't surface transient blips.
    };
    return () => es.close();
  }, [router]);

  // Keep local state in sync if server props change (after revalidate).
  useEffect(() => {
    setItems(initial);
    setUnread(initialUnread);
  }, [initial, initialUnread]);

  const handleRead = useCallback((id: string) => {
    start(async () => {
      await markNotificationRead(id);
      setItems((prev) =>
        prev.map((n) => (n.id === id ? { ...n, status: "READ" } : n)),
      );
      setUnread((u) => Math.max(0, u - 1));
    });
  }, []);

  const handleArchive = useCallback((id: string) => {
    start(async () => {
      await archiveNotification(id);
      setItems((prev) => prev.filter((n) => n.id !== id));
    });
  }, []);

  const handleMarkAll = () => {
    start(async () => {
      await markAllNotificationsRead();
      setItems((prev) => prev.map((n) => ({ ...n, status: "READ" })));
      setUnread(0);
    });
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="relative grid size-10 place-items-center rounded-xl border border-border bg-card transition hover:bg-secondary"
        title="Ειδοποιήσεις"
      >
        <Bell
          className={`size-5 ${
            unread > 0 ? "text-amber-700" : "text-muted-foreground"
          } ${pulse ? "animate-bounce" : ""}`}
        />
        {unread > 0 && (
          <span className="absolute -right-1 -top-1 inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-rose-500 px-1 text-[10px] font-extrabold text-white ring-2 ring-card">
            {unread > 99 ? "99+" : unread}
          </span>
        )}
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex justify-end bg-black/30"
          onClick={(e) => {
            if (e.target === e.currentTarget) setOpen(false);
          }}
        >
          <aside className="flex h-full w-full max-w-md flex-col bg-card shadow-2xl">
            <div className="flex items-center justify-between border-b border-border px-4 py-3">
              <div className="flex items-center gap-2">
                <Bell className="size-5 text-amber-700" />
                <h2 className="text-base font-bold">Ειδοποιήσεις</h2>
                {unread > 0 && (
                  <span className="rounded-full bg-rose-500 px-2 py-0.5 text-[10px] font-extrabold text-white">
                    {unread} νέες
                  </span>
                )}
              </div>
              <div className="flex items-center gap-1">
                {unread > 0 && (
                  <button
                    onClick={handleMarkAll}
                    disabled={pending}
                    className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-semibold text-muted-foreground hover:bg-secondary hover:text-foreground"
                  >
                    <CheckCheck className="size-3.5" /> Όλες αναγνωσμένες
                  </button>
                )}
                <button
                  onClick={() => setOpen(false)}
                  className="grid size-8 place-items-center rounded-lg text-muted-foreground hover:bg-secondary"
                >
                  <X className="size-4" />
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto">
              {items.length === 0 ? (
                <div className="flex h-full flex-col items-center justify-center p-8 text-center">
                  <BellOff className="size-12 text-muted-foreground" />
                  <p className="mt-3 text-sm font-semibold text-foreground">
                    Καμία ειδοποίηση
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Όταν συμβαίνει κάτι σημαντικό, θα το δεις εδώ.
                  </p>
                </div>
              ) : (
                <ul className="divide-y divide-border">
                  {items.map((n) => {
                    const tone = SEVERITY_TONE[n.severity];
                    const isUnread = n.status === "UNREAD";
                    const inner = (
                      <div className={`flex items-start gap-3 p-3 transition ${
                        isUnread ? tone.bg : "bg-card"
                      } hover:bg-secondary/50`}>
                        <span className={`mt-1.5 inline-block size-2 shrink-0 rounded-full ${
                          isUnread ? tone.dot : "bg-muted-foreground/40"
                        }`} />
                        <div className="min-w-0 flex-1">
                          <p className={`text-sm leading-tight ${
                            isUnread ? "font-bold text-foreground" : "font-medium text-muted-foreground"
                          }`}>
                            {n.title}
                          </p>
                          {n.body && (
                            <p className="mt-0.5 text-xs text-muted-foreground line-clamp-2">
                              {n.body}
                            </p>
                          )}
                          <p className="mt-1 text-[10px] text-muted-foreground/80">
                            {relativeTime(new Date(n.createdAt))}
                          </p>
                        </div>
                        {n.href && (
                          <ChevronRight className="mt-1 size-4 shrink-0 text-muted-foreground" />
                        )}
                      </div>
                    );
                    return (
                      <li key={n.id} className="group relative">
                        {n.href ? (
                          <Link
                            href={n.href}
                            onClick={() => {
                              if (isUnread) handleRead(n.id);
                              setOpen(false);
                            }}
                            className="block"
                          >
                            {inner}
                          </Link>
                        ) : (
                          <button
                            type="button"
                            onClick={() => isUnread && handleRead(n.id)}
                            className="block w-full text-left"
                          >
                            {inner}
                          </button>
                        )}
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleArchive(n.id);
                          }}
                          title="Αρχειοθέτηση"
                          className="absolute right-1 top-1 hidden size-7 place-items-center rounded-md text-muted-foreground hover:bg-card hover:text-foreground group-hover:grid"
                        >
                          <Archive className="size-3.5" />
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>

            <div className="border-t border-border bg-secondary/30 px-4 py-2 text-center text-[10px] text-muted-foreground">
              Live · συγχρονισμός σε πραγματικό χρόνο
            </div>
          </aside>
        </div>
      )}
    </>
  );
}

function relativeTime(d: Date): string {
  const diff = Date.now() - d.getTime();
  const m = Math.round(diff / 60000);
  if (m < 1)  return "τώρα";
  if (m < 60) return `${m}′ πριν`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h}h πριν`;
  const days = Math.round(h / 24);
  if (days < 7) return `${days} ${days === 1 ? "ημέρα" : "ημέρες"} πριν`;
  return d.toLocaleDateString("el-GR", { day: "2-digit", month: "short" });
}
