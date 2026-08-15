import NextAuth from "next-auth";
import GoogleProvider from "next-auth/providers/google";

export const authOptions = {
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID || "",
      clientSecret: process.env.GOOGLE_CLIENT_SECRET || "",
    }),
  ],
  pages: {
    signIn: "/admin/login",
  },
  session: {
    strategy: "jwt",
    maxAge: 30 * 24 * 60 * 60, // 30 days session
  },
  callbacks: {
    async signIn({ user }) {
      const allowedEmails = (process.env.ALLOWED_ADMIN_EMAILS || "")
        .split(",")
        .map((e) => e.trim().toLowerCase())
        .filter(Boolean);

      // If allowed emails are specified, enforce whitelist
      if (allowedEmails.length > 0) {
        if (!user.email || !allowedEmails.includes(user.email.toLowerCase())) {
          console.warn(`[Auth] Access denied for unauthorized email: ${user.email}`);
          return false;
        }
      }
      return true;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.sub;
        session.user.isAdmin = true;
      }
      return session;
    },
  },
  secret: process.env.NEXTAUTH_SECRET || "rifemotion_default_dev_secret_2026",
};

const handler = NextAuth(authOptions);

export { handler as GET, handler as POST };
