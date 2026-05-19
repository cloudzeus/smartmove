import { redirect } from "next/navigation";

import { auth } from "@/lib/auth";
import { requireAcceptedTerms } from "@/lib/terms";
import {
  DashboardBottomNav,
  DashboardSidebar,
} from "@/components/dashboard/sidebar";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();
  if (!session?.user) {
    redirect("/sign-in?next=/dashboard");
  }
  await requireAcceptedTerms("/dashboard");

  return (
    <div className="flex min-h-screen bg-background">
      <DashboardSidebar
        user={{
          name: session.user.name,
          email: session.user.email,
          role: session.user.role,
        }}
      />
      <div className="flex min-w-0 flex-1 flex-col pb-16 lg:pb-0">
        {children}
      </div>
      <DashboardBottomNav />
    </div>
  );
}
