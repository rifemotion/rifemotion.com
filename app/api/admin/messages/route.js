import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import { getDb, saveDb } from '@/lib/db';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

// FETCH 100% REAL EMAILS DIRECTLY FROM GOOGLE GMAIL REST API
async function fetchRealGmailMessages(accessToken, userEmail) {
  if (!accessToken) {
    throw new Error("No Google Access Token found. Please sign in with Google.");
  }

  // 1. Fetch last 20 real message IDs from user's actual Gmail Inbox
  const listRes = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/messages?maxResults=20', {
    headers: { Authorization: `Bearer ${accessToken}` }
  });

  if (!listRes.ok) {
    const errText = await listRes.text();
    throw new Error(`Google Gmail API Error (${listRes.status}): ${errText}`);
  }

  const listData = await listRes.json();
  const messagesList = listData.messages || [];

  if (messagesList.length === 0) {
    return [];
  }

  // 2. Fetch full real metadata and body for each message
  const detailPromises = messagesList.map(async (item) => {
    try {
      const msgRes = await fetch(`https://gmail.googleapis.com/gmail/v1/users/me/messages/${item.id}?format=full`, {
        headers: { Authorization: `Bearer ${accessToken}` }
      });

      if (!msgRes.ok) return null;
      const msg = await msgRes.json();

      const headers = msg.payload?.headers || [];
      const subjectHeader = headers.find(h => h.name.toLowerCase() === 'subject')?.value || '(No Subject)';
      const fromHeader = headers.find(h => h.name.toLowerCase() === 'from')?.value || 'Unknown Sender';
      const dateHeader = headers.find(h => h.name.toLowerCase() === 'date')?.value || '';

      // Extract sender display name and email address
      let senderName = fromHeader;
      let senderEmail = fromHeader;
      const fromMatch = fromHeader.match(/^(.*?)\s*<(.+?)>$/);
      if (fromMatch) {
        senderName = fromMatch[1].replace(/^["']|["']$/g, '').trim() || fromMatch[2];
        senderEmail = fromMatch[2].trim();
      }

      // Extract real body text snippet
      let bodyText = msg.snippet || '';
      if (msg.payload?.parts) {
        const textPart = msg.payload.parts.find(p => p.mimeType === 'text/plain');
        if (textPart?.body?.data) {
          try {
            bodyText = Buffer.from(textPart.body.data, 'base64').toString('utf8');
          } catch(e) {}
        }
      } else if (msg.payload?.body?.data) {
        try {
          bodyText = Buffer.from(msg.payload.body.data, 'base64').toString('utf8');
        } catch(e) {}
      }

      const isUnread = (msg.labelIds || []).includes('UNREAD');
      const isImportant = (msg.labelIds || []).includes('IMPORTANT') || (msg.labelIds || []).includes('STARRED');

      let parsedDate = new Date().toISOString();
      if (dateHeader) {
        try {
          parsedDate = new Date(dateHeader).toISOString();
        } catch(e) {
          parsedDate = new Date(parseInt(msg.internalDate, 10)).toISOString();
        }
      } else if (msg.internalDate) {
        parsedDate = new Date(parseInt(msg.internalDate, 10)).toISOString();
      }

      return {
        id: `gmail_${msg.id}`,
        platform: 'gmail',
        account: userEmail || 'Main Account',
        accountEmail: userEmail || 'me',
        sender: senderName,
        senderEmail: senderEmail,
        shortTitle: subjectHeader,
        subject: subjectHeader,
        body: bodyText,
        urgency: isImportant ? 'red' : (isUnread ? 'yellow' : 'grey'),
        read: !isUnread,
        date: parsedDate,
        url: `https://mail.google.com/mail/u/0/#inbox/${msg.id}`
      };
    } catch(err) {
      console.error(`Error loading message ${item.id}:`, err);
      return null;
    }
  });

  const results = await Promise.all(detailPromises);
  return results.filter(Boolean);
}

export async function GET(request) {
  const session = await getServerSession(authOptions);
  if (!session || !session.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const db = await getDb();
    let messages = db.messages || [];

    // Filter out any leftover fake messages from previous tests
    messages = messages.filter(m => m.id && m.id.startsWith('gmail_') && !m.id.includes('@'));

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

  if (!session.accessToken) {
    return NextResponse.json({
      ok: false,
      error: "No active Google Access Token. Please sign out and sign in with Google to grant Gmail API access."
    }, { status: 403 });
  }

  try {
    const realMessages = await fetchRealGmailMessages(session.accessToken, session.user.email);

    const db = await getDb();
    
    // Store strictly real Gmail messages
    db.messages = realMessages;
    await saveDb(db);

    return NextResponse.json({
      ok: true,
      messages: realMessages,
      syncedCount: realMessages.length,
      userEmail: session.user.email
    });
  } catch (error) {
    console.error("Gmail Sync Error:", error);
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }
}
