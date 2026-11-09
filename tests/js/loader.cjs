const assert = require('node:assert/strict');
const { createPartLoader } = require('../../js/loader.js');
(async () => {
  let calls = [], broken = true, concurrent = 0, peak = 0;
  const loader = createPartLoader({parts: ['a','b','c','d'], versions: {a:'hash'}, stamp: 123,
    fetchJson: async url => {
      calls.push(url); peak = Math.max(peak, ++concurrent);
      await new Promise(resolve => setImmediate(resolve)); concurrent--;
      if (url.includes('/b') && broken) throw Error('404');
      if (url.includes('/c') && broken) return {};
      return [url];
    }});
  assert.equal((await loader.loadFirst()).name, 'a');
  assert.deepEqual(calls, ['data/a?v=hash']);
  const one = loader.loadNext(); assert.equal(loader.loadNext(), one);
  assert.equal(loader.status().busy, true);
  assert.equal(await one, null);
  const received = []; await loader.loadAll(p => received.push(p.name));
  assert.deepEqual(received, ['d']); assert.equal(peak, 1);
  assert.deepEqual(loader.status().failed, ['b','c']);
  assert(calls.includes('data/d?v=123'));
  broken = false; await loader.retryFailed(p => received.push(p.name));
  assert.deepEqual(received, ['d','b','c']);
  assert.deepEqual(loader.status(), {total:4, loaded:4, failed:[], pending:0, busy:false});
  const retryCalls = [];
  let retryBroken = true;
  const partial = createPartLoader({parts:['first','second','third','fourth'], stamp:1,
    fetchJson: async url => {
      retryCalls.push(url);
      await new Promise(resolve => setImmediate(resolve));
      if (url.includes('/second') && retryBroken) throw Error('404');
      return [];
    }});
  await partial.loadFirst();
  const failing = partial.loadNext();
  assert.equal(partial.retryFailed(), failing);
  await failing;
  const retried = [];
  const retry = partial.retryFailed(p => retried.push(p.name));
  assert.equal(partial.retryFailed(), retry);
  await retry;
  assert.deepEqual(partial.status(), {total:4, loaded:1, failed:['second'], pending:2, busy:false});
  retryBroken = false;
  await partial.retryFailed(p => retried.push(p.name));
  assert.deepEqual(retried, ['second']);
  assert.deepEqual(retryCalls, ['data/first?v=1', 'data/second?v=1', 'data/second?v=1', 'data/second?v=1']);
  assert.deepEqual(partial.status(), {total:4, loaded:2, failed:[], pending:2, busy:false});
  // An external request during an async batch callback must not consume pending parts.
  for (const mode of ['retryFailed', 'loadAll']) {
    let broken = true, running = 0, maximum = 0;
    const fetched = [];
    const guarded = createPartLoader({parts:['bad1','bad2','pending'], stamp:1,
      fetchJson: async url => {
        fetched.push(url);
        maximum = Math.max(maximum, ++running);
        try {
          await new Promise(resolve => setImmediate(resolve));
          if (broken) throw Error('404');
          return [];
        } finally { running--; }
      }});
    await guarded.loadNext();
    await guarded.loadNext();
    broken = false;
    let enter, release;
    const entered = new Promise(resolve => { enter = resolve; });
    const gate = new Promise(resolve => { release = resolve; });
    let first = true;
    const batch = guarded[mode](async () => {
      if (first) { first = false; enter(); await gate; }
    });
    await entered;
    const before = fetched.length;
    const external = guarded.loadNext();
    await Promise.resolve();
    const duringCallback = fetched.length;
    release();
    await batch;
    const externalResult = await external;
    assert.equal(maximum, 1);
    assert.equal(externalResult, null);
    assert.equal(duringCallback, before);
    if (mode === 'retryFailed') {
      assert.equal(guarded.status().pending, 1);
      assert.deepEqual(fetched, ['data/bad1?v=1', 'data/bad2?v=1', 'data/bad1?v=1', 'data/bad2?v=1']);
    }
  }
  const fallback = createPartLoader({parts:['bad','good'], stamp:1, fetchJson: async u => {
    if (u.includes('bad')) throw Error(); return [];
  }});
  assert.equal((await fallback.loadFirst()).name, 'good');
  assert.deepEqual(fallback.status().failed, ['bad']);
  const dead = createPartLoader({parts:['bad'], fetchJson: async () => {throw Error();}});
  assert.equal(await dead.loadFirst(), null);
})().catch(e => { console.error(e); process.exitCode = 1; });
