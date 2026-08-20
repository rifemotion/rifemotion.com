import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import { getDb, saveDb } from '@/lib/db';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const DEFAULT_GEMINI_KEY = process.env.GEMINI_API_KEY || process.env.GEMINI_KEY || "";

function stripHtmlJunk(html) {
  if (!html) return '';
  return html
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<head[\s\S]*?<\/head>/gi, '')
    .replace(/<!DOCTYPE[\s\S]*?>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&quot;/gi, '"')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/\s{2,}/g, ' ')
    .trim();
}

function formatLinksAsPills(text) {
  if (!text) return '';
  const urlRegex = /(https?:\/\/[^\s<>"']+)/gi;
  return text.replace(urlRegex, (url) => {
    return `<a href="${url}" target="_blank" rel="noopener noreferrer" class="emailLinkPill" title="${url}"><svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="margin-right:3px; vertical-align:middle;"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"></path><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"></path></svg>Link</a>`;
  });
}

// Process email with Gemini to extract clean body, title, author, urgency, and threadTopic
async function processEmailWithGemini(subject, sender, rawBody, apiKey) {
  const effectiveKey = apiKey || DEFAULT_GEMINI_KEY;

  try {
    const prompt = `Analyze this email and return STRICT JSON with fields:
- "author": clean short name of sender or service (e.g. "Manychat", "Vercel", "Google", "Santander", "Lloyd"). Max 2 words.
- "geminiTitle": concise, clear and informative Russian title of the email (e.g. "Отмена подписки Manychat Pro", "Сбой деплоя Vercel", "Код подтверждения почты"). Max 6 words.
- "cleanBody": the core meaningful message text in clean readable form. STRIP ALL marketing boilerplate footers, unsubscribe links, tracking codes, and copyright addresses (like "Copyright 2026 Vercel Inc. 440 N Barranca Ave...").
- "urgency": one of "red" (urgent action/error/payment problem), "yellow" (notice/warning/update), "green" (success/verified/settled), "grey" (routine/info).
- "threadTopic": short normalized identifier for grouping emails from same sender on same topic (e.g. "manychat_pro", "vercel_deployment").

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
          cleanBody: parsed.cleanBody || rawBody,
          urgency: ['red', 'yellow', 'green', 'grey'].includes(parsed.urgency) ? parsed.urgency : 'grey',
          threadTopic: parsed.threadTopic || subject
        };
      }
    }
  } catch(e) {
    console.error("Gemini email processing error:", e);
  }

  // Fallback if Gemini request fails
  let fallbackUrgency = 'grey';
  const lowSub = (subject + ' ' + rawBody).toLowerCase();
  if (lowSub.includes('fail') || lowSub.includes('error') || lowSub.includes('cancel') || lowSub.includes('urgent') || lowSub.includes('отмена')) {
    fallbackUrgency = 'red';
  } else if (lowSub.includes('warn') || lowSub.includes('update') || lowSub.includes('missing') || lowSub.includes('notice')) {
    fallbackUrgency = 'yellow';
  } else if (lowSub.includes('success') || lowSub.includes('verified') || lowSub.includes('enabled') || lowSub.includes('включена')) {
    fallbackUrgency = 'green';
  }

  return {
    author: sender.split(' ')[0] || sender,
    geminiTitle: subject,
    cleanBody: rawBody.slice(0, 1500),
    urgency: fallbackUrgency,
    threadTopic: subject.toLowerCase().slice(0, 30)
  };
}

// FETCH REAL GMAIL EMAILS AND PROCESS THEM WITH GEMINI
async function fetchAndProcessGmailMessages(accessToken, userEmail) {
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

  const apiKey = DEFAULT_GEMINI_KEY;

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

      // Process with Gemini to extract clean human text and clean Russian title
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
        sender: senderName,
        senderEmail: senderEmail,
        author: processed.author,
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
    const realMessages = await fetchAndProcessGmailMessages(session.accessToken, session.user.email);

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
