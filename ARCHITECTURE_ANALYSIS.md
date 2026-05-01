# 🔍 LinguaFlow - Complete Architecture Analysis

**Date:** 2025-01-XX  
**Status:** Deep System Analysis (No Fixes Applied)

---

## 📋 TABLE OF CONTENTS

1. [Architecture Overview](#1-architecture-overview)
2. [Data Flow Lifecycle](#2-data-flow-lifecycle)
3. [Exact Failure Points](#3-exact-failure-points)
4. [Audio System Analysis](#4-audio-system-analysis)
5. [Storage Architecture](#5-storage-architecture)
6. [Communication Channels](#6-communication-channels)

---

## 1. ARCHITECTURE OVERVIEW

### 1.1 Component Map

```
┌─────────────────────────────────────────────────────────────┐
│                    CHROME EXTENSION                          │
├─────────────────────────────────────────────────────────────┤
│                                                               │
│  ┌──────────────┐      ┌──────────────┐      ┌───────────┐ │
│  │   Content    │◄────►│  Background  │◄────►│ Dashboard │ │
│  │   Scripts    │      │Service Worker│      │   (Tab)   │ │
│  └──────────────┘      └──────────────┘      └───────────┘ │
│         │                      │                     │       │
│         │                      │                     │       │
│         ▼                      ▼                     ▼       │
│  ┌──────────────────────────────────────────────────────┐  │
│  │              IndexedDB (LinguaFlowFreeDB)            │  │
│  │  ┌─────────┬─────────┬─────────┬──────────────┐    │  │
│  │  │ words   │ cards   │ decks   │ known_words  │    │  │
│  │  └─────────┴─────────┴─────────┴──────────────┘    │  │
│  └──────────────────────────────────────────────────────┘  │
│                                                               │
└─────────────────────────────────────────────────────────────┘
```

### 1.2 File Structure

**Content Scripts (Injected into video pages):**
- `content/boot.js` - Entry point, initializes SubtitleEngine
- `content/subtitle-engine.js` - Core subtitle capture & rendering (2,000+ lines)
- `content/word-popup.js` - Dictionary popup when clicking words
- `content/settings-panel.js` - Configuration UI
- `content/video-controls.js` - Playback controls
- `content/youtube-hook.js` - YouTube subtitle interception

**Background:**
- `background/service-worker.js` - Message routing, API calls, IndexedDB operations

**Dashboard:**
- `dashboard/dashboard.html` - Main UI
- `dashboard/dashboard.js` - Data retrieval, SRS review, stats

**Utils:**
- `utils/db.js` - IndexedDB wrapper (single source of truth)
- `utils/translator.js` - Translation API
- `utils/tts.js` - Text-to-speech
- `utils/dictionary.js` - Dictionary API

---

## 2. DATA FLOW LIFECYCLE

### 2.1 Subtitle Capture → Word Click → Save

```
┌─────────────────────────────────────────────────────────────┐
│ STEP 1: Subtitle Appears                                     │
└─────────────────────────────────────────────────────────────┘
   Video plays → subtitle-engine.js detects cue
   ↓
   subtitle-engine.js._syncXhrCues() finds active cue
   ↓
   subtitle-engine.js.onSubtitle(cue) called
   ↓
   subtitle-engine.js.renderDual(original, translation)
   ↓
   Subtitle rendered in Shadow DOM with clickable words

┌─────────────────────────────────────────────────────────────┐
│ STEP 2: User Clicks Word                                     │
└─────────────────────────────────────────────────────────────┘
   User hovers/clicks word in subtitle
   ↓
   word-popup.js.showForWord(word, context, rect) called
   ↓
   Popup fetches:
     - Translation (via chrome.runtime.sendMessage → service-worker)
     - Dictionary data (via chrome.runtime.sendMessage → service-worker)
   ↓
   Popup displays: word, translation, definition, examples

┌─────────────────────────────────────────────────────────────┐
│ STEP 3: User Clicks "Save to Flashcards"                     │
└─────────────────────────────────────────────────────────────┘
   word-popup.js._save() called
   ↓
   Imports utils/db.js
   ↓
   db.saveWord({
     word, lang, translation, phonetic, definition,
     context_sentence, video_url, video_title, platform, deck_id
   })
   ↓
   db.js opens IndexedDB transaction:
     - Checks if word exists (index: word_lang)
     - Inserts/updates in 'words' store
     - Creates card in 'cards' store (if new)
   ↓
   Returns { ok: true, id: wordId, isNew: true/false }

┌─────────────────────────────────────────────────────────────┐
│ STEP 4: Notification Broadcast                               │
└─────────────────────────────────────────────────────────────┘
   word-popup.js sends 3 notifications:
   
   1. chrome.runtime.sendMessage({ type: 'WORD_SAVED', word })
      → service-worker.js receives
      → service-worker.js.notifyDashboards() broadcasts
   
   2. chrome.runtime.sendMessage({ type: 'REFRESH_DASHBOARD', word })
      → service-worker.js receives
      → service-worker.js.notifyDashboards() broadcasts
   
   3. window.dispatchEvent(new CustomEvent('LF_WORD_SAVED', { detail }))
      → subtitle-engine.js listens
      → Updates savedWords Map in memory

┌─────────────────────────────────────────────────────────────┐
│ STEP 5: Dashboard Receives Update                            │
└─────────────────────────────────────────────────────────────┘
   dashboard.js has 3 listeners:
   
   1. chrome.runtime.onMessage.addListener()
      → Receives REFRESH_VOCAB / REFRESH_DASHBOARD / WORD_SAVED
      → Calls refreshDashboard('runtime.onMessage')
   
   2. chrome.storage.onChanged.addListener()
      → Detects changes in lf_words, lf_cards, etc.
      → Calls refreshDashboard('storage.onChanged')
   
   3. setInterval(polling, 2000)
      → Fallback polling every 2 seconds
      → Calls refreshDashboard('polling')

┌─────────────────────────────────────────────────────────────┐
│ STEP 6: Dashboard Refreshes                                  │
└─────────────────────────────────────────────────────────────┘
   refreshDashboard() called
   ↓
   updateHeader() → getAllWords() → IndexedDB query
   ↓
   loadCards() → getAllWords() + getAllCards() → IndexedDB queries
   ↓
   UI updates with new word count and card list
```

---

## 3. EXACT FAILURE POINTS

### 3.1 Save Flow Issues

#### ❌ ISSUE 1: Word Popup Save Button State
**Location:** `content/word-popup.js:_save()`  
**Line:** ~450

**Problem:**
```javascript
async _save() {
    const btn=q('#fsave');
    if(btn.textContent.includes('✅')) return; // ← BLOCKS MULTIPLE SAVES
    
    btn.textContent='⏳ Salvando...';
    btn.disabled = true;
    
    // ... save logic ...
    
    btn.textContent='✅ Salvo!';
    btn.style.background='linear-gradient(135deg,#15803d,#16a34a)';
    // ← Button stays "Salvo!" forever, never resets
}
```

**Impact:** After first save, button shows "✅ Salvo!" and early-returns on subsequent clicks. User cannot save word again even if they want to update context.

---

#### ❌ ISSUE 2: IndexedDB Transaction Timing
**Location:** `utils/db.js:saveWord()`  
**Line:** ~150

**Problem:**
```javascript
async saveWord(wordData) {
    return new Promise((resolve, reject) => {
        const tx = this.db.transaction(['words', 'cards', 'decks'], 'readwrite');
        const wordsStore = tx.objectStore('words');
        const cardsStore = tx.objectStore('cards');
        
        // ← No tx.oncomplete handler
        // ← Resolves BEFORE transaction commits
        
        const wordReq = wordsStore.put(toSave);
        wordReq.onsuccess = (e) => {
            const wordId = e.target.result;
            if (!existing) {
                cardsStore.put({ /* card data */ });
            }
            resolve({ ok: true, id: wordId, isNew: !existing });
            // ← Resolves here, but card.put() may not be done yet
        };
    });
}
```

**Impact:** Race condition. Dashboard may query before card is fully written. Results in:
- Word appears in dashboard
- Card missing from 'cards' store
- SRS review fails (no card to review)

---

#### ❌ ISSUE 3: Dashboard Polling Conflicts
**Location:** `dashboard/dashboard.js`  
**Line:** ~650

**Problem:**
```javascript
// 3 concurrent update mechanisms:
chrome.runtime.onMessage.addListener(...)  // ← Listener 1
chrome.storage.onChanged.addListener(...)  // ← Listener 2
setInterval(() => refreshDashboard('polling'), 2000); // ← Listener 3

function refreshDashboard(source) {
    const now = Date.now();
    if (now - lastUpdateTime < 500) {
        clearTimeout(updateDebounceTimer);
        updateDebounceTimer = setTimeout(() => refreshDashboard(source), 500);
        return; // ← Debounce, but still 3 sources firing
    }
    // ... update logic ...
}
```

**Impact:** 
- Multiple simultaneous IndexedDB reads
- UI flickers during rapid updates
- Debounce helps but doesn't eliminate race conditions

---

### 3.2 Notification Chain Failures

#### ❌ ISSUE 4: Service Worker Message Routing
**Location:** `background/service-worker.js:notifyDashboards()`  
**Line:** ~280

**Problem:**
```javascript
function notifyDashboards(word) {
    // 1. Broadcast via runtime.sendMessage
    chrome.runtime.sendMessage({
        type: 'REFRESH_VOCAB',
        word: word || null
    }).catch(() => {
        console.log('Runtime message falhou (esperado se nenhuma página está ouvindo)');
        // ← Silently fails if dashboard not open
    });

    // 2. Send to ALL tabs
    chrome.tabs.query({}, tabs => {
        tabs.forEach(tab => {
            if (tab.url?.includes('dashboard.html')) {
                chrome.tabs.sendMessage(tab.id, { 
                    type: 'REFRESH_VOCAB',
                    word: word || null
                }).catch(() => {}); // ← Silently fails
            }
        });
    });

    // 3. Update chrome.storage.local
    chrome.storage.local.set({
        lf_last_update: Date.now(),
        lf_last_word: word || null
    });
}
```

**Impact:**
- If dashboard is closed, notifications are lost
- No retry mechanism
- Storage update doesn't trigger dashboard refresh (dashboard only listens to lf_words, lf_cards, etc.)

---

### 3.3 Data Persistence Issues

#### ❌ ISSUE 5: Chrome Storage vs IndexedDB Confusion
**Location:** Multiple files

**Problem:**
```javascript
// service-worker.js uses IndexedDB:
async function saveWordToExtensionDB(wordData) {
    const db = await openExtensionDB();
    // ... writes to IndexedDB ...
}

// dashboard.js ALSO uses IndexedDB:
async function getAllWords() {
    const tx = db.transaction('words', 'readonly');
    // ... reads from IndexedDB ...
}

// BUT service-worker.js ALSO writes to chrome.storage.local:
chrome.storage.local.set({
    lf_last_update: Date.now(),
    lf_last_word: word || null
});

// AND dashboard.js listens to chrome.storage.onChanged:
chrome.storage.onChanged.addListener((changes, areaName) => {
    const relevantKeys = ['lf_words', 'lf_cards', 'lf_sents', 'lf_decks'];
    // ← But these keys are NEVER written to chrome.storage!
});
```

**Impact:**
- chrome.storage.onChanged listener NEVER fires (keys don't exist)
- Dashboard relies on polling fallback
- Inconsistent data sources

---

## 4. AUDIO SYSTEM ANALYSIS

### 4.1 TTS Architecture

**Location:** `utils/tts.js`

```javascript
class TTS {
    async play(text, lang = 'en-US', audioUrl = null) {
        // Priority 1: MP3 from dictionary (best quality)
        if (audioUrl) {
            try {
                const audio = new Audio(audioUrl);
                await audio.play();
                return true;
            } catch (e) { /* fallback */ }
        }

        // Priority 2: Google Translate TTS (neural voice)
        try {
            await this._playGoogleTTS(text, lang);
            return true;
        } catch (e) { /* fallback */ }

        // Priority 3: Web Speech API (robotic)
        return this._playWebSpeech(text, lang);
    }

    async _playGoogleTTS(text, lang) {
        const url = `https://translate.google.com/translate_tts?ie=UTF-8&q=${encodeURIComponent(text)}&tl=${googleLang}&client=tw-ob`;
        const audio = new Audio(url);
        await audio.play();
    }

    async _playWebSpeech(text, lang) {
        // FILTER: Only natural voices
        const naturalVoices = this.voices.filter(v => {
            const name = v.name.toLowerCase();
            const isNatural = 
                name.includes('natural') ||
                name.includes('neural') ||
                name.includes('google') ||
                name.includes('microsoft') && (name.includes('online') || name.includes('aria'));
            
            const isRobotic = 
                name.includes('eSpeak') ||
                name.includes('festival');
            
            return isNatural && !isRobotic;
        });

        // Preferred voices list
        const preferred = [
            'Google US English',
            'Microsoft Aria Online (Natural)',
            'Samantha', 'Alex'
        ];

        // Find best voice
        let voice = null;
        for (const name of preferred) {
            voice = naturalVoices.find(v => v.name.includes(name));
            if (voice) break;
        }

        if (!voice) {
            console.warn('⚠️ No natural voice found, using Google TTS');
            return false;
        }

        const utter = new SpeechSynthesisUtterance(text);
        utter.voice = voice;
        utter.rate = 0.9;
        this.synth.speak(utter);
    }
}
```

### 4.2 Why Audio Sounds Robotic

#### ❌ ROOT CAUSE 1: Voice Availability
**Problem:** System depends on browser's installed voices.

**On Windows:**
- Default voices: `Microsoft David`, `Microsoft Zira` (robotic)
- Natural voices: `Microsoft Aria Online (Natural)` (requires internet)
- Google voices: Not available in Chrome on Windows

**On macOS:**
- Default voices: `Samantha`, `Alex` (high quality)
- Google voices: Available in Chrome

**On Linux:**
- Default voices: `eSpeak` (very robotic)
- Natural voices: Rarely installed

---

#### ❌ ROOT CAUSE 2: Google TTS Fallback Fails
**Location:** `utils/tts.js:_playGoogleTTS()`

**Problem:**
```javascript
async _playGoogleTTS(text, lang) {
    const url = `https://translate.google.com/translate_tts?ie=UTF-8&q=${encodeURIComponent(text)}&tl=${googleLang}&client=tw-ob`;
    const audio = new Audio(url);
    await audio.play(); // ← May fail due to CORS or rate limiting
}
```

**Why it fails:**
1. **CORS:** Google TTS endpoint may block cross-origin requests
2. **Rate Limiting:** Too many requests → 429 error
3. **User Agent:** Google may block requests without proper headers

**Result:** Falls back to Web Speech API with robotic voices.

---

#### ❌ ROOT CAUSE 3: Dictionary Audio URLs Missing
**Location:** `content/word-popup.js:showForWord()`

**Problem:**
```javascript
async showForWord(word, context, rect) {
    // ...
    this._loadData(word); // ← Fetches dictionary data
}

async _loadData(word) {
    const [tr, di] = await Promise.all([
        this._translate(word),
        this._dict(word) // ← Calls service-worker dictionary API
    ]);
    const d = { translation: tr, ...di };
    this.cache[word] = d; // ← Caches result
}

_dict(w) {
    return new Promise(res => {
        chrome.runtime.sendMessage({ action: 'dictionary', word: w }, r => {
            res(r?.data || {}); // ← Returns { phonetic, definition, ... }
            // ← BUT: audioUrl is NOT included in response!
        });
    });
}
```

**Service Worker Dictionary Handler:**
```javascript
// background/service-worker.js
if (request.action === 'dictionary') {
    const { word } = request;
    fetchDictionary(word)
        .then(data => sendResponse({ ok: true, data }))
        .catch(err => sendResponse({ ok: false, error: err.message }));
    return true;
}

async function fetchDictionary(word) {
    const res = await fetch(`https://api.dictionaryapi.dev/api/v2/entries/en/${encodeURIComponent(word)}`);
    const data = await res.json();
    const entry = data[0];
    
    return {
        word: entry.word,
        phonetic: entry.phonetic || '',
        partOfSpeech: entry.meanings?.[0]?.partOfSpeech || '',
        definition: entry.meanings?.[0]?.definitions?.[0]?.definition || '',
        // ← MISSING: audioUrl extraction!
        // entry.phonetics[0].audio contains MP3 URL
    };
}
```

**Impact:** Priority 1 audio (MP3 from dictionary) NEVER plays because audioUrl is always null.

---

### 4.3 Audio Quality Hierarchy (Current vs Expected)

**Current Reality:**
```
1. Dictionary MP3 (never plays - audioUrl missing) ❌
2. Google TTS (fails due to CORS/rate limit) ❌
3. Web Speech API (robotic voices) ✅ ← ALWAYS USED
```

**Expected Behavior:**
```
1. Dictionary MP3 (native speaker, best quality) ✅
2. Google TTS (neural voice, natural) ✅
3. Web Speech API (natural voices only) ✅
```

---

## 5. STORAGE ARCHITECTURE

### 5.1 IndexedDB Schema

**Database:** `LinguaFlowFreeDB` (version 4)

```javascript
// Object Stores:
{
  words: {
    keyPath: 'id',
    autoIncrement: true,
    indexes: [
      { name: 'word_lang', keyPath: ['word', 'lang'], unique: true },
      { name: 'deck_id', keyPath: 'deck_id' },
      { name: 'added_at', keyPath: 'added_at' }
    ]
  },
  
  cards: {
    keyPath: 'id',
    autoIncrement: true,
    indexes: [
      { name: 'word_id', keyPath: 'word_id', unique: true },
      { name: 'due_date', keyPath: 'due_date' },
      { name: 'status', keyPath: 'status' }
    ]
  },
  
  decks: {
    keyPath: 'id',
    autoIncrement: true
  },
  
  known_words: {
    keyPath: ['word', 'lang']
  },
  
  sentences: {
    keyPath: 'id',
    autoIncrement: true
  },
  
  sessions: {
    keyPath: 'date'
  },
  
  settings: {
    keyPath: 'key'
  },
  
  review_log: {
    keyPath: 'id',
    autoIncrement: true,
    indexes: [
      { name: 'date', keyPath: 'date' }
    ]
  }
}
```

### 5.2 Data Relationships

```
┌─────────────┐
│   words     │
│  id (PK)    │◄──┐
│  word       │   │
│  lang       │   │
│  deck_id    │   │ 1:1
│  ...        │   │
└─────────────┘   │
                  │
┌─────────────┐   │
│   cards     │   │
│  id (PK)    │   │
│  word_id(FK)│───┘
│  interval   │
│  due_date   │
│  status     │
│  ...        │
└─────────────┘

┌─────────────┐
│   decks     │
│  id (PK)    │
│  name       │
└─────────────┘
       ▲
       │ N:1
       │
┌─────────────┐
│   words     │
│  deck_id(FK)│
└─────────────┘
```

### 5.3 Storage Access Patterns

**Content Script (word-popup.js):**
```javascript
// Imports db.js directly
import { db } from '../utils/db.js';

// Direct IndexedDB access
await db.saveWord({ word, lang, translation, ... });
await db.getWord(word, lang);
await db.isKnown(word, lang);
```

**Service Worker:**
```javascript
// Opens IndexedDB directly
async function openExtensionDB() {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open(DB_NAME, DB_VERSION);
        // ...
    });
}

// Saves via own implementation (DUPLICATE CODE)
async function saveWordToExtensionDB(wordData) {
    const db = await openExtensionDB();
    // ... same logic as db.js ...
}
```

**Dashboard:**
```javascript
// Opens IndexedDB directly (DUPLICATE CODE)
async function initDB() {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open(DB_NAME, DB_VERSION);
        // ...
    });
}

// Queries directly
async function getAllWords() {
    const tx = db.transaction('words', 'readonly');
    const request = tx.objectStore('words').getAll();
    // ...
}
```

**Problem:** 3 different IndexedDB implementations, no shared code.

---

## 6. COMMUNICATION CHANNELS

### 6.1 Message Flow Diagram

```
┌──────────────────────────────────────────────────────────────┐
│                    MESSAGE CHANNELS                           │
└──────────────────────────────────────────────────────────────┘

Content Script (word-popup.js)
    │
    │ chrome.runtime.sendMessage({ type: 'WORD_SAVED' })
    ▼
Service Worker (service-worker.js)
    │
    ├─► chrome.runtime.sendMessage({ type: 'REFRESH_VOCAB' })
    │   └─► Dashboard (if listening) ✓
    │
    ├─► chrome.tabs.query() → chrome.tabs.sendMessage()
    │   └─► Dashboard tab (if open) ✓
    │
    └─► chrome.storage.local.set({ lf_last_update })
        └─► Dashboard chrome.storage.onChanged ✗ (never fires)

Content Script (subtitle-engine.js)
    │
    │ window.addEventListener('LF_WORD_SAVED')
    ▼
Updates savedWords Map in memory ✓
```

### 6.2 Channel Reliability

| Channel | Reliability | Latency | Notes |
|---------|-------------|---------|-------|
| `chrome.runtime.sendMessage` | 🟡 Medium | ~10ms | Fails if receiver not ready |
| `chrome.tabs.sendMessage` | 🟡 Medium | ~20ms | Requires tab ID, fails if tab closed |
| `chrome.storage.onChanged` | 🔴 Low | ~50ms | Only fires if keys actually change |
| `window.dispatchEvent` | 🟢 High | <1ms | Same-page only, always works |
| Polling (setInterval) | 🟢 High | 2000ms | Always works, but slow |

### 6.3 Current Issues

1. **No Acknowledgment:** Messages are fire-and-forget, no confirmation of receipt
2. **No Retry:** If dashboard is closed, message is lost forever
3. **Storage Listener Broken:** Dashboard listens to keys that are never written
4. **Polling as Primary:** 2-second polling is the only reliable mechanism

---

## 7. SUMMARY OF FINDINGS

### 7.1 Critical Issues

| # | Issue | Location | Impact | Severity |
|---|-------|----------|--------|----------|
| 1 | Save button never resets | word-popup.js:450 | Can't save word twice | 🔴 High |
| 2 | IndexedDB race condition | db.js:150 | Cards missing from DB | 🔴 High |
| 3 | Dashboard polling conflicts | dashboard.js:650 | UI flickers, slow updates | 🟡 Medium |
| 4 | Service worker silent failures | service-worker.js:280 | Lost notifications | 🟡 Medium |
| 5 | Chrome storage confusion | Multiple files | Broken listener | 🟡 Medium |
| 6 | Dictionary audio missing | service-worker.js:fetchDictionary | Robotic TTS | 🔴 High |
| 7 | Google TTS CORS failures | tts.js:_playGoogleTTS | Falls back to robotic | 🟡 Medium |
| 8 | Duplicate IndexedDB code | 3 files | Maintenance nightmare | 🟡 Medium |

### 7.2 Audio Quality Root Causes

**Why audio sounds robotic:**

1. ✅ **Dictionary MP3 never plays** - audioUrl not extracted from API response
2. ✅ **Google TTS fails** - CORS/rate limiting issues
3. ✅ **Falls back to Web Speech API** - Uses system voices (often robotic on Windows/Linux)
4. ✅ **Voice filtering works** - But natural voices may not be installed

**Fix priority:**
1. Extract audioUrl from dictionary API (immediate quality boost)
2. Fix Google TTS CORS (add proper headers/proxy)
3. Improve voice selection fallback

### 7.3 Data Flow Root Causes

**Why dashboard doesn't update:**

1. ✅ **chrome.storage.onChanged never fires** - Listening to wrong keys
2. ✅ **chrome.runtime.sendMessage unreliable** - Dashboard may not be listening
3. ✅ **Polling works but slow** - 2-second delay
4. ✅ **IndexedDB race conditions** - Data may not be committed when dashboard queries

**Fix priority:**
1. Fix IndexedDB transaction completion (await tx.oncomplete)
2. Remove chrome.storage.onChanged listener (broken)
3. Improve chrome.runtime.sendMessage reliability (add retry)
4. Keep polling as fallback (reduce to 5 seconds)

---

## 8. NEXT STEPS

**DO NOT PROCEED TO FIXES YET.**

This analysis provides complete visibility into:
- ✅ How data flows from subtitle → save → dashboard
- ✅ Exact failure points in code
- ✅ Why audio is robotic (3 root causes)
- ✅ Why dashboard doesn't update (4 root causes)

**Awaiting confirmation before proceeding to fixes.**

---

**End of Analysis**
