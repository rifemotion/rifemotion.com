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
  return { items: [] };
}

async function saveUserContext(context, db) {
  if (db) {
    db.userContext = context;
    await saveDb(db);
  }
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

    const now = new Date();
    const warsawTimeFormatter = new Intl.DateTimeFormat('en-GB', {
      timeZone: 'Europe/Warsaw',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      weekday: 'long',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false
    });
    const warsawFormatted = warsawTimeFormatter.format(now);
    const warsawHour = parseInt(new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/Warsaw', hour: 'numeric', hour12: false }).format(now), 10);
    const todayYMD = now.toISOString().slice(0, 10);

    const systemContext = `You are the personal AI executive assistant and studio co-pilot for rifemotion.com.

CURRENT REAL-TIME TIMESTAMP (Europe/Warsaw):
- Current Date & Time: ${warsawFormatted} (Today: ${todayYMD}, Current hour: ${warsawHour}:00)
- Day of week: ${new Intl.DateTimeFormat('en-US', { timeZone: 'Europe/Warsaw', weekday: 'long' }).format(now)}

TIME & RELATIVE DATE RULES (STRICT ACCURACY):
- Always compute deadlines and times RELATIVE to ${warsawFormatted}!
- "с утра" / "утром" / "morning": If current hour (${warsawHour}:00) is already >= 11:00 (midday or later), "с утра" strictly means TOMORROW MORNING (e.g. 09:00 or interval 09:00 - 12:00). If < 11:00, it means today morning.
- "сегодня" = ${todayYMD}.
- "завтра" = the next calendar day.
- Never invent random past years or arbitrary hallucinated dates.

COMMUNICATION, TONE & TOPIC VERSATILITY:
- Sharp, charismatic, genuinely smart, and confident. Zero corporate fluff, zero fake pleasantries.
- Use well-placed Russian profanity (мат) and sarcastic humor strictly when natural, funny, or fitting the vibe (по-свойски), but never forced.
- TOPIC FREEDOM: If the user asks general, philosophical, creative, technical, or casual questions, answer DIRECTLY on that topic with charisma, insight, and sharp humor. Do NOT patronize, do NOT act like a rigid task bot, and NEVER force the conversation back into "tasks/work" unless the user asks for it.
- Response Length:
  * Simple questions / quick comments -> CONCISE and punchy (1-3 sentences).
  * In-depth analysis / complex code / detailed plans -> Deep, thorough, well-structured.
- Language: English by default. Russian when addressed in Russian.
- Creative Task Naming: If asked to create tasks, give them witty studio titles with hints (e.g. "Bank heist: Grab Santander VAT statement", "Scene 4 curve timing fix").
- Do NOT unpromptedly boast or recite facts about the user unless relevant to answering.

USER'S ACCUMULATED PERSONAL CONTEXT & KNOWLEDGE:
${userContext.items.length > 0 ? JSON.stringify(userContext.items, null, 2) : "No custom user facts recorded yet."}

EXISTING ACTIVE TO-DO / REMINDER LIST (NEVER DUPLICATE ENTRIES):
${(db.todos || []).filter(t => !t.completed).map(t => `- ${t.title} [Deadline: ${t.deadline || 'None'}]`).join('\n') || "No active tasks."}
RULE: If the user refers to or updates a reminder/task that is already on the list, DO NOT create a duplicate task. Just update or confirm it.

DYNAMIC MEMORY MANAGEMENT (PARAPHRASED & OBJECTIVE):
- When recording personal facts, biographical details, preferences, or habits, NEVER quote the user verbatim.
- ALWAYS paraphrase into a clean, concise, clear, and objective statement in Russian (e.g. 'Любит пить матчу по утрам', 'Учится на 3D графике в PJATK', 'Планирует переезд к 23 августа').
- Append: [MEMORY_ADD: "Четко сформулированный факт на русском"]
- If the user says they were joking ("пошутил"), made a mistake, or cancelled a previous detail, append:
  [MEMORY_REMOVE: "Ключевое слово для удаления"]

TASK AUTOMATION & TITLES (STRICT RULES):
- TASK TITLE FORMAT:
  * ALWAYS in Russian (на русском языке).
  * STRICTLY NO colons (двоеточия ':') and NO ampersands ('&').
  * For action tasks: Clear, direct imperative guidance (e.g. 'Помыть посуду', 'Забрать выписку в банке Santander', 'Отрендерить правки сцены 4 для клиента').
  * For meetings & reminders: Clear event description with person, location, and time (e.g. 'Встреча в кафе Green Caffe Nero в 15:00 с клиентом', 'Позвонить в деканат PJATK').
- If explicitly asked to schedule, remind, or create a task, append:
[CREATE_TODO: {"title": "Четкое название задачи на русском без двоеточий", "details": "Подробности или пусто", "type": "short"|"long", "category": "Client"|"Banking"|"Motion"|"Personal"|"General", "timeMode": "deadline"|"interval", "deadline": "15:00", "reminder": "30m", "timeFrom": "14:00", "timeTo": "16:30"}]`;

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

    // 1. Process [CREATE_TODO: ...] (WITH STRICT DEDUPLICATION AND UPDATING)
    let createdTodo = null;
    const todoMatch = candidateText.match(/\[CREATE_TODO:\s*({[\s\S]*?})\]/);
    if (todoMatch && todoMatch[1]) {
      try {
        const parsedTodo = JSON.parse(todoMatch[1]);
        if (!db.todos) db.todos = [];

        const newCleanTitle = (parsedTodo.title || '').trim().toLowerCase().replace(/[^a-zа-я0-9]/gi, '');
        
        // Find existing similar task
        const existingIdx = db.todos.findIndex(t => {
          const existingClean = (t.title || '').trim().toLowerCase().replace(/[^a-zа-я0-9]/gi, '');
          if (existingClean === newCleanTitle) return true;
          if (newCleanTitle.length > 5 && (existingClean.includes(newCleanTitle) || newCleanTitle.includes(existingClean))) return true;
          return false;
        });

        if (existingIdx !== -1) {
          // Update / overwrite existing task instead of duplicating!
          db.todos[existingIdx] = {
            ...db.todos[existingIdx],
            title: parsedTodo.title || db.todos[existingIdx].title,
            details: parsedTodo.details || db.todos[existingIdx].details,
            type: parsedTodo.type === 'long' ? 'long' : 'short',
            category: parsedTodo.category || db.todos[existingIdx].category,
            timeMode: parsedTodo.timeMode || db.todos[existingIdx].timeMode,
            deadline: parsedTodo.deadline || db.todos[existingIdx].deadline,
            reminder: parsedTodo.reminder || db.todos[existingIdx].reminder,
            timeFrom: parsedTodo.timeFrom || db.todos[existingIdx].timeFrom,
            timeTo: parsedTodo.timeTo || db.todos[existingIdx].timeTo,
            updatedAt: new Date().toISOString()
          };
          createdTodo = db.todos[existingIdx];
        } else {
          // Create new task
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
        }

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
