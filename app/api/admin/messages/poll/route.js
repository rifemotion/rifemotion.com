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
    const existingMessages = db.messages || [];
    const knownIds = new Set();
    existingMessages.forEach(m => {
      if (m.id) knownIds.add(m.id);
      if (m.rawGoogleId) knownIds.add(m.rawGoogleId);
      if (Array.isArray(m.threadItems)) {
        m.threadItems.forEach(ti => {
          if (ti.id) knownIds.add(ti.id);
        });
      }
    });

    const userEmail = (session?.user?.email || '').toLowerCase();
    const activeAccounts = [];
    if (session.accessToken && session?.user?.email) {
      activeAccounts.push({ token: session.accessToken, email: session.user.email });
    }

    const connectedAccounts = db.connectedGmailAccounts || [];
    for (const acc of connectedAccounts) {
      const accEmail = (acc?.email || '').toLowerCase();
      if (accEmail && accEmail !== userEmail && acc.refreshToken) {
        const fresh = await getAccessTokenForRefreshToken(acc.refreshToken);
        if (fresh) activeAccounts.push({ token: fresh, email: acc.email });
      }
    }

    // Check each account for new message IDs
    const accountsWithNewMessages = [];
    for (const acc of activeAccounts) {
      try {
        const listRes = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/messages?maxResults=10', {
          headers: { Authorization: `Bearer ${acc.token}` }
        });
        if (listRes.ok) {
          const listData = await listRes.json();
          const msgs = listData.messages || [];
          let hasUnseen = false;
          for (const m of msgs) {
            const formattedId = `gmail_${acc.email.replace(/[^a-zA-Z0-9]/g, '_')}_${m.id}`;
            if (!knownIds.has(formattedId) && !knownIds.has(m.id)) {
              hasUnseen = true;
              break;
            }
          }
          if (hasUnseen) {
            accountsWithNewMessages.push(acc);
          }
        }
      } catch(e) {}
    }

    if (accountsWithNewMessages.length === 0) {
      return NextResponse.json({ ok: true, hasNew: false, count: existingMessages.length });
    }

    // Process only inboxes that received new emails
    const apiKey = getGeminiKey();
    const newlyFetched = [];
    for (const acc of accountsWithNewMessages) {
      const msgs = await fetchEmailsForAccount(acc.token, acc.email, apiKey, 10);
      newlyFetched.push(...msgs);
    }

    // Merge new messages with existing DB messages by ID
    const msgMap = new Map();
    existingMessages.forEach(m => {
      if (m.threadItems && Array.isArray(m.threadItems)) {
        m.threadItems.forEach(ti => msgMap.set(ti.id, ti));
      } else if (m.id) {
        msgMap.set(m.id, m);
      }
    });

    newlyFetched.forEach(m => msgMap.set(m.id, m));

    const updatedThreads = groupMessagesIntoThreads(Array.from(msgMap.values()));
    db.messages = updatedThreads;
    await saveDb(db);

    return NextResponse.json({
      ok: true,
      hasNew: true,
      messages: updatedThreads,
      newCount: newlyFetched.length
    });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
