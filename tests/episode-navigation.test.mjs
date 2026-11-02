import {test} from 'node:test';
import assert from 'node:assert/strict';
import {nextEpisode, hasEarlierUnwatched} from '../src/episode-navigation.ts';
const ep=(number,watched=false)=>({number,name:'Episode '+number,airDate:'2020-01-01',watchedAt:watched?'2020-01-02':null});
const season=(number,episodes,loaded=true)=>({number,name:'Season '+number,total:episodes.length,loaded,episodes});
test('resume starts at S1E1, advances, and reopens at saved E2',()=>{
 const data={supported:true,seasons:[season(0,[ep(1)]),season(1,[ep(1),ep(2)])]};
 assert.deepEqual(nextEpisode(data),{season:1,episode:1});data.seasons[1].episodes[0].watchedAt='2020-01-02';
 assert.deepEqual(nextEpisode(data),{season:1,episode:2});assert.deepEqual(nextEpisode(JSON.parse(JSON.stringify(data))),{season:1,episode:2});
});
test('advances across seasons, imports missing seasons, and finishes',()=>{
 const data={supported:true,seasons:[season(1,[ep(1,true)]),season(2,[],false)]};
 assert.deepEqual(nextEpisode(data),{season:2,episode:null});data.seasons[1]=season(2,[ep(1)]);
 assert.deepEqual(nextEpisode(data),{season:2,episode:1});data.seasons[1].episodes[0].watchedAt='2020-01-02';assert.equal(nextEpisode(data),null);
});
test('sorts episodes, fills gaps, excludes specials, preserves future pending',()=>{
 const data={supported:true,seasons:[season(2,[ep(1)]),season(1,[ep(3,true),ep(2),ep(1,true)]),season(0,[ep(1)])]};
 assert.deepEqual(nextEpisode(data),{season:1,episode:2});data.seasons[1].episodes[1].airDate='2099-01-01';assert.deepEqual(nextEpisode(data),{season:1,episode:2});
 assert.equal(nextEpisode({supported:true,seasons:[season(0,[ep(1)])]}),null);
});

test('asks about earlier gaps but not for the next episode',()=>{
const data={supported:true,seasons:[season(0,[ep(1)]),season(1,[ep(1,true),ep(2),ep(3)])]};
assert.equal(hasEarlierUnwatched(data,{season:1,episode:2}),false);
assert.equal(hasEarlierUnwatched(data,{season:1,episode:3}),true);
assert.equal(hasEarlierUnwatched({...data,seasons:[season(1,[],false),season(2,[ep(1)])]},{season:2,episode:1}),true);
assert.equal(hasEarlierUnwatched(data,{season:0,episode:1}),false);
});


test('episódios assistidos sem data não reaparecem como pendentes', () => {
  const unknown = { ...ep(1), watched: true, watchedDateUnknown: true };
  const data = { supported: true, seasons: [season(1, [unknown, ep(2)])] };
  assert.deepEqual(nextEpisode(data), { season: 1, episode: 2 });
  assert.equal(hasEarlierUnwatched(data, { season: 1, episode: 2 }), false);
  data.seasons[0].episodes[1] = { ...ep(2), watched: true, watchedDateUnknown: true };
  assert.equal(nextEpisode(data), null);
});
