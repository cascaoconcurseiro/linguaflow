// content/boot.js
// Bootloader necessário pois o Chrome não aceita "type: module" diretamente nos content_scripts nativos.
// Ele injeta o nosso sistema baseado em classes e import/export (ES Modules).

(async () => {
    try {
        const src = chrome.runtime.getURL("content/index.js") + '?v=' + Date.now();
        await import(src);
    } catch (e) {
        console.error("LinguaFlow: Erro crítico no Bootloader do ES Module", e);
    }
})();
