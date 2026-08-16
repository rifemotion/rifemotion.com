import fs from 'fs';
import path from 'path';

// Memory cache across Vercel serverless invocations
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

function ensureDbExists() {
  const targetPath = getActiveDbPath();
  const dir = path.dirname(targetPath);
  
  try {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  } catch (e) {}

  if (!fs.existsSync(targetPath)) {
    let initialData = global.cachedDb && global.cachedDb.feedback && global.cachedDb.feedback.length > 0
      ? global.cachedDb
      : { feedback: [], mutes: {}, replies: [] };

    if (fs.existsSync(PRIMARY_DB_PATH)) {
      try {
        const fileContent = JSON.parse(fs.readFileSync(PRIMARY_DB_PATH, 'utf-8'));
        if (fileContent && fileContent.feedback) {
          initialData = fileContent;
        }
      } catch (e) {}
    }
    try {
      fs.writeFileSync(targetPath, JSON.stringify(initialData, null, 2), 'utf-8');
      global.cachedDb = initialData;
    } catch (e) {}
  }
}

export function readDb() {
  try {
    ensureDbExists();
    const targetPath = getActiveDbPath();
    let dataFromFile = null;

    if (fs.existsSync(targetPath)) {
      try {
        const content = fs.readFileSync(targetPath, 'utf-8');
        dataFromFile = JSON.parse(content);
      } catch (e) {}
    }

    if (!dataFromFile && fs.existsSync(PRIMARY_DB_PATH)) {
      try {
        const content = fs.readFileSync(PRIMARY_DB_PATH, 'utf-8');
        dataFromFile = JSON.parse(content);
      } catch (e) {}
    }

    // Merge memory cache and file data
    const memoryFeedback = (global.cachedDb && global.cachedDb.feedback) || [];
    const fileFeedback = (dataFromFile && dataFromFile.feedback) || [];

    const feedbackMap = new Map();
    memoryFeedback.forEach(item => feedbackMap.set(item.id, item));
    fileFeedback.forEach(item => feedbackMap.set(item.id, item));

    const mergedFeedback = Array.from(feedbackMap.values()).sort((a, b) => b.id - a.id);
    const mergedMutes = { ...(dataFromFile?.mutes || {}), ...(global.cachedDb?.mutes || {}) };
    const mergedReplies = (global.cachedDb?.replies || []).length > (dataFromFile?.replies || []).length
      ? global.cachedDb.replies
      : (dataFromFile?.replies || []);

    const result = {
      feedback: mergedFeedback,
      mutes: mergedMutes,
      replies: mergedReplies
    };

    global.cachedDb = result;
    return result;

  } catch (error) {
    console.error('Error reading DB:', error);
    return global.cachedDb || { feedback: [], mutes: {}, replies: [] };
  }
}

export function writeDb(data) {
  try {
    ensureDbExists();
    global.cachedDb = data;

    const targetPath = getActiveDbPath();
    fs.writeFileSync(targetPath, JSON.stringify(data, null, 2), 'utf-8');
    
    // Also write to primary path if available
    try {
      if (targetPath !== PRIMARY_DB_PATH && fs.existsSync(path.dirname(PRIMARY_DB_PATH))) {
        fs.writeFileSync(PRIMARY_DB_PATH, JSON.stringify(data, null, 2), 'utf-8');
      }
    } catch (ePrimary) {}

    return true;
  } catch (error) {
    console.error('Error writing DB:', error);
    return false;
  }
}
