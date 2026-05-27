// LinguaFlow Pro — Word Popup v5 (unified storage, bilingual examples, full grammar)

export class WordPopup {
  constructor(engine, platform) {
    this.engine=engine; this.platform=platform;
    this.popup=null; this.word=''; this.context='';
    this.cache={}; this.activeDeck='Default'; this.decks=['Default'];
    this._gramBuilt=false; this._exBuilt=false;
  }

  init() { this._build(); this._loadDecks(); }
  destroy() { this.popup?.remove(); }

  _build() {
    document.getElementById('lfp')?.remove();
    if (!document.getElementById('lfp-k')) {
      const s=document.createElement('style');s.id='lfp-k';
      s.textContent=`@keyframes lfpIn{from{opacity:0;transform:translateY(10px) scale(0.93)}to{opacity:1;transform:translateY(0) scale(1)}}@keyframes lfpSpin{to{transform:rotate(360deg)}}.lfp-spin{width:18px;height:18px;border:2px solid rgba(255,255,255,.1);border-top-color:#a78bfa;border-radius:50%;animation:lfpSpin .6s linear infinite;display:inline-block;vertical-align:middle;margin-right:8px}#lfp *{box-sizing:border-box;margin:0;padding:0}#lfp button,#lfp select,#lfp input{font-family:'Outfit','Segoe UI',sans-serif}.lfp-chip{background:rgba(255,255,255,.05);border:1px solid rgba(255,255,255,.09);border-radius:20px;padding:3px 10px;font-size:11px;color:#94a3b8;cursor:pointer;transition:all .12s;display:inline-block}.lfp-chip:hover{color:#7dd3fc;border-color:rgba(125,209,252,.35)}.lfp-chip.red{background:rgba(248,113,113,.06);border-color:rgba(248,113,113,.15);color:#f87171}.lfp-panels::-webkit-scrollbar{width:3px}.lfp-panels::-webkit-scrollbar-thumb{background:rgba(255,255,255,.1);border-radius:4px}.lfp-ph{background:rgba(244,114,182,.06);border:1px solid rgba(244,114,182,.15);border-radius:9px;padding:9px 12px;margin-bottom:7px}.lfp-ex{background:rgba(255,255,255,.03);border:1px solid rgba(255,255,255,.07);border-radius:10px;padding:10px 13px;margin-bottom:8px}.ai-res{white-space:pre-wrap;word-break:break-word}`;
      document.head.appendChild(s);
    }
    this.popup=document.createElement('div');
    this.popup.id='lfp';
    Object.assign(this.popup.style, {
      position: 'absolute',
      zIndex: '2147483647',
      background: 'rgba(13, 17, 28, 0.85)',
      backdropFilter: 'blur(20px) saturate(160%)',
      WebkitBackdropFilter: 'blur(20px) saturate(160%)',
      border: '1px solid rgba(255, 255, 255, 0.1)',
      borderRadius: '24px',
      width: '400px',
      maxWidth: '95vw',
      boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5), 0 0 0 1px rgba(255, 255, 255, 0.05)',
      fontFamily: "'Outfit', 'Inter', system-ui, -apple-system, sans-serif",
      color: '#F8FAFC',
      display: 'none',
      overflow: 'hidden',
      transition: 'opacity 0.2s ease, transform 0.2s cubic-bezier(0.34, 1.56, 0.64, 1)',
      opacity: '0',
      transform: 'translateY(10px) scale(0.95)'
    });
    this.popup.innerHTML=`
<div style="padding:16px 18px 0;display:flex;align-items:flex-start;justify-content:space-between;">
  <div style="flex:1;min-width:0;">
    <div style="display:flex;align-items:baseline;gap:8px;flex-wrap:wrap;">
      <span id="fw" style="font-size:28px;font-weight:800;color:#f8fafc;letter-spacing:-.03em;line-height:1;"></span>
      <span id="fpos" style="display:none;font-size:10px;font-weight:700;letter-spacing:.1em;text-transform:uppercase;background:rgba(125,209,252,.1);color:#7dd3fc;padding:2px 7px;border-radius:20px;"></span>
    </div>
    <div style="display:flex;align-items:center;gap:8px;margin-top:5px;flex-wrap:wrap;">
      <span id="fipa" style="font-size:13px;color:#64748b;font-family:monospace;"></span>
    </div>
  </div>
  <div style="display:flex;gap:6px;flex-shrink:0;margin-top:2px;">
    <button id="ftts" title="🔊 Ouvir" style="background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.1);border-radius:9px;color:#7dd3fc;cursor:pointer;padding:6px 9px;font-size:16px;line-height:1;transition:all .15s;">🔊</button>
    <button id="fx" style="background:none;border:none;color:#475569;font-size:18px;cursor:pointer;padding:4px 7px;border-radius:6px;line-height:1;">✕</button>
  </div>
</div>
<div style="display:flex;border-bottom:1px solid rgba(255,255,255,.07);margin-top:12px;padding:0 4px;">
  ${['Tradução','Gramática','Exemplos','Linguee','YouGlish'].map((l,i)=>`<button class="ftab" data-i="${i}" style="flex:1;padding:9px 2px;font-size:11px;font-weight:700;color:${i===0?'#7dd3fc':'#475569'};background:none;border:none;border-bottom:2px solid ${i===0?'#7dd3fc':'transparent'};cursor:pointer;letter-spacing:.03em;white-space:nowrap;transition:all .15s;">${l}</button>`).join('')}
</div>
<div class="lfp-panels" style="padding:14px 18px 18px;max-height:400px;overflow-y:auto;">

  <div class="fp" data-p="0">
    <div id="ft" style="font-size:26px;font-weight:800;color:#4ade80;margin-bottom:5px;line-height:1.2;">…</div>
    <div id="fd" style="font-size:13px;color:#94a3b8;line-height:1.6;font-style:italic;margin-bottom:10px;"></div>
    <div id="fctx" style="display:none;background:rgba(139,92,246,.06);border:1px solid rgba(139,92,246,.18);border-radius:10px;padding:10px 13px;margin-bottom:12px;"><div style="font-size:10px;color:#a78bfa;font-weight:700;letter-spacing:.08em;text-transform:uppercase;margin-bottom:5px;display:flex;align-items:center;gap:5px;"><span>💡</span><span>Contexto nesta frase</span></div><div id="fctxt" style="font-size:12px;color:#e2e8f0;line-height:1.7;"></div></div>
    <div id="fc" style="display:none;background:rgba(125,209,252,.04);border-left:3px solid rgba(125,209,252,.3);padding:8px 12px;border-radius:0 8px 8px 0;font-size:12px;color:#cbd5e1;line-height:1.6;margin-bottom:12px;"></div>
    <div id="fsyn" style="display:none;margin-bottom:10px;"><div style="font-size:10px;color:#475569;font-weight:700;letter-spacing:.09em;text-transform:uppercase;margin-bottom:5px;">Sinônimos</div><div id="fsyns" style="display:flex;flex-wrap:wrap;gap:5px;"></div></div>
    <div id="fant" style="display:none;margin-bottom:12px;"><div style="font-size:10px;color:#475569;font-weight:700;letter-spacing:.09em;text-transform:uppercase;margin-bottom:5px;">Antônimos</div><div id="fants" style="display:flex;flex-wrap:wrap;gap:5px;"></div></div>
    <div style="height:1px;background:rgba(255,255,255,.06);margin-bottom:12px;"></div>
    <div style="display:flex;gap:6px;align-items:center;margin-bottom:10px;">
      <span style="font-size:11px;color:#475569;font-weight:600;white-space:nowrap;">Deck:</span>
      <select id="fdeck" style="flex:1;background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.1);border-radius:8px;color:#94a3b8;font-size:12px;padding:5px 8px;outline:none;cursor:pointer;"></select>
      <button id="fnewdeck" style="background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.1);border-radius:8px;color:#64748b;padding:5px 9px;cursor:pointer;font-size:14px;font-weight:700;transition:all .15s;" title="Novo deck">+</button>
    </div>
    <button id="fsave" style="display:block;width:100%;padding:11px;background:linear-gradient(135deg,#1d4ed8,#2563eb);color:#fff;border:none;border-radius:12px;font-size:14px;font-weight:800;cursor:pointer;transition:all .15s;margin-bottom:8px;letter-spacing:.01em;">+ Salvar nos Flashcards</button>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:8px;">
      <button id="fknown" style="padding:9px;background:rgba(74,222,128,.08);color:#4ade80;border:1px solid rgba(74,222,128,.25);border-radius:11px;font-size:13px;font-weight:700;cursor:pointer;transition:all .15s;">✓ Já Conheço</button>
      <button id="fai" style="padding:9px;background:rgba(139,92,246,.08);color:#a78bfa;border:1px solid rgba(139,92,246,.22);border-radius:11px;font-size:13px;font-weight:700;cursor:pointer;transition:all .15s;">✦ Explicar Palavra</button>
    </div>
    <button id="faisent" style="display:none;width:100%;padding:9px;background:rgba(251,191,36,.08);color:#fbbf24;border:1px solid rgba(251,191,36,.22);border-radius:11px;font-size:13px;font-weight:700;cursor:pointer;transition:all .15s;margin-bottom:10px;">🔍 Analisar Frase Completa</button>
    <div id="fair-container" style="display:none;position:relative;">
      <div id="fair" class="ai-res" style="background:rgba(139,92,246,.08);border:1px solid rgba(139,92,246,.2);border-radius:12px;padding:12px;font-size:12px;color:#c4b5fd;line-height:1.7;"></div>
      <button id="fcopy-ai" style="position:absolute;top:8px;right:8px;background:rgba(255,255,255,.1);border:none;border-radius:6px;color:#fff;padding:4px 8px;font-size:10px;cursor:pointer;opacity:0.6;">📋 Copiar</button>
    </div>
  </div>

  <div class="fp" data-p="1" style="display:none;">
    <div id="fgb"><div style="text-align:center;color:#475569;font-size:13px;padding:16px;">Clique "Analisar" para análise completa com IA.</div></div>
    <button id="fgbtn" style="display:block;width:100%;margin-top:12px;padding:10px;background:rgba(139,92,246,.1);color:#a78bfa;border:1px solid rgba(139,92,246,.25);border-radius:11px;font-size:13px;font-weight:700;cursor:pointer;">✦ Analisar com IA</button>
  </div>

  <div class="fp" data-p="2" style="display:none;">
    <div id="fexb"><div style="text-align:center;color:#475569;font-size:13px;padding:20px;">Carregando exemplos…</div></div>
    <div style="margin:12px 0;height:1px;background:rgba(255,255,255,.06);"></div>
    <div style="font-size:10px;color:#475569;font-weight:700;letter-spacing:.09em;text-transform:uppercase;margin-bottom:7px;">Frase do vídeo</div>
    <div id="fvctx" style="background:rgba(125,209,252,.04);border-left:3px solid rgba(125,209,252,.3);padding:8px 12px;border-radius:0 8px 8px 0;font-size:12px;color:#94a3b8;font-style:italic;line-height:1.6;"></div>
    <div id="fvctxtr" style="font-size:11px;color:rgba(125,209,252,.5);font-style:italic;margin-top:5px;line-height:1.5;"></div>
  </div>

  <div class="fp" data-p="3" style="display:none;padding-top:8px;">
    <div style="font-size:13px;color:#64748b;line-height:1.8;margin-bottom:14px;text-align:center;">Traduções em contexto real de textos bilíngues — ideal para ver uso nativo.</div>
    <div id="frev" style="display:none;margin-bottom:14px;max-height:280px;overflow-y:auto;"></div>
    <button id="frevbtn" style="display:block;width:100%;padding:11px;background:linear-gradient(135deg,#0c4a6e,#0369a1);color:#7dd3fc;border:none;border-radius:12px;font-size:14px;font-weight:700;cursor:pointer;margin-bottom:8px;">🔄 Reverso Context — Exemplos Reais</button>
    <button id="fl1" style="display:block;width:100%;padding:10px;background:rgba(74,222,128,.08);color:#4ade80;border:1px solid rgba(74,222,128,.25);border-radius:12px;font-size:13px;font-weight:700;cursor:pointer;margin-bottom:8px;">🔗 Linguee — EN ↔ PT</button>
    <button id="fl2" style="display:block;width:100%;padding:9px;background:rgba(74,222,128,.05);color:#4ade80;border:1px solid rgba(74,222,128,.15);border-radius:12px;font-size:13px;font-weight:700;cursor:pointer;margin-bottom:8px;">🇬🇧 Linguee — EN definitions</button>
    <button id="fl3" style="display:block;width:100%;padding:9px;background:rgba(74,222,128,.03);color:#4ade80;border:1px solid rgba(74,222,128,.1);border-radius:12px;font-size:13px;font-weight:700;cursor:pointer;">🌐 Google Translate</button>
  </div>

  <div class="fp" data-p="4" style="display:none;text-align:center;padding-top:8px;">
    <div style="font-size:13px;color:#64748b;line-height:1.8;margin-bottom:14px;">Ouça como nativos pronunciam em vídeos reais do YouTube.</div>
    <button id="fy1" style="display:block;width:100%;padding:12px;background:linear-gradient(135deg,#7c1010,#b91c1c);color:#f87171;border:none;border-radius:12px;font-size:14px;font-weight:700;cursor:pointer;margin-bottom:8px;">🎬 YouGlish — Qualquer sotaque</button>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:8px;">
      <button id="fy2" style="padding:10px;background:rgba(248,113,113,.07);color:#f87171;border:1px solid rgba(248,113,113,.2);border-radius:10px;font-size:13px;font-weight:700;cursor:pointer;">🇺🇸 American</button>
      <button id="fy3" style="padding:10px;background:rgba(248,113,113,.07);color:#f87171;border:1px solid rgba(248,113,113,.2);border-radius:10px;font-size:13px;font-weight:700;cursor:pointer;">🇬🇧 British</button>
    </div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;">
      <button id="fy4" style="padding:10px;background:rgba(248,113,113,.04);color:#f87171;border:1px solid rgba(248,113,113,.12);border-radius:10px;font-size:13px;font-weight:700;cursor:pointer;">🇦🇺 Australian</button>
      <button id="fy5" style="padding:10px;background:rgba(248,113,113,.04);color:#f87171;border:1px solid rgba(248,113,113,.12);border-radius:10px;font-size:13px;font-weight:700;cursor:pointer;">🎓 Academic</button>
    </div>
  </div>

</div>`;
    document.body.appendChild(this.popup);
    window.__lfpopup = this;
    this._bind();
  }

  _q(s) { return this.popup.querySelector(s); }

  _bind() {
    const q = s => this._q(s);
    q('#fx').onclick = (e) => { e.stopPropagation(); this.hide(true); };
    
    // Impede que cliques dentro do popup vazem para o YouTube/Netflix
    this.popup.addEventListener('click', e => e.stopPropagation());
    this.popup.addEventListener('mousedown', e => e.stopPropagation());
    
    if (!this._mousedownAttached) {
      document.addEventListener('mousedown', e => {
        if (this.popup && this.popup.style.display !== 'none' && !this.popup.contains(e.target) && !e.target.classList?.contains('lf-word')) {
          // Se o clique for no player, NÃO forçamos o play, pois o player fará isso nativamente.
          const isPlayerClick = this.engine && (
             e.target === this.engine.videoElement || 
             (this.engine._findPlayerContainer && this.engine._findPlayerContainer()?.contains(e.target))
          );
          
          this.hide(!isPlayerClick); 
        }
      });
      
      this._mousedownAttached = true;
    }
    // Tabs
    this.popup.querySelectorAll('.ftab').forEach(t => {
      t.onclick = () => {
        const i = parseInt(t.dataset.i);
        this.popup.querySelectorAll('.ftab').forEach((x,j)=>{ x.style.color=j===i?'#7dd3fc':'#475569'; x.style.borderBottomColor=j===i?'#7dd3fc':'transparent'; });
        this.popup.querySelectorAll('.fp').forEach((p,j)=>p.style.display=j===i?'':'none');
        if (i===1 && !this._gramBuilt) this._aiGrammar();
        if (i===2 && !this._exBuilt)  this._buildExamples();
      };
    });
    q('#ftts').onclick = async () => { 
      const BASE = chrome.runtime.getURL('utils/');
      try {
        const { tts } = await import(BASE + 'tts.js');
        // Pass audioUrl from dictionary (priority 1: native MP3)
        await tts.play(this.word, 'en-US', this._currentAudioUrl || null);
      } catch (e) {
        console.error('[WordPopup] Erro ao reproduzir áudio:', e);
      }
    };
    q('#fsave').onclick = () => this._save();
    q('#fknown').onclick = () => this._toggleKnown();
    q('#fai').onclick = () => this._ai();
    q('#faisent').onclick = () => this._aiSentence();
    q('#fgbtn').onclick = () => this._aiGrammar();
    q('#frevbtn').onclick = () => this._loadReverso();
    q('#fcopy-ai').onclick = () => {
      const text = q('#fair').textContent;
      navigator.clipboard.writeText(text);
      const btn = q('#fcopy-ai');
      btn.textContent = '✅ Copiado!';
      setTimeout(() => btn.textContent = '📋 Copiar', 2000);
    };
    q('#fnewdeck').onclick = async() => {
      const n=prompt('Nome do deck:');
      if(!n?.trim()) return;
      const BASE=chrome.runtime.getURL('utils/');
      const {db}=await import(BASE+'db.js');
      const decks=[...this.decks,n.trim()];
      await db.setSetting('decks',decks);
      this.decks=decks;
      this._renderDecks();
      q('#fdeck').value=n.trim();
      this.activeDeck=n.trim();
    };
    q('#fdeck').onchange = e => this.activeDeck=e.target.value;
    // Linguee
    q('#fl1').onclick = () => window.open(`https://www.linguee.com/english-portuguese/search?source=auto&query=${encodeURIComponent(this.word)}`,'_blank');
    q('#fl2').onclick = () => window.open(`https://www.linguee.com/english-portuguese/search?source=english&query=${encodeURIComponent(this.word)}`,'_blank');
    q('#fl3').onclick = () => window.open(`https://translate.google.com/?sl=${this.engine?.sourceLang||'en'}&tl=${this.engine?.targetLang||'pt'}&text=${encodeURIComponent(this.word)}`,'_blank');
    // YouGlish
    q('#fy1').onclick = () => window.open(`https://youglish.com/pronounce/${encodeURIComponent(this.word)}/english`,'_blank');
    q('#fy2').onclick = () => window.open(`https://youglish.com/pronounce/${encodeURIComponent(this.word)}/english/us`,'_blank');
    q('#fy3').onclick = () => window.open(`https://youglish.com/pronounce/${encodeURIComponent(this.word)}/english/uk`,'_blank');
    q('#fy4').onclick = () => window.open(`https://youglish.com/pronounce/${encodeURIComponent(this.word)}/english/aus`,'_blank');
    q('#fy5').onclick = () => window.open(`https://youglish.com/pronounce/${encodeURIComponent(this.word)}/english/academic`,'_blank');
  }

  async showForWord(word, context, rect, cue) {
    if (this._hideTimeout) {
      clearTimeout(this._hideTimeout);
      this._hideTimeout = null;
    }

    if (!word) return;
    this.word=word.replace(/[.,!?()"]+/g, ''); this.context=context||'';
    this.currentCue = cue; // Armazena a cue completa com contexto expandido
    this._gramBuilt=false; this._exBuilt=false;
    
    // Encontra o player container
    const playerContainer = this._findPlayerContainer();
    if (playerContainer && this.popup.parentElement !== playerContainer) {
      playerContainer.appendChild(this.popup);
      console.log('[WordPopup] Popup movido para dentro do player');
    } else if (!playerContainer && this.popup.parentElement !== document.body) {
      document.body.appendChild(this.popup);
    }
    // Reset tabs
    this.popup.querySelectorAll('.ftab').forEach((t,i)=>{ t.style.color=i===0?'#7dd3fc':'#475569'; t.style.borderBottomColor=i===0?'#7dd3fc':'transparent'; });
    this.popup.querySelectorAll('.fp').forEach((p,i)=>p.style.display=i===0?'':'none');
    const q=s=>this._q(s);
    q('#fw').textContent=word; q('#fipa').textContent=''; q('#fpos').style.display='none';
    q('#ft').textContent='…'; q('#fd').textContent=''; q('#fc').style.display='none'; q('#fctx').style.display='none';
    q('#fsyn').style.display='none'; q('#fant').style.display='none';
    q('#fair-container').style.display='none';
    // Context
    if (context) { q('#fc').innerHTML=context.replace(new RegExp(`\\b(${word})\\b`,'gi'),'<b style="color:#7dd3fc">$1</b>'); q('#fc').style.display=''; }
    // Buttons state
    (async()=>{
      const BASE=chrome.runtime.getURL('utils/');
      const {db}=await import(BASE+'db.js');
      const lang=this.engine?.sourceLang||'en';
      const saved=await db.getWord(word,lang);
      const known=await db.isKnown(word,lang);
      q('#fsave').textContent=saved?'✅ Salvo nos Flashcards':'+ Salvar nos Flashcards';
      q('#fsave').style.background=saved?'linear-gradient(135deg,#15803d,#16a34a)':'linear-gradient(135deg,#1d4ed8,#2563eb)';
      q('#fknown').textContent=known?'✅ Conhecida':'✓ Já Conheço';
      q('#fknown').style.background=known?'rgba(74,222,128,.18)':'rgba(74,222,128,.08)';
    })();
    q('#fgb').innerHTML='<div style="text-align:center;color:#475569;font-size:13px;padding:16px;">Clique "Analisar" para análise completa com IA.</div>';
    q('#fexb').innerHTML='<div style="text-align:center;color:#475569;font-size:13px;padding:20px;">Carregando exemplos…</div>';
    q('#fvctx').textContent=context||'(sem contexto)';
    q('#fvctxtr').textContent='';
    
    this.popup.style.display = 'block';
    this._position(rect); // Chama após display=block para obter offsetHeight real
    
    // Trigger animation
    requestAnimationFrame(() => {
      this.popup.style.opacity = '1';
      this.popup.style.transform = 'translateY(0) scale(1)';
    });

    this._loadData(word);
    
    // Se o vídeo estava tocando, pausamos e marcamos que fomos nós
    if (this.engine?.videoElement && !this.engine.videoElement.paused) {
        this.engine.videoElement.pause();
        this._wasPlayingBefore = true;
    }

    // Tradução do contexto em segundo plano
    if (context) {
        this._translate(context).then(tr => {
            if (tr) q('#fvctxtr').textContent = '→ ' + tr;
        });
        // A explicação contextual agora é disparada apenas se o usuário clicar em "IA" ou após o dicionário carregar
    }
  }

  async _loadData(word) {
    if (this.cache[word]) { this._render(this.cache[word]); return; }
    const [tr, di] = await Promise.all([this._translate(word), this._dict(word)]);
    const d = { translation:tr, ...di };
    this.cache[word]=d;
    this._render(d);
  }

  _render(d) {
    const q=s=>this._q(s);
    q('#ft').textContent=d.translation||'—';
    if(d.phonetic) q('#fipa').textContent=d.phonetic;
    if(d.partOfSpeech){q('#fpos').textContent=d.partOfSpeech;q('#fpos').style.display='';}
    if(d.definition) q('#fd').textContent=d.definition;
    if(d.synonyms?.length){
      q('#fsyns').innerHTML=d.synonyms.slice(0,6).map(s=>`<span class="lfp-chip" onclick="window.__lfpopup?.showForWord('${s}','',null)">${s}</span>`).join('');
      q('#fsyn').style.display='';
    }
    if(d.antonyms?.length){
      q('#fants').innerHTML=d.antonyms.slice(0,4).map(s=>`<span class="lfp-chip red" onclick="window.__lfpopup?.showForWord('${s}','',null)">${s}</span>`).join('');
      q('#fant').style.display='';
    }
    
    // Store audioUrl for TTS button
    this._currentAudioUrl = d.audioUrl || null;
    
    // Auto-carrega contexto se disponível
    if (this.context && !this._contextExplained) {
        this._explainContext(this.word, this.context);
    }
  }

  async _buildGrammar() {
    this._gramBuilt=true;
    const q=s=>this._q(s);
    const d=this.cache[this.word]||{};
    
    // Carrega DB de phrasal verbs
    const BASE=chrome.runtime.getURL('utils/');
    const { phrasalVerbsDB } = await import(BASE + 'phrasal-verbs.js');
    
    // Verifica se a palavra atual já é uma expressão (contém espaço)
    const isExpr = this.word.includes(' ');
    const phs = isExpr ? [] : (phrasalVerbsDB[this.word.toLowerCase()] || []);

    let h = '';
    
    if (isExpr) {
      h += `<div style="margin-bottom:14px;background:rgba(244,114,182,0.1);padding:12px;border-radius:12px;border:1px solid rgba(244,114,182,0.2);">
             <div style="font-size:10px;color:#f472b6;font-weight:700;letter-spacing:.1em;text-transform:uppercase;margin-bottom:6px;">Tipo de Termo</div>
             <div style="font-size:14px;color:#f8fafc;font-weight:700;">Expressão / Phrasal Verb</div>
             <div style="font-size:12px;color:#94a3b8;margin-top:4px;line-height:1.5;">Este é um termo composto que possui um significado único quando as palavras são usadas juntas.</div>
            </div>`;
    } else {
      h += `<div style="margin-bottom:14px;"><div style="font-size:10px;color:#7dd3fc;font-weight:700;letter-spacing:.1em;text-transform:uppercase;margin-bottom:6px;">Classe Gramatical</div><div style="font-size:13px;color:#e2e8f0;line-height:1.7;">${this._posDetail(d.partOfSpeech,this.word)}</div></div>`;
    }

    if(phs.length){
      h+=`<div style="margin-bottom:14px;"><div style="font-size:10px;color:#f472b6;font-weight:700;letter-spacing:.1em;text-transform:uppercase;margin-bottom:6px;">Phrasal Verbs com "${this.word}"</div>`;
      h+=phs.map(p=>`<div class="lfp-ph"><div style="font-size:13px;font-weight:700;color:#f472b6;margin-bottom:2px;">${p.phrase}</div><div style="font-size:12px;color:#94a3b8;margin-bottom:2px;">${p.meaning}</div><div style="font-size:11px;color:#64748b;font-style:italic;">"${p.example}"</div></div>`).join('');
      h+=`</div>`;
    }

    if (!isExpr) {
      h+=`<div><div style="font-size:10px;color:#fbbf24;font-weight:700;letter-spacing:.1em;text-transform:uppercase;margin-bottom:6px;">Padrões Gramaticais</div><div style="font-size:13px;color:#94a3b8;line-height:1.8;">${this._patterns(d.partOfSpeech,this.word)}</div></div>`;
    } else {
      h+=`<div><div style="font-size:10px;color:#fbbf24;font-weight:700;letter-spacing:.1em;text-transform:uppercase;margin-bottom:6px;">Análise Sugerida</div><div style="font-size:13px;color:#94a3b8;line-height:1.8;">Clique em <b>"Analisar com IA"</b> abaixo para entender como as palavras se combinam nesta expressão específica.</div></div>`;
    }

    h+=`<div id="fgai" style="display:none;margin-top:12px;background:rgba(139,92,246,.08);border:1px solid rgba(139,92,246,.2);border-radius:12px;padding:12px;font-size:12px;color:#c4b5fd;line-height:1.7;"></div>`;
    q('#fgb').innerHTML=h;
  }

  async _buildExamples() {
    this._exBuilt=true;
    const q=s=>this._q(s);
    const d=this.cache[this.word]||{};
    const exs=[];
    if(d.example) exs.push({en:d.example,src:'Dicionário Oxford'});
    // Fetch more
    try {
      const res=await fetch(`https://api.dictionaryapi.dev/api/v2/entries/en/${encodeURIComponent(this.word)}`);
      if(res.ok){
        const arr=await res.json();
        arr[0]?.meanings?.forEach(m=>m.definitions?.forEach(def=>{
          if(def.example&&exs.length<8) exs.push({en:def.example,src:m.partOfSpeech});
        }));
      }
    } catch {}
    if(!exs.length){q('#fexb').innerHTML='<div style="color:#475569;font-size:13px;text-align:center;padding:16px 0;">Nenhum exemplo no dicionário.<br>Use "Analisar com IA" na aba Gramática para gerar exemplos personalizados.</div>';return;}
    // Translate all examples
    const hl=(t,w)=>t.replace(new RegExp(`\\b(${w})\\b`,'gi'),'<b style="color:#7dd3fc">$1</b>');
    q('#fexb').innerHTML='<div style="color:#475569;font-size:12px;text-align:center;padding:8px;">Traduzindo exemplos…</div>';
    
    // Tradução sequencial para não sobrecarregar o canal de mensagens
    const translated = [];
    for (const e of exs) {
        const tr = await this._translate(e.en);
        translated.push(tr);
    }

    q('#fexb').innerHTML=exs.map((e,i)=>`
      <div class="lfp-ex">
        <div style="margin-bottom:5px;">${hl(e.en,this.word)}</div>
        <div style="font-size:12px;color:#7dd3fc;font-style:italic;line-height:1.5;">→ ${translated[i]||'…'}</div>
        <div style="display:flex; justify-content:space-between; align-items:center; margin-top:8px;">
          <div style="font-size:10px;color:#475569;text-transform:uppercase;letter-spacing:.07em;">${e.src}</div>
          <button class="lfp-shadow-btn" data-text="${e.en.replace(/"/g,'&quot;')}" style="background:rgba(56,189,248,0.1); border:none; border-radius:6px; color:#38bdf8; padding:3px 8px; font-size:11px; cursor:pointer; font-weight:700;">🎧 Shadowing</button>
        </div>
      </div>`).join('');

    // Bind shadowing buttons
    q('#fexb').querySelectorAll('.lfp-shadow-btn').forEach(btn => {
      btn.onclick = async () => {
        const text = btn.dataset.text;
        const BASE = chrome.runtime.getURL('utils/');
        const { tts } = await import(BASE + 'tts.js');
        
        btn.textContent = '🔊 Ouvindo...';
        await tts.play(text, 'en-US');
        
        btn.textContent = '🎙️ Sua vez!';
        btn.style.background = 'rgba(74,222,128,0.1)';
        btn.style.color = '#4ade80';
        
        setTimeout(() => {
          btn.textContent = '🎧 Shadowing';
          btn.style.background = 'rgba(56,189,248,0.1)';
          btn.style.color = '#38bdf8';
        }, 3000);
      };
    });
  }

  // Os métodos _ai, _aiSentence e _aiGrammar foram movidos para o final do arquivo para melhor organização.

    async _getVideoUrlWithTimestamp() {
      const BASE = chrome.runtime.getURL('utils/');
      const { videoUtils } = await import(BASE + 'video-utils.js');
      return videoUtils.getVideoUrlWithTimestamp();
    }

    async _save() {
    const q=s=>this._q(s);
    const btn=q('#fsave');
    
    // Check if already saving (prevent double-click)
    if (btn.disabled) return;
    
    const originalText = btn.textContent;
    btn.textContent='⏳ Salvando...';
    btn.disabled = true;
    
    const d=this.cache[this.word]||{};
    const BASE=chrome.runtime.getURL('utils/');
    
    try {
      const {db}=await import(BASE+'db.js');
      const lang = this.engine?.sourceLang||'en';
      
      // Verifica se já existe
      const existing = await db.getWord(this.word, lang);
      if (existing) {
          const res = confirm(`A palavra "${this.word}" já está nos seus flashcards.\n\nDeseja salvá-la novamente para atualizar com esta nova frase de contexto?`);
          if (!res) {
              btn.textContent='✅ Já está Salvo';
              btn.style.background='linear-gradient(135deg,#059669,#10b981)';
              setTimeout(() => {
                  btn.textContent='+ Salvar nos Flashcards';
                  btn.style.background='linear-gradient(135deg,#1d4ed8,#2563eb)';
                  btn.disabled = false;
              }, 2000);
              return;
          }
      }

      let translation = d.translation || '';
      if (!translation) {
        // Tentativa de tradução de última hora se o cache estiver vazio
        translation = await this._translate(this.word) || '';
      }

      const deckId = await db.getOrCreateDeck(document.title, window.location.href);

      const result = await db.saveWord({
        word:this.word, 
        lang:this.engine?.sourceLang||'en',
        translation: translation, 
        phonetic:d.phonetic||'',
        definition:d.definition||'', 
        context_sentence:this.context||'',
        video_url:await this._getVideoUrlWithTimestamp(), 
        video_title:document.title,
        platform:this.platform||'youtube', 
        level: this.activeLevel || '',
        deck_id: deckId,
        synonyms:(d.synonyms||[]).join(','), 
        antonyms:(d.antonyms||[]).join(','),
      });
      
      console.log('[WordPopup] ✅ Palavra salva:', result);
      
      btn.textContent='✅ Salvo!';
      btn.style.background='linear-gradient(135deg,#15803d,#16a34a)';
      
      // ← FIX: Reset button after 2 seconds
      setTimeout(() => {
        btn.textContent='+ Salvar nos Flashcards';
        btn.style.background='linear-gradient(135deg,#1d4ed8,#2563eb)';
        btn.disabled = false;
      }, 2000);
      
      // Mostra toast de confirmação
      this._showSaveToast();
      
      // Notifica service worker para broadcast
      chrome.runtime.sendMessage({
        type: 'WORD_SAVED',
        word: this.word
      }).catch(() => {});
      
      // Notifica dashboard diretamente
      chrome.runtime.sendMessage({
        type: 'REFRESH_DASHBOARD',
        word: this.word
      }).catch(() => {});
      
      // Dispara evento customizado no DOM
      window.dispatchEvent(new CustomEvent('LF_WORD_SAVED', {
        detail: { word: this.word, result }
      }));
      
      console.log('[WordPopup] 📢 Notificações enviadas');
      
    } catch(e) {
      console.error('[WordPopup] ❌ Erro ao salvar:',e);
      btn.textContent='❌ Erro';
      setTimeout(() => {
        btn.textContent = originalText;
        btn.disabled = false;
      }, 2000);
    }
  }

  _showSaveToast() {
    let toast = document.getElementById('lf-save-toast');
    if (!toast) {
      toast = document.createElement('div');
      toast.id = 'lf-save-toast';
      toast.style.cssText = `
        position: fixed;
        top: 80px;
        right: 20px;
        background: rgba(16, 185, 129, 0.95);
        color: white;
        padding: 12px 20px;
        border-radius: 10px;
        font-family: 'Inter', sans-serif;
        font-size: 14px;
        font-weight: 600;
        z-index: 2147483647;
        box-shadow: 0 4px 16px rgba(0,0,0,0.4);
        animation: slideInRight 0.3s ease-out;
      `;
      document.body.appendChild(toast);
      
      const style = document.createElement('style');
      style.textContent = `
        @keyframes slideInRight {
          from { opacity: 0; transform: translateX(100px); }
          to { opacity: 1; transform: translateX(0); }
        }
        @keyframes slideOutRight {
          from { opacity: 1; transform: translateX(0); }
          to { opacity: 0; transform: translateX(100px); }
        }
      `;
      document.head.appendChild(style);
    }
    
    toast.textContent = `✅ "${this.word}" salvo no dashboard!`;
    toast.style.display = 'block';
    toast.style.animation = 'slideInRight 0.3s ease-out';
    
    setTimeout(() => {
      toast.style.animation = 'slideOutRight 0.3s ease-out';
      setTimeout(() => toast.style.display = 'none', 300);
    }, 3000);
  }

  async _toggleKnown() {
    const q=s=>this._q(s);
    const btn=q('#fknown');
    const BASE=chrome.runtime.getURL('utils/');
    const {db}=await import(BASE+'db.js');
    const lang=this.engine?.sourceLang||'en';
    const isKnown=await db.isKnown(this.word,lang);
    if(!isKnown){
      await db.markAsKnown(this.word,lang);
      this.engine?.markWordKnown(this.word);
      btn.textContent='✅ Conhecida!';
      btn.style.background='rgba(74,222,128,.18)';
    } else {
      this.engine?.knownWords?.delete(this.word.toLowerCase());
      btn.textContent='✓ Já Conheço';
      btn.style.background='rgba(74,222,128,.08)';
    }
  }

  async _loadDecks(){
    const BASE=chrome.runtime.getURL('utils/');
    const {db}=await import(BASE+'db.js');
    const decks=await db.getSetting('decks')||['Default'];
    this.decks=decks;
    this._renderDecks();
  }
  _renderDecks(){const s=this._q('#fdeck');if(!s)return;s.innerHTML=this.decks.map(d=>`<option value="${d}">${d==='Default'?'📚 Default':d}</option>`).join('');s.value=this.activeDeck;}

  _translate(t){return new Promise(res=>{chrome.runtime.sendMessage({action:'translate',text:t,from:this.engine?.sourceLang||'en',to:this.engine?.targetLang||'pt'},r=>{if(chrome.runtime.lastError){res(null);return;}res(r?.translation||null);});});}
  _dict(w){return new Promise(res=>{chrome.runtime.sendMessage({action:'dictionary',word:w},r=>{if(chrome.runtime.lastError||!r?.ok){res({});return;}res(r.data||{});});});}

  async _explainContext(word, sentence) {
    const q=s=>this._q(s);
    const el=q('#fctxt');
    const container=q('#fctx');
    
    // Gera explicação contextual rápida
    el.textContent='Analisando contexto…';
    container.style.display='';
    
    try {
      const prompt = `Palavra: "${word}"\nFrase: "${sentence}"\n\nEm 1-2 linhas curtas, explique o que "${word}" significa NESTA frase específica. Seja direto e prático.`;
      
      const response = await new Promise(resolve => {
        chrome.runtime.sendMessage({
          action: 'ai_quick_context',
          word: word,
          sentence: sentence
        }, resolve);
      });
      
      if (response?.explanation) {
        el.innerHTML = response.explanation.replace(/\n/g, '<br>');
      } else {
        // Fallback: explicação simples baseada na tradução
        const translation = await this._translate(word);
        const sentenceTranslation = await this._translate(sentence);
        el.innerHTML = `A palavra <b style="color:#7dd3fc">"${word}"</b> nesta frase significa <b style="color:#4ade80">"${translation}"</b>.<br><br><span style="color:#64748b;font-size:11px;font-style:italic;">→ ${sentenceTranslation}</span>`;
      }
    } catch (e) {
      console.error('[WordPopup] Erro ao gerar contexto:', e);
      container.style.display='none';
    }
  }

  async _loadReverso() {
    const q=s=>this._q(s);
    const btn=q('#frevbtn');
    const container=q('#frev');
    
    btn.textContent='🔄 Carregando…';
    btn.disabled=true;
    
    try {
      const response = await new Promise(resolve => {
        chrome.runtime.sendMessage({
          type: 'FETCH_REVERSO',
          word: this.word,
          srcLang: 'en',
          dstLang: 'pt'
        }, resolve);
      });
      
      if (response?.success && response.list?.length > 0) {
        const examples = response.list.slice(0, 10);
        const hl = (text, word) => text.replace(new RegExp(`\\b(${word})\\b`, 'gi'), '<b style="color:#7dd3fc">$1</b>');
        
        container.innerHTML = examples.map(ex => `
          <div style="background:rgba(255,255,255,.03);border:1px solid rgba(255,255,255,.07);border-radius:10px;padding:10px 12px;margin-bottom:8px;">
            <div style="font-size:12px;color:#e2e8f0;line-height:1.6;margin-bottom:4px;">${hl(ex.en, this.word)}</div>
            <div style="font-size:11px;color:#7dd3fc;font-style:italic;line-height:1.5;">→ ${ex.pt}</div>
          </div>
        `).join('');
        container.style.display='';
        btn.textContent='✓ Exemplos Carregados';
        btn.style.background='rgba(16,185,129,.15)';
        btn.style.color='#4ade80';
      } else {
        container.innerHTML='<div style="text-align:center;color:#475569;font-size:12px;padding:12px;">Nenhum exemplo encontrado no Reverso.</div>';
        container.style.display='';
        btn.textContent='🔄 Reverso Context';
        btn.disabled=false;
      }
    } catch (e) {
      console.error('[WordPopup] Erro ao carregar Reverso:', e);
      container.innerHTML='<div style="text-align:center;color:#f87171;font-size:12px;padding:12px;">⚠️ Erro ao carregar exemplos.</div>';
      container.style.display='';
      btn.textContent='🔄 Reverso Context';
      btn.disabled=false;
    }
  }

  _phrasals(word) {
    // Agora carregado dinamicamente no _buildGrammar para manter o arquivo principal leve.
    return [];
  }

  _posDetail(pos,w){const m={noun:`<b style="color:#7dd3fc">Substantivo</b> — Pessoa, lugar, coisa ou ideia.<br>• Artigo: <span style="color:#7dd3fc">a/an/the ${w}</span><br>• Plural: <span style="color:#7dd3fc">${w}s</span> • Possessivo: <span style="color:#7dd3fc">${w}'s</span>`,verb:`<b style="color:#4ade80">Verbo</b> — Ação ou estado.<br>• Base: <span style="color:#4ade80">${w}</span> • 3ª pessoa: <span style="color:#4ade80">${w}s</span><br>• Gerúndio: <span style="color:#4ade80">${w}ing</span> • Passado: <span style="color:#4ade80">${w}ed</span><br>• Passiva: <span style="color:#4ade80">be/was ${w}ed</span>`,adjective:`<b style="color:#fbbf24">Adjetivo</b> — Descreve substantivos.<br>• Antes do noun: <span style="color:#fbbf24">${w} + noun</span><br>• Após linking verb: <span style="color:#fbbf24">be/seem/look + ${w}</span><br>• Comparativo: <span style="color:#fbbf24">more ${w}</span> • Superlativo: <span style="color:#fbbf24">most ${w}</span>`,adverb:`<b style="color:#f472b6">Advérbio</b> — Modifica verbos, adjetivos ou advérbios.<br>• Geralmente termina em <b>-ly</b><br>• Ex: very, quite, rather, too + <span style="color:#f472b6">${w}</span>`,preposition:`<b style="color:#a78bfa">Preposição</b> — Relação entre elementos.<br>• Lugar: in, on, at, under, over<br>• Tempo: at, on, in, before, after<br>• Movimento: to, from, into, through`};return m[pos?.toLowerCase()]||`<span style="color:#64748b">Clique "Analisar com IA" para análise detalhada da classe gramatical desta palavra.</span>`;}

  _patterns(pos,w){const m={verb:`• <b>S + ${w} + O</b> (transitivo)<br>• <b>S + ${w} + to-inf.</b> (ex: want to ${w})<br>• <b>S + ${w} + -ing</b> (ex: enjoy ${w}ing)<br>• <b>S + ${w} + that clause</b>`,noun:`• <b>the/a/an + ${w}</b><br>• <b>adj + ${w}</b> (ex: big/small ${w})<br>• <b>${w} + of + sth</b><br>• <b>compound: ${w}+noun</b>`,adjective:`• <b>${w} + noun</b> (atributivo)<br>• <b>be/seem/look/feel/sound + ${w}</b><br>• <b>too + ${w} / ${w} + enough</b><br>• <b>very/quite/rather/extremely + ${w}</b>`};return m[pos?.toLowerCase()]||`<span style="color:#64748b">Use "Analisar com IA" para ver padrões específicos desta palavra.</span>`;}

  _findPlayerContainer() {
    const selectors = {
      'youtube': ['#movie_player', '.html5-video-player', '#ytd-player'],
      'netflix': ['.watch-video', '.NFPlayer', '#netflix-player'],
      'max': ['[data-testid="player-container"]', '[class*="PlayerContainer"]', '#hbo-max-player-container'],
      'disney': ['.btm-media-clients', '#disney-player-container'],
      'prime': ['.rendererContainer', '#dv-web-player']
    };
    const platformSelectors = selectors[this.platform] || [];
    for (const sel of platformSelectors) {
      const el = document.querySelector(sel);
      if (el && el.offsetHeight > 100) {
        const pos = window.getComputedStyle(el).position;
        if (pos === 'static') el.style.position = 'relative';
        return el;
      }
    }
    const video = document.querySelector('video');
    if (video) {
      let parent = video.parentElement;
      let attempts = 0;
      while (parent && attempts < 8) {
        const rect = parent.getBoundingClientRect();
        const style = window.getComputedStyle(parent);
        if (rect.width > 400 && rect.height > 300 && style.display !== 'contents') {
          if (style.position === 'static') parent.style.position = 'relative';
          return parent;
        }
        parent = parent.parentElement;
        attempts++;
      }
    }
    return null;
  }

  _position(rect) {
    const player = this._findPlayerContainer();
    const isFixed = player === document.body;
    const playerRect = player.getBoundingClientRect();
    
    const W = Math.min(420, playerRect.width * 0.95);
    
    this.popup.style.width = W + 'px';
    this.popup.style.height = 'auto'; // Altura dinâmica
    this.popup.style.maxHeight = '85vh'; // Previne estourar tela
    this.popup.style.position = isFixed ? 'fixed' : 'absolute';

    const actualH = this.popup.offsetHeight;
    let left, top;
    
    if (rect) {
      const scrollX = isFixed ? 0 : player.scrollLeft;
      const scrollY = isFixed ? 0 : player.scrollTop;
      
      // Centraliza horizontalmente no player
      left = (playerRect.width - W) / 2;
      
      // Posiciona imediatamente ACIMA da palavra (rect)
      top = (rect.top - playerRect.top) + scrollY - actualH - 15;

      // Se estourar para cima, coloca embaixo da palavra
      if (top < scrollY + 10) {
        top = (rect.bottom - playerRect.top) + scrollY + 15;
      }
      
      // Se embaixo também estourar (player pequeno), centraliza verticalmente
      if (top + actualH > scrollY + playerRect.height) {
         top = scrollY + (playerRect.height - actualH) / 2;
      }
      
    } else {
      left = (playerRect.width - W) / 2;
      top = (playerRect.height - actualH) / 2;
    }

    this.popup.style.left = left + 'px';
    this.popup.style.top = top + 'px';
  }

  hide(resumeVideo = false) {
    if (!this.popup || this.popup.style.display === 'none') return;
    
    this.popup.style.opacity = '0';
    this.popup.style.transform = 'translateY(10px) scale(0.95)';
    
    if (resumeVideo && (this._wasPlayingBefore || this.engine?._wasPausedByHover) && this.engine?.videoElement) {
        this.engine.videoElement.play();
        this._wasPlayingBefore = false;
        if (this.engine) this.engine._wasPausedByHover = false;
    }

    if (this._hideTimeout) clearTimeout(this._hideTimeout);
    this._hideTimeout = setTimeout(() => {
      this.popup.style.display = 'none';
      this._hideTimeout = null;
    }, 200);
  }
  async _ai() {
    const q=s=>this._q(s);
    const btn=q('#fai');
    const resEl=q('#fair');
    if (btn.disabled) return;
    btn.innerHTML='<span class="lfp-spin"></span> Analisando…';
    btn.disabled=true;
    resEl.style.display='block';
    resEl.innerHTML='<div style="padding:10px;text-align:center;"><span class="lfp-spin"></span> A IA está processando uma explicação detalhada...</div>';
    try {
      const response = await new Promise(resolve => {
        chrome.runtime.sendMessage({
          action: 'ai_explain_word',
          word: this.word,
          context: this.context,
          fullContext: this.currentCue?.fullContext || null
        }, resolve);
      });
      if (response?.explanation) {
        q('#fair-container').style.display = 'block';
        resEl.innerHTML = this._formatAI(response.explanation);

        // Tenta extrair o nível CEFR (A1-C2)
        const cefrMatch = response.explanation.match(/Nível Sugerido \(CEFR\):\s*(A1|A2|B1|B2|C1|C2)/i);
        if (cefrMatch) {
            const level = cefrMatch[1].toUpperCase();
            this.activeLevel = level;
            // Se já estiver salva, atualiza o nível no banco
            const BASE=chrome.runtime.getURL('utils/');
            const {db}=await import(BASE+'db.js');
            db.getWord(this.word, this.engine?.sourceLang||'en').then(saved => {
                if (saved) {
                    saved.level = level;
                    db.saveWord(saved);
                }
            });
        }
      } else {
        resEl.innerHTML = `<div style="color:#f87171;padding:10px;">⚠️ <b>Falha na IA</b><br>${response?.error || 'Não foi possível obter resposta. Verifique sua chave API no Dashboard.'}</div>`;
      }
    } catch (e) {
      resEl.innerHTML='<div style="color:#f87171;padding:10px;">⚠️ Erro de conexão com o servidor de IA.</div>';
    } finally {
      btn.textContent='✦ Explicar Palavra';
      btn.disabled=false;
    }

    // Logic for Copy Popup
    q('#fcopy-ai').onclick = () => {
        const text = resEl.textContent;
        navigator.clipboard.writeText(text);
        const copyBtn = q('#fcopy-ai');
        copyBtn.textContent = '✅ Copiado';
        setTimeout(() => copyBtn.textContent = '📋 Copiar', 2000);
    };
  }

  async _aiSentence() {
    const q=s=>this._q(s);
    const btn=q('#faisent');
    const resEl=q('#fair');
    if (!this.context) return alert('Frase de contexto não encontrada.');
    if (btn.disabled) return;
    btn.innerHTML='<span class="lfp-spin" style="border-top-color:#fbbf24"></span> Analisando frase…';
    btn.disabled=true;
    q('#fair-container').style.display='block';
    resEl.innerHTML='<div style="padding:10px;text-align:center;"><span class="lfp-spin" style="border-top-color:#fbbf24"></span> Desconstruindo a frase com IA...</div>';
    try {
      const response = await new Promise((resolve, reject) => {
        chrome.runtime.sendMessage({
          action: 'ai_explain_sentence',
          sentence: this.context,
          fullContext: this.currentCue?.fullContext || null // Passa o diálogo ao redor
        }, (res) => {
          if (chrome.runtime.lastError) {
            reject(chrome.runtime.lastError);
          } else {
            resolve(res);
          }
        });
      });
      
      if (response?.analysis) {
        resEl.innerHTML = this._formatAI(response.analysis);
      } else {
        resEl.innerHTML = `<div style="color:#f87171;padding:10px;">⚠️ <b>Erro na Análise</b><br>${response?.error || 'A IA não conseguiu processar esta frase.'}</div>`;
      }
    } catch (e) {
      console.error('[LinguaFlow] Erro ao analisar frase:', e);
      resEl.innerHTML = '<div style="color:#f87171;padding:10px;">⚠️ Falha na comunicação com o Service Worker.</div>';
    } finally {
      btn.textContent = '🔍 Analisar Frase Completa';
      btn.disabled = false;
    }

    q('#fcopy-ai').onclick = () => {
        const text = resEl.textContent;
        navigator.clipboard.writeText(text);
        const copyBtn = q('#fcopy-ai');
        copyBtn.textContent = '✅ Copiado';
        setTimeout(() => copyBtn.textContent = '📋 Copiar', 2000);
    };
  }

  async _aiGrammar() {
    const q=s=>this._q(s);
    const btn=q('#fgbtn');
    const resEl=q('#fgb');
    if (btn.disabled) return;
    btn.innerHTML='<span class="lfp-spin"></span> Analisando…';
    btn.disabled=true;
    resEl.innerHTML='<div style="text-align:center;padding:20px;color:#a78bfa;"><span class="lfp-spin"></span> Mapeando estruturas gramaticais...</div>';
    

    try {
      const response = await new Promise(resolve => {
        chrome.runtime.sendMessage({
          action: 'ai_analyze_sentence',
          sentence: this.context || this.word
        }, resolve);
      });
      if (response?.analysis) {
        resEl.className = 'ai-res';
        resEl.style.cssText = 'font-size:13px;color:#e2e8f0;line-height:1.6;padding:10px;background:rgba(255,255,255,0.03);border-radius:10px;position:relative;';
        const formatted = this._formatAI(response.analysis);
        resEl.innerHTML = `
          <div id="fgb-text" style="max-height:300px;overflow-y:auto;padding-right:5px;">${formatted}</div>
          <button id="fcopy-gram" style="position:absolute;top:5px;right:5px;background:rgba(255,255,255,0.1);border:none;border-radius:6px;color:#fff;padding:3px 6px;font-size:9px;cursor:pointer;z-index:10;">📋 Copiar</button>
        `;
        
        q('#fcopy-gram').onclick = (e) => {
            e.stopPropagation();
            navigator.clipboard.writeText(response.analysis);
            q('#fcopy-gram').textContent = '✅';
            setTimeout(() => q('#fcopy-gram').textContent = '📋', 2000);
        };
      } else {
        resEl.innerHTML=`<div style="color:#f87171;padding:10px;">⚠️ <b>Falha na Gramática</b><br>${response?.error || 'Não foi possível gerar análise.'}</div>`;
      }
    } catch (e) {
      resEl.innerHTML='<div style="color:#f87171;padding:10px;">⚠️ Erro na consulta de gramática.</div>';
    } finally {
      btn.textContent='✦ Analisar com IA';
      btn.disabled=false;
    }
  }

  _formatAI(text) {
    if (!text) return '';
    return text
      .replace(/\*\*(.*?)\*\*/g, '<b style="color:#7dd3fc">$1</b>') // Negrito
      .replace(/\*(.*?)\*/g, '<i style="color:#94a3b8">$1</i>')      // Itálico
      .replace(/\n/g, '<br>');                                      // Quebras de linha
  }
  
  // O hide original com animação está na linha ~734
}
