'use client';

import { getDefaultSettings } from '@/lib/srs';
import { createClient } from '@/lib/supabase';
import { useState } from 'react';

export default function ConfigPage() {
  const supabase = createClient();
  const defaults = getDefaultSettings();
  const [settings, setSettings] = useState({
    newLimit: '20',
    learningSteps: defaults.learningSteps.join(' '),
    gradInt: String(defaults.gradInt),
    easyInt: String(defaults.easyInt),
    easyBonus: String(defaults.easyBonus),
    intMod: String(defaults.intMod),
    maxInt: String(defaults.maxInt),
    lapseMod: String(defaults.lapseMod),
    easeFactor: '2.5',
    leechThreshold: '8',
    leechAction: 'suspend',
    revLimit: '200',
    cefrLevel: 'none',
    cefrColors: 'on',
    newOrder: 'newest',
  });
  const [saved, setSaved] = useState(false);

  const update = (key: string, value: string) => {
    setSettings((prev) => ({ ...prev, [key]: value }));
    setSaved(false);
  };

  const handleSave = async () => {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;
    await supabase.from('settings').upsert({ user_id: user.id, key: 'srs', value: settings });
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  return (
    <div>
      <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 20 }}>⚙️ Configurações</h2>
      <p style={{ color: 'var(--muted)', fontSize: 13, marginBottom: 24 }}>
        Parâmetros completos do algoritmo SRS e aparência.
      </p>

      <div className="config-grid">
        <div className="config-card">
          <div className="config-card-title">🆕 Novos Cards</div>
          <div className="config-row">
            <span className="config-label">Cards por Dia</span>
            <input
              type="number"
              className="config-input-sm"
              value={settings.newLimit}
              onChange={(e) => update('newLimit', e.target.value)}
            />
          </div>
          <div className="config-row">
            <span className="config-label">Passos de Aprendizagem (min)</span>
            <input
              type="text"
              className="config-input"
              value={settings.learningSteps}
              onChange={(e) => update('learningSteps', e.target.value)}
            />
          </div>
          <small style={{ color: 'var(--subtle)', fontSize: 10 }}>
            Ex: "1 10" (revisão em 1min e 10min)
          </small>
          <div className="config-row" style={{ marginTop: 8 }}>
            <span className="config-label">Ordem de Inserção</span>
            <select
              className="config-input"
              value={settings.newOrder}
              onChange={(e) => update('newOrder', e.target.value)}
            >
              <option value="newest">Mais recentes primeiro</option>
              <option value="oldest">Mais antigos primeiro</option>
              <option value="random">Aleatório</option>
            </select>
          </div>
        </div>

        <div className="config-card">
          <div className="config-card-title">🔄 Revisões</div>
          <div className="config-row">
            <span className="config-label">Máximo por Dia</span>
            <input
              type="number"
              className="config-input-sm"
              value={settings.revLimit}
              onChange={(e) => update('revLimit', e.target.value)}
            />
          </div>
          <div className="config-row">
            <span className="config-label">Bônus Fácil (%)</span>
            <input
              type="number"
              className="config-input-sm"
              value={settings.easyBonus}
              onChange={(e) => update('easyBonus', e.target.value)}
            />
          </div>
          <div className="config-row">
            <span className="config-label">Modificador de Intervalo (%)</span>
            <input
              type="number"
              className="config-input-sm"
              value={settings.intMod}
              onChange={(e) => update('intMod', e.target.value)}
            />
          </div>
        </div>

        <div className="config-card">
          <div className="config-card-title">⚙️ Algoritmo SM-2</div>
          <div className="config-row">
            <span className="config-label">Ease Factor Inicial (%)</span>
            <input
              type="number"
              className="config-input-sm"
              value={settings.easeFactor}
              onChange={(e) => update('easeFactor', e.target.value)}
            />
          </div>
          <div className="config-row">
            <span className="config-label">Intervalo de Graduação (Dias)</span>
            <input
              type="number"
              className="config-input-sm"
              value={settings.gradInt}
              onChange={(e) => update('gradInt', e.target.value)}
            />
          </div>
          <div className="config-row">
            <span className="config-label">Intervalo Fácil (Dias)</span>
            <input
              type="number"
              className="config-input-sm"
              value={settings.easyInt}
              onChange={(e) => update('easyInt', e.target.value)}
            />
          </div>
          <div className="config-row">
            <span className="config-label">Intervalo Máximo (Dias)</span>
            <input
              type="number"
              className="config-input-sm"
              value={settings.maxInt}
              onChange={(e) => update('maxInt', e.target.value)}
            />
          </div>
        </div>

        <div className="config-card">
          <div className="config-card-title">⚠️ Falhas (Lapses)</div>
          <div className="config-row">
            <span className="config-label">Novo Intervalo após Falha (%)</span>
            <input
              type="number"
              className="config-input-sm"
              value={settings.lapseMod}
              onChange={(e) => update('lapseMod', e.target.value)}
            />
          </div>
          <small style={{ color: 'var(--subtle)', fontSize: 10 }}>0% = volta ao começo</small>
          <div className="config-row" style={{ marginTop: 8 }}>
            <span className="config-label">Limite de Sanguessuga</span>
            <input
              type="number"
              className="config-input-sm"
              value={settings.leechThreshold}
              onChange={(e) => update('leechThreshold', e.target.value)}
            />
          </div>
          <div className="config-row">
            <span className="config-label">Ação de Sanguessuga</span>
            <select
              className="config-input"
              value={settings.leechAction}
              onChange={(e) => update('leechAction', e.target.value)}
            >
              <option value="suspend">Suspender</option>
              <option value="tag">Apenas marcar</option>
              <option value="ignore">Ignorar</option>
            </select>
          </div>
        </div>

        <div className="config-card">
          <div className="config-card-title">🎧 Imersão Automática</div>
          <div className="config-row">
            <span className="config-label">Nível Alvo (CEFR)</span>
            <select
              className="config-input"
              value={settings.cefrLevel}
              onChange={(e) => update('cefrLevel', e.target.value)}
            >
              <option value="none">Desativado</option>
              <option value="A1">A1 (Iniciante)</option>
              <option value="A2">A2 (Básico)</option>
              <option value="B1">B1 (Intermediário)</option>
              <option value="B2">B2 (Independente)</option>
              <option value="C1">C1 (Proficiência)</option>
              <option value="C2">C2 (Maestria)</option>
            </select>
          </div>
          <div className="config-row">
            <span className="config-label">Cores do CEFR</span>
            <select
              className="config-input"
              value={settings.cefrColors}
              onChange={(e) => update('cefrColors', e.target.value)}
            >
              <option value="on">Ativada (Colorir legenda por nível)</option>
              <option value="off">Desativada</option>
            </select>
          </div>
        </div>
      </div>

      <div style={{ marginTop: 24 }}>
        <button className="btn btn-accent" onClick={handleSave}>
          {saved ? '✅ Salvo!' : '💾 Salvar Configurações'}
        </button>
      </div>
    </div>
  );
}
