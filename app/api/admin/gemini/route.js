import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import { getDb } from '@/lib/db';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function POST(request) {
  const session = await getServerSession(authOptions);
  if (!session || !session.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { prompt, model = 'gemini-1.5-flash', history = [], attachments = [], userApiKey } = body;

    const apiKey = (userApiKey && userApiKey.trim()) || process.env.GEMINI_API_KEY;

    if (!apiKey) {
      return NextResponse.json({
        ok: false,
        error: "NO_API_KEY",
        reply: "⚠️ **Gemini API Key не указан.**\n\nПожалуйста, введите ваш Google AI Studio API ключ (начинается с `AIzaSy...`) в поле настройки ключа или добавьте в `.env.local` как `GEMINI_API_KEY`."
      });
    }

    const db = await getDb();
    const totalUsers = Object.keys(db.users || {}).length;
    const pendingFeedback = (db.feedback || []).slice(0, 10);
    const activeMutes = Object.keys(db.mutes || {}).length;

    const systemContext = `Ты — персональный AI-ассистент и менеджер motion-дизайн студии rifemotion.com (Никиты Солодкого).
Текущее время: ${new Date().toISOString()} (Europe/Warsaw).

У тебя есть доступ к базе данных студии:
- Пользователей расширений: ${totalUsers}
- Блокировок: ${activeMutes}
- Последние фидбеки: ${JSON.stringify(pendingFeedback.map(f => ({ id: f.id, user: f.userId, type: f.type, msg: f.message, rating: f.rating })))}

Входящие ящики Gmail:
1. Personal 1 (nikitasodkij3@gmail.com)
2. Personal 2 (nekitsolodkij@gmail.com)
3. Work 1 (rifemotion.com@gmail.com)
4. Work 2 / Aescripts (rifemotion.info@gmail.com)
5. Banking (nekitbanking@gmail.com)
6. Edu / PJATK University (s37167@pjwstk.edu.pl)

Инструкция:
- Отвечай красиво, структурировано, прямо и по существу на русском языке.
- Используй Markdown (жирный шрифт, списки, выделения).
- Если пользователь задает прямой вопрос, отвечай на него конкретно и без шаблонов.`;

    // Map model names
    let targetModel = 'gemini-1.5-flash';
    if (model.includes('pro')) {
      targetModel = 'gemini-1.5-pro';
    } else if (model.includes('flash')) {
      targetModel = 'gemini-1.5-flash';
    }

    const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${targetModel}:generateContent?key=${apiKey}`;

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
        reply: `⚠️ **Ошибка Gemini API (${res.status}):** ${errText.slice(0, 300)}\n\nПроверьте правильность вашего API ключа.`
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
      reply: `⚠️ Ошибка выполнения запроса: ${error.message}`
    }, { status: 500 });
  }
}
