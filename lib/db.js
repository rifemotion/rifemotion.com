import fs from 'fs';
import path from 'path';

const DB_PATH = path.join(process.cwd(), 'data', 'db.json');

// Ensure directory and db file exist
function ensureDbExists() {
  const dir = path.dirname(DB_PATH);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  if (!fs.existsSync(DB_PATH)) {
    const initialData = {
      feedback: [],
      mutes: {},
      replies: []
    };
    fs.writeFileSync(DB_PATH, JSON.stringify(initialData, null, 2), 'utf-8');
  }
}

export function readDb() {
  try {
    ensureDbExists();
    const content = fs.readFileSync(DB_PATH, 'utf-8');
    return JSON.parse(content);
  } catch (error) {
    console.error('Error reading DB:', error);
    return { feedback: [], mutes: {}, replies: [] };
  }
}

export function writeDb(data) {
  try {
    ensureDbExists();
    fs.writeFileSync(DB_PATH, JSON.stringify(data, null, 2), 'utf-8');
    return true;
  } catch (error) {
    console.error('Error writing DB:', error);
    return false;
  }
}
