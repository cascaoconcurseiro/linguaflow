# 🤝 Contributing to LinguaFlow

First off, thank you for considering contributing to LinguaFlow! It's people like you that make LinguaFlow such a great tool for language learners worldwide.

## 📋 Table of Contents

- [Code of Conduct](#code-of-conduct)
- [How Can I Contribute?](#how-can-i-contribute)
- [Development Setup](#development-setup)
- [Coding Guidelines](#coding-guidelines)
- [Commit Messages](#commit-messages)
- [Pull Request Process](#pull-request-process)

---

## 📜 Code of Conduct

This project and everyone participating in it is governed by our Code of Conduct. By participating, you are expected to uphold this code. Please report unacceptable behavior to extensao.linguaflow@gmail.com.

**Our Standards:**
- ✅ Be respectful and inclusive
- ✅ Welcome newcomers and help them learn
- ✅ Focus on what is best for the community
- ✅ Show empathy towards other community members
- ❌ No harassment, trolling, or insulting comments
- ❌ No political or off-topic discussions

---

## 🎯 How Can I Contribute?

### Reporting Bugs

Before creating bug reports, please check existing issues to avoid duplicates.

**When reporting a bug, include:**
- Clear, descriptive title
- Steps to reproduce
- Expected vs actual behavior
- Screenshots (if applicable)
- Browser version and OS
- Console errors (F12 → Console tab)

**Template:**
```markdown
**Bug Description:**
Clear description of the bug

**Steps to Reproduce:**
1. Go to '...'
2. Click on '...'
3. See error

**Expected Behavior:**
What should happen

**Actual Behavior:**
What actually happens

**Environment:**
- Browser: Chrome 120.0.0
- OS: Windows 11
- LinguaFlow Version: 1.0.0

**Console Errors:**
```
[paste console errors here]
```

**Screenshots:**
[attach screenshots]
```

### Suggesting Features

Feature requests are welcome! Please provide:
- Clear use case (why is this needed?)
- Detailed description of the feature
- Mockups or examples (if applicable)
- Comparison with similar features in other tools

### Contributing Code

1. **Fork the repository**
2. **Create a feature branch** (`git checkout -b feature/amazing-feature`)
3. **Make your changes**
4. **Test thoroughly** (see [Testing](#testing))
5. **Commit with clear messages** (see [Commit Messages](#commit-messages))
6. **Push to your fork** (`git push origin feature/amazing-feature`)
7. **Open a Pull Request**

---

## 🛠️ Development Setup

### Prerequisites

- **Chrome/Edge Browser** (latest version)
- **Git**
- **Text Editor** (VS Code recommended)
- **Node.js** (optional, for build tools)

### Installation

```bash
# 1. Clone your fork
git clone https://github.com/YOUR_USERNAME/linguaflow.git
cd linguaflow

# 2. Load extension in Chrome
# - Open chrome://extensions/
# - Enable "Developer mode"
# - Click "Load unpacked"
# - Select the linguaflow folder

# 3. Test on a video
# - Go to YouTube
# - Play a video with English subtitles
# - Click on words in subtitles
```

### Project Structure

```
linguaflow/
├── background/          # Service worker (background tasks)
│   └── service-worker.js
├── content/            # Content scripts (injected into pages)
│   ├── boot.js
│   ├── subtitle-engine.js
│   ├── word-popup.js
│   └── ...
├── dashboard/          # Dashboard UI (SRS review)
│   ├── dashboard.html
│   └── dashboard.js
├── utils/              # Shared utilities
│   ├── db.js          # IndexedDB wrapper
│   ├── translator.js  # Translation API
│   ├── tts.js         # Text-to-speech
│   └── ...
├── docs/               # Documentation
├── manifest.json       # Extension manifest
└── README.md
```

---

## 📝 Coding Guidelines

### JavaScript Style

- **ES6+ syntax** (async/await, arrow functions, destructuring)
- **No semicolons** (except when required)
- **2 spaces indentation**
- **camelCase** for variables and functions
- **PascalCase** for classes
- **UPPER_CASE** for constants

**Example:**
```javascript
// ✅ Good
async function translateText(text, targetLang = 'pt') {
  const result = await fetch(API_URL)
  return result.translation
}

// ❌ Bad
function translate_text(text, target_lang) {
  var result = fetch(API_URL);
  return result.translation;
}
```

### Code Comments

- **Portuguese** for comments (project language)
- **English** for code (variable names, functions)
- Comment **why**, not **what**

```javascript
// ✅ Good
// Aguarda 500ms para evitar rate limiting da API
await sleep(500)

// ❌ Bad
// Espera 500 milissegundos
await sleep(500)
```

### File Organization

- **One class per file** (when possible)
- **Group related functions** together
- **Export at the end** of the file

```javascript
// utils/translator.js

class Translator {
  async translate(text, lang) { /* ... */ }
}

async function detectLanguage(text) { /* ... */ }

export { Translator, detectLanguage }
```

---

## 💬 Commit Messages

Follow [Conventional Commits](https://www.conventionalcommits.org/):

**Format:**
```
<type>(<scope>): <subject>

<body>

<footer>
```

**Types:**
- `feat`: New feature
- `fix`: Bug fix
- `docs`: Documentation only
- `style`: Code style (formatting, no logic change)
- `refactor`: Code refactoring
- `perf`: Performance improvement
- `test`: Adding tests
- `chore`: Maintenance tasks

**Examples:**
```bash
# Feature
feat(audio): add native speaker pronunciation from dictionary API

# Bug fix
fix(dashboard): resolve race condition in IndexedDB transactions

# Documentation
docs(readme): add installation instructions for Firefox

# Refactor
refactor(db): consolidate IndexedDB access into single module
```

---

## 🔄 Pull Request Process

### Before Submitting

1. **Test your changes** on at least 2 platforms (YouTube + Netflix/Max)
2. **Check console** for errors (F12 → Console)
3. **Update documentation** if needed
4. **Add screenshots** for UI changes
5. **Rebase on main** to avoid merge conflicts

```bash
git fetch upstream
git rebase upstream/main
```

### PR Template

```markdown
## Description
Brief description of changes

## Type of Change
- [ ] Bug fix
- [ ] New feature
- [ ] Breaking change
- [ ] Documentation update

## Testing
- [ ] Tested on YouTube
- [ ] Tested on Netflix/Max
- [ ] No console errors
- [ ] Dashboard updates correctly

## Screenshots
[attach screenshots if UI changed]

## Checklist
- [ ] Code follows style guidelines
- [ ] Self-reviewed code
- [ ] Commented complex logic
- [ ] Updated documentation
- [ ] No breaking changes (or documented)
```

### Review Process

1. **Automated checks** run (if configured)
2. **Maintainer review** (1-3 days)
3. **Feedback addressed** (if any)
4. **Approved and merged** 🎉

---

## 🧪 Testing

### Manual Testing Checklist

**Subtitle Capture:**
- [ ] Subtitles appear on YouTube
- [ ] Subtitles appear on Netflix
- [ ] Subtitles appear on Max (HBO)
- [ ] Translation is accurate
- [ ] Words are clickable

**Word Popup:**
- [ ] Popup opens on word click
- [ ] Dictionary data loads
- [ ] Audio plays (native speaker)
- [ ] Save button works
- [ ] Button resets after save

**Dashboard:**
- [ ] New words appear immediately
- [ ] Card count updates
- [ ] SRS review works
- [ ] Stats are accurate

**Performance:**
- [ ] No lag when subtitles change
- [ ] No memory leaks (check Task Manager)
- [ ] IndexedDB queries are fast (<100ms)

### Debugging Tips

**Enable verbose logging:**
```javascript
// In console (F12)
localStorage.setItem('LF_DEBUG', 'true')
```

**Check IndexedDB:**
```javascript
// In console
const db = await indexedDB.open('LinguaFlowFreeDB', 4)
// Application → Storage → IndexedDB
```

**Monitor messages:**
```javascript
// In service worker console
chrome.runtime.onMessage.addListener((msg) => {
  console.log('Message:', msg)
})
```

---

## 🌍 Internationalization (i18n)

Currently, LinguaFlow is in **Portuguese** (UI) with **English** learning content.

**To add a new language:**
1. Create `locales/[lang].json`
2. Update `manifest.json` → `default_locale`
3. Use `chrome.i18n.getMessage()` in code

**Example:**
```json
// locales/en/messages.json
{
  "appName": {
    "message": "LinguaFlow",
    "description": "Extension name"
  },
  "saveButton": {
    "message": "Save to Flashcards",
    "description": "Save button text"
  }
}
```

---

## 📚 Resources

- [Chrome Extension Docs](https://developer.chrome.com/docs/extensions/)
- [IndexedDB API](https://developer.mozilla.org/en-US/docs/Web/API/IndexedDB_API)
- [Web Speech API](https://developer.mozilla.org/en-US/docs/Web/API/Web_Speech_API)
- [SuperMemo Algorithm](https://www.supermemo.com/en/archives1990-2015/english/ol/sm2)

---

## 🎓 Learning Path for New Contributors

**Beginner (HTML/CSS/JS basics):**
1. Fix typos in documentation
2. Improve UI styling (colors, spacing)
3. Add new keyboard shortcuts

**Intermediate (Chrome Extensions):**
1. Add support for new video platforms
2. Improve subtitle parsing
3. Add new dictionary sources

**Advanced (Architecture):**
1. Optimize IndexedDB queries
2. Implement offline sync
3. Add AI-powered features

---

## 💡 Ideas for Contributions

**High Priority:**
- [ ] Firefox support
- [ ] Dark mode
- [ ] Export to Anki
- [ ] Mobile app (React Native)

**Medium Priority:**
- [ ] More languages (Spanish, French, German)
- [ ] Gamification (achievements, streaks)
- [ ] Social features (share decks)

**Low Priority:**
- [ ] Custom themes
- [ ] Advanced statistics
- [ ] Browser sync (Google Drive)

---

## 🙏 Recognition

Contributors will be:
- Listed in `CONTRIBUTORS.md`
- Mentioned in release notes
- Credited in the extension description (if significant contribution)

---

## 📧 Contact

- **Email:** extensao.linguaflow@gmail.com
- **Discord:** [LinguaFlow Community](https://discord.gg/linguaflow)
- **Twitter:** [@linguaflow](https://twitter.com/linguaflow)

---

**Thank you for contributing to LinguaFlow! 🚀**

Every contribution, no matter how small, makes a difference. Happy coding! 💻
