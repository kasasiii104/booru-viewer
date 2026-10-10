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
function indexItem(item) {
  if (item._ready) return;
  const works = [];
  const characters = [];
  const seenWork = new Set();
  const seenCharacter = new Set();
  const tags = [...(item.copyright_tags || []), ...(item.character_tags || []), ...(item.tags || [])];
  tags.forEach((raw) => {
    const tag = String(raw).toLowerCase();
    const work = state.searchMaps.works.get(tag);
    if (work && !seenWork.has(work)) { seenWork.add(work); works.push(work); }
    const character = state.searchMaps.characters.get(tag);
    if (character && !seenCharacter.has(character)) { seenCharacter.add(character); characters.push(character); }
  });
  item._works = works;
  item._characters = characters;
  item._tagSet = new Set((item.tags || []).map((tag) => String(tag).toLowerCase()));
  item._text = [works.map(ja).join(" "), characters.map(ja).join(" "), ...(item.tags || []).map(ja)].join(" ").toLowerCase();
  item._ready = true;
}
function indexItems() {
  if (!state.searchMaps) buildSearchMaps();
  state.items.forEach(indexItem);
}
const labelDirect = label;
label = function (item) {
  if (!item._ready) return labelDirect(item);
  return {
    name: item._characters.length ? item._characters.map(ja).join(" / ") : "動画",
    workName: item._works.length ? item._works.map(ja).join(" / ") : "未分類",
    works: item._works,
    characters: item._characters
  };
};
const filteredDirect = filtered;
filtered = function () {
  indexItems();
  const q = state.q.trim().toLowerCase();
  const rows = state.items.filter((item) => {
    if (state.favOnly && !isFav(item)) return false;
    if (state.work === "uncategorized" && item._works.length) return false;
    if (state.work !== "all" && state.work !== "uncategorized" && !item._works.includes(state.work)) return false;
    if (state.character && !item._characters.includes(state.character)) return false;
    if (state.tag && !item._tagSet.has(state.tag)) return false;
    return !q || item._text.includes(q);
  });
  rows.sort((a, b) => state.sort === "new" ? String(b.created_at).localeCompare(String(a.created_at)) : state.sort === "rating" ? ratingValue(b) - ratingValue(a) || (b.score || 0) - (a.score || 0) : (b.score || 0) - (a.score || 0));
  return rows;
};
const box = $("q");
const search = box.cloneNode(true);
box.replaceWith(search);
let timer = 0;
search.addEventListener("input", (event) => {
  clearTimeout(timer);
  timer = setTimeout(() => { state.q = event.target.value; state.visible = 240; renderGrid(); }, 250);
});
