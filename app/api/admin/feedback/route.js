import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import { getDb, writeDb } from '@/lib/db';

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

  const db = await getDb();
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

    const db = await getDb();
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
        reason: body.reason || 'Violation of Guidelines',
        shadowBanned: false
      };

      writeDb(db);
      return NextResponse.json({ ok: true, mutes: db.mutes, replies: db.replies });
    }

    if (action === 'delete_feedback') {
      const id = body.id;
      db.feedback = (db.feedback || []).filter(item => item.id !== id);
      writeDb(db);
      return NextResponse.json({ ok: true, feedback: db.feedback });
    }

    if (action === 'delete_reply') {
      const replyId = body.replyId;
      db.replies = (db.replies || []).filter(r => r.id !== replyId);
      writeDb(db);
      return NextResponse.json({ ok: true, replies: db.replies });
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

      if (!db.replies) db.replies = [];
      const newReply = {
        id: Date.now(),
        ticketId: ticketId || null,
        userId: userId,
        message: message.trim(),
        date: dateStr
      };

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
