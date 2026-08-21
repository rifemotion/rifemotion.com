import { getGeminiKey } from '@/lib/gemini-config';

export function decodeHtmlEntities(str) {
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

export function stripHtmlJunk(html) {
  if (!html) return '';
  let cleaned = html
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<head[\s\S]*?<\/head>/gi, '')
    .replace(/<!DOCTYPE[\s\S]*?>/gi, '')
    .replace(/<[^>]+>/g, ' ');
  return decodeHtmlEntities(cleaned).replace(/\s{2,}/g, ' ').trim();
}

export function formatLinksAsPills(text) {
  if (!text) return '';
  let cleanText = text
    .replace(/<((?:https?:\/\/)[^>]+)>/gi, '$1')
    .replace(/(?:view in browser|unsubscribe|manage notifications)[^\n]*https?:\/\/[^\s<>"']+/gi, '');

  const urlRegex = /(https?:\/\/[^\s<>"']+)/gi;
  return cleanText.replace(urlRegex, (url) => {
    return `<a href="${url}" target="_blank" rel="noopener noreferrer" class="emailLinkPill" title="${url}"><svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="margin-right:4px; vertical-align:-1px;"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"></path><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"></path></svg>Link</a>`;
  });
}

export function normalizeTopicKey(str) {
  if (!str) return 'general';
  return str
    .toLowerCase()
    .replace(/^(re|fwd|fw|отв|на):\s*/i, '')
    .replace(/rifemotion/g, '')
    .replace(/подписка|subscription/g, 'sub')
    .replace(/отменена|истекла|expired|cancelled|cancellation/g, 'cancel')
    .replace(/деплой|deployment|deploy/g, 'deploy')
    .replace(/сбой|failed|failure|error/g, 'fail')
    .replace(/диалоги|conversions|dms/g, 'dms')
    .replace(/[^a-z0-9]/g, '_')
    .replace(/_+/g, '_')
    .trim();
}

export async function processEmailWithGemini(subject, sender, rawBody, apiKey, isSent = false) {
  const effectiveKey = apiKey || getGeminiKey();
  const isAuto = /no-?reply|notifications?|alerts?|billing|news|support@|digest|updates@|vercel|manychat|google|namecheap|santander|mbank|allegro/i.test(sender);

  if (effectiveKey) {
    try {
      const prompt = `You are the executive assistant for the studio director.
Analyze this ${isSent ? 'SENT (outgoing)' : 'INCOMING'} email, eliminate boilerplate noise, translate/adapt into polished concise C1 English, and identify any actionable task or deadline.

RULES (Strict JSON format only):
CRITICAL RULE: DO NOT invent or hallucinate emails. Base your output ONLY on the provided email subject and body. If the content is empty or garbage, do not make up a story.

1. "author": Clean sender/service name (Max 2 words). NO EMOJIS.
2. "geminiTitle": Maximum 35 characters. Ultra-concise, sharp, INVENTED title in Russian or English summarizing the essence (e.g. "Билет на поезд", "Лимит контактов", "Вход в аккаунт"). NEVER copy the original long subject. Max 4 words. NO EMOJIS.
3. "urgency":
   - "red": CRITICAL / IMMEDIATE. Always at the top. Client requests, tickets (flights/events), successful or declined payments, important documents, emails awaiting a reply, auth/2FA codes, or anything directly affecting career/schedule/life.
   - "yellow": MEDIUM. Long-term plans, important info that requires NO immediate action but is useful to know. Won't ruin life if not seen right away.
   - "grey": INFORMATIVE. Not junk! Info about hackathons, successful logins (security alerts that you triggered yourself), general useful information.
   - "spam": JUNK. Cheap newsletters from banks, airlines, marketplaces, generic promos.
4. "isAuthCode": boolean (true ONLY if the email is a 2FA/login code/OTP).
5. "threadTopic": Normalized English topic slug (NO EMOJIS).
6. "requiresReply": boolean (true ONLY if a real human is waiting for a response).
7. "hasActionableDeadline": boolean (true if deadline, payment expiration, or concrete action required).
8. "suggestedTodoTitle": Clear Russian action directive if actionable. No colons, ampersands, emojis.
9. "cleanBody": Structured, high-density, ULTRA-COMPACT readable digest strictly in ENGLISH. DO NOT use multiple line breaks. DO NOT use emojis. Strip spaces between paragraphs, use single newline character. Remove tracking noise.

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
            author: isSent ? 'You (Sent)' : (parsed.author || sender.split(' ')[0] || sender),
            geminiTitle: (parsed.geminiTitle || subject).trim().slice(0, 28),
            cleanBody: decodeHtmlEntities(parsed.cleanBody || rawBody),
            urgency: isSent ? 'grey' : (['red', 'yellow', 'grey', 'spam'].includes(parsed.urgency) ? parsed.urgency : 'grey'),
          isAuthCode: parsed.isAuthCode === true,
            threadTopic: normalizeTopicKey(parsed.threadTopic || subject),
            requiresReply: isSent ? false : (typeof parsed.requiresReply === 'boolean' ? parsed.requiresReply : !isAuto),
            hasActionableDeadline: isSent ? false : parsed.hasActionableDeadline === true,
            suggestedTodoTitle: isSent ? null : (parsed.suggestedTodoTitle || null)
          };
        }
      }
    } catch(e) {
      console.error("Gemini email rewriting error:", e);
    }
  }

  let fallbackUrgency = 'grey';

    const isPromo = low.includes('скидк') || low.includes('акци') || low.includes('распродаж') || 
                    low.includes('розыгрыш') || low.includes('лотере') || low.includes('winner') || 
                    low.includes('uber one') || low.includes('bonus') || low.includes('promo');
    if (isPromo) {
      return { urgency: 'spam' };
    }

  const low = (subject + ' ' + rawBody).toLowerCase();
  let hasAction = false;
  if (!isSent) {
    if (low.includes('cancel') || low.includes('fail') || low.includes('error') || low.includes('отмена') || low.includes('сбой') || low.includes('security') || low.includes('alert')) {
      fallbackUrgency = 'red';
      hasAction = true;
    } else if (low.includes('warn') || low.includes('update') || low.includes('notice') || low.includes('outage') || low.includes('inquiry')) {
      fallbackUrgency = 'yellow';
    }
  }

  return {
    author: isSent ? 'You (Sent)' : (sender.split(' ')[0] || sender),
    geminiTitle: subject,
    cleanBody: decodeHtmlEntities(rawBody).replace(/View in browser/gi, '').replace(/Copyrights*d{4}[sS]*$/gi, '').slice(0, 1500),
    urgency: fallbackUrgency,
      isAuthCode: false,
    threadTopic: normalizeTopicKey(subject),
    requiresReply: isSent ? false : !isAuto,
    hasActionableDeadline: hasAction,
    suggestedTodoTitle: hasAction ? subject : null
  };
}

export function groupMessagesIntoThreads(messages) {
  const threadMap = new Map();
  const sorted = [...messages].sort((a, b) => new Date(b.date) - new Date(a.date));

  sorted.forEach(msg => {
    const counterpartyEmail = msg.isSent ? (msg.to || msg.recipientEmail || 'unknown') : (msg.senderEmail || msg.sender || 'unknown');
    const normCounterparty = (counterpartyEmail ? String(counterpartyEmail).toLowerCase() : 'unknown').replace(/[^a-z0-9]/g, '');
    const normTopic = normalizeTopicKey(msg.threadTopic || msg.shortTitle || msg.subject);
    const key = `${normCounterparty}_${normTopic}`;

    const itemObj = {
      id: msg.id,
      date: msg.date,
      subject: msg.shortTitle || msg.subject,
      body: msg.body,
      formattedHtml: msg.formattedHtml || formatLinksAsPills(msg.body),
      from: msg.from || msg.sender,
      to: msg.to || msg.accountEmail,
      isSent: msg.isSent === true,
      folder: msg.folder || (msg.isSent ? 'sent' : 'inbox')
    };

    if (!threadMap.has(key)) {
      threadMap.set(key, {
        id: msg.id,
        threadKey: key,
        platform: msg.platform || 'gmail',
        folder: msg.folder || (msg.isSent ? 'sent' : 'inbox'),
        isSent: msg.isSent === true,
        hasIncoming: !msg.isSent,
        from: msg.from || msg.sender,
        to: msg.to || msg.accountEmail,
        sender: msg.sender,
        senderEmail: msg.senderEmail,
        author: msg.author || msg.sender,
        account: msg.account || msg.to,
        accountEmail: msg.accountEmail,
        shortTitle: msg.shortTitle || msg.subject,
        subject: msg.subject || msg.shortTitle,
        originalSubject: msg.originalSubject || msg.subject,
        body: msg.body,
        formattedHtml: msg.formattedHtml || formatLinksAsPills(msg.body),
        urgency: msg.urgency || 'grey',
        isAuthCode: msg.isAuthCode || false,
        threadTopic: normTopic,
        requiresReply: msg.requiresReply,
        hasActionableDeadline: msg.hasActionableDeadline,
        suggestedTodoTitle: msg.suggestedTodoTitle,
        read: msg.read,
        date: msg.date,
        url: msg.url,
        threadCount: 1,
        threadItems: [itemObj]
      });
    } else {
      const existing = threadMap.get(key);
      if (!existing.threadItems.some(item => item.id === msg.id || (Math.abs(new Date(item.date) - new Date(msg.date)) < 10000))) {
        existing.threadCount += 1;
        existing.threadItems.push(itemObj);
      }

      if (!msg.isSent) {
        existing.hasIncoming = true;
        existing.folder = 'inbox';
      }

      if (msg.urgency === 'red' || existing.urgency === 'red') {
        existing.urgency = 'red';
      } else if (msg.urgency === 'yellow' || existing.urgency === 'yellow') {
        existing.urgency = 'yellow';
      }

      if (msg.hasActionableDeadline) existing.hasActionableDeadline = true;
      if (msg.suggestedTodoTitle && !existing.suggestedTodoTitle) existing.suggestedTodoTitle = msg.suggestedTodoTitle;

      if (new Date(msg.date) > new Date(existing.date)) {
        existing.date = msg.date;
        existing.body = msg.body;
        existing.formattedHtml = msg.formattedHtml || formatLinksAsPills(msg.body);
        existing.shortTitle = msg.shortTitle || msg.subject;
        if (!msg.isSent) existing.requiresReply = msg.requiresReply;
      }
      if (!msg.read) existing.read = false;
    }
  });

  return Array.from(threadMap.values());
}

export async function fetchEmailsForAccount(accessToken, userEmail, apiKey, limit = 10) {
  try {
    const listRes = await fetch(`https://gmail.googleapis.com/gmail/v1/users/me/messages?maxResults=${limit}`, {
      headers: { Authorization: `Bearer ${accessToken}` }
    });
    if (!listRes.ok) return [];
    const listData = await listRes.json();
    const messagesList = listData.messages || [];
    if (messagesList.length === 0) return [];

    const detailPromises = messagesList.map(async (item) => {
      try {
        const msgRes = await fetch(`https://gmail.googleapis.com/gmail/v1/users/me/messages/${item.id}?format=full`, {
          headers: { Authorization: `Bearer ${accessToken}` }
        });
        if (!msgRes.ok) return null;
        const msg = await msgRes.json();

        const labels = msg.labelIds || [];
        if (labels.includes('TRASH') || labels.includes('SPAM')) return null;

        const isSent = labels.includes('SENT') && !labels.includes('INBOX');
        const folder = isSent ? 'sent' : 'inbox';

        const headers = msg.payload?.headers || [];
        const subjectHeader = headers.find(h => (h?.name || '').toLowerCase() === 'subject')?.value || '(No Subject)';
        const fromHeader = headers.find(h => (h?.name || '').toLowerCase() === 'from')?.value || 'Unknown Sender';
        const toHeader = headers.find(h => (h?.name || '').toLowerCase() === 'to')?.value || userEmail || '';
        const dateHeader = headers.find(h => (h?.name || '').toLowerCase() === 'date')?.value || '';

        let senderName = fromHeader;
        let senderEmail = fromHeader;
        const fromMatch = fromHeader.match(/^(.*?)\s*<(.+?)>$/);
        if (fromMatch) {
          senderName = fromMatch[1].replace(/^["']|["']$/g, '').trim() || fromMatch[2];
          senderEmail = fromMatch[2].trim();
        }

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

        if (!rawText || rawText.trim() === '') {
           rawText = subjectHeader; // Use subject if body is entirely empty
        }
        const processed = await processEmailWithGemini(subjectHeader, senderName, rawText, apiKey, isSent);
        const isUnread = labels.includes('UNREAD');

        let parsedDate = new Date().toISOString();
        if (dateHeader) {
          try { parsedDate = new Date(dateHeader).toISOString(); } catch(e) {
            parsedDate = new Date(parseInt(msg.internalDate, 10)).toISOString();
          }
        } else if (msg.internalDate) {
          parsedDate = new Date(parseInt(msg.internalDate, 10)).toISOString();
        }

        if (processed.urgency === 'spam') {
          return null; // DISCARD SPAM ENTIRELY
        }

        const formattedHtml = formatLinksAsPills(processed.cleanBody);

        return {
          id: `gmail_${userEmail.replace(/[^a-zA-Z0-9]/g, '_')}_${msg.id}`,
          rawGoogleId: msg.id,
          platform: 'gmail',
          folder: folder,
          isSent: isSent,
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
          isAuthCode: processed.isAuthCode || false,
          threadTopic: processed.threadTopic,
          requiresReply: processed.requiresReply,
          hasActionableDeadline: processed.hasActionableDeadline,
          suggestedTodoTitle: processed.suggestedTodoTitle,
          read: !isUnread,
          date: parsedDate,
          url: `https://mail.google.com/mail/u/0/#inbox/${msg.id}`
        };
      } catch(err) {
        return null;
      }
    });

    return (await Promise.all(detailPromises)).filter(Boolean);
  } catch(e) {
    return [];
  }
}
