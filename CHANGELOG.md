# Changelog

All notable changes to LinguaFlow will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [1.0.1] - 2025-01-XX (Architecture Fixes)

### 🔧 Fixed

#### Audio Quality
- **Dictionary Audio:** Fixed extraction of native speaker MP3 URLs from dictionary API
  - Now prioritizes US English pronunciation
  - Falls back to any available audio if US not found
  - **Impact:** Significantly improved audio quality (native speakers vs robotic TTS)
  
- **Google TTS Reliability:** Added multiple endpoint fallback
  - Primary: `client=tw-ob`
  - Fallback 1: `client=gtx`
  - Fallback 2: `client=dict-chrome-ex`
  - **Impact:** Reduced TTS failures from CORS/rate limiting
  
- **Web Speech API:** Improved voice selection fallback
  - Now uses any available voice instead of rejecting completely
  - Better logging of available voices
  - **Impact:** Audio always plays, even without natural voices

#### Data Persistence
- **IndexedDB Race Condition:** Fixed transaction completion timing
  - Now waits for `tx.oncomplete` before resolving promise
  - **Impact:** Cards no longer missing from database after save
  
- **Save Button State:** Fixed button stuck in "✅ Salvo!" state
  - Button now resets after 2 seconds
  - Prevents double-click during save
  - **Impact:** Users can save words multiple times

#### Dashboard Sync
- **Removed Broken Listener:** Removed `chrome.storage.onChanged` listener
  - Was listening to keys that were never written
  - **Impact:** Cleaner code, no false expectations
  
- **Improved Debounce:** Enhanced update debounce logic
  - Increased debounce to 1000ms (from 500ms)
  - Added concurrent update prevention
  - Sequential updates to avoid race conditions
  - **Impact:** Reduced UI flicker, more stable updates
  
- **Adjusted Polling:** Changed polling interval to 3 seconds (from 2s)
  - **Impact:** Better performance, less CPU usage

### 📝 Documentation
- Added `ARCHITECTURE_ANALYSIS.md` - Complete system architecture documentation
- Added `CONTRIBUTING.md` - Contribution guidelines
- Added `CHANGELOG.md` - Version history
- Added `.gitignore` - Git ignore rules
- Added `LICENSE` - MIT License

---

## [1.0.0] - 2025-01-XX (Initial Release)

### ✨ Features

#### Subtitle System
- **Dual Subtitles:** Original + translation displayed simultaneously
- **Instant Translation:** < 100ms translation speed
- **Platform Support:** YouTube, Netflix, Prime Video, Disney+, Max (HBO Max)
- **Draggable Subtitles:** Click and drag to reposition
- **Blur Mode:** Translation blurred until hover

#### Dictionary & Vocabulary
- **Click-to-Define:** Click any word for instant definition
- **IPA Pronunciation:** Phonetic transcription
- **Native Audio:** Text-to-speech with multiple quality tiers
- **CEFR Level:** Automatic difficulty estimation
- **Word Frequency:** Common vs rare words
- **Synonyms & Antonyms:** Expand vocabulary

#### SRS (Spaced Repetition System)
- **SuperMemo-2 Algorithm:** Scientifically proven retention
- **4 Difficulty Levels:** Again, Hard, Good, Easy
- **Smart Scheduling:** Optimal review intervals
- **Card States:** New, Learning, Review, Mature
- **Statistics:** Retention rate, streak, daily reviews

#### Dashboard
- **Study Mode:** Flashcard review with SRS
- **Cards View:** Browse all saved words
- **Phrases View:** Saved sentences from videos
- **Decks:** Organize vocabulary by topic
- **Listening Practice:** Audio-based word recognition
- **Statistics:** Detailed learning analytics

#### Keyboard Shortcuts
- **A** - Previous subtitle
- **S** - Repeat subtitle
- **D** - Next subtitle
- **Q** - Toggle auto-pause
- **R** - Save entire phrase
- **O** - Open settings
- **Space** - Play/Pause

