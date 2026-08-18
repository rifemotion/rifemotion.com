import { NextResponse } from 'next/server';
import { getDb, writeDb, getWarsawDateString } from '@/lib/db';

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

    let hasMedia = false;
    let mediaCount = 0;

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

      // Count attached files in multipart form
      for (const key of formData.keys()) {
        if (key.startsWith('file_') || key === 'file') {
          hasMedia = true;
          mediaCount++;
        }
      }
      if (formData.get('hasMedia') === 'true') hasMedia = true;
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
      if (body.hasMedia) hasMedia = true;
      if (body.mediaCount) mediaCount = parseInt(body.mediaCount) || 1;
    }

    if (telegramMediaUrl) hasMedia = true;

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
    const typeNames = {
      review: "General Review",
      suggest: "Feature Suggestion",
      report: "Bug Report"
    };

    const dateStr = getWarsawDateString();
    const lastSeq = db.feedback && db.feedback.length > 0 ? (db.feedback[0].seqId || db.feedback.length) + 1 : 1;

    let resolvedEmail = email && email.includes('@') ? email.trim() : 'none';
    if (resolvedEmail === 'none' && db.feedback) {
      const existingUserItem = db.feedback.find(item => item.userId === userId && item.email && item.email.includes('@') && item.email !== 'none');
      if (existingUserItem) {
        resolvedEmail = existingUserItem.email;
      }
    }

    const actionResp = metaObj.actionResponse;
    const isNewsletterAction = type === 'newsletter' || actionResp?.action === 'subscribe' || actionResp?.action === 'unsubscribe';

    if (isNewsletterAction) {
      const isSubscribing = actionResp?.action === 'subscribe' || (type === 'newsletter' && actionResp?.action !== 'unsubscribe');
      let foundUser = false;

      (db.feedback || []).forEach(item => {
        if (String(item.userId) === String(userId)) {
          foundUser = true;
          item.newsletterSubscribed = isSubscribing;
          if (resolvedEmail !== 'none') {
            item.email = resolvedEmail;
          }
        }
      });

      // If user has no existing submissions, create a lightweight newsletter profile entry
      if (!foundUser) {
        const subscriberEntry = {
          id: Date.now(),
          seqId: lastSeq,
          userId: userId,
          email: resolvedEmail,
          extension: metaObj.extName || 'lapath',
          extensionName: metaObj.extName === 'kliner' ? 'KLiner' : 'LaPath',
          type: 'newsletter',
          typeName: 'Newsletter Subscriber',
          title: isSubscribing ? 'Newsletter Subscriber' : 'Unsubscribed',
          message: isSubscribing ? `Subscribed to email updates (${resolvedEmail})` : 'Unsubscribed from updates',
          urgency: 'low',
          rating: null,
          newsletterSubscribed: isSubscribing,
          status: 'Open',
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
          hasMedia: false,
          mediaCount: 0,
          telegramMediaUrl: null
        };
        db.feedback = [subscriberEntry, ...(db.feedback || [])];
      }

      await writeDb(db);

      return NextResponse.json({
        ok: true,
        message: isSubscribing ? "Subscribed to newsletter." : "Unsubscribed from newsletter."
      }, { status: 200, headers: corsHeaders });
    }

    const newFeedback = {
      id: Date.now(),
      seqId: lastSeq,
      userId: userId,
      email: resolvedEmail,
      extension: metaObj.extName || 'lapath',
      extensionName: metaObj.extName === 'kliner' ? 'KLiner' : 'LaPath',
      type: type,
      typeName: typeNames[type] || "General Feedback",
      title: typeNames[type] || "Feedback",
      message: text,
      urgency: urgency,
      rating: rating,
      newsletterSubscribed: false,
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
      hasMedia: hasMedia,
      mediaCount: mediaCount,
      telegramMediaUrl: telegramMediaUrl
    };

    db.feedback = [newFeedback, ...(db.feedback || [])];

    // Ensure db.users has this user registered with telemetry & email
    if (!db.users) db.users = {};
    if (!db.users[userId]) {
      db.users[userId] = {
        userId: userId,
        emails: resolvedEmail && resolvedEmail !== 'none' ? [resolvedEmail] : [],
        email: resolvedEmail && resolvedEmail !== 'none' ? resolvedEmail : 'none',
        extensionName: metaObj.extName === 'kliner' ? 'KLiner' : 'LaPath',
        extension: metaObj.extName || 'lapath',
        hardware: metaObj.hardware || "Unknown Hardware",
        stats: metaObj.stats || "Launches: 1",
        os: (metaObj.os || "Windows 11").replace(/Windows\s*10\/11/gi, "Windows 11"),
        appVersion: metaObj.appVersion || "Unknown",
        installDate: metaObj.installDate || dateStr,
        daysInstalled: metaObj.daysInstalled || "First day",
        newsletterSubscribed: false,
        lastSeen: dateStr
      };
    } else {
      if (resolvedEmail && resolvedEmail !== 'none') {
        if (!db.users[userId].emails) db.users[userId].emails = [];
        if (!db.users[userId].emails.includes(resolvedEmail)) {
          db.users[userId].emails.push(resolvedEmail);
        }
      }
      if (metaObj.hardware) db.users[userId].hardware = metaObj.hardware;
      if (metaObj.stats) db.users[userId].stats = metaObj.stats;
      if (metaObj.os) db.users[userId].os = metaObj.os;
      if (metaObj.appVersion) db.users[userId].appVersion = metaObj.appVersion;
      db.users[userId].lastSeen = dateStr;
    }

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
