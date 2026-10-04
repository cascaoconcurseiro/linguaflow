// stryker.config.mjs — Configuração do teste de mutação (Stryker) sobre utils/schema.js.
export default {
  testRunner: 'command',
  commandRunner: { command: 'node tests/architectural-resilience.test.mjs' },
  mutate: ['utils/schema.js'],
  reporters: ['progress', 'clear-text', 'html'],
  timeoutMS: 10000,
  incremental: true,
  concurrency: 2,
};
