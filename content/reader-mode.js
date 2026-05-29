// content/reader-mode.js

class ReaderMode {
    constructor() {
        this.isActive = false;
        this.knownWords = {};
        this.init();
    }

    init() {
        // Only run when requested (e.g., via popup or shortcut)
        chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
            if (request.action === 'TOGGLE_READER_MODE') {
                if (this.isActive) this.deactivate();
                else this.activate();
                sendResponse({ active: this.isActive });
            }
        });
    }

    async activate() {
        if (this.isActive) return;
        this.isActive = true;
        document.body.classList.add('lf-reader-active');
        
        if (!document.getElementById('lf-reader-styles')) {
            const style = document.createElement('style');
            style.id = 'lf-reader-styles';
            style.textContent = `
                .lf-reader-active .lf-reader-word { cursor: pointer; border-radius: 3px; padding: 0 1px; transition: background 0.2s; }
                .lf-reader-active .lf-reader-word:hover { background: rgba(56,189,248,0.3) !important; }
                .lf-reader-word.lf-status-mature { background: rgba(16,185,129,0.15); border-bottom: 2px solid rgba(16,185,129,0.4); }
                .lf-reader-word.lf-status-new { background: rgba(56,189,248,0.15); border-bottom: 2px solid rgba(56,189,248,0.4); }
            `;
            document.head.appendChild(style);
        }

        // Fetch known words
        const res = await new Promise(r => chrome.runtime.sendMessage({ type: 'GET_KNOWN_WORDS' }, r));
        if (res && res.known) {
            this.knownWords = res.known;
        }

        this.processDOM(document.body);
    }

    deactivate() {
        this.isActive = false;
        document.body.classList.remove('lf-reader-active');
        // Limpar spans? Num ambiente real, recarregar a pagina ou desfazer. 
        // Para v1 do Reader, um recarregamento da página resolve o desfazimento.
        alert('Modo Leitura desativado. Recarregue a página (F5) para remover os realces de palavras.');
    }

    processDOM(node) {
        // Skip some nodes (script, style, noscript, etc)
        const skipTags = new Set(['SCRIPT', 'STYLE', 'NOSCRIPT', 'IFRAME', 'CODE', 'PRE']);
        
        const walker = document.createTreeWalker(
            node, 
            NodeFilter.SHOW_TEXT,
            {
                acceptNode: (n) => {
                    if (skipTags.has(n.parentNode.tagName)) return NodeFilter.FILTER_REJECT;
                    if (n.parentNode.classList.contains('lf-reader-word')) return NodeFilter.FILTER_REJECT;
                    if (n.nodeValue.trim() === '') return NodeFilter.FILTER_REJECT;
                    return NodeFilter.FILTER_ACCEPT;
                }
            }
        );

        const nodesToProcess = [];
        let currentNode;
        while(currentNode = walker.nextNode()) {
            nodesToProcess.push(currentNode);
        }

        nodesToProcess.forEach(txtNode => {
            this.replaceTextWithSpans(txtNode);
        });
    }

    replaceTextWithSpans(textNode) {
        const text = textNode.nodeValue;
        // Split por palavras e pontuação mantendo a pontuação
        const tokens = text.split(/([ \n\t\r.,!?;"()[\]{}<>]+)/);
        if (tokens.length <= 1) return;

        const frag = document.createDocumentFragment();

        tokens.forEach(token => {
            if (!token) return;
            if (!/[a-zA-Z\u00C0-\u024F]/.test(token)) {
                frag.appendChild(document.createTextNode(token));
            } else {
                const span = document.createElement('span');
                span.textContent = token;
                span.className = 'lf-reader-word';
                
                const cleanWord = token.toLowerCase();
                const status = this.knownWords[cleanWord];
                if (status === 'mature') span.classList.add('lf-status-mature');
                else if (status === 'new') span.classList.add('lf-status-new');

                span.addEventListener('click', (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    this.onWordClick(token, span);
                });

                frag.appendChild(span);
            }
        });

        textNode.parentNode.replaceChild(frag, textNode);
    }

    onWordClick(word, span) {
        // Comunica com o popup flutuante de palavras do subtitle-engine (se existir)
        // Se a engine não estiver rodando no site, a gente carrega o popup
        chrome.runtime.sendMessage({ action: 'openWordPopup', payload: { word: word }});
    }
}

// Inicializa globalmente
if (!window.lfReaderMode) {
    window.lfReaderMode = new ReaderMode();
}
