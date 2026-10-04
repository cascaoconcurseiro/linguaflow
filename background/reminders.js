// background/reminders.js — Alarmes e lembrete de revisão do service worker (#465)

// O código do service worker roda a cada vez que ele acorda. Criar um alarme
// com o mesmo nome cancela e reinicia o anterior; com os alarmes de 1 minuto
// acordando o worker o tempo todo, o de 60 min nunca chegava a disparar.
// Por isso só cria o que ainda não existe (ou o que mudou de período).
export async function ensureAlarms(alarmsApi, specs) {
  if (!alarmsApi) return;
  for (const { name, periodInMinutes } of specs) {
    try {
      const existing = await alarmsApi.get(name);
      if (existing && existing.periodInMinutes === periodInMinutes) continue;
      await alarmsApi.create(name, { periodInMinutes });
    } catch {
      // Sem permissão ou API indisponível: o próximo despertar tenta de novo.
    }
  }
}

export const DUE_NOTIFY_INTERVAL_MS = 20 * 60 * 60 * 1000;

// No máximo 1 notificação a cada 20h, e só com cards devidos. As chamadas
// chegam de mais de um lugar (alarme, mensagens); sem a trava, duas chamadas
// simultâneas liam o mesmo lf_last_notify e notificavam em dobro.
export function createDueNotifier(chromeApi, { now = Date.now, iconUrl = '', onError = () => {} } = {}) {
  let inFlight = null;

  const run = async (due) => {
    const { lf_last_notify } = await chromeApi.storage.local.get('lf_last_notify');
    if (lf_last_notify && now() - lf_last_notify < DUE_NOTIFY_INTERVAL_MS) return;
    await chromeApi.storage.local.set({ lf_last_notify: now() });
    chromeApi.notifications.create('lf-due-reminder', {
      type: 'basic',
      iconUrl,
      title: 'LinguaFlow 🔥',
      message: `Você tem ${due} ${due === 1 ? 'card esperando' : 'cards esperando'}. 5 minutinhos salvam sua ofensiva!`,
      priority: 1,
    });
  };

  return async function maybeNotifyDue(due) {
    if (!due || due < 1 || !chromeApi.notifications) return;
    if (inFlight) return inFlight;
    inFlight = run(due)
      .catch((error) => onError(error))
      .finally(() => {
        inFlight = null;
      });
    return inFlight;
  };
}
