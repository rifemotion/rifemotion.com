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
    const context = db.userContext || { items: [] };
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
    if (!context || !Array.isArray(context.items)) {
      return NextResponse.json({ error: "Invalid context payload" }, { status: 400 });
    }

    const db = await getDb();
    db.userContext = { items: context.items };
    await saveDb(db);
    return NextResponse.json({ ok: true, context: db.userContext });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
