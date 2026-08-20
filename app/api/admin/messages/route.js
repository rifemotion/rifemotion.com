import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import { getDb, saveDb } from '@/lib/db';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

async function fetchRealGmailMessages(accessToken, accountEmail) {
  if (!accessToken) return [];
  try {
    // 1. List last 20 messages
    const listRes = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/messages?maxResults=20', {
      headers: { Authorization: `Bearer ${accessToken}` }
    });

    if (!listRes.ok) {
      console.error("Gmail list error:", listRes.status, await listRes.text());
      return [];
    }

    const listData = await listRes.json();
    const msgIds = (listData.messages || []).map(m => m.id);

    if (msgIds.length === 0) return [];

    // 2. Fetch full message details in parallel
    const detailPromises = msgIds.map(async (id) => {
      try {
        const msgRes = await fetch(`https://gmail.googleapis.com/gmail/v1/users/me/messages/${id}?format=full`, {
          headers: { Authorization: `Bearer ${accessToken}` }
        });
        if (!msgRes.ok) return null;
        const msg = await msgRes.json();

        const headers = msg.payload?.headers || [];
        const subjectHeader = headers.find(h => h.name.toLowerCase() === 'subject')?.value || 'No Subject';
        const fromHeader = headers.find(h => h.name.toLowerCase() === 'from')?.value || 'Unknown Sender';
        const dateHeader = headers.find(h => h.name.toLowerCase() === 'date')?.value || new Date().toISOString();

        // Extract sender name & email
        let senderName = fromHeader;
        let senderEmail = fromHeader;
        const fromMatch = fromHeader.match(/^(.*?)\s*<(.+?)>$/);
        if (fromMatch) {
          senderName = fromMatch[1].replace(/^["']|["']$/g, '').trim() || fromMatch[2];
          senderEmail = fromMatch[2].trim();
        }

        // Extract plain text snippet / body
        let bodyText = msg.snippet || '';
        if (msg.payload?.parts) {
          const textPart = msg.payload.parts.find(p => p.mimeType === 'text/plain');
          if (textPart?.body?.data) {
            try {
              bodyText = Buffer.from(textPart.body.data, 'base64').toString('utf8');
            } catch(e) {}
          }
        }

        const isUnread = (msg.labelIds || []).includes('UNREAD');
        const isImportant = (msg.labelIds || []).includes('IMPORTANT');

        return {
          id: `gmail_${msg.id}`,
          platform: 'gmail',
          account: accountEmail || 'Connected Gmail',
          accountEmail: accountEmail || 'me',
          sender: senderName,
          senderEmail: senderEmail,
          shortTitle: subjectHeader,
          subject: subjectHeader,
          body: bodyText,
          urgency: isImportant ? 'red' : (isUnread ? 'yellow' : 'grey'),
          read: !isUnread,
          date: new Date(dateHeader).toISOString() || new Date(parseInt(msg.internalDate, 10)).toISOString(),
          url: `https://mail.google.com/mail/u/0/#inbox/${msg.id}`
        };
      } catch (e) {
        return null;
      }
    });

    const results = await Promise.all(detailPromises);
    return results.filter(Boolean);
  } catch (err) {
    console.error("Error in fetchRealGmailMessages:", err);
    return [];
  }
}

export async function GET(request) {
  const session = await getServerSession(authOptions);
  if (!session || !session.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const db = await getDb();
    let messages = db.messages || [];

    // If session has active Google Access Token and no messages yet, auto fetch real Gmail emails
    if (session.accessToken && messages.length === 0) {
      const realMessages = await fetchRealGmailMessages(session.accessToken, session.user.email);
      if (realMessages.length > 0) {
        messages = realMessages;
        db.messages = messages;
        await saveDb(db);
      }
    }

    return NextResponse.json({ ok: true, messages });
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
    if (!session.accessToken) {
      return NextResponse.json({
        ok: false,
        error: "No Google OAuth Access Token found. Please re-login via Google to grant Gmail API permissions."
      }, { status: 403 });
    }

    const realMessages = await fetchRealGmailMessages(session.accessToken, session.user.email);

    const db = await getDb();
    const existing = db.messages || [];
    
    // Merge real emails by ID
    const msgMap = new Map();
    existing.forEach(m => { if (m && m.id) msgMap.set(m.id, m); });
    realMessages.forEach(m => { if (m && m.id) msgMap.set(m.id, m); });

    const finalMessages = Array.from(msgMap.values()).sort((a, b) => new Date(b.date) - new Date(a.date));
    db.messages = finalMessages;
    await saveDb(db);

    return NextResponse.json({ ok: true, messages: finalMessages, syncedCount: realMessages.length });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
