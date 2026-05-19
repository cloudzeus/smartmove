"use server";

import { signIn, signOut } from "@/lib/auth";

export async function signInWithMicrosoft(callbackUrl?: string) {
  await signIn("microsoft-entra-id", { redirectTo: callbackUrl ?? "/scan" });
}

export async function signOutAction() {
  await signOut({ redirectTo: "/" });
}
