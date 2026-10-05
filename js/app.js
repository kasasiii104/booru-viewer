const state = { items: [], taxonomy: { works: [], characters: [] }, names: {}, work: "all", character: "", sort: "score", q: "" };
const TOOLS = ["source_filmmaker", "sfm", "blender", "blender_(medium)", "mmd", "mikumikudance", "daz_studio", "koikatsu", "honey_select", "xps", "xnalara", "cinema_4d"];
const $ = (id) => document.getElementById(id);

function norm(tags) {
  return (tags || []).map((t) => String(t).toLowerCase()).filter(Boolean);
}
function pretty(tag) {
  return String(tag || "").replaceAll("_", " ");
}
function ja(tag) {
  const key = String(tag || "").toLowerCase();
  return state.names[key] || pretty(key);
}
function workTags(item) {
  const copyright = norm(item.copyright_tags);
  if (copyright.length) return copyright;
  const tags = norm(item.tags);
  return state.taxonomy.works.filter((work) => work.tags.some((t) => tags.includes(t))).map((work) => work.id);
}
function label(item) {
  const tags = norm(item.tags);
  const character = state.taxonomy.characters.find((c) => c.tags.some((t) => tags.includes(t)));
  const works = workTags(item);
  return {
    name: character ? character.name : ja(tags.find((t) => !TOOLS.includes(t)) || "無題"),
    workName: works.length ? works.map(ja).join(" / ") : "未分類",
    works
  };
}
function shelves() {
  const counts = new Map();
  state.items.forEach((item) => workTags(item).forEach((tag) => counts.set(tag, (counts.get(tag) || 0) + 1)));
  return [...counts.entries()].sort((a, b) => b[1] - a[1]).map(([tag, count]) => ({ id: tag, name: ja(tag), count }));
}
function filtered() {
  const q = state.q.trim().toLowerCase();
  const rows = state.items.filter((item) => {
    const works = workTags(item);
    const tags = norm(item.tags);
    const character = state.taxonomy.characters.find((c) => c.tags.some((t) => tags.includes(t)));
    if (state.work === "uncategorized" && works.length) return false;
    if (state.work !== "all" && state.work !== "uncategorized" && !works.includes(state.work)) return false;
    if (state.character && (!character || character.id !== state.character)) return false;
    if (!q) return true;
    return [label(item).name, label(item).workName, ...works.map(ja), ...tags].join(" ").toLowerCase().includes(q);
  });
  rows.sort((a, b) => state.sort === "new" ? String(b.created_at).localeCompare(String(a.created_at)) : (b.score || 0) - (a.score || 0));
  return rows;
}
function renderNav() {
  const nav = $("works");
  nav.innerHTML = "";
  const add = (id, text) => {
    const button = document.createElement("button");
    button.className = "work" + (state.work === id ? " is-on" : "");
    button.textContent = text;
    button.onclick = () => { state.work = id; state.character = ""; nav.classList.remove("is-open"); render(); };
    nav.appendChild(button);
  };
  add("all", "ホーム");
  add("uncategorized", "未分類");
  shelves().forEach((work) => add(work.id, work.name + "  " + work.count));
}
function renderChips() {
  const box = $("chips");
  box.innerHTML = "";
  state.taxonomy.characters.filter((c) => state.work === "all" || c.work === state.work || c.tags.includes(state.work)).forEach((character) => {
    const button = document.createElement("button");
    button.className = "chip" + (state.character === character.id ? " is-on" : "");
    button.textContent = character.name;
    button.onclick = () => { state.character = state.character === character.id ? "" : character.id; render(); };
    box.appendChild(button);
  });
}
function renderGrid() {
  const rows = filtered();
  $("count").textContent = rows.length + " 件";
  $("empty").hidden = rows.length > 0;
  const grid = $("grid");
  grid.innerHTML = "";
  rows.forEach((item) => {
    const names = label(item);
    const card = document.createElement("article");
    card.className = "card";
    const thumb = document.createElement("div");
    thumb.className = "thumb";
    if (item.preview_url) thumb.style.backgroundImage = "url(" + JSON.stringify(item.preview_url) + ")";
    const title = document.createElement("h2");
    title.textContent = names.name + " / " + names.workName;
    const sub = document.createElement("p");
    sub.textContent = (item.source || "") + " · スコア " + (item.score || 0);
    card.append(thumb, title, sub);
    card.onclick = () => openItem(item);
    grid.appendChild(card);
  });
}
function tagGroup(title, tags) {
  const unique = [...new Set(tags)].slice(0, 16);
  if (!unique.length) return null;
  const group = document.createElement("section");
  group.className = "group";
  const heading = document.createElement("h3");
  heading.textContent = title;
  const list = document.createElement("div");
  list.className = "tags";
  unique.forEach((tag) => {
    const chip = document.createElement("button");
    chip.className = "tag";
    chip.textContent = ja(tag);
    chip.onclick = () => { $("q").value = ja(tag); state.q = ja(tag); closeWatch(); renderGrid(); };
    list.appendChild(chip);
  });
  group.append(heading, list);
  return group;
}
function openItem(item) {
  const names = label(item);
  const tags = norm(item.tags);
  $("title").textContent = names.name + " / " + names.workName;
  $("sub").textContent = (item.source || "") + " · スコア " + (item.score || 0);
  $("origin").href = item.post_url || item.file_url;
  const stage = $("stage");
  stage.innerHTML = "";
  const video = document.createElement("video");
  video.controls = true;
  video.playsInline = true;
  video.autoplay = true;
  video.src = item.file_url;
  if (String(item.file_url).toLowerCase().includes(".gif")) video.loop = true;
  video.onerror = () => { stage.innerHTML = "<p>この場では再生できません。元のページを開いてください。</p>"; };
  stage.appendChild(video);
  const box = $("tagbox");
  box.innerHTML = "";
  [tagGroup("作品", names.works), tagGroup("制作", tags.filter((t) => TOOLS.includes(t))), tagGroup("タグ", tags.filter((t) => !TOOLS.includes(t) && !names.works.includes(t)))]
    .filter(Boolean).forEach((group) => box.appendChild(group));
  $("modal").hidden = false;
}
function closeWatch() {
  $("stage").innerHTML = "";
  $("modal").hidden = true;
}
function render() { renderNav(); renderChips(); renderGrid(); }
$("q").addEventListener("input", (event) => { state.q = event.target.value; renderGrid(); });
document.querySelectorAll(".sort").forEach((button) => {
  button.onclick = () => {
    state.sort = button.dataset.sort;
    document.querySelectorAll(".sort").forEach((el) => el.classList.toggle("is-on", el === button));
    renderGrid();
  };
});
$("close").onclick = closeWatch;
$("menu").onclick = () => $("works").classList.toggle("is-open");
Promise.all([
  fetch("data/videos.json?v=" + Date.now()).then((r) => r.json()),
  fetch("data/taxonomy.json?v=" + Date.now()).then((r) => r.json()),
  fetch("data/tag-names.json?v=" + Date.now()).then((r) => r.json())
]).then(([items, taxonomy, names]) => {
  state.items = Array.isArray(items) ? items : [];
  state.taxonomy = taxonomy;
  state.names = names || {};
  taxonomy.works.forEach((work) => work.tags.forEach((tag) => { state.names[tag] = work.name; }));
  taxonomy.characters.forEach((character) => character.tags.forEach((tag) => { state.names[tag] = character.name; }));
  render();
}).catch(() => { $("empty").hidden = false; $("empty").textContent = "データを読めませんでした。"; });
