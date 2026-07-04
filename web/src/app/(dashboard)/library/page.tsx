'use client';

import { deleteWord, getWords, saveWord } from '@/lib/db';
import { useEffect, useRef, useState } from 'react';

function downloadFile(content: string, filename: string, type: string) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export default function LibraryPage() {
  const [words, setWords] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    loadWords();
  }, []);

  const loadWords = async () => {
    setLoading(true);
    const w = await getWords(null, 500);
    setWords(w);
    setLoading(false);
  };

  const handleExportAnki = () => {
    const lines = words.map((w) => {
      const tags = Array.isArray(w.tags) ? w.tags.join(' ') : w.tags || '';
      return [
        w.word,
        w.translation || '',
        w.context_sentence || '',
        w.phonetic || '',
        tags,
        w.level || '',
      ].join('\t');
    });
    downloadFile(
      '#separator:tab\n#html:false\n' + lines.join('\n'),
      `linguaflow-anki-${new Date().toISOString().split('T')[0]}.txt`,
      'text/plain',
    );
  };

  const handleExportJSON = () => {
    downloadFile(
      JSON.stringify(words, null, 2),
      `linguaflow-backup-${new Date().toISOString().split('T')[0]}.json`,
      'application/json',
    );
  };

  const handleImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async (ev) => {
      const text = ev.target?.result as string;
      const lines = text.split('\n').filter((l) => l.trim() && !l.startsWith('#'));
      let imported = 0;
      for (const line of lines) {
        const parts = line.split('\t');
        if (parts.length >= 2) {
          try {
            await saveWord({
              word: parts[0].trim(),
              translation: parts[1]?.trim(),
              lang: 'en',
              context_sentence: parts[2]?.trim(),
            });
            imported++;
          } catch {}
        }
      }
      loadWords();
      alert(`${imported} palavras importadas.`);
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const filtered = words.filter(
    (w) =>
      !search ||
      w.word?.toLowerCase().includes(search.toLowerCase()) ||
      w.translation?.toLowerCase().includes(search.toLowerCase()),
  );

  const handleDelete = async (id: string) => {
    if (!confirm('Excluir esta palavra?')) return;
    await deleteWord(id);
    setWords((w) => w.filter((x) => x.id !== id));
  };

  return (
    <div className="max-w-[1200px] animate-fade-up">
      <div className="flex gap-3 mb-5">
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Buscar palavras..."
          className="input flex-1 max-w-[400px]"
        />
        <button onClick={handleExportAnki} className="btn btn-ghost btn-sm text-xs">
          📤 Anki
        </button>
        <button onClick={handleExportJSON} className="btn btn-ghost btn-sm text-xs">
          💾 JSON
        </button>
        <button onClick={() => fileRef.current?.click()} className="btn btn-ghost btn-sm text-xs">
          📥 Importar
        </button>
        <input
          ref={fileRef}
          type="file"
          accept=".txt,.csv,.json"
          className="hidden"
          onChange={handleImport}
        />
      </div>

      {loading ? (
        <div className="text-center py-20 text-[#64748b] text-sm">Carregando...</div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((w) => (
            <div
              key={w.id}
              className="card p-5 hover:border-[rgba(56,189,248,0.2)] transition-all hover:-translate-y-1 cursor-pointer group"
            >
              <div className="flex justify-between items-start mb-3">
                <div className="text-xl font-extrabold text-[#38bdf8]">{w.word}</div>
                <button
                  onClick={() => handleDelete(w.id)}
                  className="opacity-0 group-hover:opacity-100 text-[#64748b] hover:text-[#f87171] transition-all text-sm"
                >
                  🗑️
                </button>
              </div>
              <div className="text-base font-bold text-[#4ade80] mb-2">
                {w.translation || <span className="text-[#64748b] italic">sem tradução</span>}
              </div>
              {w.context_sentence && (
                <div className="text-xs text-[#64748b] italic leading-relaxed mb-3">
                  &ldquo;{w.context_sentence.substring(0, 100)}
                  {w.context_sentence.length > 100 ? '…' : ''}&rdquo;
                </div>
              )}
              <div className="flex items-center gap-2 text-[10px] text-[#64748b]">
                {w.level && (
                  <span
                    className="status-badge"
                    style={{ background: 'rgba(56,189,248,0.12)', color: '#38bdf8' }}
                  >
                    {w.level}
                  </span>
                )}
                <span>{new Date(w.added_at).toLocaleDateString('pt-BR')}</span>
              </div>
            </div>
          ))}
          {!filtered.length && (
            <div className="col-span-full text-center py-16 text-[#64748b]">
              <div className="text-5xl mb-4">📭</div>
              <div className="text-base font-semibold mb-1">Nenhuma palavra encontrada</div>
              <div className="text-sm">Salve palavras estudando ou importe do Anki.</div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
