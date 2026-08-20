import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import { getDb, saveDb } from '@/lib/db';
import { getGeminiKey } from '@/lib/gemini-config';
import { fetchEmailsForAccount, groupMessagesIntoThreads } from '@/lib/gmail-service';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

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

export async function GET(request) {
  const session = await getServerSession(authOptions);
  if (!session || !session.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const db = await getDb();
    let rawMessages = db.messages || [];
    rawMessages = rawMessages.filter(m => m.id && m.id.startsWith('gmail_') && !m.id.includes('@'));

    const grouped = groupMessagesIntoThreads(rawMessages);
    const connectedAccounts = (db.connectedGmailAccounts || []).map(a => a.email);

    return NextResponse.json({
      ok: true,
      messages: grouped,
      connectedAccounts: Array.from(new Set([session.user.email, ...connectedAccounts]))
    });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(request) {
  const session = await getServerSession(authOptions);
  if (!session || !session.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    let reqApiKey = "";
    try {
      const body = await request.json();
      if (body && body.apiKey) reqApiKey = body.apiKey;
    } catch(e) {}

    const apiKey = reqApiKey || getGeminiKey();
    const db = await getDb();
    const allFetched = [];

    // 1. Fetch 10 latest from current session inbox
    if (session.accessToken) {
      const sessionMsgs = await fetchEmailsForAccount(session.accessToken, session.user.email, apiKey, 10);
      allFetched.push(...sessionMsgs);
    }

    // 2. Fetch 10 latest from all other connected accounts
    const connectedAccounts = db.connectedGmailAccounts || [];
    for (const acc of connectedAccounts) {
      if (acc.email.toLowerCase() !== session.user.email.toLowerCase() && acc.refreshToken) {
        const freshToken = await getAccessTokenForRefreshToken(acc.refreshToken);
        if (freshToken) {
          const accMsgs = await fetchEmailsForAccount(freshToken, acc.email, apiKey, 10);
          allFetched.push(...accMsgs);
        }
      }
    }

    const grouped = groupMessagesIntoThreads(allFetched);
    db.messages = grouped;
    await saveDb(db);

    return NextResponse.json({
      ok: true,
      messages: grouped,
      syncedCount: allFetched.length,
      connectedAccounts: Array.from(new Set([session.user.email, ...connectedAccounts.map(a => a.email)]))
    });
  } catch (error) {
    console.error("Gmail Multi-Sync Error:", error);
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }
}
