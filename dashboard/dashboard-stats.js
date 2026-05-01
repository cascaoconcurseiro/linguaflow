// dashboard-stats.js - Stats de Imersão, Gamificação e Melhorias

async function loadImmersionStats() {
    try {
        const BASE = chrome.runtime.getURL('utils/');
        const { db } = await import(BASE + 'db.js');
        const stats = await db.getStats();
        
        // Stats de imersão
        document.getElementById('stat-today-mins').textContent = Math.floor(stats.todaySecs / 60);
        document.getElementById('stat-total-hours').textContent = Math.floor(stats.totalSecs / 3600);
        document.getElementById('stat-retention').textContent = `${stats.retention}%`;
        
        // Nível CEFR estimado (baseado na distribuição de palavras)
        const cefrLevel = estimateCEFRLevel(stats.byCEFR);
        document.getElementById('stat-cefr-level').textContent = cefrLevel;
        
        // Por plataforma
        const sessions = await db.getSessions(30);
        const byPlatform = {};
        sessions.forEach(s => {
            Object.entries(s.by_platform || {}).forEach(([platform, secs]) => {
                byPlatform[platform] = (byPlatform[platform] || 0) + secs;
            });
        });
        
        const platformStats = document.getElementById('platform-stats');
        platformStats.innerHTML = '';
        Object.entries(byPlatform).sort((a, b) => b[1] - a[1]).forEach(([platform, secs]) => {
            const mins = Math.floor(secs / 60);
            const hours = Math.floor(mins / 60);
            const displayMins = mins % 60;
            const timeStr = hours > 0 ? `${hours}h ${displayMins}m` : `${mins}m`;
            
            const pill = document.createElement('div');
            pill.style.cssText = 'background:rgba(56,189,248,0.1);border:1px solid rgba(56,189,248,0.2);border-radius:8px;padding:8px 12px;font-size:12px;color:#38BDF8;font-weight:600;';
            pill.textContent = `${platform}: ${timeStr}`;
            platformStats.appendChild(pill);
        });
        
        // Gráfico CEFR
        renderCEFRChart(stats.byCEFR);
        
        // Conquistas
        renderAchievements(stats);
        
    } catch (e) {
        console.error('[LinguaFlow] Erro ao carregar stats de imersão:', e);
    }
}

function estimateCEFRLevel(byCEFR) {
    const total = Object.values(byCEFR).reduce((a, b) => a + b, 0);
    if (total === 0) return '-';
    
    // Calcula média ponderada
    const weights = { A1: 1, A2: 2, B1: 3, B2: 4, C1: 5, C2: 6 };
    let sum = 0;
    Object.entries(byCEFR).forEach(([level, count]) => {
        sum += (weights[level] || 0) * count;
    });
    const avg = sum / total;
    
    // Mapeia para nível
    if (avg < 1.5) return 'A1';
    if (avg < 2.5) return 'A2';
    if (avg < 3.5) return 'B1';
    if (avg < 4.5) return 'B2';
    if (avg < 5.5) return 'C1';
    return 'C2';
}

function renderCEFRChart(byCEFR) {
    const chart = document.getElementById('cefr-chart');
    if (!chart) return;
    
    chart.innerHTML = '';
    const max = Math.max(...Object.values(byCEFR), 1);
    const colors = { A1: '#10B981', A2: '#38BDF8', B1: '#F59E0B', B2: '#A78BFA', C1: '#F472B6', C2: '#EF4444' };
    
    ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'].forEach(level => {
        const count = byCEFR[level] || 0;
        const height = (count / max) * 100;
        
        const bar = document.createElement('div');
        bar.style.cssText = `flex:1;background:${colors[level]};height:${height}%;border-radius:4px 4px 0 0;position:relative;transition:all 0.3s;cursor:pointer;`;
        bar.title = `${level}: ${count} palavras`;
        
        const label = document.createElement('div');
        label.style.cssText = 'position:absolute;top:-20px;left:50%;transform:translateX(-50%);font-size:11px;font-weight:700;color:#F8FAFC;';
        label.textContent = count;
        bar.appendChild(label);
        
        chart.appendChild(bar);
    });
}

