// content/boot.js
// Bootloader necessário pois o Chrome não aceita "type: module" diretamente nos content_scripts nativos.
// Ele injeta o nosso sistema baseado em classes e import/export (ES Modules).

(async () => {
    try {
        const version = chrome?.runtime?.getManifest?.()?.version || '3.0.44';
        const src = chrome.runtime.getURL("content/index.js") + '?v=' + version;
        await import(src);
    } catch (e) {
        console.error("LinguaFlow: Erro crítico no Bootloader do ES Module", e);
    }
})();
