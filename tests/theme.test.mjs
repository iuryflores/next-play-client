import { test } from 'node:test';
import assert from 'node:assert/strict';
import { initializeTheme, rememberTheme, readTheme } from '../src/theme.ts';

test('aparência usa apenas a sessão em memória e nunca acessa armazenamento local', () => {
  globalThis.localStorage = {
    getItem() {
      assert.fail('Tema não deve ler localStorage');
    },
    setItem() {
      assert.fail('Tema não deve gravar localStorage');
    },
  };
  const events = new Map();
  globalThis.window = {
    addEventListener(name, listener) {
      events.set(name, listener);
    },
    dispatchEvent(event) {
      events.get(event.type)?.(event);
    },
  };
  const root = {
    dataset: {},
    classList: {
      toggle(_, value) {
        root.dark = value;
      },
    },
  };
  const meta = {
    setAttribute(_, value) {
      meta.content = value;
    },
  };
  globalThis.document = {
    documentElement: root,
    ['query' + 'Selector']: () => meta,
  };
  const media = {
    matches: true,
    addEventListener(_, listener) {
      media.change = listener;
    },
  };
  globalThis.matchMedia = () => media;
  globalThis.CustomEvent = class {
    constructor(type, { detail }) {
      this.type = type;
      this.detail = detail;
    }
  };
  initializeTheme();
  assert.equal(root.dataset.theme, 'dark');
  rememberTheme('light');
  assert.equal(root.dataset.theme, 'light');
  assert.equal(root.dark, false);
  assert.equal(meta.content, '#f5f3f9');
  media.change({ matches: true });
  assert.equal(
    root.dataset.theme,
    'light',
    'escolha explícita prevalece sobre o sistema',
  );
  rememberTheme('dark');
  assert.equal(root.dataset.theme, 'dark');
  media.matches = false;
  rememberTheme('system');
  assert.equal(root.dataset.theme, 'light');
  media.change({ matches: true });
  assert.equal(root.dataset.theme, 'dark');
  assert.equal(readTheme(), 'system');
  rememberTheme('light');
  media.change({ matches: true });
  assert.equal(
    root.dataset.theme,
    'light',
    'troca funciona mesmo sem persistência',
  );
});
