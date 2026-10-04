import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { videoWordStats } from '../dashboard/js/core/videoWordStats.js';

test('conta palavras de vídeo e as que já fixaram', () => {
  const words = [
    { id: 1, video_url: 'https://youtu.be/a' }, { id: 2, video_title: 'TED' },
    { id: 3 }, { id: 4, video_url: 'https://youtu.be/b' },
  ];
  const cards = [
    { word_id: 1, status: 'mature' }, { word_id: 1, status: 'mature' },
    { word_id: 2, status: 'learning' }, { word_id: 3, status: 'mature' }, { word_id: 4, status: 'review' },
  ];
  assert.deepEqual(videoWordStats(words, cards), { total: 3, stable: 2 });
  assert.deepEqual(videoWordStats(null, null), { total: 0, stable: 0 });
});

test('Início mostra o selo só quando há palavras de vídeo', () => {
  const home = readFileSync(new URL('../dashboard/js/ui/homeView.js', import.meta.url), 'utf8');
  assert.match(home, /videoWordStats\(allWords, allCards\)/);
  assert.match(home, /videoWords\.total > 0/);
  assert.match(home, /De vídeos:/);
});
