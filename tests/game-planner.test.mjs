import {test} from 'node:test';
import assert from 'node:assert/strict';
import {plannerSummary,recommendGames} from '../src/game-planner.ts';
const estimate=n=>({supported:true,source:'igdb',mainMinutes:n,extrasMinutes:n===null?null:n*2,completionistMinutes:null,sampleCount:2});
const game=(id,extra={})=>({id,title:id,status:'planned',priority:'none',platform:'PC',genres:['RPG'],playtimeMinutes:0,estimate:estimate(600),estimateFailed:false,...extra});
test('backlog soma restante por conteúdo e separa cobertura, média atingida e falhas',()=>{
 const list=[game('principal',{playtimeMinutes:120}),game('dlc',{parentGameCatalogId:'igdb:game:1',estimate:estimate(60),playtimeMinutes:30}),game('sem',{estimate:estimate(null)}),game('erro',{estimate:null,estimateFailed:true}),game('passou',{playtimeMinutes:700})];
 assert.deepEqual(plannerSummary(list,'mainMinutes'),{minutes:510,known:3,unknown:2,failed:1});
 assert.equal(plannerSummary(list,'completionistMinutes').known,0);
});
test('sugestões respeitam prioridade, andamento, orçamento, gênero e plataforma sem sortear a lista',()=>{
 const list=[game('baixo',{priority:'low',estimate:estimate(60)}),game('alto',{priority:'high'}),game('ativo',{status:'active'}),game('futuro',{priority:'high',releaseDate:'2099-01-01'}),game('nao anunciado',{unreleased:true}),game('sem',{estimate:null}),game('PS5',{platform:'PS5'}),game('outro gênero',{genres:['Ação']})];
 const recommend=(budget=0,platform='PC',genre='RPG')=>recommendGames(list,'mainMinutes',budget,platform,genre,'2026-11-02').map(row=>row.item.id);
 assert.deepEqual(recommend(),['alto','baixo','ativo','sem']);
 assert.deepEqual(recommend(90),['baixo']);
 assert.deepEqual(recommend(0,'PS5'),['PS5']);
 assert.deepEqual(recommendGames([game('passou',{playtimeMinutes:700})],'mainMinutes',60,'','','2026-11-02'),[]);
});
