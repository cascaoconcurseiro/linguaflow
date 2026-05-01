# 📦 Installation Guide

Complete guide to install LinguaFlow on your browser.

---

## 🚀 Quick Install (Chrome Web Store)

**Coming Soon!** LinguaFlow will be available on the Chrome Web Store.

For now, use the manual installation method below.

---

## 🛠️ Manual Installation (Developer Mode)

### Prerequisites

- **Chrome, Edge, or Brave** browser (latest version)
- **5 minutes** of your time

### Step-by-Step Instructions

#### 1️⃣ Download LinguaFlow

**Option A: Download ZIP from GitHub**
```bash
# Go to: https://github.com/seu-usuario/linguaflow
# Click "Code" → "Download ZIP"
# Extract the ZIP file to a folder (e.g., C:\linguaflow)
```

**Option B: Clone with Git**
```bash
git clone https://github.com/seu-usuario/linguaflow.git
cd linguaflow
```

#### 2️⃣ Open Chrome Extensions Page

1. Open Chrome/Edge/Brave
2. Type in address bar: `chrome://extensions/`
3. Press Enter

**Or:**
- Click ⋮ (three dots) → More Tools → Extensions

#### 3️⃣ Enable Developer Mode

1. Look for **"Developer mode"** toggle in the top-right corner
2. Click to enable it

