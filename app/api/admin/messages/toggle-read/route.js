import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import { getDb, saveDb } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function POST(request) {
  const session = await getServerSession(authOptions);
  if (!session || !session.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { messageId, read } = await request.json();
    if (!messageId) {
      return NextResponse.json({ error: "Missing messageId" }, { status: 400 });
    }

    const db = await getDb();
    if (!db.messages) db.messages = [];

    let updated = false;
    for (const msg of db.messages) {
      if (msg.id === messageId) {
        msg.read = read;
        updated = true;
        break;
      }
    }

    if (updated) {
      await saveDb(db);
      return NextResponse.json({ ok: true, read });
    } else {
      return NextResponse.json({ error: "Message not found" }, { status: 404 });
    }
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
