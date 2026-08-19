import { NextResponse } from 'next/server';
import { getDb, writeDb, getWarsawDateString } from '@/lib/db';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: corsHeaders,
  });
}

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId') || '';
    const channel = searchParams.get('channel') || 'lapath';
    const hardware = searchParams.get('hardware');
    const os = searchParams.get('os');
    const stats = searchParams.get('stats');
    const appVersion = searchParams.get('appVersion');
    const installDate = searchParams.get('installDate');
    const daysInstalled = searchParams.get('daysInstalled');
    const extName = searchParams.get('extName') || channel;

    const db = await getDb();

    // Auto-register / update user presence in db.users
    const isDeletedUser = Boolean(db.deletedUserIds && db.deletedUserIds.includes(userId));
    if (userId && userId !== 'unknown' && !isDeletedUser) {
      if (!db.users) db.users = {};
      const dateStr = getWarsawDateString();

      if (!db.users[userId]) {
        db.users[userId] = {
          userId: userId,
          emails: [],
          email: 'none',
          extensionName: extName === 'kliner' ? 'KLiner' : 'LaPath',
          extension: extName || 'lapath',
          hardware: hardware || "Unknown Hardware",
          stats: stats || "Launches: 1",
          os: (os || "Windows 11").replace(/Windows\s*10\/11/gi, "Windows 11"),
          appVersion: appVersion || "Unknown",
          installDate: installDate || dateStr,
          daysInstalled: daysInstalled || "First day",
          newsletterSubscribed: false,
          lastSeen: dateStr
        };
        writeDb(db);
      } else {
        let changed = false;
        if (hardware && db.users[userId].hardware !== hardware) { db.users[userId].hardware = hardware; changed = true; }
        if (stats && db.users[userId].stats !== stats) { db.users[userId].stats = stats; changed = true; }
        if (os && db.users[userId].os !== os) { db.users[userId].os = os; changed = true; }
        if (appVersion && db.users[userId].appVersion !== appVersion) { db.users[userId].appVersion = appVersion; changed = true; }
        db.users[userId].lastSeen = dateStr;
        if (changed) writeDb(db);
      }
    }

    const allReplies = db.replies || [];
    const mutes = db.mutes || {};

    let isMuted = false;
    let mutedUntil = null;
    let muteReason = null;
    let muteRecord = null;

    if (userId && mutes[userId]) {
      muteRecord = mutes[userId];
      if (muteRecord.bannedUntil) {
        const banExpiry = new Date(muteRecord.bannedUntil).getTime();
        if (banExpiry > Date.now()) {
          isMuted = true;
          mutedUntil = new Date(banExpiry).toLocaleDateString('en-GB');
          muteReason = muteRecord.reason || 'Feedback submission temporarily suspended';
        }
      }
    }

    const notifications = [];

    // 1. If muted, add single clean System Notice to user feed
    if (isMuted) {
      let bodyText = `Your feedback submission access has been restricted until ${mutedUntil}.`;
      if (muteReason) {
        bodyText += ` Reason: ${muteReason}.`;
      }

      notifications.push({
        id: muteRecord?.mutedAt ? new Date(muteRecord.mutedAt).getTime() : Date.now(),
        title: "Feedback Access Restricted",
        subtitle: "System Notice",
        body: bodyText,
        date: muteRecord?.mutedAt || getWarsawDateString(),
        unread: true
      });
    }

    // 2. Convert replies into notifications (using custom title as header, and message as body)
    allReplies.forEach((r) => {
      if (r.userId === 'all' || r.userId === userId) {
        notifications.push({
          id: r.id,
          title: r.title || (r.category === 'announcements' ? "Announcement" : r.category === 'warning' ? "System Notice" : "Personal Reply"),
          subtitle: r.category === 'announcements' ? "Announcement" : r.category === 'warning' ? "System Notice" : "Personal Reply",
          body: r.message,
          message: r.message,
          buttons: r.buttons || [],
          date: r.date,
          unread: true
        });
      }
    });

    return NextResponse.json({
      ok: true,
      isMuted: isMuted,
      mutedUntil: mutedUntil,
      notifications: notifications
    }, { status: 200, headers: corsHeaders });

  } catch (error) {
    console.error("Notifications fetch error:", error);
    return NextResponse.json({ ok: false, isMuted: false, notifications: [] }, { status: 500, headers: corsHeaders });
  }
}
