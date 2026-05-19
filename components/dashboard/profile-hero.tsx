"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  Camera,
  CheckCircle2,
  Globe,
  Loader2,
  Mail,
  Phone,
  ShieldCheck,
  Sparkles,
} from "lucide-react";

import { cn } from "@/lib/utils";
import { uploadImage } from "@/server/actions/upload.action";
import { updateUserDetails } from "@/server/actions/user.action";

interface ProfileHeroProps {
  user: {
    id: string;
    name: string | null;
    email: string;
    phone: string | null;
    image: string | null;
    role: string;
    locale: string;
    timezone: string;
    marketingConsent: boolean;
    createdAt: Date;
  };
  stats: {
    moveCount: number;
    totalVolumeM3: number;
    locationsCount: number;
    itemsCount: number;
  };
}

const ROLE_LABEL: Record<string, string> = {
  CUSTOMER: "Πελάτης",
  TENANTADMIN: "Tenant Admin",
  TENANTEMPLOYEE: "Tenant Employee",
  EMPLOYEE: "SmartMove Employee",
  SUPERADMIN: "Superadmin",
};

export function ProfileHero({ user, stats }: ProfileHeroProps) {
  const router = useRouter();
  const [image, setImage] = useState<string | null>(user.image);
  const [uploading, startUpload] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const initials = (user.name ?? user.email)
    .split(/[\s@]/)
    .map((p) => p[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();

  function onPickAvatar(e: React.ChangeEvent<HTMLInputElement>) {
    setError(null);
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      setError("Μέγιστο 5MB.");
      return;
    }
    startUpload(async () => {
      const fd = new FormData();
      fd.append("file", file);
      fd.append("purpose", "user-avatar");
      if (image) fd.append("replaceUrl", image);
      const up = await uploadImage(fd);
      if (!up.ok) {
        setError(up.error);
        return;
      }
      // Persist on the user record too
      const res = await updateUserDetails({
        name: user.name ?? "",
        phone: user.phone ?? "",
        locale: user.locale ?? "el",
        timezone: user.timezone ?? "Europe/Athens",
        marketingConsent: user.marketingConsent,
        image: up.url,
      });
      if (res.ok) {
        setImage(up.url);
        router.refresh();
      } else {
        setError(res.error);
      }
    });
  }

  const memberSince = new Intl.DateTimeFormat("el-GR", {
    month: "long",
    year: "numeric",
  }).format(user.createdAt);

  return (
    <section className="relative overflow-hidden rounded-2xl border border-border bg-card shadow-[var(--shadow-card)]">
      {/* Decorative gradient */}
      <div
        className="absolute inset-0 -z-0"
        style={{
          background:
            "linear-gradient(135deg, var(--color-brand-blue-light) 0%, transparent 60%), radial-gradient(circle at 90% 10%, rgba(239,68,68,0.08), transparent 50%)",
        }}
        aria-hidden
      />
      <div className="relative grid gap-6 p-6 sm:p-8 lg:grid-cols-[auto_1fr_auto] lg:items-center">
        {/* Avatar */}
        <div className="relative">
          <div className="relative grid size-24 place-items-center overflow-hidden rounded-2xl border-2 border-white bg-[var(--color-brand-blue)] text-2xl font-bold text-white shadow-lg sm:size-28">
            {image ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={image}
                alt={user.name ?? user.email}
                className="size-full object-cover"
              />
            ) : (
              <span>{initials || "U"}</span>
            )}
            {uploading && (
              <span className="absolute inset-0 grid place-items-center bg-foreground/40">
                <Loader2 className="size-6 animate-spin text-white" />
              </span>
            )}
          </div>
          <label
            className={cn(
              "absolute -bottom-1 -right-1 inline-flex size-9 cursor-pointer items-center justify-center rounded-xl border-2 border-white bg-[var(--color-brand-blue)] text-white shadow-md transition-transform hover:scale-105",
              uploading && "pointer-events-none opacity-60",
            )}
            title="Αλλαγή φωτογραφίας"
          >
            <Camera className="size-4" />
            <input
              type="file"
              accept="image/*"
              className="hidden"
              onChange={onPickAvatar}
              disabled={uploading}
            />
          </label>
        </div>

        {/* Identity */}
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="font-display text-2xl font-bold text-foreground sm:text-3xl">
              {user.name ?? "Συμπλήρωσε το όνομά σου"}
            </h1>
            <span className="inline-flex items-center gap-1 rounded-full bg-[var(--color-brand-blue-light)] px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-[var(--color-brand-blue-deep)]">
              <ShieldCheck className="size-3" />
              {ROLE_LABEL[user.role] ?? user.role}
            </span>
            {!user.phone && (
              <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-amber-700">
                Λείπει τηλέφωνο
              </span>
            )}
          </div>
          <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted-foreground">
            <span className="inline-flex items-center gap-1.5">
              <Mail className="size-3.5" />
              {user.email}
            </span>
            <span className="inline-flex items-center gap-1.5">
              <Phone className="size-3.5" />
              {user.phone ?? "—"}
            </span>
            <span className="inline-flex items-center gap-1.5">
              <Globe className="size-3.5" />
              {user.locale === "el" ? "Ελληνικά" : "English"}
            </span>
            <span className="inline-flex items-center gap-1.5">
              <Sparkles className="size-3.5" />
              Μέλος από {memberSince}
            </span>
          </div>
          {error && (
            <p className="mt-2 text-xs text-destructive">{error}</p>
          )}
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <Stat label="Αιτήματα" value={stats.moveCount} />
          <Stat label="m³ συνολικά" value={stats.totalVolumeM3.toFixed(1)} />
          <Stat label="Διευθύνσεις" value={stats.locationsCount} />
          <Stat label="Έπιπλα" value={stats.itemsCount} />
        </div>
      </div>

      {/* Status strip */}
      <div className="relative flex items-center gap-3 border-t border-border bg-secondary/40 px-6 py-3 text-xs sm:px-8">
        {user.phone ? (
          <span className="inline-flex items-center gap-1.5 font-medium text-emerald-700">
            <CheckCircle2 className="size-3.5" />
            Προφίλ πλήρες
          </span>
        ) : (
          <span className="inline-flex items-center gap-1.5 font-medium text-amber-700">
            <Phone className="size-3.5" />
            Πρόσθεσε τηλέφωνο για να ολοκληρώσεις το προφίλ σου
          </span>
        )}
        <span className="ml-auto text-muted-foreground">ID: {user.id.slice(-8)}</span>
      </div>
    </section>
  );
}

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-xl border border-border bg-white/70 px-3 py-2 text-center backdrop-blur">
      <p className="font-display text-xl font-bold text-foreground tabular-nums sm:text-2xl">
        {value}
      </p>
      <p className="text-[10px] uppercase tracking-wide text-muted-foreground">
        {label}
      </p>
    </div>
  );
}
