import fs from 'fs';
import path from 'path';

const CLOUD_STORE_URL = 'https://api.restful-api.dev/objects/ff8081819ff5b11001a00c0b217b2f57';

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

    // 1. Fetch live persistent state from cloud store
    try {
      const res = await fetch(CLOUD_STORE_URL, { cache: 'no-store' });
      if (res.ok) {
        const json = await res.json();
        if (json && json.data) {
          cloudData = json.data;
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

    // Merge: Cloud is primary source of truth, merged with memory and file
    const cloudFeedback = (cloudData && cloudData.feedback) || [];
    const memoryFeedback = (global.cachedDb && global.cachedDb.feedback) || [];
    const fileFeedback = (dataFromFile && dataFromFile.feedback) || [];

    const feedbackMap = new Map();
    // Insert file & memory first, then cloud overwrites so latest cloud state always wins
    fileFeedback.forEach(item => feedbackMap.set(item.id, item));
    memoryFeedback.forEach(item => feedbackMap.set(item.id, item));
    cloudFeedback.forEach(item => feedbackMap.set(item.id, item));

    const mergedFeedback = Array.from(feedbackMap.values()).sort((a, b) => b.id - a.id);
    const mergedMutes = {
      ...(dataFromFile?.mutes || {}),
      ...(global.cachedDb?.mutes || {}),
      ...(cloudData?.mutes || {})
    };

    const allReplies = [
      ...(fileFeedback.length ? (dataFromFile?.replies || []) : []),
      ...(global.cachedDb?.replies || []),
      ...(cloudData?.replies || [])
    ];
    const replyMap = new Map();
    allReplies.forEach(r => replyMap.set(r.id, r));
    const mergedReplies = Array.from(replyMap.values()).sort((a, b) => b.id - a.id);

    const result = {
      feedback: mergedFeedback,
      mutes: mergedMutes,
      replies: mergedReplies
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

    // Await cloud sync so serverless execution context is NOT terminated prematurely
    try {
      const res = await fetch(CLOUD_STORE_URL, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: 'rifemotion_db',
          data: data
        })
      });
      if (!res.ok) {
        console.error('Cloud store write failed with status:', res.status);
      }
    } catch (eCloud) {
      console.error('Cloud store sync error:', eCloud);
    }

    return true;
  } catch (error) {
    console.error('Error writing DB:', error);
    return false;
  }
}
