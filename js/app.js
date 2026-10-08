const state = { items: [], taxonomy: { works: [], characters: [] }, names: {}, work: "all", character: "", tag: "", sort: "score", q: "", panel: "", panelQ: "", favOnly: false, loop: true, current: null, preview: null };
const TOOLS = ["source_filmmaker", "sfm", "blender", "blender_(medium)", "mmd", "mikumikudance", "daz_studio", "koikatsu", "honey_select", "xps", "xnalara", "cinema_4d"];
const $ = (id) => document.getElementById(id);
const favKey = "booru-viewer-favs";

function favs() { try { return new Set(JSON.parse(localStorage.getItem(favKey) || "[]")); } catch { return new Set(); } }
function saveFavs(set) { localStorage.setItem(favKey, JSON.stringify([...set])); }
function ids(item) { return [item.md5, item.source + ":" + item.source_id, item.file_url].filter(Boolean); }
function isFav(item) { const saved = favs(); return ids(item).some((id) => saved.has(id)); }
function toggleFav(item) {
  const set = favs();
  const keys = ids(item);
  if (keys.some((key) => set.has(key))) keys.forEach((key) => set.delete(key));
  else keys.forEach((key) => set.add(key));
  saveFavs(set);
  render();
  if (state.current) markFav(state.current);
}
function norm(tags) { return (tags || []).map((t) => String(t).toLowerCase()).filter(Boolean); }
function ja(tag) { return state.names[String(tag || "").toLowerCase()] || String(tag || "").replaceAll("_", " "); }
function canonicalWork(tag) {
  const found = state.taxonomy.works.find((work) => work.id === tag || work.tags.includes(tag));
  return found ? found.id : tag;
}
function canonicalCharacter(tag) {
  const found = state.taxonomy.characters.find((character) => character.id === tag || character.tags.includes(tag));
  if (found) return found.id;
  const bare = tag.replace(/_\([^)]+\)$/, "");
  const byBare = state.taxonomy.characters.find((character) => character.id === bare || character.tags.includes(bare));
  return byBare ? byBare.id : tag;
}
function workTags(item) {
  const known = new Set(state.taxonomy.works.flatMap((work) => [work.id, ...work.tags]));
  return [...new Set([...norm(item.copyright_tags), ...norm(item.tags).filter((tag) => known.has(tag))].map(canonicalWork))];
}
function characterTags(item) {
  const known = new Set(state.taxonomy.characters.flatMap((character) => [character.id, ...character.tags]));
  return [...new Set([...norm(item.character_tags), ...norm(item.tags).filter((tag) => known.has(tag))].map(canonicalCharacter))];
}
function plainTags(item) {
  const used = new Set([...workTags(item), ...characterTags(item), ...TOOLS, ...state.taxonomy.works.flatMap((work) => work.tags), ...state.taxonomy.characters.flatMap((character) => character.tags)]);
  return norm(item.tags).filter((tag) => !used.has(tag));
}
function label(item) {
  const works = workTags(item);
  const characters = characterTags(item);
  return { name: characters.length ? characters.map(ja).join(" / ") : "動画", workName: works.length ? works.map(ja).join(" / ") : "未分類", works, characters };
}
function ratingValue(item) { return { e: 3, q: 2, s: 1 }[String(item.rating || "").toLowerCase()] || 0; }
function counts(pick) {
  const map = new Map();
  state.items.forEach((item) => pick(item).forEach((tag) => map.set(tag, (map.get(tag) || 0) + 1)));
  return [...map.entries()].sort((a, b) => b[1] - a[1]).map(([id, count]) => ({ id, name: ja(id), count }));
}
function filtered() {
  const q = state.q.trim().toLowerCase();
  const rows = state.items.filter((item) => {
    const names = label(item);
    if (state.favOnly && !isFav(item)) return false;
    if (state.work === "uncategorized" && names.works.length) return false;
    if (state.work !== "all" && state.work !== "uncategorized" && !names.works.includes(state.work)) return false;
    if (state.character && !names.characters.includes(state.character)) return false;
    if (state.tag && !norm(item.tags).includes(state.tag)) return false;
    if (!q) return true;
    return [names.name, names.workName, ...norm(item.tags).map(ja)].join(" ").toLowerCase().includes(q);
  });
  rows.sort((a, b) => state.sort === "new" ? String(b.created_at).localeCompare(String(a.created_at)) : state.sort === "rating" ? ratingValue(b) - ratingValue(a) || (b.score || 0) - (a.score || 0) : (b.score || 0) - (a.score || 0));
  return rows;
}
function clock(seconds) {
  const value = Number(seconds);
  if (!value || !isFinite(value)) return "";
  const total = Math.round(value);
  return Math.floor(total / 60) + ":" + String(total % 60).padStart(2, "0");
}
function stopPreview() {
  if (state.preview) { state.preview.pause(); state.preview.remove(); state.preview = null; }
}
function playPreview(item, thumb) {
  stopPreview();
  const video = document.createElement("video");
  video.playsInline = true;
  video.muted = true;
  video.controls = false;
  video.preload = "metadata";
  video.src = item.file_url + "#t=0,6";
  video.ontimeupdate = () => { if (video.currentTime >= 6) video.currentTime = 0; };
  video.onerror = () => { video.remove(); if (state.preview === video) state.preview = null; };
  thumb.querySelector(".play")?.remove();
  thumb.appendChild(video);
  state.preview = video;
  video.play();
}
function renderPicked() {
  const box = $("picked");
  box.innerHTML = "";
  const chips = [];
  if (state.work !== "all") chips.push(["作品: " + (state.work === "uncategorized" ? "未分類" : ja(state.work)), () => { state.work = "all"; render(); }]);
  if (state.character) chips.push(["キャラ: " + ja(state.character), () => { state.character = ""; render(); }]);
  if (state.tag) chips.push(["タグ: " + ja(state.tag), () => { state.tag = ""; render(); }]);
  chips.forEach(([text, clear]) => {
    const chip = document.createElement("button");
    chip.className = "chip";
    chip.textContent = text + " ×";
    chip.onclick = clear;
    box.appendChild(chip);
  });
}
function renderPanel() {
  const panel = $("panel");
  panel.hidden = !state.panel;
  document.querySelectorAll("[data-panel]").forEach((button) => button.classList.toggle("is-on", button.dataset.panel === state.panel));
  if (!state.panel) return;
  const source = state.panel === "work" ? [{ id: "all", name: "すべて", count: state.items.length }, { id: "uncategorized", name: "未分類", count: "" }, ...counts(workTags)] : state.panel === "character" ? [{ id: "", name: "すべて", count: "" }, ...counts(characterTags)] : [{ id: "", name: "すべて", count: "" }, ...counts(plainTags)];
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
      render();
    };
    list.appendChild(button);
  });
}
function renderGrid() {
  const all = filtered();
  const rows = state.favOnly ? all : all.slice(0, 240);
  $("count").textContent = all.length + " 件";
  $("favs").textContent = "お気に入り " + state.items.filter(isFav).length;
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
    const play = document.createElement("span");
    play.className = "play";
    play.textContent = "▶";
    const star = document.createElement("button");
    star.className = "star";
    star.textContent = isFav(item) ? "★" : "☆";
    star.onclick = (event) => { event.stopPropagation(); toggleFav(item); };
    thumb.append(play, star);
    const shown = clock(item.duration);
    if (shown) {
      const time = document.createElement("span");
      time.className = "time";
      time.textContent = shown;
      thumb.appendChild(time);
    }
    thumb.onclick = () => playPreview(item, thumb);
    const title = document.createElement("button");
    title.className = "title";
    title.type = "button";
    title.textContent = names.name;
    title.onclick = () => openItem(item);
    const sub = document.createElement("p");
    sub.textContent = names.workName + " · " + (item.score || 0);
    card.append(thumb, title, sub);
    grid.appendChild(card);
  });
}
function markFav(item) {
  $("fav").textContent = isFav(item) ? "★ お気に入り済み" : "☆ お気に入り";
  $("fav").classList.toggle("is-on", isFav(item));
}
function tagGroup(title, tags) {
  const unique = [...new Set(tags)].slice(0, 18);
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
    chip.onclick = () => { state.q = ""; $("q").value = ""; state.work = title === "作品" ? tag : state.work; state.character = title === "キャラ" ? tag : ""; state.tag = title === "タグ" ? tag : ""; closeWatch(); render(); };
    list.appendChild(chip);
  });
  group.append(heading, list);
  return group;
}
function openItem(item) {
  stopPreview();
  state.current = item;
  const names = label(item);
  const tags = norm(item.tags);
  $("title").textContent = names.name;
  $("sub").textContent = [names.workName, "スコア " + (item.score || 0), clock(item.duration)].filter(Boolean).join(" · ");
  $("origin").href = item.post_url || item.file_url;
  markFav(item);
  $("loop").classList.toggle("is-on", state.loop);
  const stage = $("stage");
  stage.innerHTML = "";
  const video = document.createElement("video");
  video.controls = true;
  video.playsInline = true;
  video.loop = state.loop;
  video.preload = "none";
  video.poster = item.preview_url || "";
  video.src = item.file_url;
  const play = document.createElement("span");
  play.className = "play";
  play.textContent = "▶";
  let startY = 0;
  let moved = false;
  stage.onpointerdown = (event) => { startY = event.clientY; moved = false; };
  stage.onpointermove = (event) => { if (Math.abs(event.clientY - startY) > 12) moved = true; };
  stage.onpointerup = (event) => {
    if (event.clientY - startY > 70) { closeWatch(); return; }
    if (moved) return;
    play.remove();
    video.play();
  };
  video.onloadedmetadata = () => { $("sub").textContent = [names.workName, "スコア " + (item.score || 0), clock(video.duration)].filter(Boolean).join(" · "); };
  video.onerror = () => { stage.innerHTML = "<p>この場では再生できません。元のページを開いてください。</p>"; };
  stage.append(video, play);
  const box = $("tagbox");
  box.innerHTML = "";
  [tagGroup("作品", names.works), tagGroup("キャラ", names.characters), tagGroup("制作", tags.filter((t) => TOOLS.includes(t))), tagGroup("タグ", plainTags(item))]
    .filter(Boolean).forEach((group) => box.appendChild(group));
  $("modal").hidden = false;
  document.body.classList.add("is-open");
}
function closeWatch() {
  state.current = null;
  $("stage").innerHTML = "";
  $("modal").hidden = true;
  document.body.classList.remove("is-open");
}
function render() { $("favs").classList.toggle("is-on", state.favOnly); renderPicked(); renderPanel(); renderGrid(); }
$("q").addEventListener("input", (event) => { state.q = event.target.value; renderGrid(); });
$("panel-q").addEventListener("input", (event) => { state.panelQ = event.target.value; renderPanel(); });
document.querySelectorAll(".sort[data-sort]").forEach((button) => {
  button.onclick = () => {
    state.sort = button.dataset.sort;
    document.querySelectorAll(".sort[data-sort]").forEach((el) => el.classList.toggle("is-on", el === button));
    renderGrid();
  };
});
document.querySelectorAll("[data-panel]").forEach((button) => {
  button.onclick = () => {
    state.panel = state.panel === button.dataset.panel ? "" : button.dataset.panel;
    state.panelQ = "";
    $("panel-q").value = "";
    renderPanel();
  };
});
$("favs").onclick = () => { state.favOnly = !state.favOnly; render(); };
$("fav").onclick = () => { if (state.current) toggleFav(state.current); };
$("loop").onclick = () => {
  state.loop = !state.loop;
  $("loop").classList.toggle("is-on", state.loop);
  const video = $("stage").querySelector("video");
  if (video) video.loop = state.loop;
};
$("close").onclick = (event) => { event.stopPropagation(); closeWatch(); };
$("close-bar").onclick = (event) => { event.stopPropagation(); closeWatch(); };
$("modal").onclick = (event) => { if (event.target === $("modal")) closeWatch(); };
window.addEventListener("load", () => { if (document.activeElement) document.activeElement.blur(); });
Promise.all([
  fetch("data/videos.json?v=" + Date.now()).then((r) => r.json()),
  fetch("data/taxonomy.json?v=" + Date.now()).then((r) => r.json()),
  fetch("data/tag-names.json?v=" + Date.now()).then((r) => r.json())
]).then(([items, taxonomy, names]) => {
  state.items = Array.isArray(items) ? items : [];
  state.taxonomy = taxonomy;
  state.names = names || {};
  taxonomy.works.forEach((work) => { state.names[work.id] = work.name; work.tags.forEach((tag) => { state.names[tag] = work.name; }); });
  taxonomy.characters.forEach((character) => { state.names[character.id] = character.name; character.tags.forEach((tag) => { state.names[tag] = character.name; }); });
  render();
}).catch(() => { $("empty").hidden = false; $("empty").textContent = "データを読めませんでした。"; });
