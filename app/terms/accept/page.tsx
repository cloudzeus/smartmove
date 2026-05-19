import { redirect } from "next/navigation";

import { auth } from "@/lib/auth";
import { getActiveTerms } from "@/lib/terms";
import { AcceptTermsClient } from "@/components/terms/accept-client";

export const dynamic = "force-dynamic";
export const metadata = { title: "Όροι Χρήσης" };

export default async function AcceptTermsPage() {
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/sign-in?next=/terms/accept");
  }

  const active = await getActiveTerms();
  if (!active) {
    // No active terms — nothing to accept; send them back.
    redirect("/");
  }

  // Staff don't need to accept (already gated in requireAcceptedTerms helper),
  // but we still allow viewing.
  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto max-w-3xl px-4 py-10 sm:px-6 lg:px-8">
        <AcceptTermsClient
          version={active.version}
          summary={active.summary}
          bodyEl={active.bodyEl}
          bodyEn={active.bodyEn}
          publishedAt={active.publishedAt.toISOString()}
        />
      </div>
    </div>
  );
}
