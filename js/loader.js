function createPartLoader({ parts, versions = {}, stamp, fetchJson }) {
  const pending = [...parts], loaded = new Set(), failed = new Set();
  let active = null, batch = null;
  function loadNext() {
    if (batch) return batch.then(() => null);
    return nextPart();
  }
  function nextPart() {
    if (active) return active;
    if (!pending.length) return Promise.resolve(null);
    const name = pending.shift();
    return loadPart(name);
  }
  function loadPart(name) {
    active = Promise.resolve().then(() => fetchJson("data/" + name + "?v=" + (versions[name] || stamp)))
      .then(items => {
        if (!Array.isArray(items)) throw new Error("Invalid part");
        loaded.add(name);
        return { name, items };
      }).catch(() => { failed.add(name); return null; }).finally(() => { active = null; });
    return active;
  }
  async function loadFirst() {
    while (pending.length || active) { const part = await loadNext(); if (part) return part; }
    return null;
  }
  function loadAll(onPart = () => {}) {
    if (batch) return batch;
    batch = (async () => {
      while (pending.length || active) { const part = await nextPart(); if (part) await onPart(part); }
    })().finally(() => { batch = null; });
    return batch;
  }
  function retryFailed(onPart = () => {}) {
    if (active || batch) return batch || active;
    const retry = [...failed]; failed.clear();
    batch = (async () => {
      for (const name of retry) {
        const part = await loadPart(name);
        if (part) await onPart(part);
      }
    })().finally(() => { batch = null; });
    return batch;
  }
  return { loadNext, loadFirst, loadAll, retryFailed,
    status: () => ({ total: parts.length, loaded: loaded.size, failed: [...failed], pending: pending.length, busy: !!(active || batch) }) };
}
if (typeof module !== "undefined" && module.exports) module.exports = { createPartLoader };
