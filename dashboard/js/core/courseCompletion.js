// Consulta a recomendação somente depois de confirmar o progresso no servidor.
export function createCourseCompletion({ commit, loadNext, onState, isActive = () => true }) {
  let saved = false;
  let result;
  let pending;
  const emit = state => { if (isActive()) onState(state); };
  async function readNext() {
    if (!isActive()) return;
    if (!loadNext) { emit({ status: 'saved', result }); return; }
    emit({ status: 'loading-next', result });
    try {
      const path = await loadNext();
      emit({ status: path?.next ? 'next' : path?.blocked ? 'blocked' : 'done', next: path?.next, result });
    } catch (error) { emit({ status: 'next-error', result, error }); }
  }
  function track(promise) {
    pending = promise.finally(() => { pending = null; });
    return pending;
  }
  function retryNext() {
    if (pending) return pending;
    if (!saved) return save();
    return track(readNext());
  }
  function save() {
    if (pending) return pending;
    if (saved) return retryNext();
    emit({ status: 'saving' });
    // O callback é chamado já nesta operação, antes de qualquer leitura da trilha.
    let operation;
    try { operation = commit(); } catch (error) { operation = Promise.reject(error); }
    return track(Promise.resolve(operation).then(async value => {
      saved = true;
      result = value;
      await readNext();
    }, error => { emit({ status: 'save-error', error }); }));
  }
  return { save, retryNext };
}
