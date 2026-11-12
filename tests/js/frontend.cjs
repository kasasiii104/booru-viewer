const fs = require('node:fs'), vm = require('node:vm'), assert = require('node:assert/strict');
class Element {
  constructor() { this.children=[]; this.style={}; this.dataset={}; this.hidden=false; this.textContent='';
    this.classList={toggle(){}, add(){}, remove(){}, contains(){return false;}}; }
  set innerHTML(v) {this.children=[];} get innerHTML() {return '';}
  append(...v) {this.children.push(...v);} appendChild(v) {this.append(v);}
  addEventListener() {} cloneNode() {return new Element();} replaceWith() {}
  querySelector(selector) {
    const matches = node => String(node.className || '').split(/\s+/).includes(selector.slice(1));
    for (const child of this.children) {
      if (matches(child)) return child;
      const found = child.querySelector(selector);
      if (found) return found;
    }
    return null;
  }
  remove() {} play() {} pause() {} blur() {}
}
(async () => {
  const taxonomyFail = process.argv.includes('--taxonomy-fail');
  const catalogFail = process.argv.includes('--catalog-fail');
  const namesFail = process.argv.includes('--names-fail');
  const allFail = process.argv.includes('--all-fail');
  const nodes = new Map(), calls=[], events={}; let broken=true;
  const get = id => {if (!nodes.has(id)) nodes.set(id,new Element()); return nodes.get(id);};
  const document={getElementById:get, createElement:()=>new Element(), querySelectorAll:()=>[], body:new Element()};
  document.body.offsetHeight=1000;
  const window={addEventListener:(name, fn)=>events[name]=fn, innerHeight:1000, scrollY:0};
  const row = n => ({md5:String(n), score:n, tags:['tag'], copyright_tags:['work'], character_tags:[], source:'danbooru'});
  const context=vm.createContext({document,window, console, Date, setTimeout:()=>0, clearTimeout(){},
    localStorage:{getItem:()=>null}, fetch:async url=> {
      calls.push(url); const path=url.split('?')[0];
      const data={ 'data/catalog.json':{parts:['cards-1.json','cards-2.json','cards-3.json'],count:3},
        'data/cards-1.json':[row(1)], 'data/cards-2.json':[row(2)], 'data/cards-3.json':[row(3)],
        'data/taxonomy.json':{works:[{id:'work',name:'作品',tags:['work']}],characters:[]}, 'data/tag-names.json':{} };
      return {ok:!(broken && (path==='data/cards-3.json' || (taxonomyFail && path==='data/taxonomy.json') || (catalogFail && path==='data/catalog.json') || (namesFail && path==='data/tag-names.json') || (allFail && path.includes('/cards-')))), status:404, json:async()=>data[path]};
    }});
  const html=fs.readFileSync('index.html','utf8');
  const scripts=[...html.matchAll(/<script src="([^"?]+)/g)].map(m=>m[1]);
  assert.deepEqual(scripts,['js/loader.js','js/app.js','js/search.js','js/more.js','js/gelbooru.js']);
  scripts.forEach(file=>vm.runInContext(fs.readFileSync(file,'utf8'),context,{filename:file}));
  const flush=()=>new Promise(resolve=>setImmediate(resolve)); await flush();
  if (process.argv.includes('--gelbooru-boundaries')) {
    const opened=[], previewed=[];
    window.open=(...args)=>opened.push(args);
    context.previewed=previewed;
    vm.runInContext('playPreview = item => previewed.push(item)', context);
    const check = (count, favOnly, mixed, visible=240) => {
      // Reverse input order so assertions also exercise the filtered sort order.
      const items=Array.from({length:count}, (_, i)=>({...row(i), score:count-i,
        source:mixed && i % 2 === 0 ? 'danbooru' : 'gelbooru',
        file_url:`https://media.example/${i}.mp4`, post_url:`https://posts.example/${i}`,
        preview_url:i % 2 ? `https://thumbs.example/${i}.jpg` : ''}));
      context.testItems=[...items].reverse(); context.testFavOnly=favOnly; context.testVisible=visible;
      context.localStorage.getItem=()=>JSON.stringify(items.map(item=>item.md5));
      vm.runInContext('state.items=testItems; state.favOnly=testFavOnly; state.visible=testVisible; renderGrid()',context);
      const cards=get('grid').children;
      assert.equal(cards.length, favOnly && visible===240 ? count : Math.min(count,visible));
      for (const index of [...new Set([0,238,239,240,241,478,479,480,cards.length-1])].filter(i=>i>=0 && i<cards.length)) {
        const item=items[index], card=cards[index];
        for (const selector of ['.thumb','.title']) {
          opened.length=0; previewed.length=0;
          card.querySelector(selector).onclick();
          const label=`${count} favorites=${favOnly} mixed=${mixed} visible=${visible} card=${index+1} ${selector}`;
          if (item.source==='gelbooru') {
            assert.deepEqual(opened,[[item.post_url,'_blank','noopener']],label);
            assert.equal(previewed.length,0,label);
          } else {
            assert.equal(opened.length,0,label);
            if (selector==='.thumb') assert.equal(previewed[0],item,label);
            else assert.equal(vm.runInContext('state.current',context),item,label);
          }
        }
      }
    };
    for (const count of [240,241,481]) check(count,true,false);
    check(481,true,true);
    check(481,false,false);
    check(481,false,true);
    check(481,false,true,480);
    check(481,false,true,720);
    return;
  }
  if (allFail || taxonomyFail || catalogFail) {
    assert.equal(get('empty').hidden, false);
    assert.equal(get('empty').textContent, 'データを読めませんでした。再読み込みしてください。');
    assert.equal(get('loadstate').hidden, true);
    assert.equal(vm.runInContext('state.items.length',context), 0);
    const before = calls.length;
    broken=false;
    for (const id of ['load-more', 'load-all', 'load-retry']) {
      assert.equal(get(id).disabled, true);
      await get(id).onclick();
    }
    events.scroll(); await flush();
    assert.equal(calls.length, before);
    assert.equal(get('loadstate').hidden, true);
    return;
  }
  assert.deepEqual(calls.map(u=>u.split('?')[0]).sort(),['data/catalog.json','data/cards-1.json','data/tag-names.json','data/taxonomy.json'].sort());
  assert.equal(vm.runInContext('state.items.length',context),1);
  vm.runInContext('shelfCounts()',context);
  await get('load-more').onclick();
  assert.equal(vm.runInContext('state.items.length',context),2);
  assert.equal(vm.runInContext('shelfCounts().works[0].count',context),2);
  assert.match(get('count').textContent,/2/);
  // F1: reveal already-loaded results before requesting another part.
  vm.runInContext('state.visible = 1', context);
  const beforeScroll = calls.length;
  events.scroll();
  assert.equal(calls.length, beforeScroll);
  assert.equal(vm.runInContext('state.visible', context), 241);
  events.scroll(); await flush();
  assert.match(get('load-message').textContent,/1 パートの読込に失敗/);
  assert(!get('empty').textContent.includes('データを読めませんでした'));
  assert.equal(get('load-retry').hidden,false);
  broken=false; await get('load-retry').onclick();
  assert.equal(vm.runInContext('state.items.length',context),3);
  assert.equal(get('load-more').hidden,true); assert.equal(get('load-retry').hidden,true);
})().catch(e=>{console.error(e);process.exitCode=1;});
