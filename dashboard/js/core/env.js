// dashboard/js/core/env.js — Detecção única do contexto de execução: página da extensão Chrome ou PWA na web.

// Verdadeiro dentro de uma página da extensão (chrome-extension://). Em testes sem `location`, assume extensão.
export const isExtensionContext = typeof chrome !== 'undefined'
  && !!chrome.runtime
  && !!chrome.runtime.id
  && (typeof location === 'undefined' || location.protocol === 'chrome-extension:');
