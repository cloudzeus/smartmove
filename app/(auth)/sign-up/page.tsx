import { Suspense } from "react";
import type { Metadata } from "next";

import { SignUpForm } from "@/components/auth/sign-up-form";
import { flags } from "@/lib/env";

export const metadata: Metadata = {
  title: "Εγγραφή",
};

export default function SignUpPage() {
  return (
    <Suspense>
      <SignUpForm microsoftEnabled={flags.hasMicrosoftAuth()} />
    </Suspense>
  );
}
