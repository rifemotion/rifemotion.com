import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import { getDb, saveDb } from '@/lib/db';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET(request) {
  const session = await getServerSession(authOptions);
  if (!session || !session.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const db = await getDb();
    const todos = db.todos || [];
    return NextResponse.json({ ok: true, todos });
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
    const db = await getDb();
    if (!db.todos) db.todos = [];

    const newTodo = {
      id: body.id || 'todo_' + Date.now() + '_' + Math.random().toString(36).substr(2, 4),
      title: body.title || 'Untitled Task',
      details: body.details || '',
      type: body.type || 'short', // 'short' (daily) or 'long' (goals/projects)
      category: body.category || 'General', // 'Client', 'Banking', 'Motion', 'Personal'
      timeMode: body.timeMode || 'deadline', // 'deadline' or 'interval'
      deadline: body.deadline || '', // e.g. '15:00' or '2026-08-21 15:00'
      reminder: body.reminder || '30m', // '15m', '30m', '1h', '2h', '1d', 'none'
      timeFrom: body.timeFrom || '', // e.g. '14:00'
      timeTo: body.timeTo || '', // e.g. '16:30'
      completed: false,
      createdAt: new Date().toISOString()
    };

    db.todos.unshift(newTodo);
    await saveDb(db);

    return NextResponse.json({ ok: true, todo: newTodo, todos: db.todos });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function PATCH(request) {
  const session = await getServerSession(authOptions);
  if (!session || !session.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { id, completed, ...updates } = body;
    const db = await getDb();
    if (!db.todos) db.todos = [];

    const item = db.todos.find(t => t.id === id);
    if (!item) {
      return NextResponse.json({ error: "Task not found" }, { status: 404 });
    }

    if (completed !== undefined) item.completed = completed;
    Object.assign(item, updates);

    await saveDb(db);
    return NextResponse.json({ ok: true, todo: item, todos: db.todos });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function DELETE(request) {
  const session = await getServerSession(authOptions);
  if (!session || !session.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    const db = await getDb();
    if (!db.todos) db.todos = [];

    db.todos = db.todos.filter(t => t.id !== id);
    await saveDb(db);

    return NextResponse.json({ ok: true, todos: db.todos });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
