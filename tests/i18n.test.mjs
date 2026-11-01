import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import ts from 'typescript';
const compile = code => ts.transpileModule(code, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText;
const url = code => 'data:text/javascript;base64,' + Buffer.from(code).toString('base64');
const dictionaryUrl = url(compile(fs.readFileSync(new URL('../src/translations.ts', import.meta.url), 'utf8')));
const statsUrl = url(compile(fs.readFileSync(new URL('../src/stats-summary.ts', import.meta.url), 'utf8')));
const { translations } = await import(dictionaryUrl);
test('all translations preserve interpolation parameters and include both languages', () => {
  for (const [source, pair] of Object.entries(translations)) {
    assert.equal(pair.length, 2);
    for (const translation of pair) {
      assert.ok(translation?.trim(), source);
      assert.deepEqual(translation.match(/\{\d+\}/g)?.sort() || [], source.match(/\{\d+\}/g)?.sort() || [], source);
    }
  }
});
test('language preference drives labels, interpolation, genres, dates and errors', async () => {
  const previous = globalThis.localStorage;
  try {
    for (const [language, settings, genre, date] of [['pt-BR', 'Configurações', 'Fantasia', '07/09/2026'], ['en-US', 'Settings', 'Fantasy', '07/09/2026'], ['es-ES', 'Configuración', 'Fantasía', '07/09/2026']]) {
      let saved = language;
      globalThis.localStorage = { getItem: () => saved, setItem: (_, value) => { saved = value; } };
      const source = compile(fs.readFileSync(new URL('../src/i18n.ts', import.meta.url), 'utf8'))
        .replace("'./translations'", JSON.stringify(dictionaryUrl))
        .replace("'./stats-summary'", JSON.stringify(statsUrl));
      const i18n = await import(url(source + '\n// ' + language));
      assert.equal(i18n.language, language);
      assert.equal(i18n.t('Configurações'), settings);
      assert.equal(i18n.genreLabel('fantasia'), genre);
      assert.equal(i18n.dateLabel('2026-09-07'), date);
      assert.ok(i18n.t('{0} de {1} episódios assistidos', 3, 10).includes('10'));
      assert.equal(i18n.t('Custom title'), 'Custom title');
      assert.equal(i18n.validLanguage('invalid'), 'pt-BR');
      i18n.rememberLanguage('es-ES'); assert.equal(saved, 'es-ES');
      if (language !== 'pt-BR') assert.notEqual(i18n.apiMessage(400, 'Mensagem desconhecida'), 'Mensagem desconhecida');
    }
  } finally { if (previous === undefined) delete globalThis.localStorage; else globalThis.localStorage = previous; }
});

