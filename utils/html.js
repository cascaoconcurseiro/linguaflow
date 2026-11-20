// utils/html.js — Escape de HTML para qualquer texto de fora (legendas, IA, web) antes de entrar no DOM.
export function escapeHTML(value) {
    if (!value) return '';
    return String(value)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

// Texto de fora (Wikcionário, Reverso) que deve virar texto puro. O regex simples /<[^>]+>/g deixa `<script`
// quando a entrada vem aninhada (`<<b>script>`); por isso repete até estabilizar e, no fim, descarta qualquer
// `<` que ainda abriria uma tag. Sinais soltos ("3 < 5", "<3") são preservados. Quem exibe o resultado ainda
// deve escapá-lo (escapeHTML): esta função é uma segunda camada, não a única.
export function stripHtmlTags(value) {
    let text = String(value ?? '');
    let previous;
    do {
        previous = text;
        text = text.replace(/<\/?[a-zA-Z!?][^>]*>/g, '');
    } while (text !== previous);
    return text.replace(/<(?=\s*[a-zA-Z/!?])/g, '');
}
