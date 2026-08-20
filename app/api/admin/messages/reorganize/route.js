import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import { getDb, saveDb } from '@/lib/db';
import { processEmailWithGemini, getGeminiApiKey } from '@/lib/gmail-service';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function POST(request) {
  const session = await getServerSession(authOptions);
  if (!session || !session.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const db = await getDb();
    if (!db.messages || db.messages.length === 0) {
      return NextResponse.json({ ok: true, msg: "No messages to reorganize." });
    }

    const apiKey = getGeminiApiKey();
    
    // Process all existing messages to re-generate their Gemini analysis (no emojis, strict structure)
    // Run them in batches of 5 to avoid rate limits
    const updatedMessages = [];
    
    for (let i = 0; i < db.messages.length; i += 5) {
      const batch = db.messages.slice(i, i + 5);
      const batchPromises = batch.map(async (msg) => {
        try {
          // Re-run Gemini on the original plain text or snippet
          const rawText = msg.body || msg.originalSubject || "";
          if (!rawText) return msg;

          const processed = await processEmailWithGemini(
            msg.originalSubject || msg.subject,
            msg.sender || msg.from,
            rawText,
            apiKey,
            msg.isSent
          );

          return {
            ...msg,
            shortTitle: processed.geminiTitle || msg.shortTitle,
            subject: processed.geminiTitle || msg.subject,
            body: processed.cleanBody || msg.body,
            formattedHtml: processed.cleanBody ? null : msg.formattedHtml, // Let frontend regenerate formatting
            author: processed.author || msg.author,
            urgency: processed.urgency || msg.urgency,
            threadTopic: processed.threadTopic || msg.threadTopic
          };
        } catch(err) {
          console.error("Reorganize err:", err);
          return msg;
        }
      });
      const results = await Promise.all(batchPromises);
      updatedMessages.push(...results);
    }

    db.messages = updatedMessages;
    await saveDb(db);

    return NextResponse.json({ ok: true, count: updatedMessages.length });
  } catch (error) {
    console.error("Reorganize error:", error);
    return NextResponse.json({ error: "Reorganization failed" }, { status: 500 });
  }
}
