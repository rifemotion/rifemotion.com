import fs from 'fs';
import path from 'path';

const CLOUD_STORE_URL = 'https://lapathfeedbackapi.nikitasolodkij3.workers.dev/db';

if (!global.cachedDb) {
  global.cachedDb = { feedback: [], mutes: {}, replies: [] };
}

const PRIMARY_DB_PATH = path.join(process.cwd(), 'data', 'db.json');
const TMP_DB_PATH = path.join('/tmp', 'db.json');

function getActiveDbPath() {
  if (process.env.VERCEL || process.env.NODE_ENV === 'production') {
    return TMP_DB_PATH;
  }
  return PRIMARY_DB_PATH;
}

export async function getDb() {
  try {
    let cloudData = null;
    const customUrl = process.env.DATABASE_URL || process.env.CUSTOM_DB_API || CLOUD_STORE_URL;

    // 1. Fetch live persistent state from Cloudflare Worker KV
    try {
      const res = await fetch(customUrl, { cache: 'no-store' });
      if (res.ok) {
        const json = await res.json();
        if (json) {
          cloudData = json.data || json;
        }
      }
    } catch (eCloud) {
      console.error('Cloud fetch error:', eCloud);
    }

    const targetPath = getActiveDbPath();
    let dataFromFile = null;

    if (fs.existsSync(targetPath)) {
      try {
        dataFromFile = JSON.parse(fs.readFileSync(targetPath, 'utf-8'));
      } catch (e) {}
    }

    // Track deleted feedback IDs so they are permanently removed across all sources
    const deletedSet = new Set([
      ...(Array.isArray(cloudData?.deletedFeedbackIds) ? cloudData.deletedFeedbackIds.map(String) : []),
      ...(Array.isArray(dataFromFile?.deletedFeedbackIds) ? dataFromFile.deletedFeedbackIds.map(String) : []),
      ...(Array.isArray(global.cachedDb?.deletedFeedbackIds) ? global.cachedDb.deletedFeedbackIds.map(String) : [])
    ]);

    const cloudFeedback = Array.isArray(cloudData?.feedback) ? cloudData.feedback : [];
    const memoryFeedback = Array.isArray(global.cachedDb?.feedback) ? global.cachedDb.feedback : [];
    const fileFeedback = Array.isArray(dataFromFile?.feedback) ? dataFromFile.feedback : [];

    const feedbackMap = new Map();
    // Merge all sources cumulatively, excluding deleted items
    cloudFeedback.forEach(item => { if (item && item.id && !deletedSet.has(String(item.id))) feedbackMap.set(String(item.id), item); });
    fileFeedback.forEach(item => { if (item && item.id && !deletedSet.has(String(item.id))) feedbackMap.set(String(item.id), item); });
    memoryFeedback.forEach(item => { if (item && item.id && !deletedSet.has(String(item.id))) feedbackMap.set(String(item.id), item); });

    const mergedFeedback = Array.from(feedbackMap.values()).sort((a, b) => b.id - a.id);
    const mergedMutes = {
      ...(cloudData?.mutes || {}),
      ...(dataFromFile?.mutes || {}),
      ...(global.cachedDb?.mutes || {})
    };

    const mergedUsers = {
      ...(cloudData?.users || {}),
      ...(dataFromFile?.users || {}),
      ...(global.cachedDb?.users || {})
    };

    // Auto-seed registered users from existing feedback submissions
    mergedFeedback.forEach(item => {
      if (item && item.userId) {
        if (!mergedUsers[item.userId]) {
          mergedUsers[item.userId] = {
            userId: item.userId,
            emails: item.email && item.email.includes('@') && item.email !== 'none' ? [item.email.trim()] : [],
            email: item.email && item.email.includes('@') && item.email !== 'none' ? item.email.trim() : 'none',
            extensionName: item.extensionName || "LaPath",
            extension: item.extension || "lapath",
            hardware: item.hardware || "Unknown Hardware",
            stats: item.stats || "Launches: 1",
            os: (item.os || "Windows 11").replace(/Windows\s*10\/11/gi, "Windows 11"),
            appVersion: item.appVersion || "Unknown",
            installDate: item.installDate || "-",
            daysInstalled: item.daysInstalled || "Unknown",
            newsletterSubscribed: item.newsletterSubscribed === true || item.type === 'newsletter',
            lastSeen: item.date || new Date().toISOString()
          };
        } else {
          // If user exists, ensure email is recorded
          if (item.email && item.email.includes('@') && item.email !== 'none') {
            const trimmed = item.email.trim();
            if (!mergedUsers[item.userId].emails) mergedUsers[item.userId].emails = [];
            if (!mergedUsers[item.userId].emails.includes(trimmed)) {
              if (item.newsletterSubscribed === true || item.type === 'newsletter') {
                mergedUsers[item.userId].emails.unshift(trimmed);
              } else {
                mergedUsers[item.userId].emails.push(trimmed);
              }
            }
          }
          if (item.newsletterSubscribed === true || item.type === 'newsletter') {
            mergedUsers[item.userId].newsletterSubscribed = true;
          }
        }
      }
    });

    const allReplies = [
      ...(Array.isArray(cloudData?.replies) ? cloudData.replies : []),
      ...(Array.isArray(dataFromFile?.replies) ? dataFromFile.replies : []),
      ...(Array.isArray(global.cachedDb?.replies) ? global.cachedDb.replies : [])
    ];
    const replyMap = new Map();
    allReplies.forEach(r => { if (r && r.id) replyMap.set(r.id, r); });
    const mergedReplies = Array.from(replyMap.values()).sort((a, b) => b.id - a.id);

    const mergedTodos = [
      ...(Array.isArray(cloudData?.todos) ? cloudData.todos : []),
      ...(Array.isArray(dataFromFile?.todos) ? dataFromFile.todos : []),
      ...(Array.isArray(global.cachedDb?.todos) ? global.cachedDb.todos : [])
    ];
    const todoMap = new Map();
    mergedTodos.forEach(t => { if (t && t.id) todoMap.set(t.id, t); });

    const result = {
      users: mergedUsers,
      feedback: mergedFeedback,
      mutes: mergedMutes,
      replies: mergedReplies,
      todos: Array.from(todoMap.values()),
      deletedFeedbackIds: Array.from(deletedSet)
    };

    global.cachedDb = result;

    // Cache locally
    try {
      const dir = path.dirname(targetPath);
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(targetPath, JSON.stringify(result, null, 2), 'utf-8');
    } catch (eSave) {}

    return result;

  } catch (error) {
    console.error('Error in getDb:', error);
    return global.cachedDb || { feedback: [], mutes: {}, replies: [] };
  }
}

