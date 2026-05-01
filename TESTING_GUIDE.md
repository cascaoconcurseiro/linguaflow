# 🧪 LinguaFlow - Testing Guide for Architecture Fixes

## 📋 Pre-Test Setup

1. **Clear Extension Cache:**
   ```
   chrome://extensions/ → LinguaFlow → Remove → Reload unpacked
   ```

2. **Open Developer Console:**
   - Dashboard: F12 on dashboard page
   - Content Script: F12 on YouTube/Netflix page
   - Service Worker: chrome://extensions/ → LinguaFlow → Service Worker → Inspect

3. **Open Multiple Tabs:**
   - Tab 1: YouTube video with subtitles
   - Tab 2: Dashboard (dashboard.html)
   - Tab 3: Another dashboard (to test multi-tab sync)

---

## ✅ Test 1: Save Word from Video

### Steps:
1. Open YouTube video with English subtitles
2. Wait for subtitle to appear
3. Click on any word in the subtitle
4. Word popup should appear
5. Click "Salvar nos Flashcards"

### Expected Results:
- ✅ Button changes to "⏳ Salvando..."
- ✅ Button changes to "✅ Salvo!" (green)
- ✅ Toast notification appears: "✅ [word] salvo no dashboard!"
- ✅ Dashboard updates within 2 seconds
- ✅ Word appears in "Cards" tab
- ✅ Header counter increases

### Console Logs to Check:
```
[WordPopup] ✅ Palavra salva: {ok: true, id: 1, isNew: true}
[WordPopup] 📢 Notificações enviadas
[LinguaFlow SW] 📢 Notificando dashboards sobre nova palavra: [word]
[LinguaFlow SW] ✅ Notificações enviadas via 3 canais
🔄 Dashboard: Atualizando (fonte: runtime.onMessage)
✓ Atualizado
```

---

## ✅ Test 2: Dashboard Real-Time Update

### Steps:
1. Have dashboard open in Tab 2
2. Save a word from YouTube (Tab 1)
3. Watch dashboard WITHOUT refreshing page

### Expected Results:
- ✅ Dashboard updates automatically within 2 seconds
- ✅ "✓ Atualizado" indicator appears top-right
- ✅ New word appears in cards list
- ✅ Header stats update

### Console Logs to Check:
```
📨 Dashboard: Mensagem recebida: REFRESH_VOCAB
🔄 Dashboard: Atualizando (fonte: runtime.onMessage)
📚 Dashboard: getAllWords retornou [N] palavras
```

---

## ✅ Test 3: Multi-Tab Sync

### Steps:
1. Open 2 dashboard tabs (Tab 2 and Tab 3)
2. Save a word from YouTube (Tab 1)
3. Watch BOTH dashboards

### Expected Results:
- ✅ BOTH dashboards update simultaneously
- ✅ Both show "✓ Atualizado" indicator
- ✅ Both show the same word count

---

## ✅ Test 4: Manual Refresh Button

### Steps:
1. Open dashboard
2. Look for 🔄 button in header (top-right area)
3. Click the button

### Expected Results:
- ✅ Button rotates 180° on hover
- ✅ Button spins 360° on click
- ✅ Dashboard refreshes immediately
- ✅ "✓ Atualizado" indicator appears

### Console Logs to Check:
```
🔄 Dashboard: Atualizando (fonte: manual)
```

---

## ✅ Test 5: Storage Change Listener

### Steps:
1. Open dashboard
2. Open Chrome DevTools → Application → Storage → Local Storage
3. Manually change `lf_last_update` value
4. Watch dashboard

### Expected Results:
- ✅ Dashboard detects change
- ✅ Dashboard refreshes automatically

### Console Logs to Check:
```
💾 Dashboard: Mudança detectada no storage
🔄 Dashboard: Atualizando (fonte: storage.onChanged)
```

---

## ✅ Test 6: Polling Fallback

### Steps:
1. Open dashboard
2. Disable network (to simulate message passing failure)
3. Wait 2 seconds
4. Check if header updates

