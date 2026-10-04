// utils/db/srs-constants.js — Parâmetros do agendamento: chaves de SRS por categoria e os pesos default do FSRS-4.5.

// Só estas 3 configs fazem diferença pedagógica real por categoria (retenção, learning steps, intervalo de
// graduação); leech e limites diários continuam globais de propósito (são sobre volume da sessão).
export const SRS_OVERRIDABLE_KEYS = ['lf_srs_retention', 'learning_steps', 'graduating_interval'];

// Parâmetros default publicados do FSRS-4.5. quality: 1=Errei 2=Difícil 3=Bom 4=Fácil
export const FSRS_W = [0.4872, 1.4003, 3.7145, 13.8206, 5.1618, 1.2298, 0.8975, 0.031,
  1.6474, 0.1367, 1.0461, 2.1072, 0.0793, 0.3246, 1.587, 0.2272, 2.8755];
export const FSRS_DECAY = -0.5;
export const FSRS_FACTOR = Math.pow(0.9, 1 / -0.5) - 1; // 19/81
