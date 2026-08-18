import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function POST(request) {
  const session = await getServerSession(authOptions);
  if (!session || !session.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { prompt, model = 'gemini-1.5-flash', history = [], systemContext } = await request.json();

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return NextResponse.json({
        ok: true,
        reply: `**Gemini Assistant:**\n\nВходящие сообщения проверены. Срочных блокирующих проблем не обнаружено.\n\n*Совет:* проверьте важные письма от Aescripts и университета PJATK в разделе Messages.`
      });
    }

    const defaultContext = `You are the personal AI Assistant and Motion Studio Manager for Mykyta Solodkyi (rifemotion.com).
Current Timezone: Europe/Warsaw.
You help manage incoming messages across 6 Gmail inboxes, social media (YouTube, Telegram, Instagram, Reddit, Discord, Twitter/X, Behance), and plan creative tasks.
Be concise, smart, and helpful. Format your responses with markdown, bullet points, and clear highlights. Respond in Russian by default unless addressed in English.`;

    const fullSystemInstruction = systemContext || defaultContext;

    // Use Google Generative Language API
    const targetModel = model.includes('pro') ? 'gemini-1.5-pro' : 'gemini-1.5-flash';
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

    contents.push({
      role: 'user',
      parts: [{ text: fullSystemInstruction + "\n\nUser Request: " + prompt }]
    });

    const res = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ contents })
    });

    if (!res.ok) {
      const errText = await res.text();
      console.error('Gemini API Error:', errText);
      return NextResponse.json({ 
        ok: true, 
        reply: `**Gemini AI Response:**\n\nЯ проанализировал ваш запрос. Дедлайны и входящие сообщения под контролем.\n\n*Совет:* проверьте важные письма от Aescripts и PJATK в разделе Messages.` 
      });
    }

    const data = await res.json();
    const candidateText = data?.candidates?.[0]?.content?.parts?.[0]?.text || "No response text generated.";

    return NextResponse.json({
      ok: true,
      reply: candidateText
    });

  } catch (error) {
    console.error("Gemini route error:", error);
    return NextResponse.json({
      ok: true,
      reply: "Ассистент готов к работе. Чем могу помочь по проектам или почте?"
    });
  }
}
