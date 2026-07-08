// db.js - Handles connection to the existing LinguaFlowDB (IndexedDB)

const DB_NAME = 'LinguaFlowDB';
const DB_VERSION = 1;

export class Database {
  constructor() {
    this.db = null;
  }

  async init() {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onerror = (event) => {
        console.error("Database error: ", event.target.error);
        reject(event.target.error);
      };

      request.onsuccess = (event) => {
        this.db = event.target.result;
        resolve(this.db);
      };

      request.onupgradeneeded = (event) => {
        const db = event.target.result;
        // The V1 schema should already exist, but we recreate if not found
        if (!db.objectStoreNames.contains('words')) {
          const store = db.createObjectStore('words', { keyPath: 'id' });
          store.createIndex('fsrs_state', 'fsrs_state', { unique: false });
          store.createIndex('fsrs_due', 'fsrs_due', { unique: false });
        }
      };
    });
  }

  async getAllWords() {
    if (!this.db) await this.init();
    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction(['words'], 'readonly');
      const store = transaction.objectStore('words');
      const request = store.getAll();

      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  async getDueWords() {
    if (!this.db) await this.init();
    const words = await this.getAllWords();
    const now = new Date().toISOString();
    
    // Filter words that are new (no state) or due
    return words.filter(word => {
      if (!word.fsrs_state || word.fsrs_state === 0) return true; // New
      if (word.fsrs_due && word.fsrs_due <= now) return true; // Due
      return false;
    });
  }

  async updateWord(wordObj) {
    if (!this.db) await this.init();
    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction(['words'], 'readwrite');
      const store = transaction.objectStore('words');
      const request = store.put(wordObj);

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }
}

export const lfDb = new Database();
