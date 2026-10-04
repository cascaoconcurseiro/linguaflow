import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { DUE_NOTIFY_INTERVAL_MS, createDueNotifier, ensureAlarms } from '../background/reminders.js';

function fakeAlarms(initial = {}) {
  const alarms = { ...initial };
  const created = [];
  return {
    created,
    get: async (name) => alarms[name],
    create: async (name, info) => {
      created.push(name);
      alarms[name] = { name, ...info };
    },
  };
}

const SPECS = [
  { name: 'srs-reminder', periodInMinutes: 60 },
  { name: 'word-save-sync', periodInMinutes: 1 },
];

test('alarme que já existe não é recriado (senão reinicia o período a cada despertar)', async () => {
  const api = fakeAlarms({ 'srs-reminder': { name: 'srs-reminder', periodInMinutes: 60 } });
  await ensureAlarms(api, SPECS);
  assert.deepEqual(api.created, ['word-save-sync'], 'só cria o que faltava');
  await ensureAlarms(api, SPECS);
  assert.deepEqual(api.created, ['word-save-sync'], 'despertar seguinte não recria nada');
});

test('alarme com período diferente é recriado, e API ausente ou com erro não quebra', async () => {
  const api = fakeAlarms({ 'srs-reminder': { name: 'srs-reminder', periodInMinutes: 30 } });
  await ensureAlarms(api, SPECS);
  assert.ok(api.created.includes('srs-reminder'));
  await ensureAlarms(undefined, SPECS);
  await ensureAlarms({ get: async () => { throw new Error('x'); }, create: async () => {} }, SPECS);
});

function fakeChrome({ lastNotify } = {}) {
  const store = lastNotify === undefined ? {} : { lf_last_notify: lastNotify };
  const sent = [];
  return {
    sent,
    store,
    storage: {
      local: {
        // O atraso expõe a corrida: duas chamadas leem antes de qualquer uma gravar.
        get: async (key) => {
          await new Promise((resolve) => setTimeout(resolve, 5));
          return { [key]: store[key] };
        },
        set: async (obj) => Object.assign(store, obj),
      },
    },
    notifications: { create: (id, options) => sent.push({ id, options }) },
  };
}

test('duas chamadas simultâneas geram uma única notificação', async () => {
  const chromeApi = fakeChrome();
  const notify = createDueNotifier(chromeApi, { now: () => 1_000_000 });
  await Promise.all([notify(3), notify(3)]);
  assert.equal(chromeApi.sent.length, 1);
  assert.match(chromeApi.sent[0].options.message, /3 cards esperando/);
});

test('respeita o intervalo de 20h e só notifica com cards devidos', async () => {
  const now = 50_000_000;
  const recent = fakeChrome({ lastNotify: now - DUE_NOTIFY_INTERVAL_MS + 1000 });
  await createDueNotifier(recent, { now: () => now })(2);
  assert.equal(recent.sent.length, 0, 'dentro das 20h não notifica');

  const old = fakeChrome({ lastNotify: now - DUE_NOTIFY_INTERVAL_MS - 1 });
  const notify = createDueNotifier(old, { now: () => now });
  await notify(1);
  assert.equal(old.sent.length, 1);
  assert.match(old.sent[0].options.message, /1 card esperando/);

  const none = fakeChrome();
  await createDueNotifier(none)(0);
  assert.equal(none.sent.length, 0);
});

test('falha ao notificar vai para onError e libera a trava', async () => {
  const chromeApi = fakeChrome();
  chromeApi.notifications.create = () => { throw new Error('sem permissão'); };
  const errors = [];
  const notify = createDueNotifier(chromeApi, { onError: (e) => errors.push(e.message) });
  await notify(2);
  assert.deepEqual(errors, ['sem permissão']);
  await notify(2);
  assert.equal(errors.length, 1, 'o intervalo de 20h já foi gravado antes da falha');
});

test('contrato: o service worker usa ensureAlarms e não recria alarmes direto', async () => {
  const code = await readFile(new URL('../background/service-worker.js', import.meta.url), 'utf8');
  assert.match(code, /ensureAlarms\(chrome\.alarms,/);
  assert.doesNotMatch(code, /chrome\.alarms\.create\(/, 'recriar alarme a cada despertar reinicia o período');
  assert.match(code, /createDueNotifier\(chrome,/);
});
