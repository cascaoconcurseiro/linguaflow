// dashboard/js/ui/settingsView.js
import { db as lfDb } from '../../../utils/db.js';

export async function renderSettings(container, app) {
  // Carrega API key salva
  let savedApiKey = '';
  try {
    const stored = await chrome.storage.local.get(['aiApiKey']);
    savedApiKey = stored?.aiApiKey || '';
  } catch(e) {}
  const savedCefr = (await lfDb.getSetting('lf_cefr_level')) || '';
  const savedTtsLang = (await lfDb.getSetting('lf_tts_lang')) || 'en-US';
  const savedTtsSpeed = (await lfDb.getSetting('lf_tts_speed')) || 'normal';
  
  const srsMinInt = (await lfDb.getSetting('lf_srs_min_interval')) || '1';
  const srsEase = (await lfDb.getSetting('lf_srs_ease')) || '2.5';
  const srsPenalty = (await lfDb.getSetting('lf_srs_penalty')) || '0.2';
  const srsSuspend = (await lfDb.getSetting('lf_srs_suspend')) || '8';

  container.innerHTML = `
    <div style="padding: 40px; max-width: 800px; margin: 0 auto; padding-bottom:100px;">
      <h1 style="font-size: 32px; color: var(--color-text); margin-bottom: 8px;">Configurações do Cofre</h1>
      <p style="color:var(--color-text-light); margin-bottom: 32px;">Personalize seu aprendizado com as opções avançadas do sistema LinguaFlow (Inspirado no Anki V3).</p>

      <!-- CEFR Level Selector -->
      <div style="background: var(--color-surface); border-radius: var(--radius-md); padding: 24px; border: 2px solid var(--color-border); margin-bottom: 24px;">
        <h2 style="font-size: 20px; color: var(--color-text); margin-bottom: 8px; border-bottom: 1px solid var(--color-border); padding-bottom:8px;">Meu Nível CEFR</h2>
        <p style="color:var(--color-text-light); margin-bottom:16px; font-size:14px;">Declare seu nível atual para calibrar sua Jornada Fluente. Referência: Cambridge English Scale.</p>
        <div id="cefr-selector" style="display:flex; gap:10px; flex-wrap:wrap;">
          <button class="cefr-btn lf-btn-bounce" data-level="A1" style="flex:1; min-width:80px; padding:12px 8px; border-radius:var(--radius-sm); border:2px solid var(--color-border); background:var(--color-surface); color:var(--color-text); font-family:var(--font-main); font-weight:800; font-size:16px; cursor:pointer; transition:all 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275);">A1<br><span style="font-size:11px; font-weight:600; color:var(--color-text-light);">Iniciante</span></button>
          <button class="cefr-btn lf-btn-bounce" data-level="A2" style="flex:1; min-width:80px; padding:12px 8px; border-radius:var(--radius-sm); border:2px solid var(--color-border); background:var(--color-surface); color:var(--color-text); font-family:var(--font-main); font-weight:800; font-size:16px; cursor:pointer; transition:all 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275);">A2<br><span style="font-size:11px; font-weight:600; color:var(--color-text-light);">Básico</span></button>
          <button class="cefr-btn lf-btn-bounce" data-level="B1" style="flex:1; min-width:80px; padding:12px 8px; border-radius:var(--radius-sm); border:2px solid var(--color-border); background:var(--color-surface); color:var(--color-text); font-family:var(--font-main); font-weight:800; font-size:16px; cursor:pointer; transition:all 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275);">B1<br><span style="font-size:11px; font-weight:600; color:var(--color-text-light);">Intermediário</span></button>
          <button class="cefr-btn lf-btn-bounce" data-level="B2" style="flex:1; min-width:80px; padding:12px 8px; border-radius:var(--radius-sm); border:2px solid var(--color-border); background:var(--color-surface); color:var(--color-text); font-family:var(--font-main); font-weight:800; font-size:16px; cursor:pointer; transition:all 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275);">B2<br><span style="font-size:11px; font-weight:600; color:var(--color-text-light);">Fluente Base</span></button>
          <button class="cefr-btn lf-btn-bounce" data-level="C1" style="flex:1; min-width:80px; padding:12px 8px; border-radius:var(--radius-sm); border:2px solid var(--color-border); background:var(--color-surface); color:var(--color-text); font-family:var(--font-main); font-weight:800; font-size:16px; cursor:pointer; transition:all 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275);">C1<br><span style="font-size:11px; font-weight:600; color:var(--color-text-light);">Avançado</span></button>
          <button class="cefr-btn lf-btn-bounce" data-level="C2" style="flex:1; min-width:80px; padding:12px 8px; border-radius:var(--radius-sm); border:2px solid var(--color-border); background:var(--color-surface); color:var(--color-text); font-family:var(--font-main); font-weight:800; font-size:16px; cursor:pointer; transition:all 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275);">C2<br><span style="font-size:11px; font-weight:600; color:var(--color-text-light);">Maestria</span></button>
        </div>
      </div>

      <!-- Daily Limits -->
      <div style="background: var(--color-surface); border-radius: var(--radius-md); padding: 24px; border: 2px solid var(--color-border); margin-bottom: 24px;">
        <h2 style="font-size: 20px; color: var(--color-text); margin-bottom: 16px; border-bottom: 1px solid var(--color-border); padding-bottom:8px;">Limites Diários</h2>
        <div style="display:flex; gap: 24px; margin-bottom: 16px;">
          <div style="flex:1;">
            <label style="font-weight:bold; color:var(--color-text); display:block; margin-bottom:8px;">Novas cartas/dia</label>
            <input type="number" value="20" style="width:100%; padding:12px; border:2px solid var(--color-border); border-radius:6px; background:var(--color-bg-alt); color:var(--color-text);">
          </div>
          <div style="flex:1;">
            <label style="font-weight:bold; color:var(--color-text); display:block; margin-bottom:8px;">Revisões máximas/dia</label>
            <input type="number" value="200" style="width:100%; padding:12px; border:2px solid var(--color-border); border-radius:6px; background:var(--color-bg-alt); color:var(--color-text);">
          </div>
        </div>
      </div>

      <!-- Advanced FSRS Section -->
      <div style="background: var(--color-surface); border-radius: var(--radius-md); padding: 24px; border: 2px solid var(--color-border); margin-bottom: 24px;">
        <h2 style="font-size: 20px; color: var(--color-text); margin-bottom: 16px; border-bottom: 1px solid var(--color-border); padding-bottom:8px;">Motor de Memória (FSRS v4)</h2>
        <p style="color: var(--color-text-light); margin-bottom: 16px; line-height:1.5;">
          Otimizador de repetição espaçada. Substitui os multiplicadores fixos do Anki por um modelo de probabilidade de retenção de memória.
        </p>
        
        <label style="font-weight:bold; color:var(--color-text); display:block; margin-bottom:8px;">Retenção Desejada (Recomendado: 90%): <span id="retention-val" style="color:var(--color-primary);">90%</span></label>
        <input type="range" id="retention-slider" min="80" max="99" value="90" style="width:100%; margin-bottom: 16px;">
        
        <label style="font-weight:bold; color:var(--color-text); display:block; margin-bottom:8px;">Passos de Aprendizagem (minutos)</label>
        <input type="text" value="1m 10m" style="width:100%; padding:12px; border:2px solid var(--color-border); border-radius:6px; margin-bottom:16px; background:var(--color-bg-alt); color:var(--color-text);">
        <p style="font-size:12px; color:var(--color-text-light);">Ex: "1m 10m" significa ver a carta em 1 min e depois 10 min antes de graduar.</p>
      </div>

      <!-- Advanced SRS -->
      <div style="background: var(--color-surface); border-radius: var(--radius-md); padding: 24px; border: 2px solid var(--color-border); margin-bottom: 24px;">
        <h2 style="font-size: 20px; color: var(--color-text); margin-bottom: 16px; border-bottom: 1px solid var(--color-border); padding-bottom:8px;">SRS Avançado (Nível Anki)</h2>
        <div style="display:flex; gap:16px; flex-wrap:wrap;">
          <div style="flex:1; min-width:180px;">
            <label style="font-weight:bold; color:var(--color-text); display:block; margin-bottom:8px; font-size:14px;">Intervalo mínimo após graduação</label>
            <input type="number" id="srs-min-interval" value="${srsMinInt}" min="1" max="30" style="width:100%; padding:10px; border:2px solid var(--color-border); border-radius:6px; font-family:var(--font-main); background:var(--color-bg-alt); color:var(--color-text);"> <span style="font-size:12px; color:var(--color-text-light);">dias</span>
          </div>
          <div style="flex:1; min-width:180px;">
            <label style="font-weight:bold; color:var(--color-text); display:block; margin-bottom:8px; font-size:14px;">Ease factor inicial</label>
            <input type="number" id="srs-ease" value="${srsEase}" min="1.3" max="4.0" step="0.1" style="width:100%; padding:10px; border:2px solid var(--color-border); border-radius:6px; font-family:var(--font-main); background:var(--color-bg-alt); color:var(--color-text);">
          </div>
          <div style="flex:1; min-width:180px;">
            <label style="font-weight:bold; color:var(--color-text); display:block; margin-bottom:8px; font-size:14px;">Penalidade por lapso</label>
            <input type="number" id="srs-lapse-penalty" value="${srsPenalty}" min="0" max="1" step="0.05" style="width:100%; padding:10px; border:2px solid var(--color-border); border-radius:6px; font-family:var(--font-main); background:var(--color-bg-alt); color:var(--color-text);">
          </div>
          <div style="flex:1; min-width:180px;">
            <label style="font-weight:bold; color:var(--color-text); display:block; margin-bottom:8px; font-size:14px;">Suspender após N erros</label>
            <input type="number" id="srs-suspend" value="${srsSuspend}" min="1" max="50" style="width:100%; padding:10px; border:2px solid var(--color-border); border-radius:6px; font-family:var(--font-main); background:var(--color-bg-alt); color:var(--color-text);">
          </div>
        </div>
      </div>

      <!-- Audio Options -->
      <div style="background: var(--color-surface); border-radius: var(--radius-md); padding: 24px; border: 2px solid var(--color-border); margin-bottom: 24px;">
        <h2 style="font-size: 20px; color: var(--color-text); margin-bottom: 16px; border-bottom: 1px solid var(--color-border); padding-bottom:8px;">Opções de Áudio (TTS Google Neural)</h2>
        <div style="display:flex; flex-direction:column; gap: 16px;">
          <label style="display:flex; align-items:center; gap:8px;">
            <input type="checkbox" id="audio-auto-front" checked style="width:18px; height:18px;"> Reproduzir áudio automaticamente na Frente
          </label>
          <label style="display:flex; align-items:center; gap:8px;">
            <input type="checkbox" id="audio-auto-back" checked style="width:18px; height:18px;"> Reproduzir áudio automaticamente no Verso
          </label>
          <div style="display:flex; gap:16px; flex-wrap:wrap; margin-top:8px;">
            <div style="flex:1; min-width:200px;">
              <label style="font-weight:bold; color:var(--color-text); display:block; margin-bottom:8px; font-size:14px;">Sotaque</label>
              <div id="tts-lang-selector" style="display:flex; gap:8px;">
                <button class="tts-opt-btn" data-lang="en-US" style="flex:1; padding:10px; border-radius:var(--radius-sm); border:2px solid var(--color-primary); background:rgba(88,204,2,0.1); font-family:var(--font-main); font-weight:800; cursor:pointer; color:var(--color-text);">🇺🇸 Americano</button>
                <button class="tts-opt-btn" data-lang="en-GB" style="flex:1; padding:10px; border-radius:var(--radius-sm); border:2px solid var(--color-border); background:var(--color-surface); font-family:var(--font-main); font-weight:700; cursor:pointer; color:var(--color-text-light);">🇬🇧 Britânico</button>
              </div>
            </div>
            <div style="flex:1; min-width:200px;">
              <label style="font-weight:bold; color:var(--color-text); display:block; margin-bottom:8px; font-size:14px;">Velocidade</label>
              <div id="tts-speed-selector" style="display:flex; gap:8px;">
                <button class="tts-speed-btn" data-speed="slow" style="flex:1; padding:10px; border-radius:var(--radius-sm); border:2px solid var(--color-border); background:var(--color-surface); font-family:var(--font-main); font-weight:700; cursor:pointer; color:var(--color-text-light); font-size:13px;">🐢 Lento</button>
                <button class="tts-speed-btn" data-speed="normal" style="flex:1; padding:10px; border-radius:var(--radius-sm); border:2px solid var(--color-primary); background:rgba(88,204,2,0.1); font-family:var(--font-main); font-weight:800; cursor:pointer; font-size:13px; color:var(--color-text);">👌 Normal</button>
                <button class="tts-speed-btn" data-speed="native" style="flex:1; padding:10px; border-radius:var(--radius-sm); border:2px solid var(--color-border); background:var(--color-surface); font-family:var(--font-main); font-weight:700; cursor:pointer; color:var(--color-text-light); font-size:13px;">🚀 Nativo</button>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- AI / DeepSeek API Key -->
      <div style="background: var(--color-surface); border-radius: var(--radius-md); padding: 24px; border: 2px solid var(--color-border); margin-bottom: 24px;">
        <h2 style="font-size: 20px; color: var(--color-text); margin-bottom: 8px; border-bottom: 1px solid var(--color-border); padding-bottom:8px;">🤖 Inteligência Artificial (DeepSeek)</h2>
        <p style="color:var(--color-text-light); margin-bottom:16px; font-size:14px;">Insira sua chave de API do DeepSeek para ativar a geração de histórias, explicações e chunking automático. Obtenha em <a href="https://platform.deepseek.com" target="_blank" style="color:var(--color-primary);">platform.deepseek.com</a>.</p>
        <div style="display:flex; gap:10px; align-items:center;">
          <input type="password" id="ai-api-key-input" placeholder="sk-..." value="${savedApiKey}" style="flex:1; padding:12px 16px; border:2px solid var(--color-border); border-radius:var(--radius-sm); font-family:var(--font-main); font-size:14px; background:var(--color-bg-alt); color:var(--color-text);">
          <button id="btn-toggle-key" style="padding:12px 14px; border:2px solid var(--color-border); border-radius:var(--radius-sm); background:var(--color-surface); color:var(--color-text); cursor:pointer; font-size:16px;" title="Mostrar/ocultar">👁️</button>
        </div>
        <p id="api-key-status" style="font-size:12px; margin-top:8px; color:${savedApiKey ? '#58cc02' : '#afafaf'};">${ savedApiKey ? '✅ Chave configurada' : '⚠️ Nenhuma chave configurada'}</p>
        <button id="btn-save-api-key" class="btn btn-primary" style="margin-top:16px; width:100%;">Salvar Chave de API</button>
      </div>

      <!-- Export Section -->
      <div style="background: var(--color-surface); border-radius: var(--radius-md); padding: 24px; border: 2px solid var(--color-border); margin-bottom: 24px;">
        <h2 style="font-size: 20px; color: var(--color-text); margin-bottom: 16px; border-bottom: 1px solid var(--color-border); padding-bottom:8px;">Dados e Portabilidade</h2>
        <p style="color: var(--color-text-light); margin-bottom: 16px; line-height:1.5;">
          Você é dono dos seus dados. Baixe seu progresso para formato Anki ou CSV.
        </p>
        
        <div style="display: flex; gap: 16px;">
          <button id="btn-export-csv" class="btn btn-outline" style="flex:1;">
            📄 Exportar CSV
          </button>
          <button id="btn-export-anki" class="btn btn-secondary" style="flex:1;">
            📦 Exportar .apkg (Anki)
          </button>
        </div>
        <p id="export-msg" style="color: var(--color-primary); margin-top: 12px; font-weight:bold; display:none;">Exportação concluída!</p>
      </div>

      <!-- Account Section -->
      <div style="background: var(--color-surface); border-radius: var(--radius-md); padding: 24px; border: 2px solid var(--color-border); margin-bottom: 24px;">
        <h2 style="font-size: 20px; color: var(--color-danger); margin-bottom: 16px; border-bottom: 1px solid var(--color-border); padding-bottom:8px;">Conta</h2>
        <p style="color: var(--color-text-light); margin-bottom: 16px; line-height:1.5;">
          Gerencie sua sessão no aplicativo.
        </p>
        
        <button id="btn-logout" class="btn" style="background-color: var(--color-danger); border-bottom: 4px solid var(--color-danger-shadow); width: 100%;">
          🚪 Sair da Conta
        </button>
      </div>
      
      <div style="text-align:right;">
        <button id="btn-save" class="btn btn-primary" style="padding: 16px 32px; font-size: 16px;">Salvar Todas as Configurações</button>
      </div>
    </div>
  `;

  document.getElementById('retention-slider').addEventListener('input', function(e) {
    document.getElementById('retention-val').innerText = e.target.value + '%';
  });

  // CEFR selector
  const cefrBtns = document.querySelectorAll('.cefr-btn');
  cefrBtns.forEach(btn => {
    if (btn.dataset.level === savedCefr) {
      btn.style.background = 'var(--color-primary)';
      btn.style.color = 'white';
      btn.style.borderColor = 'var(--color-primary)';
    }
    btn.addEventListener('click', async () => {
      cefrBtns.forEach(b => { b.style.background='var(--color-surface)'; b.style.color='var(--color-text)'; b.style.borderColor='var(--color-border)'; });
      btn.style.background = 'var(--color-primary)';
      btn.style.color = 'white';
      btn.style.borderColor = 'var(--color-primary)';
      await lfDb.setSetting('lf_cefr_level', btn.dataset.level);
      // Espelha na chave usada pela extensão (coloração de palavras na legenda)
      lfDb.setSetting('cefrTargetLevel', btn.dataset.level).catch(() => {});
      app.showToast(`Nível ${btn.dataset.level} selecionado! A IA foi atualizada.`, 'success');
    });
  });

  // TTS Language selector
  document.querySelectorAll('.tts-opt-btn').forEach(btn => {
    if (btn.dataset.lang === savedTtsLang) {
      btn.style.borderColor = 'var(--color-primary)';
      btn.style.background = 'rgba(88,204,2,0.1)';
      btn.style.color = 'var(--color-text)';
      btn.style.fontWeight = '800';
    }
    btn.addEventListener('click', async () => {
      document.querySelectorAll('.tts-opt-btn').forEach(b => {
        b.style.borderColor = 'var(--color-border)';
        b.style.background = 'var(--color-surface)';
        b.style.color = 'var(--color-text-light)';
        b.style.fontWeight = '700';
      });
      btn.style.borderColor = 'var(--color-primary)';
      btn.style.background = 'rgba(88,204,2,0.1)';
      btn.style.color = 'var(--color-text)';
      btn.style.fontWeight = '800';
      await lfDb.setSetting('lf_tts_lang', btn.dataset.lang);
    });
  });

  // TTS Speed selector
  document.querySelectorAll('.tts-speed-btn').forEach(btn => {
    if (btn.dataset.speed === savedTtsSpeed) {
      btn.style.borderColor = 'var(--color-primary)';
      btn.style.background = 'rgba(88,204,2,0.1)';
      btn.style.color = 'var(--color-text)';
      btn.style.fontWeight = '800';
    }
    btn.addEventListener('click', async () => {
      document.querySelectorAll('.tts-speed-btn').forEach(b => {
        b.style.borderColor = 'var(--color-border)';
        b.style.background = 'var(--color-surface)';
        b.style.color = 'var(--color-text-light)';
        b.style.fontWeight = '700';
      });
      btn.style.borderColor = 'var(--color-primary)';
      btn.style.background = 'rgba(88,204,2,0.1)';
      btn.style.color = 'var(--color-text)';
      btn.style.fontWeight = '800';
      await lfDb.setSetting('lf_tts_speed', btn.dataset.speed);
    });
  });

  // API Key: toggle show/hide
  document.getElementById('btn-toggle-key').addEventListener('click', () => {
    const input = document.getElementById('ai-api-key-input');
    input.type = input.type === 'password' ? 'text' : 'password';
  });

  // API Key: salvar
  document.getElementById('btn-save-api-key').addEventListener('click', async () => {
    const btn = document.getElementById('btn-save-api-key');
    const key = document.getElementById('ai-api-key-input').value.trim();
    const statusEl = document.getElementById('api-key-status');
    btn.innerHTML = '<span class="lf-spin"></span> Salvando...';
    try {
      await chrome.storage.local.set({ aiApiKey: key });
      statusEl.textContent = key ? '✅ Chave configurada' : '⚠️ Nenhuma chave configurada';
      statusEl.style.color = key ? '#58cc02' : '#afafaf';
      app.showToast('Chave de API salva! A IA está pronta. 🚀', 'success');
    } catch(e) {
      app.showToast('Erro ao salvar a chave. Tente recarregar.', 'error');
    }
    setTimeout(() => btn.innerHTML = 'Salvar Chave de API', 600);
  });

  document.getElementById('btn-save').addEventListener('click', async () => {
    const btnSave = document.getElementById('btn-save');
    const originalText = btnSave.innerHTML;
    btnSave.innerHTML = '<span class="lf-spin"></span> Salvando...';
    
    const minInt = document.getElementById('srs-min-interval')?.value;
    const ease = document.getElementById('srs-ease')?.value;
    const penalty = document.getElementById('srs-lapse-penalty')?.value;
    const suspend = document.getElementById('srs-suspend')?.value;
    
    if (minInt) await lfDb.setSetting('lf_srs_min_interval', minInt);
    if (ease) await lfDb.setSetting('lf_srs_ease', ease);
    if (penalty) await lfDb.setSetting('lf_srs_penalty', penalty);
    if (suspend) await lfDb.setSetting('lf_srs_suspend', suspend);
    
    app.showToast('Configurações salvas com sucesso! ✅', 'success');
    setTimeout(() => btnSave.innerHTML = originalText, 500);
  });

  document.getElementById('btn-export-csv').addEventListener('click', async () => {
    try {
      const words = await lfDb.getAllWords();
      let csvContent = "data:text/csv;charset=utf-8,Word,Translation,Context\n";
      words.forEach(w => {
        csvContent += `"${w.word}","${w.translation}","${w.context}"\n`;
      });
      const encodedUri = encodeURI(csvContent);
      const link = document.createElement("a");
      link.setAttribute("href", encodedUri);
      link.setAttribute("download", "linguaflow_export.csv");
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      document.getElementById('export-msg').style.display = 'block';
      setTimeout(() => { document.getElementById('export-msg').style.display = 'none'; }, 3000);
    } catch(e) {
      console.error(e);
      alert("Erro ao exportar");
    }
  });

  document.getElementById('btn-export-anki').addEventListener('click', () => {
    alert("Para importar no Anki: Exporte como CSV acima e no Anki clique em 'Importar Arquivo'. A exportação nativa .apkg requer a ponte Python local que será liberada no próximo patch.");
  });

  const logoutBtn = document.getElementById('btn-logout');
  if (logoutBtn) {
    logoutBtn.addEventListener('click', () => {
      if (confirm('Tem certeza que deseja sair?')) {
        app.logout();
      }
    });
  }
}
