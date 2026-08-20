import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: corsHeaders });
}

export async function GET(request) {
  try {
    const db = await getDb();
    const messages = db.messages || [];
    const todos = db.todos || [];

    const urgentMessages = messages.filter(m => m.urgency === 'red');
    const pendingTodos = todos.filter(t => !t.completed);

    return NextResponse.json({
      ok: true,
      timestamp: Date.now(),
      summary: {
        urgentCount: urgentMessages.length,
        todoCount: pendingTodos.length,
        totalMessages: messages.length,
      },
      urgentAlerts: urgentMessages.map(m => ({
        id: m.id,
        title: m.shortTitle || m.subject,
        author: m.author || m.sender,
        body: m.body,
        date: m.date,
        url: m.url || 'https://rifemotion.com/admin',
        urgency: 'red',
        isAlarm: true
      })),
      todos: pendingTodos.slice(0, 15).map(t => ({
        id: t.id,
        text: t.text,
        urgency: t.urgency || 'medium',
        deadline: t.deadline || null,
        completed: t.completed === true,
        date: t.date
      })),
      latestMessages: messages.slice(0, 10).map(m => ({
        id: m.id,
        title: m.shortTitle || m.subject,
        author: m.author || m.sender,
        urgency: m.urgency,
        folder: m.folder || (m.isSent ? 'sent' : 'inbox'),
        date: m.date
      }))
    }, { headers: corsHeaders });
  } catch (error) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500, headers: corsHeaders });
  }
}
