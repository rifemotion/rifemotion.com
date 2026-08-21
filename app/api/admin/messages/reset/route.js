import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import { getDb, saveDb } from '@/lib/db';
import { getGeminiKey } from '@/lib/gemini-config';
import { fetchEmailsForAccount, groupMessagesIntoThreads } from '@/lib/gmail-service';

export const dynamic = 'force-dynamic';

async function getAccessTokenForRefreshToken(refreshToken) {
  try {
    const res = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: process.env.GOOGLE_CLIENT_ID || "",
        client_secret: process.env.GOOGLE_CLIENT_SECRET || "",
        grant_type: "refresh_token",
        refresh_token: refreshToken,
      }),
    });
    if (!res.ok) return null;
    const data = await res.json();
    return data.access_token || null;
  } catch(e) {
    return null;
  }
}

export async function POST(request) {
  const session = await getServerSession(authOptions);
  if (!session || !session.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const db = await getDb();
    
    // Clear existing messages!
    db.messages = [];

    const activeAccounts = [];
    if (session.accessToken) {
      activeAccounts.push({ token: session.accessToken, email: session.user.email });
    }

    const connectedAccounts = db.connectedGmailAccounts || [];
    for (const acc of connectedAccounts) {
      if (acc.email.toLowerCase() !== session.user.email.toLowerCase() && acc.refreshToken) {
        const fresh = await getAccessTokenForRefreshToken(acc.refreshToken);
        if (fresh) activeAccounts.push({ token: fresh, email: acc.email });
      }
    }

    if (activeAccounts.length === 0) {
       await saveDb(db);
       return NextResponse.json({ ok: true, msg: "Cleared. No active accounts to fetch." });
    }

    const apiKey = getGeminiKey();
    const newlyFetched = [];

    // Fetch up to 5 emails for each connected account
    for (const acc of activeAccounts) {
      const msgs = await fetchEmailsForAccount(acc.token, acc.email, apiKey, 5);
      newlyFetched.push(...msgs);
    }

    const msgMap = new Map();
    newlyFetched.forEach(m => msgMap.set(m.id, m));

    const updatedThreads = groupMessagesIntoThreads(Array.from(msgMap.values()));
    db.messages = updatedThreads;
    await saveDb(db);

    return NextResponse.json({
      ok: true,
      messages: updatedThreads
    });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
