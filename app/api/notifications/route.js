import { NextResponse } from 'next/server';
import { readDb } from '@/lib/db';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

export async function OPTIONS() {
  return new Response(null, {
    status: 204,
    headers: corsHeaders,
  });
}

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId') || '';
    const channel = searchParams.get('channel') || 'lapath';

    const db = readDb();
    const allReplies = db.replies || [];
    const mutes = db.mutes || {};

    let isMuted = false;
    let mutedUntil = null;
    let muteReason = null;

    if (userId && mutes[userId]) {
      const muteRecord = mutes[userId];
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

    // 1. If muted, add single unified Mute Notification to user feed
    if (isMuted) {
      let bodyText = `Your feedback submission access has been temporarily restricted until ${mutedUntil}.`;
      if (muteReason) {
        bodyText += ` Reason: ${muteReason}.`;
      }
      if (muteRecord && muteRecord.customMessage && muteRecord.customMessage.trim()) {
        bodyText += ` Note: ${muteRecord.customMessage.trim()}`;
      }

      notifications.push({
        id: 99999,
        title: "Feedback Access Restricted",
        subtitle: "System Notice",
        body: bodyText,
        date: "Today",
        unread: true
      });
    }

    // 2. Convert replies sent to this user or all users into notifications
    allReplies.forEach((r) => {
      if (r.userId === 'all' || r.userId === userId) {
        notifications.push({
          id: r.id,
          title: "Response from rifemotion Team",
          subtitle: r.userId === 'all' ? "Announcement" : "Personal Reply",
          body: r.message,
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
