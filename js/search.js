function buildSearchMaps() {
  const works = new Map();
  const characters = new Map();
  state.taxonomy.works.forEach((work) => {
    works.set(work.id, work.id);
    work.tags.forEach((tag) => works.set(String(tag).toLowerCase(), work.id));
  });
  state.taxonomy.characters.forEach((character) => {
    characters.set(character.id, character.id);
    character.tags.forEach((tag) => characters.set(String(tag).toLowerCase(), character.id));
  });
  state.searchMaps = { works, characters };
}
function bareTag(tag) {
  return String(tag).toLowerCase().replace(/_\([^)]+\)$/, "").replace(/_\(cosplay\)$/, "");
}
function characterId(tag) {
  const raw = String(tag).toLowerCase();
  const maps = state.searchMaps.characters;
  if (maps.has(raw)) return maps.get(raw);
  const bare = bareTag(raw);
  if (maps.has(bare)) return maps.get(bare);
  for (const [alias, id] of maps) {
    if (alias.length < 2) continue;
    if (raw === alias || bare === alias || raw.startsWith(alias + "_") || raw.endsWith("_" + alias) || raw.includes("_" + alias + "_") || raw.includes("_(" + alias)) return id;
  }
  return "";
}
function workId(tag) {
  const raw = String(tag).toLowerCase();
  const maps = state.searchMaps.works;
  if (maps.has(raw)) return maps.get(raw);
  const bare = bareTag(raw);
  return maps.get(bare) || "";
}
function indexItem(item) {
  if (item._ready) return;
  const works = [];
  const characters = [];
  const seenWork = new Set();
  const seenCharacter = new Set();
  const tags = [...(item.copyright_tags || []), ...(item.character_tags || []), ...(item.tags || [])];
  tags.forEach((raw) => {
    const work = workId(raw);
    if (work && !seenWork.has(work)) { seenWork.add(work); works.push(work); }
    const character = characterId(raw);
    if (character && !seenCharacter.has(character)) { seenCharacter.add(character); characters.push(character); }
  });
  item._works = works;
  item._characters = characters;
  item._tagSet = new Set(tags.map((tag) => String(tag).toLowerCase()));
  item._text = [works.map(ja).join(" "), characters.map(ja).join(" "), ...tags.map(ja)].join(" ").toLowerCase();
  item._ready = true;
}
function indexItems() {
  if (!state.searchMaps) buildSearchMaps();
  state.items.forEach(indexItem);
}
function shelfCounts() {
  indexItems();
  if (state.shelf && state.shelf.n === state.items.length) return state.shelf;
  const works = new Map();
  const characters = new Map();
  const tags = new Map();
  let uncategorized = 0;
  state.items.forEach((item) => {
    if (!item._works.length) uncategorized += 1;
    item._works.forEach((id) => works.set(id, (works.get(id) || 0) + 1));
    item._characters.forEach((id) => characters.set(id, (characters.get(id) || 0) + 1));
    (item.tags || []).forEach((tag) => {
      const key = String(tag).toLowerCase();
      if (state.searchMaps.works.has(key) || state.searchMaps.characters.has(bareTag(key))) return;
      tags.set(key, (tags.get(key) || 0) + 1);
    });
  });
  const rows = (map) => [...map.entries()].sort((a, b) => b[1] - a[1]).map(([id, count]) => ({ id, name: ja(id), count }));
  state.shelf = { n: state.items.length, works: rows(works), characters: rows(characters), tags: rows(tags), uncategorized };
  return state.shelf;
}
const labelDirect = label;
label = function (item) {
  if (!item._ready) indexItem(item);
  return {
    name: item._characters.length ? item._characters.map(ja).join(" / ") : "動画",
    workName: item._works.length ? item._works.map(ja).join(" / ") : "未分類",
    works: item._works,
    characters: item._characters
  };
};
filtered = function () {
  indexItems();
  const q = state.q.trim().toLowerCase();
  const characterName = state.character ? ja(state.character).toLowerCase() : "";
  const rows = state.items.filter((item) => {
    if (state.favOnly && !isFav(item)) return false;
    if (state.work === "uncategorized" && item._works.length) return false;
    if (state.work !== "all" && state.work !== "uncategorized" && !item._works.includes(state.work)) return false;
    if (state.character && !item._characters.includes(state.character) && !item._text.includes(characterName) && !item._text.includes(state.character)) return false;
    if (state.tag && !item._tagSet.has(state.tag)) return false;
    return !q || item._text.includes(q);
  });
  rows.sort((a, b) => state.sort === "new" ? String(b.created_at).localeCompare(String(a.created_at)) : state.sort === "rating" ? ratingValue(b) - ratingValue(a) || (b.score || 0) - (a.score || 0) : (b.score || 0) - (a.score || 0));
  return rows;
};
renderPanel = function () {
  const panel = $("panel");
  panel.hidden = !state.panel;
  document.querySelectorAll("[data-panel]").forEach((button) => button.classList.toggle("is-on", button.dataset.panel === state.panel));
  if (!state.panel) return;
  const shelf = shelfCounts();
  const source = state.panel === "work"
    ? [{ id: "all", name: "すべて", count: state.items.length }, { id: "uncategorized", name: "未分類", count: shelf.uncategorized }, ...shelf.works]
    : state.panel === "character" ? [{ id: "", name: "すべて", count: "" }, ...shelf.characters] : [{ id: "", name: "すべて", count: "" }, ...shelf.tags];
  const q = state.panelQ.trim().toLowerCase();
  const rows = source.filter((row) => !q || row.name.toLowerCase().includes(q) || row.id.includes(q)).slice(0, 80);
  const list = $("panel-list");
  list.innerHTML = "";
  rows.forEach((row) => {
    const button = document.createElement("button");
    const active = state.panel === "work" ? state.work === row.id : state.panel === "character" ? state.character === row.id : state.tag === row.id;
    button.className = "work" + (active ? " is-on" : "");
    button.textContent = row.name + (row.count === "" ? "" : "  " + row.count);
    button.onclick = () => {
      if (state.panel === "work") state.work = row.id;
      if (state.panel === "character") state.character = row.id;
      if (state.panel === "tag") state.tag = row.id;
      state.panel = "";
      state.visible = 240;
      render();
    };
    list.appendChild(button);
  });
};
const box = $("q");
const search = box.cloneNode(true);
box.replaceWith(search);
let timer = 0;
search.addEventListener("input", (event) => {
  clearTimeout(timer);
  timer = setTimeout(() => { state.q = event.target.value; state.visible = 240; renderGrid(); }, 250);
});
