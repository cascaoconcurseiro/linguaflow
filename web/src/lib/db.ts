/** LinguaFlow Data Access Layer — Supabase */
import { calculateNextState, getDefaultSettings, type CardState } from './srs';
import { createClient } from './supabase';

export async function getDecks() {
  const supabase = createClient();
  const { data } = await supabase.from('decks').select('*').order('created_at');
  return data || [];
}

export async function createDeck(name: string, icon = '📚') {
  const supabase = createClient();
  const { data, error } = await supabase.from('decks').insert({ name, icon }).select().single();
  if (error) throw error;
  return data;
}

export async function deleteDeck(id: string) {
  const supabase = createClient();
  await supabase.from('decks').delete().eq('id', id);
}

export async function getDeckStats() {
  const supabase = createClient();
  const { data: decks } = await supabase.from('decks').select('*');
  const { data: words } = await supabase.from('words').select('id, deck_id');
  const { data: cards } = await supabase.from('cards').select('word_id, status, due_date');
  if (!decks) return [];
  const wordMap = new Map<string, string>();
  words?.forEach((w) => wordMap.set(w.id, w.deck_id));
  const cardByWord = new Map<string, { status: string; due: string }>();
  cards?.forEach((c) => cardByWord.set(c.word_id, { status: c.status, due: c.due_date }));
  return decks.map((d) => {
    const deckWords = words?.filter((w) => w.deck_id === d.id) || [];
    const deckCards = deckWords
      .map((w) => cardByWord.get(w.id))
      .filter((c): c is { status: string; due: string } => c !== undefined);
    return {
      ...d,
      newCount: deckCards.filter((c) => c.status === 'new').length,
      dueCount: deckCards.filter((c) => c.status !== 'new' && new Date(c.due) <= new Date()).length,
      totalCount: deckWords.length,
    };
  });
}

export async function getWords(deckId?: string | null, limit = 100) {
  const supabase = createClient();
  let q = supabase.from('words').select('*').order('added_at', { ascending: false }).limit(limit);
  if (deckId) q = q.eq('deck_id', deckId);
  const { data } = await q;
  return data || [];
}

export async function saveWord(word: Record<string, any>) {
  const supabase = createClient();
  const { data: existing } = await supabase
    .from('words')
    .select('id')
    .eq('word', word.word)
    .eq('lang', word.lang || 'en')
    .maybeSingle();
  if (existing) {
    const { data } = await supabase
      .from('words')
      .update(word)
      .eq('id', existing.id)
      .select()
      .single();
    return data;
  }
  const { data, error } = await supabase.from('words').insert(word).select().single();
  if (error) throw error;
  await supabase
    .from('cards')
    .insert({ word_id: data.id, status: 'new', due_date: new Date().toISOString() });
  return data;
}

export async function deleteWord(id: string) {
  const supabase = createClient();
  await supabase.from('words').delete().eq('id', id);
}

export async function getCardsDue(limit = 50, deckId?: string | null) {
  const supabase = createClient();
  const { data, error } = await supabase
    .from('cards')
    .select(
      '*, words:word_id(word, translation, context_sentence, phonetic, pronunciation_pt, level, tags, chunks, deck_id)',
    )
    .eq('suspended', false)
    .lte('due_date', new Date().toISOString())
    .order('due_date')
    .limit(limit);
  if (error || !data) return [];
  return data.map((row: any) => ({
    id: row.id,
    word_id: row.word_id,
    status: row.status,
    interval: row.interval,
    ease_factor: row.ease_factor,
    step_index: row.step_index,
    reps: row.reps,
    lapses: row.lapses,
    difficulty: row.difficulty,
    stability: row.stability,
    pre_lapse_interval: row.pre_lapse_interval,
    due_date: row.due_date,
    last_review: row.last_review,
    suspended: row.suspended,
    is_leech: row.is_leech,
    wordData: row.words
      ? {
          id: row.word_id,
          word: (row.words as any).word,
          translation: (row.words as any).translation,
          context_sentence: (row.words as any).context_sentence,
          phonetic: (row.words as any).phonetic,
          pronunciation_pt: (row.words as any).pronunciation_pt,
          level: (row.words as any).level,
          tags: (row.words as any).tags,
          chunks: (row.words as any).chunks,
        }
      : null,
  }));
}

export async function logReview(cardId: string, quality: number) {
  const supabase = createClient();
  const { data: card } = await supabase.from('cards').select('*').eq('id', cardId).single();
  if (!card) return;
  const settings = getDefaultSettings();
  const nextState = calculateNextState(card as CardState, quality, settings);
  await supabase.from('cards').update(nextState).eq('id', cardId);
  await supabase
    .from('review_log')
    .insert({
      card_id: cardId,
      quality,
      date: new Date().toISOString().split('T')[0],
      ts: new Date().toISOString(),
    });
}

export async function getStats() {
  const supabase = createClient();
  const { count: total } = await supabase.from('words').select('*', { count: 'exact', head: true });
  const { count: due } = await supabase
    .from('cards')
    .select('*', { count: 'exact', head: true })
    .eq('suspended', false)
    .lte('due_date', new Date().toISOString());
  return { total_words: total || 0, due_cards: due || 0, retention: 0, by_cefr: {} };
}

export async function getSentences(limit = 20) {
  const supabase = createClient();
  const { data } = await supabase
    .from('sentences')
    .select('*')
    .order('added_at', { ascending: false })
    .limit(limit);
  return data || [];
}

export async function saveSentence(sentence: Record<string, any>) {
  const supabase = createClient();
  const { data } = await supabase.from('sentences').insert(sentence).select().single();
  return data;
}

export async function getSetting(key: string): Promise<string | null> {
  const supabase = createClient();
  const { data } = await supabase.from('settings').select('value').eq('key', key).maybeSingle();
  return data?.value || null;
}

export async function setSetting(key: string, value: string) {
  const supabase = createClient();
  await supabase.from('settings').upsert({ key, value }, { onConflict: 'user_id,key' });
}
