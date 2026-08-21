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

    const systemContext = `You are Rifemotion's admin AI assistant. You have full access to the user's database, including messages (emails) and to-dos.
Your tone should be concise, professional, direct, and slightly cynical. You use Russian language primarily.

USER CONTEXT (Read carefully):
${userContextStr}

EXISTING TASKS (Read carefully):
${(db.todos || []).map(t => `- [${t.id}] ${t.title} (${t.timeMode}: ${t.deadline || t.timeFrom + '-' + t.timeTo}) ${t.details}`).join('\n')}

MEMORY RULES (STRICT):
- ONLY add facts to context that are permanent or long-term (e.g. age, university, past locations, permanent workplace).
- DO NOT add temporary states (e.g. "I am looking for an apartment in Warsaw", "I want to buy a car").
- To add a permanent fact, append: [MEMORY_ADD: "Fact description"]
- To remove a fact, append: [MEMORY_REMOVE: "Keyword"]

TASK AUTOMATION & TITLES (STRICT RULES):
- When creating a task, cross-reference the user's input with the EXISTING TASKS list. If they mention buying a ticket to Bern, and there's already a task "Trip to Bern" on 30.02, infer that the ticket is for that trip.
- IF YOU ARE UNSURE about dates, times, or details, DO NOT create the task. Instead, ask the user a clarifying question.
- TASK TITLE FORMAT: Always in Russian, NO colons, NO ampersands. Clear imperative action or event description.
- To create a task, append exactly this JSON structure (it supports subtasks):
[CREATE_TODO: {"title": "Task Title", "details": "Task description", "type": "short"|"long", "category": "Client"|"Personal"|"General", "timeMode": "deadline"|"interval", "deadline": "15:00", "reminder": "30m", "timeFrom": "14:00", "timeTo": "16:30", "subtasks": ["Subtask 1", "Subtask 2"]}]
- If the user asks to "reorganize" or overwrite existing emails, append: [TRIGGER_REORGANIZE]`;

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
    
    let triggersReorganize = false;
    if (candidateText.includes('[TRIGGER_REORGANIZE]')) {
      triggersReorganize = true;
      candidateText = candidateText.replace(/\[TRIGGER_REORGANIZE\]/g, '').trim();
    }

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
            subtasks: Array.isArray(parsedTodo.subtasks) 
              ? parsedTodo.subtasks.map(s => ({ id: 'sub_' + Math.random().toString(36).substr(2, 6), text: s, completed: false })) 
              : db.todos[existingIdx].subtasks,
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
            subtasks: Array.isArray(parsedTodo.subtasks) ? parsedTodo.subtasks.map(s => ({ id: 'sub_' + Math.random().toString(36).substr(2, 6), text: s, completed: false })) : [],
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
      createdTodo,
      triggersReorganize
    });

  } catch (error) {
    console.error("Gemini route error:", error);
    return NextResponse.json({
      ok: false,
      reply: "⚠️ Request failed: " + error.message
    }, { status: 500 });
  }
}