### Expected Results:
- ✅ Header updates every 2 seconds
- ✅ Full refresh every 10 seconds

### Console Logs to Check:
```
⏰ Dashboard: Polling de fallback
```

---

## ✅ Test 7: Save Phrase

### Steps:
1. Open YouTube video
2. Wait for subtitle to appear
3. Click "Salvar frase" button (should only appear when subtitle is visible)
4. Go to dashboard → Phrases tab

### Expected Results:
- ✅ Button only visible when subtitle is present
- ✅ Button disappears when subtitle disappears
- ✅ Phrase appears in dashboard within 2 seconds
- ✅ Phrase shows original + translation

---

## ✅ Test 8: Create Deck

### Steps:
1. Open word popup
2. Click "+" button next to deck selector
3. Enter deck name: "Test Deck"
4. Save a word to this deck
5. Go to dashboard → Decks tab

### Expected Results:
- ✅ New deck appears in selector immediately
- ✅ Deck appears in dashboard Decks tab
- ✅ Deck shows correct word count

---

## ✅ Test 9: Audio Quality (Natural Voices Only)

### Steps:
1. Open word popup for any word
2. Click 🔊 button
3. Listen to pronunciation

### Expected Results:
- ✅ Voice sounds natural/human-like (NOT robotic)
- ✅ Uses Google TTS (priority 1) or natural browser voice
- ✅ NO eSpeak, Festival, or Pico voices

### Console Logs to Check:
```
[TTS] Vozes naturais disponíveis: [N] / [Total]
[TTS] Usando voz preferida: Google US English
```

OR if no natural voice:
```
[TTS] ⚠️ Nenhuma voz natural encontrada, usando Google TTS
```

---

## ✅ Test 10: Listening Practice

### Steps:
1. Go to dashboard → Listening tab
2. Click 🔊 button
3. Listen to word

### Expected Results:
- ✅ Audio plays with natural voice
- ✅ NO robotic voice

---

## ✅ Test 11: Cross-Page Persistence

### Steps:
1. Save 5 words from YouTube
2. Close ALL tabs
3. Reopen dashboard

### Expected Results:
- ✅ All 5 words are still there
- ✅ Stats are correct
- ✅ No data loss

---

## ✅ Test 12: Performance Check

### Steps:
1. Save 50 words
2. Open dashboard
3. Check load time

### Expected Results:
- ✅ Dashboard loads in < 2 seconds
- ✅ No lag when switching tabs
- ✅ Smooth scrolling in cards list

---

## 🐛 Common Issues & Solutions

### Issue: Dashboard not updating
**Solution:**
1. Check console for errors
2. Verify service worker is running: chrome://extensions/ → Inspect
3. Try manual refresh button
4. Check if IndexedDB has data: DevTools → Application → IndexedDB

### Issue: No toast notification
**Solution:**
1. Check if popup is blocked
2. Verify z-index is high enough
3. Check console for errors

### Issue: Robotic voice
**Solution:**
1. Check console: `[TTS] Vozes naturais disponíveis`
2. If 0 natural voices, Google TTS should be used
3. Verify Google TTS URL is not blocked

### Issue: Save button not appearing
**Solution:**
1. Verify subtitle is actually present
2. Check if subtitle text is not empty
3. Look for MutationObserver errors in console

---

## 📊 Success Criteria

All tests must pass with:
- ✅ 0 console errors
- ✅ < 2 second update latency
- ✅ 100% data persistence
- ✅ Natural voice quality
- ✅ Smooth user experience

---

## 🎯 Final Checklist

- [ ] All 12 tests passed
- [ ] No console errors
- [ ] Dashboard updates in real-time
- [ ] Audio uses natural voices only
- [ ] Save button visibility works correctly
- [ ] Multi-tab sync works
- [ ] Manual refresh button works
- [ ] Data persists across sessions
- [ ] Performance is acceptable
- [ ] User experience is smooth

---

**Status:** Ready for Production ✅
**Last Updated:** 2024
