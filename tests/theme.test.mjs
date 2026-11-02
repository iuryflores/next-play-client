import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  initializeTheme,
  rememberTheme,
  readTheme,
  themeKey,
} from '../src/theme.ts';

test('aparência respeita sistema, escolha explícita, outras abas e armazenamento bloqueado', () => {
  const storage = new Map();
  let blocked = false;
  globalThis.localStorage = {
    getItem(key) {
      if (blocked) throw new Error('blocked');
      return storage.get(key) ?? null;
    },
    setItem(key, value) {
      if (blocked) throw new Error('blocked');
      storage.set(key, value);
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
  storage.set(themeKey, 'dark');
  events.get('storage')({ key: themeKey });
  assert.equal(root.dataset.theme, 'dark');
  storage.delete(themeKey);
  media.matches = false;
  events.get('storage')({ key: null });
  assert.equal(root.dataset.theme, 'light');
  media.change({ matches: true });
  assert.equal(root.dataset.theme, 'dark');
  blocked = true;
  assert.equal(readTheme(), 'system');
  rememberTheme('light');
  media.change({ matches: true });
  assert.equal(
    root.dataset.theme,
    'light',
    'troca funciona mesmo sem persistência',
  );
});
