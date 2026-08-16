import fs from 'fs';
import path from 'path';

// Primary path in workspace, with fallback to /tmp for Vercel serverless environment
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
    // If tmp doesn't have it yet, try copying from primary data/db.json if available
    let initialData = { feedback: [], mutes: {}, replies: [] };
    if (fs.existsSync(PRIMARY_DB_PATH)) {
      try {
        initialData = JSON.parse(fs.readFileSync(PRIMARY_DB_PATH, 'utf-8'));
      } catch (e) {}
    }
    try {
      fs.writeFileSync(targetPath, JSON.stringify(initialData, null, 2), 'utf-8');
    } catch (e) {}
  }
}

export function readDb() {
  try {
    ensureDbExists();
    const targetPath = getActiveDbPath();
    if (fs.existsSync(targetPath)) {
      const content = fs.readFileSync(targetPath, 'utf-8');
      return JSON.parse(content);
    }
    if (fs.existsSync(PRIMARY_DB_PATH)) {
      const content = fs.readFileSync(PRIMARY_DB_PATH, 'utf-8');
      return JSON.parse(content);
    }
    return { feedback: [], mutes: {}, replies: [] };
  } catch (error) {
    console.error('Error reading DB:', error);
    return { feedback: [], mutes: {}, replies: [] };
  }
}

export function writeDb(data) {
  try {
    ensureDbExists();
    const targetPath = getActiveDbPath();
    fs.writeFileSync(targetPath, JSON.stringify(data, null, 2), 'utf-8');
    
    // Also attempt writing to primary if not read-only
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
