import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import { getDb, saveDb } from '@/lib/db';
import { getGeminiKey } from '@/lib/gemini-config';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

function decodeHtmlEntities(str) {
  if (!str) return '';
  return str
    .replace(/&#xA0;/gi, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&#039;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&#x27;/g, "'")
    .replace(/&#x2F;/g, "/")
    .replace(/&#39;/g, "'");
}

function stripHtmlJunk(html) {
  if (!html) return '';
  let cleaned = html
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<head[\s\S]*?<\/head>/gi, '')
    .replace(/<!DOCTYPE[\s\S]*?>/gi, '')
    .replace(/<[^>]+>/g, ' ');
  return decodeHtmlEntities(cleaned).replace(/\s{2,}/g, ' ').trim();
}

function formatLinksAsPills(text) {
  if (!text) return '';
  let cleanText = text.replace(/<((?:https?:\/\/)[^>]+)>/gi, '$1');
  const urlRegex = /(https?:\/\/[^\s<>"']+)/gi;
  return cleanText.replace(urlRegex, (url) => {
    return `<a href="${url}" target="_blank" rel="noopener noreferrer" class="emailLinkPill" title="${url}"><svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="margin-right:4px; vertical-align:-1px;"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"></path><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"></path></svg>Link</a>`;
  });
}

// Full AI rewriter: transforms raw email into clean readable executive studio digest
async function processEmailWithGemini(subject, sender, rawBody, apiKey) {
  const effectiveKey = apiKey || getGeminiKey();

  if (effectiveKey) {
    try {
      const prompt = `You are an executive studio email parsing engine.
Your task is to REWRITE and CLEAN this incoming email into a concise, readable, and professional digest.

REWRITING RULES (Return STRICT JSON ONLY):
1. "author": Clean sender name or company/service name (e.g. "Manychat", "Vercel", "Google", "Namecheap", "Lloyd Alvarez"). Max 2 words.
2. "geminiTitle": Sharp, clean, and informative title in the email's natural language (do NOT force translation if it is in English; if Russian keep Russian, if English keep English). Max 6 words.
3. "urgency":
   - "red": Urgent action required, service cancellation, failed deployment, payment issues, security alerts.
   - "yellow": Maintenance notices, important inquiries, project deadlines.
   - "green": Verification successful, service restored, payment received.
   - "grey": Routine notifications, newsletters, marketing.
4. "cleanBody": Clear, readable, formatted body text.
   - STRIP ALL JUNK: Remove "Copyright 2026...", "View in browser", office physical addresses, unsubscribe links, duplicate subject headers, tracking fragments.
   - Retain only the actual meaningful message content.
   - Keep important URLs clean (e.g. https://vercel.com/help).

Email Subject: ${subject}
Email Sender: ${sender}
Email Content:
${rawBody.slice(0, 3000)}`;

      const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.1-flash-lite:generateContent?key=${effectiveKey}`;
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ role: 'user', parts: [{ text: prompt }] }],
          generationConfig: { response_mime_type: "application/json" }
        })
      });

      if (res.ok) {
        const data = await res.json();
        const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
        if (text) {
          const parsed = JSON.parse(text);
          return {
            author: parsed.author || sender.split(' ')[0] || sender,
            geminiTitle: parsed.geminiTitle || subject,
            cleanBody: decodeHtmlEntities(parsed.cleanBody || rawBody),
            urgency: ['red', 'yellow', 'green', 'grey'].includes(parsed.urgency) ? parsed.urgency : 'grey',
            threadTopic: parsed.threadTopic || subject
          };
        }
      } else {
        console.error("Gemini API HTTP Error:", res.status, await res.text());
      }
    } catch(e) {
      console.error("Gemini email rewriting error:", e);
    }
  }

  // Smart fallback
  let fallbackUrgency = 'grey';
  const low = (subject + ' ' + rawBody).toLowerCase();
  if (low.includes('cancel') || low.includes('fail') || low.includes('error') || low.includes('отмена') || low.includes('сбой') || low.includes('security') || low.includes('alert')) {
    fallbackUrgency = 'red';
  } else if (low.includes('warn') || low.includes('update') || low.includes('notice') || low.includes('outage') || low.includes('missing')) {
    fallbackUrgency = 'yellow';
  } else if (low.includes('success') || low.includes('verified') || low.includes('restored') || low.includes('включена') || low.includes('enabled')) {
    fallbackUrgency = 'green';
  }

  let cleaned = decodeHtmlEntities(rawBody)
    .replace(/View in browser/gi, '')
    .replace(/Copyrights*d{4}[sS]*$/gi, '')
    .slice(0, 1500);

  return {
    author: sender.split(' ')[0] || sender,
    geminiTitle: subject,
    cleanBody: cleaned,
    urgency: fallbackUrgency,
    threadTopic: subject.toLowerCase().slice(0, 30)
  };
}

// FETCH REAL GMAIL EMAILS AND PROCESS THEM WITH GEMINI
async function fetchAndProcessGmailMessages(accessToken, userEmail, userApiKey) {
  if (!accessToken) {
    throw new Error("No Google Access Token found. Please sign in with Google.");
  }

  // 1. Fetch last 20 real message IDs from user's Gmail
  const listRes = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/messages?maxResults=20', {
    headers: { Authorization: `Bearer ${accessToken}` }
  });

  if (!listRes.ok) {
    const errText = await listRes.text();
    throw new Error(`Google Gmail API Error (${listRes.status}): ${errText}`);
  }

  const listData = await listRes.json();
  const messagesList = listData.messages || [];
  if (messagesList.length === 0) return [];

  const apiKey = userApiKey || getGeminiKey();

  // 2. Fetch full metadata & body for each message
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
      const toHeader = headers.find(h => h.name.toLowerCase() === 'to')?.value || userEmail || '';
      const dateHeader = headers.find(h => h.name.toLowerCase() === 'date')?.value || '';

      // Extract sender display name and email address
      let senderName = fromHeader;
      let senderEmail = fromHeader;
      const fromMatch = fromHeader.match(/^(.*?)\s*<(.+?)>$/);
      if (fromMatch) {
        senderName = fromMatch[1].replace(/^["']|["']$/g, '').trim() || fromMatch[2];
        senderEmail = fromMatch[2].trim();
      }

      // Extract raw body
      let rawText = '';
      if (msg.payload?.parts) {
        const textPart = msg.payload.parts.find(p => p.mimeType === 'text/plain');
        const htmlPart = msg.payload.parts.find(p => p.mimeType === 'text/html');
        if (textPart?.body?.data) {
          try { rawText = Buffer.from(textPart.body.data, 'base64').toString('utf8'); } catch(e) {}
        } else if (htmlPart?.body?.data) {
          try { rawText = stripHtmlJunk(Buffer.from(htmlPart.body.data, 'base64').toString('utf8')); } catch(e) {}
        }
      } else if (msg.payload?.body?.data) {
        try {
          const decoded = Buffer.from(msg.payload.body.data, 'base64').toString('utf8');
          rawText = decoded.includes('<html') || decoded.includes('<!DOCTYPE') ? stripHtmlJunk(decoded) : decoded;
        } catch(e) {}
      }

      if (!rawText || rawText.includes('<!DOCTYPE') || rawText.includes('<html')) {
        rawText = stripHtmlJunk(rawText || msg.snippet || '');
      }

      rawText = decodeHtmlEntities(rawText);

      // Process with Gemini to extract clean human text and clean title
      const processed = await processEmailWithGemini(subjectHeader, senderName, rawText, apiKey);

      const isUnread = (msg.labelIds || []).includes('UNREAD');

      let parsedDate = new Date().toISOString();
      if (dateHeader) {
        try { parsedDate = new Date(dateHeader).toISOString(); } catch(e) {
          parsedDate = new Date(parseInt(msg.internalDate, 10)).toISOString();
        }
      } else if (msg.internalDate) {
        parsedDate = new Date(parseInt(msg.internalDate, 10)).toISOString();
      }

      const formattedHtml = formatLinksAsPills(processed.cleanBody);

      return {
        id: `gmail_${msg.id}`,
        platform: 'gmail',
        from: fromHeader,
        to: toHeader,
        sender: processed.author || senderName,
        senderEmail: senderEmail,
        author: processed.author || senderName,
        account: toHeader || userEmail,
        accountEmail: userEmail,
        shortTitle: processed.geminiTitle,
        subject: processed.geminiTitle,
        originalSubject: subjectHeader,
        body: processed.cleanBody,
        formattedHtml: formattedHtml,
        urgency: processed.urgency,
        threadTopic: processed.threadTopic,
        read: !isUnread,
        date: parsedDate,
        url: `https://mail.google.com/mail/u/0/#inbox/${msg.id}`
      };
    } catch(err) {
      console.error(`Error processing email ${item.id}:`, err);
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

    // Filter only real Gmail messages
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
    let reqApiKey = "";
    try {
      const body = await request.json();
      if (body && body.apiKey) reqApiKey = body.apiKey;
    } catch(e) {}

    const realMessages = await fetchAndProcessGmailMessages(session.accessToken, session.user.email, reqApiKey);

    const db = await getDb();
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
