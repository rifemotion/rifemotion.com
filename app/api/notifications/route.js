import { NextResponse } from 'next/server';
import { readDb } from '@/lib/db';

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

    const notifications = [];

    // Convert replies sent to this user or all users into notifications
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

    notifications.push({
      id: 10001,
      title: "LaPath 1.2.0 Connected",
      subtitle: "System Notice",
      body: "Your extension is synchronized with rifemotion control hub.",
      date: "16.08.2026",
      unread: false
    });

    return NextResponse.json({
      ok: true,
      notifications: notifications
    }, { status: 200, headers: corsHeaders });

  } catch (error) {
    console.error("Notifications fetch error:", error);
    return NextResponse.json({ ok: false, notifications: [] }, { status: 500, headers: corsHeaders });
  }
}