export function readDb() {
  return global.cachedDb || { feedback: [], mutes: {}, replies: [] };
}

export const saveDb = writeDb;
export async function writeDb(data) {
  try {
    global.cachedDb = data;

    const targetPath = getActiveDbPath();
    const dir = path.dirname(targetPath);
    try {
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    } catch (e) {}

    try {
      fs.writeFileSync(targetPath, JSON.stringify(data, null, 2), 'utf-8');
    } catch (e) {}

    if (targetPath !== PRIMARY_DB_PATH && fs.existsSync(path.dirname(PRIMARY_DB_PATH))) {
      try {
        fs.writeFileSync(PRIMARY_DB_PATH, JSON.stringify(data, null, 2), 'utf-8');
      } catch (ePrimary) {}
    }

    // Await cloud sync directly to Cloudflare Worker KV
    try {
      const customUrl = process.env.DATABASE_URL || process.env.CUSTOM_DB_API || CLOUD_STORE_URL;
      const res = await fetch(customUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      });
      if (!res.ok) {
        console.error('Cloudflare KV write returned status:', res.status);
      }
    } catch (eCloud) {
      console.error('Cloudflare KV sync error:', eCloud);
    }

    return true;
  } catch (error) {
    console.error('Error writing DB:', error);
    return false;
  }
}

export function getWarsawDateString(date = new Date()) {
  const parts = new Intl.DateTimeFormat('ru-RU', {
    timeZone: 'Europe/Warsaw',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false
  }).formatToParts(date);

  const day = parts.find(p => p.type === 'day')?.value || '01';
  const month = parts.find(p => p.type === 'month')?.value || '01';
  const year = parts.find(p => p.type === 'year')?.value || '2026';
  const hour = parts.find(p => p.type === 'hour')?.value || '00';
  const minute = parts.find(p => p.type === 'minute')?.value || '00';

  return `${day}.${month}.${year} ${hour}:${minute}`;
}
