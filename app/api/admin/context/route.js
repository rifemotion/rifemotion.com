import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import { getDb, saveDb } from '@/lib/db';
import fs from 'fs';
import path from 'path';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

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
