/**
 * LinguaFlow Data Access Layer — Supabase
 */
import { calculateNextState, getDefaultSettings, type CardState } from './srs';
import { createClient } from './supabase';

// ── Decks ───────────────────────────────────────────────────────────────────
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
  const wordMap = new Map<string, string>(); // word_id -> deck_id
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

// ── Words ───────────────────────────────────────────────────────────────────
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
  // Create associated card
  await supabase.from('cards').insert({
    word_id: data.id,
    status: 'new',
    due_date: new Date().toISOString(),
  });
  return data;
}

export async function deleteWord(id: string) {
  const supabase = createClient();
  await supabase.from('words').delete().eq('id', id);
}

// ── Cards & SRS ─────────────────────────────────────────────────────────────
export async function getCardsDue(limit = 50, deckId?: string | null) {
  const supabase = createClient();
  const { data, error } = await supabase.rpc('get_due_cards', {
    p_user_id: (await supabase.auth.getUser()).data.user?.id,
    p_limit: limit,
  });
  if (error) return [];
  let result = (data || []).map((row: any) => ({
    id: row.card_id,
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
    wordData: {
      id: row.word_id,
      word: row.word_word,
      translation: row.word_translation,
      context_sentence: row.word_context,
      phonetic: row.word_phonetic,
      pronunciation_pt: row.word_pronunciation_pt,
      level: row.word_level,
      tags: row.word_tags,
      chunks: row.word_chunks,
      deck_id: row.word_deck_id,
    },
  }));
  if (deckId) result = result.filter((c: any) => c.wordData?.deck_id === deckId);
  return result;
}

export async function logReview(cardId: string, quality: number) {
  const supabase = createClient();
  const settings = getDefaultSettings();

  // Fetch card
  const { data: card } = await supabase.from('cards').select('*').eq('id', cardId).single();
  if (!card) throw new Error('Card not found');

  const nextState = calculateNextState(card as CardState, quality, settings);

  // Update card
  await supabase
    .from('cards')
    .update({
      status: nextState.status,
      interval: nextState.interval,
      ease_factor: nextState.ease_factor,
      step_index: nextState.step_index,
      reps: nextState.reps,
      lapses: nextState.lapses,
      pre_lapse_interval: nextState.pre_lapse_interval,
      due_date: new Date(nextState.due_date!).toISOString(),
      last_review: new Date().toISOString(),
      is_leech: nextState.lapses >= 8,
    })
    .eq('id', cardId);

  // Log review
  await supabase.from('review_log').insert({
    card_id: cardId,
    quality,
    date: new Date().toISOString().split('T')[0],
  });

  return nextState;
}

export async function getStats() {
  const supabase = createClient();
  const { data, error } = await supabase.rpc('get_user_stats', {
    p_user_id: (await supabase.auth.getUser()).data.user?.id,
  });
  if (error) return { total_words: 0, due_cards: 0, retention: 0, by_cefr: {} };
  return data;
}

// ── Sentences ───────────────────────────────────────────────────────────────
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

// ── Settings ────────────────────────────────────────────────────────────────
export async function getSetting(key: string): Promise<string | null> {
  const supabase = createClient();
  const { data } = await supabase.from('settings').select('value').eq('key', key).maybeSingle();
  return data?.value || null;
}

export async function setSetting(key: string, value: string) {
  const supabase = createClient();
  await supabase.from('settings').upsert({ key, value }, { onConflict: 'user_id,key' });
}
