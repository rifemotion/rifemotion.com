import { NextResponse } from 'next/server';
import { getDb, writeDb } from '@/lib/db';

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
      const rawRating = formData.get('rating');
      rating = type === 'review' ? (rawRating ? parseInt(rawRating) : 5) : null;
      text = formData.get('text') || '';
      email = formData.get('email') || '';
      urgency = formData.get('urgency') || 'low';
      metaStr = formData.get('meta');
      const rawTg = formData.get('telegramMediaUrl');
      telegramMediaUrl = rawTg && typeof rawTg === 'string' && rawTg.startsWith('http') ? rawTg : null;
    } else {
      const body = await request.json();
      type = body.type || 'review';
      rating = type === 'review' ? (body.rating ? parseInt(body.rating) : 5) : null;
      text = body.text || '';
      email = body.email || '';
      urgency = body.urgency || 'low';
      metaStr = body.meta ? (typeof body.meta === 'string' ? body.meta : JSON.stringify(body.meta)) : null;
      const rawTg = body.telegramMediaUrl;
      telegramMediaUrl = rawTg && typeof rawTg === 'string' && rawTg.startsWith('http') ? rawTg : null;
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

    const db = await getDb();

    // Check Mute & Shadow Ban Status
    if (db.mutes && db.mutes[userId]) {
      const muteRecord = db.mutes[userId];
      
      // SHADOW BAN: Silently pretend success without saving to DB
      if (muteRecord.shadowBanned) {
        return NextResponse.json({
          ok: true,
          ticketId: 100,
          message: "Feedback successfully recorded."
        }, { status: 200, headers: corsHeaders });
      }

      // STANDARD MUTE: Block request with error
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

    const lastSeq = db.feedback && db.feedback.length > 0 ? db.feedback.length + 1 : 1;

    const typeNames = {
      review: "General Review",
      suggest: "Feature Suggestion",
      report: "Bug Report"
    };

    const newFeedback = {
      id: Date.now(),
      seqId: lastSeq,
      userId: userId,
      email: email && email.includes('@') ? email : 'none',
      extension: metaObj.extName || 'lapath',
      extensionName: metaObj.extName === 'kliner' ? 'KLiner' : 'LaPath',
      type: type,
      typeName: typeNames[type] || "General Feedback",
      title: text.length > 50 ? text.substring(0, 50) + '...' : (text || "Submission"),
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
    await writeDb(db);

    return NextResponse.json({
      ok: true,
      ticketId: newFeedback.id,
      message: "Feedback successfully recorded."
    }, { status: 200, headers: corsHeaders });

  } catch (error) {
    console.error("Feedback submission error:", error);
    return NextResponse.json({ ok: false, error: "Internal server error" }, { status: 500, headers: corsHeaders });
  }
}
