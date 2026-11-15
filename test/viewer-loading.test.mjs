import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { JSDOM } from 'jsdom';
import { Viewer } from '../public/viewer.mjs';

test('描画器準備中の編集を防ぎ、前のファイルの遅い準備結果を反映しない', async () => {
  const dom = new JSDOM(await readFile(new URL('../public/index.html', import.meta.url), 'utf8'), { url: 'http://localhost/workspaces' });
  const previous = Object.fromEntries(['window','document','location','ResizeObserver','EventSource'].map(key => [key, Object.getOwnPropertyDescriptor(globalThis, key)]));
  let viewer;
  try {
    Object.assign(globalThis, { window: dom.window, document: dom.window.document, location: dom.window.location,
      ResizeObserver: class { observe() {} }, EventSource: class { close() {} } });
    const releases = new Map(), accepted = [];
    viewer = new Viewer({
      rendererFor: path => ({ editorLabel: path,
        ready: () => new Promise(resolve => releases.set(path, resolve)),
        createState: () => ({}), highlight: source => source,
        render: async () => ({ svg: '<svg></svg>' }),
      }),
      api: async endpoint => endpoint === '/api/session' ? { token: 'test' } : { source: endpoint.includes('first') ? 'first' : 'second' },
      onSaved: (repo, path, source) => accepted.push({ path, source }),
    });
    const first = viewer.open('repo', 'first.mmd');
    assert.equal(document.getElementById('source').disabled, true);
    const second = viewer.open('repo', 'second.mmd');
    releases.get('second.mmd')(); await second;
    assert.equal(document.getElementById('source').disabled, false);
    assert.equal(document.getElementById('source').value, 'second');
    releases.get('first.mmd')(); await first;
    assert.deepEqual(accepted, [{ path: 'second.mmd', source: 'second' }]);
    assert.equal(document.getElementById('source').value, 'second');
  } finally {
    viewer?.close(); dom.window.close();
    for (const [key, descriptor] of Object.entries(previous)) { if (descriptor) Object.defineProperty(globalThis, key, descriptor); else delete globalThis[key]; }
  }
});
