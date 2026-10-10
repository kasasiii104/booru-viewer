async function loadItems() {
  const stamp = Date.now();
  $("count").textContent = "読み込み中";
  const catalog = await fetch("data/catalog.json?v=" + stamp).then((r) => r.ok ? r.json() : { parts: ["videos.json"] });
  const parts = catalog.parts && catalog.parts.length ? catalog.parts : ["videos.json"];
  const loadPart = (name) => fetch("data/" + name + "?v=" + stamp).then((r) => r.json());
  const first = await Promise.all(parts.slice(0, 2).map(loadPart));
  return { items: first.flat(), rest: parts.slice(2).map(loadPart) };
}
loadItems().then(async ({ items, rest }) => {
  state.items = Array.isArray(items) ? items : [];
  const [taxonomy, names] = await Promise.all([
    fetch("data/taxonomy.json?v=" + Date.now()).then((r) => r.json()),
    fetch("data/tag-names.json?v=" + Date.now()).then((r) => r.json())
  ]);
  state.taxonomy = taxonomy;
  state.names = names || {};
  taxonomy.works.forEach((work) => { state.names[work.id] = work.name; work.tags.forEach((tag) => { state.names[tag] = work.name; }); });
  taxonomy.characters.forEach((character) => { state.names[character.id] = character.name; character.tags.forEach((tag) => { state.names[tag] = character.name; }); });
  render();
  if (!rest.length) return;
  const groups = await Promise.all(rest);
  state.items = state.items.concat(groups.flat());
  render();
}).catch(() => { $("empty").hidden = false; $("empty").textContent = "データを読めませんでした。"; });
