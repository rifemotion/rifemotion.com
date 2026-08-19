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

    const systemContext = "Ты — персональный AI-ассистент и менеджер motion-дизайн студии rifemotion.com (Никиты Солодкого).\n" +
      "Текущее время: " + new Date().toISOString() + " (Europe/Warsaw).\n\n" +
      "У тебя есть доступ к базе данных студии:\n" +
      "- Пользователей расширений: " + totalUsers + "\n" +
      "- Блокировок: " + activeMutes + "\n" +
      "- Последние фидбеки: " + JSON.stringify(pendingFeedback.map(f => ({ id: f.id, user: f.userId, type: f.type, msg: f.message, rating: f.rating }))) + "\n\n" +
      "Входящие ящики Gmail:\n" +
      "1. Personal 1 (nikitasolodkij3@gmail.com)\n" +
      "2. Personal 2 (nekitsolodkij@gmail.com)\n" +
      "3. Work 1 (rifemotion.com@gmail.com)\n" +
      "4. Work 2 / Aescripts (rifemotion.info@gmail.com)\n" +
      "5. Banking (nekitbanking@gmail.com)\n" +
      "6. Edu / PJATK University (s37167@pjwstk.edu.pl)\n\n" +
      "Инструкция:\n" +
      "- Отвечай вежливо, кратко, четко, структурировано и по существу на русском языке.\n" +
      "- Используй Markdown (жирный шрифт, списки, выделения).\n" +
      "- Отвечай прямо на конкретный вопрос пользователя без лишних шаблонов.";

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

    userParts.push({ text: systemContext + "\n\nЗапрос пользователя: " + prompt });

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
        reply: "⚠️ **Ошибка Gemini API (" + res.status + "):** " + errText.slice(0, 300)
      });
    }

    const data = await res.json();
    const candidateText = data?.candidates?.[0]?.content?.parts?.[0]?.text || "Пустой ответ от модели.";

    return NextResponse.json({
      ok: true,
      reply: candidateText
    });

  } catch (error) {
    console.error("Gemini route error:", error);
    return NextResponse.json({
      ok: false,
      reply: "⚠️ Ошибка выполнения запроса: " + error.message
    }, { status: 500 });
  }
}