![Developer Mode](https://i.imgur.com/example.png)

#### 4️⃣ Load the Extension

1. Click **"Load unpacked"** button
2. Navigate to the LinguaFlow folder
3. Select the folder and click **"Select Folder"**

![Load Unpacked](https://i.imgur.com/example.png)

#### 5️⃣ Verify Installation

You should see:
- ✅ LinguaFlow icon in extensions list
- ✅ Version number (e.g., 1.0.1)
- ✅ "Enabled" status

![Extension Loaded](https://i.imgur.com/example.png)

#### 6️⃣ Pin to Toolbar (Optional)

1. Click the **puzzle icon** 🧩 in Chrome toolbar
2. Find **LinguaFlow**
3. Click the **pin icon** 📌

Now you'll see LinguaFlow icon in your toolbar!

---

## ✅ Test Installation

### Test on YouTube

1. Go to [YouTube](https://www.youtube.com)
2. Play any video with **English subtitles**
3. Enable subtitles (CC button)
4. You should see:
   - ✅ Dual subtitles (English + Portuguese)
   - ✅ Clickable words
   - ✅ LinguaFlow controls in player

### Test Word Popup

1. Click any word in the subtitle
2. You should see:
   - ✅ Popup with definition
   - ✅ Translation
   - ✅ Audio button 🔊
   - ✅ Save button

### Test Dashboard

1. Click LinguaFlow icon in toolbar
2. Click **"Open Dashboard"**
3. You should see:
   - ✅ Dashboard opens in new tab
   - ✅ Stats show 0 words (if first time)
   - ✅ No console errors (F12)

---

## 🔧 Troubleshooting

### Extension Not Loading

**Problem:** "Load unpacked" button is grayed out

**Solution:**
1. Make sure Developer Mode is **enabled**
2. Restart Chrome
3. Try again

---

### Subtitles Not Appearing

**Problem:** No dual subtitles on YouTube

**Solution:**
1. Make sure video has **English subtitles** (CC button)
2. Refresh the page (F5)
3. Check console for errors (F12 → Console)
4. Try another video

---

### Word Popup Not Opening

**Problem:** Clicking words does nothing

**Solution:**
1. Check if subtitles are visible
2. Refresh the page (F5)
3. Check console for errors (F12 → Console)
4. Disable other subtitle extensions (Language Reactor, etc.)

---

### Audio Not Playing

**Problem:** 🔊 button doesn't play audio

**Solution:**
1. Check browser audio settings
2. Try another word
3. Check console for errors (F12 → Console)
4. See [Audio Troubleshooting](#audio-troubleshooting)

---

### Dashboard Not Updating

**Problem:** Saved words don't appear in dashboard

**Solution:**
1. Wait 3 seconds (polling interval)
2. Click refresh button 🔄 in dashboard
3. Check IndexedDB (F12 → Application → IndexedDB → LinguaFlowFreeDB)
4. See [Dashboard Troubleshooting](#dashboard-troubleshooting)

---

## 🎧 Audio Troubleshooting

### Robotic Voice

**Problem:** Audio sounds robotic

**Cause:** System doesn't have natural voices installed

**Solution (Windows):**
1. Install Microsoft natural voices:
   - Settings → Time & Language → Speech
   - Download "Microsoft Aria Online (Natural)"
2. Restart Chrome
3. Test audio again

**Solution (macOS):**
- macOS has high-quality voices by default (Samantha, Alex)
- No action needed

**Solution (Linux):**
```bash
# Install espeak-ng for better quality
sudo apt install espeak-ng

# Or install festival
sudo apt install festival
```

### No Audio at All

**Problem:** No sound when clicking 🔊

**Solution:**
1. Check browser audio permissions:
   - chrome://settings/content/sound
   - Make sure sound is allowed
2. Check system volume
3. Try headphones
4. Check console for errors

---

## 💾 Dashboard Troubleshooting

### Words Not Saving

**Problem:** Click "Save to Flashcards" but word doesn't appear

**Solution:**
1. Check console for errors (F12)
2. Check IndexedDB:
   - F12 → Application → IndexedDB → LinguaFlowFreeDB → words
   - Should see saved words
3. Refresh dashboard (🔄 button)
4. Wait 3 seconds for polling

### Dashboard Empty

**Problem:** Dashboard shows 0 words but I saved many

**Solution:**
1. Check IndexedDB (see above)
2. Clear browser cache:
   - chrome://settings/clearBrowserData
   - Select "Cached images and files"
   - Click "Clear data"
3. Reload extension:
   - chrome://extensions/
   - Click reload icon ↻ on LinguaFlow
4. Reopen dashboard

---

## 🔄 Updating LinguaFlow

### Manual Update

1. Download latest version from GitHub
2. Extract to **same folder** (overwrite files)
3. Go to `chrome://extensions/`
4. Click **reload icon** ↻ on LinguaFlow
5. Verify new version number

### Automatic Update (Chrome Web Store)

Once published, updates will be automatic.

---

## 🗑️ Uninstalling

### Remove Extension

1. Go to `chrome://extensions/`
2. Find LinguaFlow
3. Click **"Remove"**
4. Confirm removal

### Delete Data

Extension data is stored in IndexedDB. To delete:

1. F12 → Application → IndexedDB
2. Right-click **LinguaFlowFreeDB**
3. Click **"Delete database"**

**Warning:** This will delete all saved words, cards, and progress!

### Backup Before Uninstall

1. Open dashboard
2. Click **"Export"** button
3. Save JSON file
4. To restore: Click **"Import"** and select file

---

## 🌐 Platform-Specific Notes

### YouTube
- ✅ Works perfectly
- ✅ Auto-detects subtitles
- ✅ All features available

### Netflix
- ⚠️ May require manual subtitle activation
- ⚠️ Some titles have DRM restrictions
- ✅ Most features work

### Max (HBO Max)
- ⚠️ Requires clicking 👁️ button to activate
- ⚠️ Subtitle format varies by title
- ✅ Most features work

### Prime Video
- ✅ Works on most titles
- ⚠️ Some titles have custom subtitle format

### Disney+
- ✅ Works on most titles
- ⚠️ Newer titles may have issues

---

## 📞 Still Having Issues?

### Get Help

1. **Check existing issues:** [GitHub Issues](https://github.com/seu-usuario/linguaflow/issues)
2. **Open new issue:** [Report Bug](https://github.com/seu-usuario/linguaflow/issues/new?template=bug_report.md)
3. **Join Discord:** [LinguaFlow Community](https://discord.gg/linguaflow)
4. **Email:** extensao.linguaflow@gmail.com

### Include in Bug Report

- Browser version
- OS version
- LinguaFlow version
- Console errors (F12 → Console)
- Screenshots
- Steps to reproduce

---

## 🎓 Next Steps

After installation:

1. **Read the Guide:** [User Guide](GUIA_DE_TESTES.md)
2. **Watch Tutorial:** [YouTube Tutorial](https://youtube.com/watch?v=example)
3. **Join Community:** [Discord](https://discord.gg/linguaflow)
4. **Star on GitHub:** ⭐ [GitHub Repo](https://github.com/seu-usuario/linguaflow)

---

**Happy Learning! 🚀**
