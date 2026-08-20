import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import { getDb, saveDb } from '@/lib/db';
import fs from 'fs';
import path from 'path';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

function getUserContext(db) {
  if (db && db.userContext) return db.userContext;
  try {
    const contextPath = path.join(process.cwd(), 'data', 'user_context.json');
    if (fs.existsSync(contextPath)) {
      return JSON.parse(fs.readFileSync(contextPath, 'utf8'));
    }
  } catch (e) {}
  return {
    profile: {
      name: "Mykyta Solodkyi (Никита)",
      role: "Founder & Motion Designer at rifemotion",
      location: "Warsaw, Poland",
      education: "PJATK University",
      projects: ["rifemotion.com", "LaPath", "KLiner"]
    },
    principles_and_preferences: [
      "Strict UI cleanliness: dark technical aesthetic, 4px rectangular corners, no bright purple outside Gemini window.",
      "Hover animations must never scale or shift position, only color/border/glow/opacity.",
      "Hates corporate fluff; values directness and concise answers for quick questions.",
      "Speaks English by default, Russian when addressed in Russian."
    ],
    dynamic_notes: []
  };
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

export async function GET(request) {
  const session = await getServerSession(authOptions);
  if (!session || !session.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const db = await getDb();
    const context = getUserContext(db);
    return NextResponse.json({ ok: true, context });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(request) {
  const session = await getServerSession(authOptions);
  if (!session || !session.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { context } = body;
    if (!context) {
      return NextResponse.json({ error: "No context provided" }, { status: 400 });
    }

    const db = await getDb();
    await saveUserContext(context, db);
    return NextResponse.json({ ok: true, context });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
