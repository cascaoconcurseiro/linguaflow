// utils/examples.js
// Busca exemplos bilíngues do Linguee (via background) e Reverso Context
// Totalmente gratuito, sem API key, com cache de 7 dias

/**
 * Busca exemplos para uma palavra.
 * @param {string} word - Palavra em inglês
 * @param {string} srcLang - Idioma fonte (padrão: 'en')
 * @param {string} dstLang - Idioma destino (padrão: 'pt')
 * @param {'linguee'|'reverso'|'both'} source - Fonte preferida
 * @returns {Promise<Array<{en:string, pt:string, verified:boolean, source:string}>>}
 */
function escapeHTML(value) {
    return String(value ?? '').replace(/[&<>"']/g, ch => ({
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#39;'
    }[ch]));
}

export async function fetchExamples(word, srcLang = 'en', dstLang = 'pt', source = 'both') {
    const results = [];

    const [lingueeRes, reversoRes] = await Promise.allSettled([
        source !== 'reverso' ? fetchLinguee(word) : Promise.resolve([]),
        source !== 'linguee' ? fetchReverso(word, srcLang, dstLang) : Promise.resolve([])
    ]);

    if (lingueeRes.status === 'fulfilled') {
        lingueeRes.value.forEach(ex => results.push({ ...ex, source: 'Linguee' }));
    }

    if (reversoRes.status === 'fulfilled') {
        reversoRes.value.forEach(ex => {
            // Evita duplicatas
            if (!results.some(r => r.en.toLowerCase() === ex.en.toLowerCase())) {
                results.push({ ...ex, source: 'Reverso Context' });
            }
        });
    }

    // Se ambos falharam, retorna vazio
    return results.slice(0, 40);
}

async function fetchLinguee(word) {
    try {
        const response = await chrome.runtime.sendMessage({ type: 'FETCH_LINGUEE', word });
        if (!response?.success || !response.html) return [];

        const doc = new DOMParser().parseFromString(response.html, 'text/html');
        const examples = [];

        doc.querySelectorAll('.example').forEach(div => {
            const en = div.querySelector('.tag_s')?.textContent?.trim();
            const pt = div.querySelector('.tag_t')?.textContent?.trim();
            if (en && pt) examples.push({ en, pt, verified: true });
        });

        doc.querySelectorAll('.inexact, .unverified').forEach(div => {
            const en = div.querySelector('.tag_s, .source_text')?.textContent?.trim();
            const pt = div.querySelector('.tag_t, .target_text')?.textContent?.trim();
            if (en && pt && en.length > 5 && !examples.some(e => e.en === en)) {
                examples.push({ en, pt, verified: false });
            }
        });

        return examples;
    } catch {
        return [];
    }
}

async function fetchReverso(word, srcLang = 'en', dstLang = 'pt') {
    try {
        const response = await chrome.runtime.sendMessage({
            type: 'FETCH_REVERSO',
            word,
            srcLang,
            dstLang
        });
        if (!response?.success || !response.list) return [];
        return response.list.map(item => ({ en: item.en, pt: item.pt, verified: false }));
    } catch {
        return [];
    }
}

/**
 * Renderiza lista de exemplos como HTML
 */
export function renderExamplesHTML(examples, word, limit = 20) {
    if (!examples.length) return '<p style="color:#64748B;">Nenhum exemplo encontrado.</p>';

    const items = examples.slice(0, limit).map(ex => {
        const highlighted = escapeHTML(ex.en).replace(
            new RegExp(`(${escapeHTML(word).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi'),
            '<strong style="color:#F59E0B;">$1</strong>'
        );
        return `
            <div style="padding:10px 0;border-bottom:1px solid rgba(255,255,255,0.05);">
                <div style="font-size:13px;color:#E2E8F0;line-height:1.6;margin-bottom:3px;">${highlighted}</div>
                <div style="font-size:12px;color:#10B981;line-height:1.5;">${escapeHTML(ex.pt)}</div>
                <div style="font-size:10px;color:#475569;margin-top:2px;">${escapeHTML(ex.source)}${ex.verified ? ' ✓' : ''}</div>
            </div>`;
    }).join('');

    const more = examples.length > limit
        ? `<p style="font-size:12px;color:#64748B;margin-top:8px;">Mostrando ${limit} de ${examples.length} exemplos</p>`
        : '';

    return items + more;
}
