// dashboard/js/ui/settingsView.js
import { db as lfDb } from '../../../utils/db.js';

export function renderSettings(container, app) {
  container.innerHTML = `
    <div style="padding: 40px; max-width: 800px; margin: 0 auto; padding-bottom:100px;">
      <h1 style="font-size: 32px; color: var(--color-text); margin-bottom: 8px;">Configurações do Cofre</h1>
      <p style="color:var(--color-text-light); margin-bottom: 32px;">Personalize seu aprendizado com as opções avançadas do sistema LinguaFlow (Inspirado no Anki V3).</p>

      <!-- CEFR Level Selector -->
      <div style="background: white; border-radius: var(--radius-md); padding: 24px; border: 2px solid var(--color-border); margin-bottom: 24px;">
        <h2 style="font-size: 20px; color: var(--color-text); margin-bottom: 8px; border-bottom: 1px solid var(--color-border); padding-bottom:8px;">Meu Nível CEFR</h2>
        <p style="color:var(--color-text-light); margin-bottom:16px; font-size:14px;">Declare seu nível atual para calibrar sua Jornada Fluente. Referência: Cambridge English Scale.</p>
        <div id="cefr-selector" style="display:flex; gap:10px; flex-wrap:wrap;">
          <button class="cefr-btn" data-level="A1" style="flex:1; min-width:80px; padding:12px 8px; border-radius:var(--radius-sm); border:2px solid var(--color-border); background:white; font-family:var(--font-main); font-weight:800; font-size:16px; cursor:pointer; transition:all 0.2s;">A1<br><span style="font-size:11px; font-weight:600; color:var(--color-text-light);">Iniciante</span></button>
          <button class="cefr-btn" data-level="A2" style="flex:1; min-width:80px; padding:12px 8px; border-radius:var(--radius-sm); border:2px solid var(--color-border); background:white; font-family:var(--font-main); font-weight:800; font-size:16px; cursor:pointer; transition:all 0.2s;">A2<br><span style="font-size:11px; font-weight:600; color:var(--color-text-light);">Básico</span></button>
          <button class="cefr-btn" data-level="B1" style="flex:1; min-width:80px; padding:12px 8px; border-radius:var(--radius-sm); border:2px solid var(--color-border); background:white; font-family:var(--font-main); font-weight:800; font-size:16px; cursor:pointer; transition:all 0.2s;">B1<br><span style="font-size:11px; font-weight:600; color:var(--color-text-light);">Intermediário</span></button>
          <button class="cefr-btn" data-level="B2" style="flex:1; min-width:80px; padding:12px 8px; border-radius:var(--radius-sm); border:2px solid var(--color-border); background:white; font-family:var(--font-main); font-weight:800; font-size:16px; cursor:pointer; transition:all 0.2s;">B2<br><span style="font-size:11px; font-weight:600; color:var(--color-text-light);">Fluente Base</span></button>
          <button class="cefr-btn" data-level="C1" style="flex:1; min-width:80px; padding:12px 8px; border-radius:var(--radius-sm); border:2px solid var(--color-border); background:white; font-family:var(--font-main); font-weight:800; font-size:16px; cursor:pointer; transition:all 0.2s;">C1<br><span style="font-size:11px; font-weight:600; color:var(--color-text-light);">Avançado</span></button>
          <button class="cefr-btn" data-level="C2" style="flex:1; min-width:80px; padding:12px 8px; border-radius:var(--radius-sm); border:2px solid var(--color-border); background:white; font-family:var(--font-main); font-weight:800; font-size:16px; cursor:pointer; transition:all 0.2s;">C2<br><span style="font-size:11px; font-weight:600; color:var(--color-text-light);">Maestria</span></button>
        </div>
      </div>

      <!-- Daily Limits -->
      <div style="background: white; border-radius: var(--radius-md); padding: 24px; border: 2px solid var(--color-border); margin-bottom: 24px;">
        <h2 style="font-size: 20px; color: var(--color-text); margin-bottom: 16px; border-bottom: 1px solid var(--color-border); padding-bottom:8px;">Limites Diários</h2>
        <div style="display:flex; gap: 24px; margin-bottom: 16px;">
          <div style="flex:1;">
            <label style="font-weight:bold; color:var(--color-text); display:block; margin-bottom:8px;">Novas cartas/dia</label>
            <input type="number" value="20" style="width:100%; padding:12px; border:2px solid var(--color-border); border-radius:6px;">
          </div>
          <div style="flex:1;">
            <label style="font-weight:bold; color:var(--color-text); display:block; margin-bottom:8px;">Revisões máximas/dia</label>
            <input type="number" value="200" style="width:100%; padding:12px; border:2px solid var(--color-border); border-radius:6px;">
          </div>
        </div>
      </div>

      <!-- Advanced FSRS Section -->
      <div style="background: white; border-radius: var(--radius-md); padding: 24px; border: 2px solid var(--color-border); margin-bottom: 24px;">
        <h2 style="font-size: 20px; color: var(--color-text); margin-bottom: 16px; border-bottom: 1px solid var(--color-border); padding-bottom:8px;">Motor de Memória (FSRS v4)</h2>
        <p style="color: var(--color-text-light); margin-bottom: 16px; line-height:1.5;">
          Otimizador de repetição espaçada. Substitui os multiplicadores fixos do Anki por um modelo de probabilidade de retenção de memória.
        </p>
        
        <label style="font-weight:bold; color:var(--color-text); display:block; margin-bottom:8px;">Retenção Desejada (Recomendado: 90%): <span id="retention-val" style="color:var(--color-primary);">90%</span></label>
        <input type="range" id="retention-slider" min="80" max="99" value="90" style="width:100%; margin-bottom: 16px;">
        
        <label style="font-weight:bold; color:var(--color-text); display:block; margin-bottom:8px;">Passos de Aprendizagem (minutos)</label>
        <input type="text" value="1m 10m" style="width:100%; padding:12px; border:2px solid var(--color-border); border-radius:6px; margin-bottom:16px;">
        <p style="font-size:12px; color:var(--color-text-light);">Ex: "1m 10m" significa ver a carta em 1 min e depois 10 min antes de graduar.</p>
      </div>

      <!-- Advanced SRS -->
      <div style="background: white; border-radius: var(--radius-md); padding: 24px; border: 2px solid var(--color-border); margin-bottom: 24px;">
        <h2 style="font-size: 20px; color: var(--color-text); margin-bottom: 16px; border-bottom: 1px solid var(--color-border); padding-bottom:8px;">SRS Avançado (Nível Anki)</h2>
        <div style="display:flex; gap:16px; flex-wrap:wrap;">
          <div style="flex:1; min-width:180px;">
            <label style="font-weight:bold; color:var(--color-text); display:block; margin-bottom:8px; font-size:14px;">Intervalo mínimo após graduação</label>
            <input type="number" id="srs-min-interval" value="1" min="1" max="30" style="width:100%; padding:10px; border:2px solid var(--color-border); border-radius:6px; font-family:var(--font-main);"> <span style="font-size:12px; color:var(--color-text-light);">dias</span>
          </div>
          <div style="flex:1; min-width:180px;">
            <label style="font-weight:bold; color:var(--color-text); display:block; margin-bottom:8px; font-size:14px;">Ease factor inicial</label>
            <input type="number" id="srs-ease" value="2.5" min="1.3" max="4.0" step="0.1" style="width:100%; padding:10px; border:2px solid var(--color-border); border-radius:6px; font-family:var(--font-main);">
          </div>
          <div style="flex:1; min-width:180px;">
            <label style="font-weight:bold; color:var(--color-text); display:block; margin-bottom:8px; font-size:14px;">Penalidade por lapso</label>
            <input type="number" id="srs-lapse-penalty" value="0.2" min="0" max="1" step="0.05" style="width:100%; padding:10px; border:2px solid var(--color-border); border-radius:6px; font-family:var(--font-main);">
          </div>
          <div style="flex:1; min-width:180px;">
            <label style="font-weight:bold; color:var(--color-text); display:block; margin-bottom:8px; font-size:14px;">Suspender após N erros</label>
            <input type="number" id="srs-suspend" value="8" min="1" max="50" style="width:100%; padding:10px; border:2px solid var(--color-border); border-radius:6px; font-family:var(--font-main);">
          </div>
        </div>
      </div>

      <!-- Audio Options -->
      <div style="background: white; border-radius: var(--radius-md); padding: 24px; border: 2px solid var(--color-border); margin-bottom: 24px;">
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
                <button class="tts-opt-btn" data-lang="en-US" style="flex:1; padding:10px; border-radius:var(--radius-sm); border:2px solid var(--color-primary); background:rgba(88,204,2,0.1); font-family:var(--font-main); font-weight:800; cursor:pointer;">🇺🇸 Americano</button>
                <button class="tts-opt-btn" data-lang="en-GB" style="flex:1; padding:10px; border-radius:var(--radius-sm); border:2px solid var(--color-border); background:white; font-family:var(--font-main); font-weight:700; cursor:pointer; color:var(--color-text-light);">🇬🇧 Britânico</button>
              </div>
            </div>
            <div style="flex:1; min-width:200px;">
              <label style="font-weight:bold; color:var(--color-text); display:block; margin-bottom:8px; font-size:14px;">Velocidade</label>
              <div id="tts-speed-selector" style="display:flex; gap:8px;">
                <button class="tts-speed-btn" data-speed="slow" style="flex:1; padding:10px; border-radius:var(--radius-sm); border:2px solid var(--color-border); background:white; font-family:var(--font-main); font-weight:700; cursor:pointer; color:var(--color-text-light); font-size:13px;">🐢 Lento</button>
                <button class="tts-speed-btn" data-speed="normal" style="flex:1; padding:10px; border-radius:var(--radius-sm); border:2px solid var(--color-primary); background:rgba(88,204,2,0.1); font-family:var(--font-main); font-weight:800; cursor:pointer; font-size:13px;">👌 Normal</button>
                <button class="tts-speed-btn" data-speed="native" style="flex:1; padding:10px; border-radius:var(--radius-sm); border:2px solid var(--color-border); background:white; font-family:var(--font-main); font-weight:700; cursor:pointer; color:var(--color-text-light); font-size:13px;">🚀 Nativo</button>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Export Section -->
      <div style="background: white; border-radius: var(--radius-md); padding: 24px; border: 2px solid var(--color-border); margin-bottom: 24px;">
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
      <div style="background: white; border-radius: var(--radius-md); padding: 24px; border: 2px solid var(--color-border); margin-bottom: 24px;">
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
  const savedCefr = localStorage.getItem('lf_cefr_level') || '';
  cefrBtns.forEach(btn => {
    if (btn.dataset.level === savedCefr) {
      btn.style.background = 'var(--color-primary)';
      btn.style.color = 'white';
      btn.style.borderColor = 'var(--color-primary)';
    }
    btn.addEventListener('click', () => {
      cefrBtns.forEach(b => { b.style.background='white'; b.style.color='var(--color-text)'; b.style.borderColor='var(--color-border)'; });
      btn.style.background = 'var(--color-primary)';
      btn.style.color = 'white';
      btn.style.borderColor = 'var(--color-primary)';
      localStorage.setItem('lf_cefr_level', btn.dataset.level);
      app.showToast(`Nível ${btn.dataset.level} selecionado!`, 'success');
    });
  });

  // TTS Language selector
  document.querySelectorAll('.tts-opt-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.tts-opt-btn').forEach(b => {
        b.style.borderColor = 'var(--color-border)';
        b.style.background = 'white';
        b.style.color = 'var(--color-text-light)';
      });
      btn.style.borderColor = 'var(--color-primary)';
      btn.style.background = 'rgba(88,204,2,0.1)';
      btn.style.color = 'var(--color-text)';
      localStorage.setItem('lf_tts_lang', btn.dataset.lang);
    });
    // Highlight saved
    const saved = localStorage.getItem('lf_tts_lang') || 'en-US';
    if (btn.dataset.lang === saved) {
      btn.style.borderColor = 'var(--color-primary)';
      btn.style.background = 'rgba(88,204,2,0.1)';
      btn.style.color = 'var(--color-text)';
    }
  });

  // TTS Speed selector
  document.querySelectorAll('.tts-speed-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.tts-speed-btn').forEach(b => {
        b.style.borderColor = 'var(--color-border)';
        b.style.background = 'white';
        b.style.color = 'var(--color-text-light)';
      });
      btn.style.borderColor = 'var(--color-primary)';
      btn.style.background = 'rgba(88,204,2,0.1)';
      btn.style.color = 'var(--color-text)';
      localStorage.setItem('lf_tts_speed', btn.dataset.speed);
    });
    const savedSpeed = localStorage.getItem('lf_tts_speed') || 'normal';
    if (btn.dataset.speed === savedSpeed) {
      btn.style.borderColor = 'var(--color-primary)';
      btn.style.background = 'rgba(88,204,2,0.1)';
      btn.style.color = 'var(--color-text)';
    }
  });

  document.getElementById('btn-save').addEventListener('click', () => {
    const minInt = document.getElementById('srs-min-interval')?.value;
    const ease = document.getElementById('srs-ease')?.value;
    const penalty = document.getElementById('srs-lapse-penalty')?.value;
    const suspend = document.getElementById('srs-suspend')?.value;
    if (minInt) localStorage.setItem('lf_srs_min_interval', minInt);
    if (ease) localStorage.setItem('lf_srs_ease', ease);
    if (penalty) localStorage.setItem('lf_srs_penalty', penalty);
    if (suspend) localStorage.setItem('lf_srs_suspend', suspend);
    app.showToast('Configurações salvas com sucesso! ✅', 'success');
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
