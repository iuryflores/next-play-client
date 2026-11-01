import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readingForCopy} from '../src/book-reading-link.ts';

test('exemplares da mesma edição reutilizam a leitura sem confundir edições ou outras mídias', () => {
  const items = [
    {id:'movie',kind:'movie',title:'Duna',catalogId:'tmdb:movie:1'},
    {id:'other-edition',kind:'book',title:'Duna',catalogId:'googlebooks:book:other'},
    {id:'book',kind:'book',title:'Duna',catalogId:'googlebooks:book:dune'},
  ];
  const copy = {id:'copy1',kind:'book',title:'Duna',catalogId:'googlebooks:book:dune'};
  assert.equal(readingForCopy(items,copy).id,'book');
  assert.equal(readingForCopy(items,{...copy,id:'copy2',format:'digital'}).id,'book');
  assert.equal(readingForCopy(items,{...copy,catalogId:'googlebooks:book:new'}),undefined);
  assert.equal(readingForCopy(items,{...copy,kind:'movie'}),undefined);
});

test('livros manuais compartilham a identidade de título da API sem capturar obras vinculadas', () => {
  const linked = {id:'linked',kind:'book',title:'Duna',catalogId:'googlebooks:book:dune'};
  const manual = {id:'manual',kind:'book',title:' DUNA ',status:'completed',archived:true};
  const copy = {id:'copy',kind:'book',title:'Duna'};
  assert.equal(readingForCopy([linked],copy),undefined);
  assert.equal(readingForCopy([linked,manual],copy),manual);
  assert.equal(readingForCopy([{...manual,kind:'game'}],copy),undefined);
});
