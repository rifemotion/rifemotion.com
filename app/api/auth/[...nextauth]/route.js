import NextAuth from "next-auth";
import GoogleProvider from "next-auth/providers/google";
import { getDb, saveDb } from "@/lib/db";

async function refreshAccessToken(token) {
  try {
    const url = "https://oauth2.googleapis.com/token";
    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: process.env.GOOGLE_CLIENT_ID || "",
        client_secret: process.env.GOOGLE_CLIENT_SECRET || "",
        grant_type: "refresh_token",
        refresh_token: token.refreshToken,
      }),
    });

    const refreshedTokens = await response.json();

    if (!response.ok) {
      throw refreshedTokens;
    }

    return {
      ...token,
      accessToken: refreshedTokens.access_token,
      accessTokenExpires: Date.now() + (refreshedTokens.expires_in * 1000),
      refreshToken: refreshedTokens.refresh_token ?? token.refreshToken,
    };
  } catch (error) {
    console.error("[NextAuth] RefreshAccessTokenError", error);
    return {
      ...token,
      error: "RefreshAccessTokenError",
    };
  }
}

export const authOptions = {
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID || "",
      clientSecret: process.env.GOOGLE_CLIENT_SECRET || "",
      authorization: {
        params: {
          scope: "openid email profile https://www.googleapis.com/auth/gmail.readonly",
          access_type: "offline",
          prompt: "consent",
        },
      },
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
    async signIn({ user, account }) {
      const allowedEmails = (process.env.ALLOWED_ADMIN_EMAILS || "")
        .split(",")
        .map((e) => e.trim().toLowerCase())
        .filter(Boolean);

      if (allowedEmails.length > 0) {
        if (!user.email || !allowedEmails.includes(user.email.toLowerCase())) {
          console.warn(`[Auth] Access denied for unauthorized email: ${user.email}`);
          return false;
        }
      }

      // Automatically store/update this account's refresh token in connectedGmailAccounts DB
      if (user.email && account?.refresh_token) {
        try {
          const db = await getDb();
          const accounts = db.connectedGmailAccounts || [];
          const existingIdx = accounts.findIndex(a => a.email.toLowerCase() === user.email.toLowerCase());
          const accObj = {
            email: user.email.toLowerCase(),
            name: user.name || user.email,
            refreshToken: account.refresh_token,
            updatedAt: Date.now()
          };
          if (existingIdx !== -1) {
            accounts[existingIdx] = { ...accounts[existingIdx], ...accObj };
          } else {
            accounts.push(accObj);
          }
          db.connectedGmailAccounts = accounts;
          await saveDb(db);
        } catch(err) {
          console.error("Error saving connected gmail account token:", err);
        }
      }

      return true;
    },
    async jwt({ token, account, user }) {
      // Initial sign in
      if (account && user) {
        return {
          accessToken: account.access_token,
          accessTokenExpires: Date.now() + ((account.expires_in || 3600) * 1000),
          refreshToken: account.refresh_token,
          user,
        };
      }

      // Return previous token if the access token has not expired yet (with 2 min buffer)
      if (Date.now() < (token.accessTokenExpires - 120000)) {
        return token;
      }

      // Access token has expired, try to update it
      return refreshAccessToken(token);
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.sub;
        session.user.isAdmin = true;
        session.accessToken = token.accessToken;
        session.refreshToken = token.refreshToken;
        session.error = token.error;
      }
      return session;
    },
  },
  secret: process.env.NEXTAUTH_SECRET || "rifemotion_default_dev_secret_2026",
};

const handler = NextAuth(authOptions);

export { handler as GET, handler as POST };
