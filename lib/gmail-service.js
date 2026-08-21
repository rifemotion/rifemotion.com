// Shared Gmail fetching, parsing and Gemini classification service

export function decodeHtmlEntities(str) {
  if (!str) return '';
  return str
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&nbsp;/g, ' ')
    .trim();
}

export function formatLinksAsPills(text) {
  if (!text) return '';
  const urlRegex = /(https?:\/\/[^\s<>"']+)/g;
  return text.replace(urlRegex, (url) => {
    let cleanUrl = url;
    if (cleanUrl.endsWith('.') || cleanUrl.endsWith(',') || cleanUrl.endsWith(')')) {
      cleanUrl = cleanUrl.slice(0, -1);
    }
    return `<a href="${cleanUrl}" target="_blank" rel="noopener noreferrer" class="linkPillBtn"><svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"></path><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"></path></svg><span>Link</span></a>`;
  });
}

export function normalizeTopicKey(str) {
  if (!str) return 'general';
  return str
    .toLowerCase()
    .replace(/^(re|fwd|fw|отв|fwd):\s*/i, '')
    .replace(/rifemotion/g, '')
    .replace(/[^a-z0-9]/g, '_')
    .replace(/_+/g, '_')
    .slice(0, 40) || 'general';
}

// ROCK-SOLID SPAM & PROMO DETECTOR
export function isUnwantedSpam(subject, sender, body) {
  const text = (String(subject || '') + ' ' + String(sender || '') + ' ' + String(body || '')).toLowerCase();
  
  const spamKeywords = [
    'sweepstakes', 'lottery', 'розыгрыш', 'розыгрыше', 'выигрыш', 'лотере', 
    'uber one', 'uber eats', 'yandex plus', 'яндекс плюс', 'скидк', 'скидк',
    'распродаж', 'black friday', 'promocode', 'промокод', 'cashback', 'кэшбэк',
    'купите', 'акция', 'акции', 'special offer', 'отзыв по процессу', 'оцените качество',
    'survey', 'опрос', 'rate our service', 'are you a winner', 'claim your prize',
    'скидка', 'скидки', 'sale', 'discount', 'free trial offer'
  ];
  
  return spamKeywords.some(kw => text.includes(kw));
}

function truncateSmart(str, maxLen = 35) {
  if (!str) return '';
  const clean = str.trim().replace(/[\r\n]+/g, ' ');
  if (clean.length <= maxLen) return clean;
  const cut = clean.slice(0, maxLen);
  const lastSpace = cut.lastIndexOf(' ');
  if (lastSpace > 15) {
    return cut.slice(0, lastSpace).trim();
  }
  return cut.trim();
}

export async function processEmailWithGemini(subject, sender, rawBody, apiKey, isSent = false) {
  // 1. HARD PRE-FILTER: Instantly drop obvious spam/promos/lotteries
  if (isUnwantedSpam(subject, sender, rawBody)) {
    return { urgency: 'spam', isSpam: true };
  }

  const effectiveKey = apiKey || process.env.GEMINI_API_KEY;
  const isAuto = /no-?reply|notification|alert|support|billing|receipt/i.test(sender);

  if (effectiveKey) {
    try {
      const systemPrompt = `You are an elite, highly precise email categorizer.
Return RAW VALID JSON ONLY with NO markdown, NO backticks.

CRITICAL RULES:
1. "geminiTitle": Sharp, ultra-concise summary STRICTLY IN ENGLISH.
   - MAXIMUM 35 CHARACTERS.
   - NEVER truncate mid-word.
   - NEVER return Russian text in geminiTitle.
   - NEVER copy the full long subject.
   - Examples:
     "Оповещение системы безопасности..." -> "Google Security Alert"
     "Заявка на справку об отсутствии судимости" -> "Police Clearance Request"
     "Запрос на сотрудничество: семейный ужин" -> "Dinner Collab Request"
     "График работы техподдержки Satchel.EU" -> "Support Working Hours"
     "Vercel Deploy Failed" -> "Vercel Deploy Failed"
     "Manychat - Your Pro subscription has expired" -> "Manychat Expired"
     "Чек + билет Гранд Сервис Экспресс" -> "Train Ticket"

2. "urgency":
   - "spam": ANY marketing, prize draws, sweepstakes, lotteries, promos, discounts, food/ride offers, newsletters, surveys.
   - "red": Deploy failures, expired subscriptions, train/flight tickets, security alerts, 2FA codes, urgent client requests.
   - "yellow": Neutral notices, support schedule changes, collaboration invites.
   - "grey": Government certificates ("Госуслуги"), receipts, read 2FA.

3. "author": Clean English sender/company name (Max 2 words, e.g. "Google", "Monese", "Gosuslugi", "Manychat", "Vercel"). NO EMOJIS.

JSON SCHEMA:
{
  "author": "string",
  "geminiTitle": "string",
  "urgency": "red"|"yellow"|"grey"|"spam",
  "isAuthCode": boolean,
  "threadTopic": "string",
  "requiresReply": boolean,
  "hasActionableDeadline": boolean,
  "suggestedTodoTitle": "string or null",
  "cleanBody": "string"
}

Email Subject: ${subject}
Email Sender: ${sender}
Email Content:
${rawBody.slice(0, 3000)}`;

      const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.1-flash-lite:generateContent?key=${effectiveKey}`;
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: systemPrompt }] }],
          generationConfig: {
            response_mime_type: "application/json",
            temperature: 0.1
          }
        })
      });

      if (res.ok) {
        const data = await res.json();
        const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
        if (text) {
          const parsed = JSON.parse(text);

          // Second filter: if Gemini classified as spam or title has lottery/sweepstakes
          if (parsed.urgency === 'spam' || isUnwantedSpam(parsed.geminiTitle, parsed.author, parsed.cleanBody)) {
            return { urgency: 'spam', isSpam: true };
          }

          const cleanTitle = truncateSmart(parsed.geminiTitle || subject, 35);

          return {
            author: isSent ? 'You (Sent)' : (parsed.author || sender.split(' ')[0] || sender),
            geminiTitle: cleanTitle,
            cleanBody: decodeHtmlEntities(parsed.cleanBody || rawBody),
            urgency: isSent ? 'grey' : (['red', 'yellow', 'grey', 'spam'].includes(parsed.urgency) ? parsed.urgency : 'grey'),
            isAuthCode: parsed.isAuthCode === true,
            threadTopic: normalizeTopicKey(parsed.threadTopic || cleanTitle),
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

  // Fallback
  let fallbackUrgency = 'grey';
  const low = (subject + ' ' + rawBody).toLowerCase();
  let hasAction = false;
  if (!isSent) {
    if (
      low.includes('cancel') || low.includes('fail') || low.includes('error') || 
      low.includes('ошибка') || low.includes('отказ') || low.includes('security') || 
      low.includes('alert') || low.includes('билет') || low.includes('ticket') || 
      low.includes('поезд') || low.includes('flight') || low.includes('чек') || 
      low.includes('оплата') || low.includes('payment') || low.includes('безопасность') ||
      low.includes('код') || low.includes('code') || low.includes('пароль') || low.includes('expired')
    ) {
      fallbackUrgency = 'red';
      hasAction = true;
    } else if (low.includes('warn') || low.includes('update') || low.includes('notice') || low.includes('outage') || low.includes('inquiry') || low.includes('запрос')) {
      fallbackUrgency = 'yellow';
    }
  }

  return {
    author: isSent ? 'You (Sent)' : (sender.split(' ')[0] || sender),
    geminiTitle: truncateSmart(subject, 35),
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

        const headers = msg.payload?.headers || [];
        const subjectHeader = headers.find(h => (h?.name || '').toLowerCase() === 'subject')?.value || '(No Subject)';
        const fromHeader = headers.find(h => (h?.name || '').toLowerCase() === 'from')?.value || 'Unknown Sender';
        const toHeader = headers.find(h => (h?.name || '').toLowerCase() === 'to')?.value || userEmail || '';
        const dateHeader = headers.find(h => (h?.name || '').toLowerCase() === 'date')?.value || '';

        let senderName = fromHeader;
        let senderEmail = fromHeader;
        const emailMatch = fromHeader.match(/<([^>]+)>/);
        if (emailMatch) {
          senderEmail = emailMatch[1];
          senderName = fromHeader.replace(/<[^>]+>/, '').trim().replace(/^["']|["']$/g, '');
        }

        const isSent = (msg.labelIds || []).includes('SENT');
        const isUnread = (msg.labelIds || []).includes('UNREAD');

        let rawText = '';
        function getPartsText(payload) {
          let text = '';
          if (payload?.body?.data) {
            try {
              text += Buffer.from(payload.body.data, 'base64').toString('utf-8');
            } catch(e) {}
          }
          if (payload?.parts) {
            for (const part of payload.parts) {
              if (part.mimeType === 'text/plain' && part.body?.data) {
                try {
                  text += Buffer.from(part.body.data, 'base64').toString('utf-8');
                } catch(e) {}
              } else if (part.parts) {
                text += getPartsText(part);
              }
            }
          }
          return text;
        }

        rawText = getPartsText(msg.payload);
        if (!rawText.trim()) rawText = msg.snippet || subjectHeader;

        const processed = await processEmailWithGemini(subjectHeader, fromHeader, rawText, apiKey, isSent);
        if (!processed || processed.urgency === 'spam' || processed.isSpam) return null;

        const formattedHtml = formatLinksAsPills(processed.cleanBody);
        let parsedDate = dateHeader ? new Date(dateHeader).toISOString() : new Date().toISOString();

        return {
          id: `gmail_${userEmail.replace(/[^a-zA-Z0-9]/g, '_')}_${msg.id}`,
          rawGoogleId: msg.id,
          platform: 'gmail',
          folder: isSent ? 'sent' : 'inbox',
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
