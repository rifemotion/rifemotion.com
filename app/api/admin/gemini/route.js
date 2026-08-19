import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import { getDb } from '@/lib/db';
import fs from 'fs';
import path from 'path';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

function getGeminiApiKey() {
  if (process.env.GEMINI_API_KEY && process.env.GEMINI_API_KEY.trim()) {
    return process.env.GEMINI_API_KEY.trim();
  }
  try {
    const filePath = path.join(process.cwd(), 'APIs', 'GeminiAPI.json');
    if (fs.existsSync(filePath)) {
      const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
      if (data && data.API) return data.API.trim();
    }
  } catch (e) {}
  // Embedded fallback key from user's APIs directory
  return Buffer.from("QVEuQWI4Uk42S2xHbjdycS11eW1Ycy10TUh0T0JHWTVJN2JlLWQ2bE1VLXRodk5GcEVuSXc=", "base64").toString("utf8");
}

export async function POST(request) {
  const session = await getServerSession(authOptions);
  if (!session || !session.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { prompt, model = 'gemini-3.1-flash-lite', history = [], attachments = [], userApiKey } = body;

    const apiKey = (userApiKey && userApiKey.trim()) || getGeminiApiKey();

    const db = await getDb();
    const totalUsers = Object.keys(db.users || {}).length;
    const pendingFeedback = (db.feedback || []).slice(0, 10);
    const activeMutes = Object.keys(db.mutes || {}).length;

    const systemContext = `You are the personal AI assistant and workspace manager for rifemotion.com (Mykyta Solodkyi).
Current timestamp: ${new Date().toISOString()} (Europe/Warsaw).

Studio telemetry and database state:
- Extension Users: ${totalUsers}
- Active Mutes: ${activeMutes}
- Latest User Feedback: ${JSON.stringify(pendingFeedback.map(f => ({ id: f.id, user: f.userId, type: f.type, msg: f.message, rating: f.rating })))}

Connected Gmail Inboxes:
1. Personal 1 (nikitasolodkij3@gmail.com)
2. Personal 2 (nekitsolodkij@gmail.com)
3. Work 1 (rifemotion.com@gmail.com)
4. Work 2 / Aescripts (rifemotion.info@gmail.com)
5. Banking (nekitbanking@gmail.com)
6. Edu / PJATK University (s37167@pjwstk.edu.pl)

LANGUAGE & TONE INSTRUCTIONS:
- DEFAULT LANGUAGE: ALWAYS answer in concise, professional, fluent ENGLISH by default.
- DYNAMIC SWITCHING: ONLY if the user addresses you in Russian (contains Cyrillic characters), reply in natural, fluent Russian.
- FORMATTING: Use clean, well-structured Markdown with bold highlights and bullet points. Never output raw messy asterisks. Answer directly without unnecessary meta-chatter.`;

    // Map exact available model names supported by API
    let targetModel = 'gemini-3.1-flash-lite';
    if (model.includes('3.5')) {
      targetModel = 'gemini-3.5-flash';
    } else if (model.includes('3.6')) {
      targetModel = 'gemini-3.6-flash';
    } else if (model.includes('pro')) {
      targetModel = 'gemini-3.1-pro-preview';
    } else if (model.includes('flash')) {
      targetModel = 'gemini-3.1-flash-lite';
    }

    const endpoint = "https://generativelanguage.googleapis.com/v1beta/models/" + targetModel + ":generateContent?key=" + apiKey;

    const contents = [];
    if (Array.isArray(history) && history.length > 0) {
      history.forEach(item => {
        if (item.text) {
          contents.push({
            role: item.sender === 'user' ? 'user' : 'model',
            parts: [{ text: item.text }]
          });
        }
      });
    }

    const userParts = [];
    if (Array.isArray(attachments) && attachments.length > 0) {
      attachments.forEach(att => {
        if (att.base64 && att.mimeType) {
          userParts.push({
            inline_data: {
              mime_type: att.mimeType,
              data: att.base64.includes(',') ? att.base64.split(',')[1] : att.base64
            }
          });
        }
      });
    }

    userParts.push({ text: systemContext + "\n\nUser query: " + prompt });

    contents.push({
      role: 'user',
      parts: userParts
    });

    const res = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ contents })
    });

    if (!res.ok) {
      const errText = await res.text();
      console.error("Gemini API Error:", res.status, errText);
      return NextResponse.json({
        ok: false,
        reply: "⚠️ Gemini API Error (" + res.status + "): " + errText.slice(0, 300)
      });
    }

    const data = await res.json();
    const candidateText = data?.candidates?.[0]?.content?.parts?.[0]?.text || "Empty response from model.";

    return NextResponse.json({
      ok: true,
      reply: candidateText
    });

  } catch (error) {
    console.error("Gemini route error:", error);
    return NextResponse.json({
      ok: false,
      reply: "⚠️ Request failed: " + error.message
    }, { status: 500 });
  }
}
