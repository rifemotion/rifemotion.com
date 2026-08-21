import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import { getDb, saveDb } from '@/lib/db';
import { getGeminiKey } from '@/lib/gemini-config';
import { processEmailWithGemini, formatLinksAsPills, groupMessagesIntoThreads } from '@/lib/gmail-service';

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

export async function GET(request) {
  const session = await getServerSession(authOptions);
  if (!session || !session.user) {
    return new Response("Unauthorized", { status: 401 });
  }

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const send = (data) => {
        controller.enqueue(encoder.encode("data: " + JSON.stringify(data) + "\n\n"));
      };

      try {
        const db = await getDb();
        const userEmail = (session?.user?.email || '').toLowerCase();

        // 1. Notify start and clear DB
        send({ type: 'step', text: 'Удаление всех сообщений из базы данных...', status: 'clearing' });
        db.messages = [];
        await saveDb(db);
        send({ type: 'cleared' });

        // 2. Resolve active accounts
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

        if (activeAccounts.length === 0) {
          send({ type: 'error', text: 'Нет подключенных почтовых ящиков! Подключите Gmail в Настройках.' });
          controller.close();
          return;
        }

        send({ type: 'step', text: `Опрос ${activeAccounts.length} ящиков (по 5 писем с каждого)...`, status: 'fetching' });

        // 3. Fetch list of IDs (5 per account)
        const itemsToProcess = [];
        for (const acc of activeAccounts) {
          try {
            const listRes = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/messages?maxResults=5', {
              headers: { Authorization: `Bearer ${acc.token}` }
            });
            if (listRes.ok) {
              const listData = await listRes.json();
              const msgs = listData.messages || [];
              for (const m of msgs) {
                itemsToProcess.push({ msgId: m.id, token: acc.token, email: acc.email });
              }
            }
          } catch(e) {}
        }

        if (itemsToProcess.length === 0) {
          send({ type: 'done', total: 0, text: 'Новых писем в почтовых ящиках не найдено.' });
          controller.close();
          return;
        }

        send({ type: 'step', text: `Найдено ${itemsToProcess.length} писем. Начинаем анализ Gemini...`, total: itemsToProcess.length });

        const apiKey = getGeminiKey();
        const finalMessages = [];

        // 4. Process each message 1-by-1 and stream new card immediately!
        for (let i = 0; i < itemsToProcess.length; i++) {
          const item = itemsToProcess[i];
          try {
            const detailRes = await fetch(`https://gmail.googleapis.com/gmail/v1/users/me/messages/${item.msgId}?format=full`, {
              headers: { Authorization: `Bearer ${item.token}` }
            });
            if (!detailRes.ok) continue;
            const detail = await detailRes.json();

            const headers = detail.payload?.headers || [];
            const subjectHeader = headers.find(h => (h?.name || '').toLowerCase() === 'subject')?.value || '(No Subject)';
            const fromHeader = headers.find(h => (h?.name || '').toLowerCase() === 'from')?.value || 'Unknown Sender';
            const dateHeader = headers.find(h => (h?.name || '').toLowerCase() === 'date')?.value || '';
            const isUnread = (detail.labelIds || []).includes('UNREAD');
            const isSent = (detail.labelIds || []).includes('SENT');

            // Extract body text
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

            rawText = getPartsText(detail.payload);
            if (!rawText.trim()) rawText = detail.snippet || subjectHeader;

            // Notify client: analyzing this specific email
            send({
              type: 'analyzing',
              current: i + 1,
              total: itemsToProcess.length,
              subject: subjectHeader.slice(0, 35),
              account: item.email
            });

            // Call Gemini
            const processed = await processEmailWithGemini(subjectHeader, fromHeader, rawText, apiKey, isSent);

            if (processed && processed.urgency !== 'spam') {
              const formattedHtml = formatLinksAsPills(processed.cleanBody);
              const formattedId = `gmail_${item.email.replace(/[^a-zA-Z0-9]/g, '_')}_${item.msgId}`;
              
              const messageObj = {
                id: formattedId,
                rawGoogleId: item.msgId,
                platform: 'gmail',
                sender: processed.author || fromHeader,
                author: processed.author || fromHeader,
                account: item.email,
                accountEmail: item.email,
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
                date: dateHeader ? new Date(dateHeader).toISOString() : new Date().toISOString(),
                url: `https://mail.google.com/mail/u/0/#inbox/${item.msgId}`
              };

              finalMessages.push(messageObj);

              // Dynamically group messages into threads in real-time
              const currentThreaded = groupMessagesIntoThreads(finalMessages);

              // STREAM UPDATED THREADS TO FRONTEND IN REAL-TIME!
              send({
                type: 'threads_update',
                threads: currentThreaded,
                current: i + 1,
                total: itemsToProcess.length,
                lastAdded: messageObj.shortTitle || messageObj.subject
              });
            }
          } catch(err) {
            console.error("Error processing item:", err);
          }
        }

        // 5. Save final threaded cards to DB
        const finalThreaded = groupMessagesIntoThreads(finalMessages);
        db.messages = finalThreaded;
        await saveDb(db);

        send({
          type: 'done',
          total: finalMessages.length,
          text: `Успешно сохранено ${finalMessages.length} писем.`
        });
        controller.close();

      } catch(e) {
        send({ type: 'error', text: e.message });
        controller.close();
      }
    }
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-cache, no-transform',
      'Connection': 'keep-alive'
    }
  });
}