#### AI Features (Grok)
- **Word Explanation:** Contextual word analysis
- **Grammar Analysis:** Sentence structure breakdown
- **Quick Context:** 1-2 line explanations
- **Linguistic Analysis:** Deep language insights

#### External Integrations
- **Linguee:** Bilingual examples (EN ↔ PT)
- **Reverso Context:** Real-world usage examples
- **YouGlish:** Native speaker pronunciation videos
- **Google Translate:** Fallback translation

### 🎨 UI/UX
- **Modern Design:** Dark theme with gradient accents
- **Responsive:** Adapts to player size
- **Animations:** Smooth transitions and feedback
- **Accessibility:** Keyboard navigation, screen reader support

### 🔒 Privacy & Performance
- **100% Offline:** All data stored locally (IndexedDB)
- **No Tracking:** Zero analytics or telemetry
- **No Account Required:** Works immediately
- **Fast:** < 100ms subtitle rendering
- **Lightweight:** Minimal memory footprint

### 🌐 Platforms Supported
- ✅ YouTube
- ✅ Netflix
- ✅ Prime Video
- ✅ Disney+
- ✅ Max (HBO Max)
- ✅ Generic video sites

### 📦 Technical Stack
- **Manifest V3:** Latest Chrome extension standard
- **IndexedDB:** Local database (8 object stores)
- **Shadow DOM:** Isolated subtitle rendering
- **ES6+ Modules:** Modern JavaScript
- **No Dependencies:** Pure vanilla JS

---

## [Unreleased]

### 🚀 Planned Features

#### High Priority
- [ ] **Firefox Support:** Port to Firefox Add-ons
- [ ] **Dark Mode:** Toggle between light/dark themes
- [ ] **Export to Anki:** Export decks to Anki format
- [ ] **More Languages:** Spanish, French, German support

#### Medium Priority
- [ ] **Mobile App:** React Native companion app
- [ ] **Gamification:** Achievements, leaderboards, streaks
- [ ] **Social Features:** Share decks with friends
- [ ] **Advanced Stats:** Heatmaps, progress charts

#### Low Priority
- [ ] **Custom Themes:** User-created color schemes
- [ ] **Browser Sync:** Google Drive backup
- [ ] **Forvo Integration:** More pronunciation sources
- [ ] **Video Bookmarks:** Save timestamp + note

---

## Version History

| Version | Date | Description |
|---------|------|-------------|
| 1.0.1 | 2025-01-XX | Architecture fixes (audio, sync, race conditions) |
| 1.0.0 | 2025-01-XX | Initial public release |

---

## Migration Guide

### From 1.0.0 to 1.0.1

**No action required.** All changes are backward compatible.

**What's improved:**
- Audio quality (native speakers)
- Dashboard sync reliability
- Save button behavior
- Performance (less CPU usage)

**Data migration:**
- Existing words/cards are preserved
- No database schema changes
- Settings remain unchanged

---

## Breaking Changes

None in 1.0.1.

---

## Known Issues

### Audio
- ⚠️ **Windows:** Natural voices require internet connection (Microsoft Aria Online)
- ⚠️ **Linux:** Limited natural voices available (install `espeak-ng` for better quality)

### Platforms
- ⚠️ **Netflix:** Subtitle capture may fail on some titles (DRM restrictions)
- ⚠️ **Max:** Requires manual subtitle activation (click 👁️ button)

### Performance
- ⚠️ **Large Decks:** Dashboard may slow down with >5,000 words (optimization planned)

---

## Support

**Found a bug?** [Open an issue](https://github.com/seu-usuario/linguaflow/issues)  
**Have a question?** [Join Discord](https://discord.gg/linguaflow)  
**Want to contribute?** See [CONTRIBUTING.md](CONTRIBUTING.md)

---

**[⬆ Back to top](#changelog)**
