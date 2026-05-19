import NextAuth from "next-auth";
import { PrismaAdapter } from "@auth/prisma-adapter";
import Credentials from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { z } from "zod";

import authConfig from "./auth.config";
import { db } from "./db";

const credentialsSchema = z.object({
  email: z.string().email("Μη έγκυρο email"),
  password: z.string().min(8, "Τουλάχιστον 8 χαρακτήρες"),
});

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  adapter: PrismaAdapter(db),
  providers: [
    ...authConfig.providers,
    Credentials({
      name: "Credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(creds) {
        const parsed = credentialsSchema.safeParse(creds);
        if (!parsed.success) return null;

        const user = await db.user.findUnique({
          where: { email: parsed.data.email.toLowerCase().trim() },
        });
        if (!user || !user.passwordHash || user.deletedAt) return null;
        if (user.active === false) return null;

        const ok = await bcrypt.compare(
          parsed.data.password,
          user.passwordHash,
        );
        if (!ok) return null;

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          image: user.image,
          role: user.role,
          locale: user.locale,
          permissions: user.permissions ?? [],
        } as {
          id: string;
          email: string;
          name: string | null;
          image: string | null;
          role: string;
          locale: string;
          permissions: string[];
        };
      },
    }),
  ],
});
