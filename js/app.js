async function loadItems() {
  const stamp = Date.now();
  const catalog = await fetch("data/catalog.json?v=" + stamp).then((r) => r.ok ? r.json() : { parts: ["videos.json"] });
  const parts = catalog.parts && catalog.parts.length ? catalog.parts : ["videos.json"];
  const groups = await Promise.all(parts.map((name) => fetch("data/" + name + "?v=" + stamp).then((r) => r.json())));
  return groups.flat();
}
loadItems().then((items) => {
  state.items = Array.isArray(items) ? items : [];
  return Promise.all([
    fetch("data/taxonomy.json?v=" + Date.now()).then((r) => r.json()),
    fetch("data/tag-names.json?v=" + Date.now()).then((r) => r.json())
  ]);
}).then(([taxonomy, names]) => {
  state.taxonomy = taxonomy;
  state.names = names || {};
  taxonomy.works.forEach((work) => { state.names[work.id] = work.name; work.tags.forEach((tag) => { state.names[tag] = work.name; }); });
  taxonomy.characters.forEach((character) => { state.names[character.id] = character.name; character.tags.forEach((tag) => { state.names[tag] = character.name; }); });
  render();
}).catch(() => { $("empty").hidden = false; $("empty").textContent = "データを読めませんでした。"; });
