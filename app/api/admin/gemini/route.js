import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import { getDb, saveDb } from '@/lib/db';
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
  return Buffer.from("QVEuQWI4Uk42S2xHbjdycS11eW1Ycy10TUh0T0JHWTVJN2JlLWQ2bE1VLXRodk5GcEVuSXc=", "base64").toString("utf8");
}

function getUserContext(db) {
  if (db && db.userContext && Array.isArray(db.userContext.items)) {
    return db.userContext;
  }
  try {
    const contextPath = path.join(process.cwd(), 'data', 'user_context.json');
    if (fs.existsSync(contextPath)) {
      const data = JSON.parse(fs.readFileSync(contextPath, 'utf8'));
      if (data && Array.isArray(data.items)) return data;
    }
  } catch (e) {}
  return { items: [] };
}

async function saveUserContext(context, db) {
  if (db) {
    db.userContext = context;
    await saveDb(db);
  }
  try {
    const contextPath = path.join(process.cwd(), 'data', 'user_context.json');
    const dir = path.dirname(contextPath);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(contextPath, JSON.stringify(context, null, 2), 'utf8');
  } catch (e) {}
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
    const userContext = getUserContext(db);

    const totalUsers = Object.keys(db.users || {}).length;
    const activeMutes = Object.keys(db.mutes || {}).length;
    const activeTodos = (db.todos || []).filter(t => !t.completed);

    const systemContext = `You are the personal AI executive assistant and studio co-pilot for rifemotion.com.
Current timestamp: ${new Date().toISOString()} (Europe/Warsaw timezone).

SYSTEM INSTRUCTIONS & BEHAVIOR (INTERNAL):
- Character & Tone: Sharp, direct, pragmatic, restrained by default. Sarcastic, humorous, and using well-placed Russian profanity (мат) strictly when fitting and natural (по-свойски). No fake corporate fluff.
- Adaptive Response Length:
  * Simple question / check / clarification -> ULTRA-CONCISE (1-3 sentences).
  * Project plan / code / deep analysis -> Comprehensive, structured, in-depth.
- Language: English by default. Russian if addressed in Russian.
- Creative Task Naming: If asked to create tasks, give them clever, witty studio titles with hints (e.g. "Bank heist: VAT statement", "Fix Scene #4 curve timing").
- Never unpromptedly recite or boast about user facts without a direct reason; simply keep them in mind to make better decisions.

USER'S ACCUMULATED PERSONAL CONTEXT & KNOWLEDGE:
${userContext.items.length > 0 ? JSON.stringify(userContext.items, null, 2) : "No custom user facts recorded yet."}

DYNAMIC MEMORY MANAGEMENT:
- If the user tells you new biographical facts, personal details, or habits about themselves, append:
  [MEMORY_ADD: "Brief statement of the fact"]
- If the user says they were joking ("пошутил"), made a mistake, or cancelled a previous fact, append:
  [MEMORY_REMOVE: "Keyword or phrase to remove"]

TASK AUTOMATION:
If asked to schedule or create a task, append:
[CREATE_TODO: {"title": "...", "details": "...", "type": "short"|"long", "category": "Client"|"Banking"|"Motion"|"Personal"|"General", "timeMode": "deadline"|"interval", "deadline": "15:00", "reminder": "30m", "timeFrom": "14:00", "timeTo": "16:30"}]`;

    let targetModel = 'gemini-3.1-flash-lite';
    if (model.includes('3.5')) {
      targetModel = 'gemini-3.5-flash';
    } else if (model.includes('3.6')) {
      targetModel = 'gemini-3.6-flash';
    } else if (model.includes('pro')) {
      targetModel = 'gemini-3.1-pro-preview';
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
      return NextResponse.json({
        ok: false,
        reply: "⚠️ Gemini API Error (" + res.status + "): " + errText.slice(0, 300)
      });
    }

    const data = await res.json();
    let candidateText = data?.candidates?.[0]?.content?.parts?.[0]?.text || "Empty response from model.";

    // 1. Process [CREATE_TODO: ...]
    let createdTodo = null;
    const todoMatch = candidateText.match(/\[CREATE_TODO:\s*({[\s\S]*?})\]/);
    if (todoMatch && todoMatch[1]) {
      try {
        const parsedTodo = JSON.parse(todoMatch[1]);
        if (!db.todos) db.todos = [];
        createdTodo = {
          id: 'todo_' + Date.now() + '_' + Math.random().toString(36).substr(2, 4),
          title: parsedTodo.title || 'New Task',
          details: parsedTodo.details || '',
          type: parsedTodo.type === 'long' ? 'long' : 'short',
          category: parsedTodo.category || 'General',
          timeMode: parsedTodo.timeMode || 'deadline',
          deadline: parsedTodo.deadline || '',
          reminder: parsedTodo.reminder || '30m',
          timeFrom: parsedTodo.timeFrom || '',
          timeTo: parsedTodo.timeTo || '',
          completed: false,
          createdAt: new Date().toISOString()
        };
        db.todos.unshift(createdTodo);
        await saveDb(db);
        candidateText = candidateText.replace(/\[CREATE_TODO:[\s\S]*?\]/, '').trim();
      } catch (err) {
        console.error("Error auto-creating todo:", err);
      }
    }

    // 2. Process [MEMORY_ADD: ...]
    const memAddMatch = candidateText.match(/\[MEMORY_ADD:\s*([\s\S]*?)\]/);
    if (memAddMatch && memAddMatch[1]) {
      try {
        const newFact = memAddMatch[1].trim().replace(/^["']|["']$/g, '');
        if (!userContext.items) userContext.items = [];
        if (!userContext.items.includes(newFact)) {
          userContext.items.push(newFact);
          await saveUserContext(userContext, db);
        }
        candidateText = candidateText.replace(/\[MEMORY_ADD:[\s\S]*?\]/, '').trim();
      } catch (e) {
        console.error("Error adding memory:", e);
      }
    }

    // 3. Process [MEMORY_REMOVE: ...]
    const memRemoveMatch = candidateText.match(/\[MEMORY_REMOVE:\s*([\s\S]*?)\]/);
    if (memRemoveMatch && memRemoveMatch[1]) {
      try {
        const query = memRemoveMatch[1].trim().toLowerCase().replace(/^["']|["']$/g, '');
        if (userContext.items) {
          userContext.items = userContext.items.filter(item => !item.toLowerCase().includes(query));
        }
        await saveUserContext(userContext, db);
        candidateText = candidateText.replace(/\[MEMORY_REMOVE:[\s\S]*?\]/, '').trim();
      } catch (e) {
        console.error("Error removing memory:", e);
      }
    }

    return NextResponse.json({
      ok: true,
      reply: candidateText,
      createdTodo
    });

  } catch (error) {
    console.error("Gemini route error:", error);
    return NextResponse.json({
      ok: false,
      reply: "⚠️ Request failed: " + error.message
    }, { status: 500 });
  }
}
