import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import { readDb, writeDb } from '@/lib/db';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

// Verify admin authorization
async function isAuthorizedAdmin() {
  const session = await getServerSession(authOptions);
  if (!session || !session.user) return false;
  const adminEmail = process.env.ADMIN_EMAIL || "rifemotion.info@gmail.com";
  return session.user.email === adminEmail;
}

export async function GET() {
  const authorized = await isAuthorizedAdmin();
  if (!authorized) {
    return NextResponse.json({ error: "Unauthorized access" }, { status: 401 });
  }

  const db = readDb();
  return NextResponse.json({
    ok: true,
    feedback: db.feedback || [],
    mutes: db.mutes || {},
    replies: db.replies || []
  });
}

export async function POST(request) {
  const authorized = await isAuthorizedAdmin();
  if (!authorized) {
    return NextResponse.json({ error: "Unauthorized access" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { action, userId, ticketId, durationDays, message, customNotificationMessage } = body;

    const db = readDb();
    const now = new Date();
    const dateStr = `${now.getDate().toString().padStart(2, "0")}.${(now.getMonth() + 1).toString().padStart(2, "0")}.${now.getFullYear()} ${now.getHours().toString().padStart(2, "0")}:${now.getMinutes().toString().padStart(2, "0")}`;

    if (!db.mutes) db.mutes = {};

    if (action === 'mute_user') {
      if (!userId) return NextResponse.json({ error: "User ID required" }, { status: 400 });

      let bannedUntil = null;
      if (durationDays && durationDays !== 'permanent') {
        const days = parseInt(durationDays, 10);
        bannedUntil = new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString();
      } else {
        bannedUntil = new Date(Date.now() + 3650 * 24 * 60 * 60 * 1000).toISOString(); // 10 years
      }

      db.mutes[userId] = {
        userId: userId,
        bannedUntil: bannedUntil,
        bannedAt: dateStr,
        durationDays: durationDays,
        customMessage: customNotificationMessage || null,
        shadowBanned: false
      };

      // Also record custom mute notification in user replies log if message provided
      if (customNotificationMessage && customNotificationMessage.trim()) {
        if (!db.replies) db.replies = [];
        db.replies.unshift({
          id: Date.now(),
          ticketId: null,
          userId: userId,
          message: customNotificationMessage.trim(),
          date: dateStr
        });
      }

      writeDb(db);
      return NextResponse.json({ ok: true, mutes: db.mutes, replies: db.replies });
    }

    if (action === 'shadow_ban_user') {
      if (!userId) return NextResponse.json({ error: "User ID required" }, { status: 400 });

      db.mutes[userId] = {
        userId: userId,
        bannedUntil: new Date(Date.now() + 3650 * 24 * 60 * 60 * 1000).toISOString(),
        bannedAt: dateStr,
        durationDays: 'shadow',
        shadowBanned: true
      };

      writeDb(db);
      return NextResponse.json({ ok: true, mutes: db.mutes });
    }

    if (action === 'unmute_user') {
      if (!userId) return NextResponse.json({ error: "User ID required" }, { status: 400 });

      if (db.mutes && db.mutes[userId]) {
        delete db.mutes[userId];
        writeDb(db);
      }
      return NextResponse.json({ ok: true, mutes: db.mutes });
    }

    if (action === 'reply_user') {
      if (!userId || !message) return NextResponse.json({ error: "User ID & message required" }, { status: 400 });

      const newReply = {
        id: Date.now(),
        ticketId: ticketId || null,
        userId: userId,
        message: message,
        date: dateStr
      };

      if (!db.replies) db.replies = [];
      db.replies.unshift(newReply);

      writeDb(db);
      return NextResponse.json({ ok: true, replies: db.replies, feedback: db.feedback });
    }

    return NextResponse.json({ error: "Invalid action" }, { status: 400 });

  } catch (error) {
    console.error("Admin action error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