function renderAchievements(stats) {
    const achievements = [
        { id: 'first_word', title: '🎯 Primeira Palavra', desc: 'Salvou sua primeira palavra', unlocked: stats.totalWords >= 1 },
        { id: 'ten_words', title: '📚 Colecionador', desc: 'Salvou 10 palavras', unlocked: stats.totalWords >= 10 },
        { id: 'fifty_words', title: '🏆 Vocabulário Sólido', desc: 'Salvou 50 palavras', unlocked: stats.totalWords >= 50 },
        { id: 'hundred_words', title: '💎 Centenário', desc: 'Salvou 100 palavras', unlocked: stats.totalWords >= 100 },
        { id: 'five_hundred', title: '🌟 Poliglota', desc: 'Salvou 500 palavras', unlocked: stats.totalWords >= 500 },
        { id: 'thousand', title: '👑 Mestre das Palavras', desc: 'Salvou 1000 palavras', unlocked: stats.totalWords >= 1000 },
        { id: 'streak_7', title: '🔥 Semana Completa', desc: '7 dias seguidos', unlocked: stats.streak >= 7 },
        { id: 'streak_30', title: '🔥 Mês Dedicado', desc: '30 dias seguidos', unlocked: stats.streak >= 30 },
        { id: 'streak_100', title: '🔥 Lenda', desc: '100 dias seguidos', unlocked: stats.streak >= 100 },
        { id: 'retention_80', title: '🎯 Memória Afiada', desc: 'Retenção acima de 80%', unlocked: stats.retention >= 80 },
        { id: 'retention_90', title: '🧠 Memória Fotográfica', desc: 'Retenção acima de 90%', unlocked: stats.retention >= 90 },
        { id: 'hour_immersion', title: '⏱️ Primeira Hora', desc: '1 hora de imersão', unlocked: stats.totalSecs >= 3600 },
        { id: 'ten_hours', title: '📺 Maratonista', desc: '10 horas de imersão', unlocked: stats.totalSecs >= 36000 },
        { id: 'hundred_hours', title: '🎬 Cinéfilo', desc: '100 horas de imersão', unlocked: stats.totalSecs >= 360000 },
    ];
    
    const container = document.getElementById('achievements');
    if (!container) return;
    
    container.innerHTML = '';
    achievements.forEach(ach => {
        const card = document.createElement('div');
        card.style.cssText = `background:${ach.unlocked ? 'rgba(16,185,129,0.1)' : 'rgba(255,255,255,0.03)'};border:1px solid ${ach.unlocked ? 'rgba(16,185,129,0.3)' : 'rgba(255,255,255,0.06)'};border-radius:10px;padding:12px;transition:all 0.2s;cursor:pointer;`;
        card.innerHTML = `
            <div style="font-size:24px;margin-bottom:6px;filter:${ach.unlocked ? 'none' : 'grayscale(1) opacity(0.3)'};">${ach.title.split(' ')[0]}</div>
            <div style="font-size:13px;font-weight:700;color:${ach.unlocked ? '#10B981' : '#64748B'};margin-bottom:2px;">${ach.title.split(' ').slice(1).join(' ')}</div>
            <div style="font-size:11px;color:#64748B;">${ach.desc}</div>
        `;
        card.onmouseenter = () => { if (ach.unlocked) card.style.transform = 'translateY(-2px)'; };
        card.onmouseleave = () => { card.style.transform = 'translateY(0)'; };
        container.appendChild(card);
    });
}

function renderHeatmap() {
    const container = document.getElementById('heatmap-container');
    if (!container) return;
    
    container.innerHTML = '<div style="color:#64748B;font-size:12px;text-align:center;padding:20px;">Heatmap em desenvolvimento...</div>';
}

// Exporta funções
window.loadImmersionStats = loadImmersionStats;
window.renderHeatmap = renderHeatmap;

// Carrega stats quando a aba de estatísticas é aberta
if (window.dashboard) {
    const originalSwitchTab = window.dashboard.switchTab;
    window.dashboard.switchTab = function(tab) {
        originalSwitchTab.call(this, tab);
        if (tab === 'stats') {
            loadImmersionStats();
            renderHeatmap();
        }
    };
}
