import { NextResponse } from 'next/server';
import { readDb, writeDb } from '@/lib/db';

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

export async function POST(request) {
  try {
    let type = 'review';
    let rating = null;
    let text = '';
    let email = '';
    let urgency = 'low';
    let metaStr = null;
    let telegramMediaUrl = null;

    const contentType = request.headers.get('content-type') || '';

    if (contentType.includes('multipart/form-data')) {
      const formData = await request.formData();
      type = formData.get('type') || 'review';
      rating = formData.get('rating') ? parseInt(formData.get('rating')) : null;
      text = formData.get('text') || '';
      email = formData.get('email') || '';
      urgency = formData.get('urgency') || 'low';
      metaStr = formData.get('meta');
      telegramMediaUrl = formData.get('telegramMediaUrl') || null;
    } else {
      const body = await request.json();
      type = body.type || 'review';
      rating = body.rating || null;
      text = body.text || '';
      email = body.email || '';
      urgency = body.urgency || 'low';
      metaStr = body.meta ? (typeof body.meta === 'string' ? body.meta : JSON.stringify(body.meta)) : null;
      telegramMediaUrl = body.telegramMediaUrl || null;
    }

    let metaObj = {};
    if (metaStr) {
      try {
        metaObj = typeof metaStr === 'string' ? JSON.parse(metaStr) : metaStr;
      } catch (e) {
        metaObj = {};
      }
    }

    const userId = metaObj.userId || `usr_${Math.random().toString(36).substring(2, 10)}`;

    const db = readDb();

    // Check Mute / Ban Status
    if (db.mutes && db.mutes[userId]) {
      const muteRecord = db.mutes[userId];
      if (muteRecord.bannedUntil) {
        const banExpiry = new Date(muteRecord.bannedUntil).getTime();
        const now = Date.now();
        if (banExpiry > now) {
          const formattedDate = new Date(banExpiry).toLocaleDateString('en-GB');
          return NextResponse.json({
            ok: false,
            error: `Feedback submission is temporarily suspended for your account until ${formattedDate}.`
          }, { status: 403, headers: corsHeaders });
        }
      }
    }

    const now = new Date();
    const dateStr = `${now.getDate().toString().padStart(2, "0")}.${(now.getMonth() + 1).toString().padStart(2, "0")}.${now.getFullYear()} ${now.getHours().toString().padStart(2, "0")}:${now.getMinutes().toString().padStart(2, "0")}`;

    // Clean Short Ticket ID (e.g. 101, 102...)
    const lastTicket = db.feedback && db.feedback.length > 0 ? db.feedback[0] : null;
    const newTicketId = lastTicket && typeof lastTicket.id === 'number' && lastTicket.id < 1000000 ? lastTicket.id + 1 : 101;

    const typeNames = {
      review: "General Review",
      suggest: "Feature Suggestion",
      report: "Bug Report"
    };

    const newFeedback = {
      id: newTicketId,
      userId: userId,
      email: email || 'anonymous@user',
      extension: metaObj.extName || 'lapath',
      extensionName: metaObj.extName === 'kliner' ? 'KLiner' : 'LaPath',
      type: type,
      typeName: typeNames[type] || "General Feedback",
      title: text.length > 50 ? text.substring(0, 50) + '...' : (text || "Feedback Submission"),
      message: text,
      urgency: urgency,
      rating: rating,
      status: "Open",
      date: dateStr,
      hardware: metaObj.hardware || "Unknown Hardware",
      stats: metaObj.stats || "Launches: 1",
      appName: metaObj.appName || "Adobe After Effects",
      appVersion: metaObj.appVersion || "Unknown",
      appLocale: metaObj.appLocale || "en_US",
      os: metaObj.os || "Windows",
      extVersion: metaObj.extVersion || "1.2.0",
      installDate: metaObj.installDate || dateStr,
      daysInstalled: metaObj.daysInstalled || "First day",
      telegramMediaUrl: telegramMediaUrl
    };

    db.feedback = [newFeedback, ...(db.feedback || [])];
    writeDb(db);

    return NextResponse.json({
      ok: true,
      ticketId: newTicketId,
      message: "Feedback successfully recorded."
    }, { status: 200, headers: corsHeaders });

  } catch (error) {
    console.error("Feedback submission error:", error);
    return NextResponse.json({ ok: false, error: "Internal server error" }, { status: 500, headers: corsHeaders });
  }
}
