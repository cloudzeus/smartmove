import { Suspense } from "react";
import type { Metadata } from "next";

import { SignInForm } from "@/components/auth/sign-in-form";
import { flags } from "@/lib/env";

export const metadata: Metadata = {
  title: "Σύνδεση",
};

export default function SignInPage() {
  return (
    <Suspense>
      <SignInForm microsoftEnabled={flags.hasMicrosoftAuth()} />
    </Suspense>
  );
}
