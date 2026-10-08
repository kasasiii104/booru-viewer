const state = { items: [], taxonomy: { works: [], characters: [] }, names: {}, work: "all", character: "", sort: "score", q: "", favOnly: false, loop: true, current: null };
const TOOLS = ["source_filmmaker", "sfm", "blender", "blender_(medium)", "mmd", "mikumikudance", "daz_studio", "koikatsu", "honey_select", "xps", "xnalara", "cinema_4d"];
const $ = (id) => document.getElementById(id);
const favKey = "booru-viewer-favs";

function favs() { try { return new Set(JSON.parse(localStorage.getItem(favKey) || "[]")); } catch { return new Set(); } }
function saveFavs(set) { localStorage.setItem(favKey, JSON.stringify([...set])); }
function keyOf(item) { return item.md5 || item.source + ":" + item.source_id; }
function toggleFav(item) {
  const set = favs();
  const key = keyOf(item);
  set.has(key) ? set.delete(key) : set.add(key);
  saveFavs(set);
  render();
  if (state.current) markFav(state.current);
}
function norm(tags) { return (tags || []).map((t) => String(t).toLowerCase()).filter(Boolean); }
function ja(tag) { return state.names[String(tag || "").toLowerCase()] || String(tag || "").replaceAll("_", " "); }
function knownCharacter(tag) { return state.taxonomy.characters.find((c) => c.id === tag || c.tags.includes(tag)); }
function workTags(item) {
  const copyright = norm(item.copyright_tags);
  if (copyright.length) return copyright;
  const tags = norm(item.tags);
  return state.taxonomy.works.filter((work) => work.tags.some((t) => tags.includes(t))).map((work) => work.id);
}
function characterTags(item) {
  const tagged = norm(item.character_tags);
  if (tagged.length) return tagged;
  return norm(item.tags).map(knownCharacter).filter(Boolean).map((c) => c.id);
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
  const saved = favs();
  const rows = state.items.filter((item) => {
    const names = label(item);
    if (state.favOnly && !saved.has(keyOf(item))) return false;
    if (state.work === "uncategorized" && names.works.length) return false;
    if (state.work !== "all" && state.work !== "uncategorized" && !names.works.includes(state.work)) return false;
    if (state.character && !names.characters.includes(state.character)) return false;
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
function button(text, active, onClick) {
  const el = document.createElement("button");
  el.className = "work" + (active ? " is-on" : "");
  el.textContent = text;
  el.onclick = onClick;
  return el;
}
function fillShelf(id, title, rows, active, onPick) {
  const shelf = $(id);
  shelf.innerHTML = "";
  const heading = document.createElement("div");
  heading.className = "heading";
  heading.textContent = title;
  shelf.appendChild(heading);
  rows.forEach((row) => shelf.appendChild(button(row.name + "  " + row.count, active(row), () => onPick(row))));
}
function renderNav() {
  const close = () => document.querySelector(".shelves").classList.remove("is-open");
  fillShelf("work-shelf", "作品", [{ id: "all", name: "ホーム", count: state.items.length }, { id: "uncategorized", name: "未分類", count: "" }, ...counts(workTags)], (row) => state.work === row.id && !state.character, (row) => { state.work = row.id; state.character = ""; close(); render(); });
  fillShelf("char-shelf", "キャラ", [{ id: "", name: "すべて", count: "" }, ...counts(characterTags)], (row) => state.character === row.id, (row) => { state.character = row.id; close(); render(); });
}
function renderGrid() {
  const rows = filtered().slice(0, 240);
  const saved = favs();
  $("count").textContent = filtered().length + " 件";
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
    star.textContent = saved.has(keyOf(item)) ? "★" : "☆";
    star.onclick = (event) => { event.stopPropagation(); toggleFav(item); };
    thumb.append(play, star);
    const shown = clock(item.duration);
    if (shown) {
      const time = document.createElement("span");
      time.className = "time";
      time.textContent = shown;
      thumb.appendChild(time);
    }
    const title = document.createElement("h2");
    title.textContent = names.name;
    const sub = document.createElement("p");
    sub.textContent = names.workName + " · " + (item.score || 0);
    card.append(thumb, title, sub);
    card.onclick = () => openItem(item);
    grid.appendChild(card);
  });
}
function markFav(item) {
  $("fav").textContent = favs().has(keyOf(item)) ? "★ お気に入り済み" : "☆ お気に入り";
  $("fav").classList.toggle("is-on", favs().has(keyOf(item)));
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
    chip.onclick = () => { state.q = ""; $("q").value = ""; state.work = title === "作品" ? tag : state.work; state.character = title === "キャラ" ? tag : ""; closeWatch(); render(); };
    list.appendChild(chip);
  });
  group.append(heading, list);
  return group;
}
function openItem(item) {
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
  video.preload = "auto";
  video.poster = item.preview_url || "";
  video.src = item.file_url;
  const play = document.createElement("button");
  play.className = "play";
  play.textContent = "▶";
  play.hidden = true;
  play.onclick = () => { play.hidden = true; video.play(); };
  video.onloadedmetadata = () => { $("sub").textContent = [names.workName, "スコア " + (item.score || 0), clock(video.duration)].filter(Boolean).join(" · "); };
  video.onerror = () => { stage.innerHTML = "<p>この場では再生できません。元のページを開いてください。</p>"; };
  stage.append(video, play);
  const box = $("tagbox");
  box.innerHTML = "";
  [tagGroup("作品", names.works), tagGroup("キャラ", names.characters), tagGroup("制作", tags.filter((t) => TOOLS.includes(t))), tagGroup("タグ", tags.filter((t) => !TOOLS.includes(t) && !names.works.includes(t) && !names.characters.includes(t)))]
    .filter(Boolean).forEach((group) => box.appendChild(group));
  $("modal").hidden = false;
  const started = video.play();
  if (started) started.catch(() => { play.hidden = false; });
}
function closeWatch() { state.current = null; $("stage").innerHTML = ""; $("modal").hidden = true; }
function render() { $("favs").classList.toggle("is-on", state.favOnly); renderNav(); renderGrid(); }
$("q").addEventListener("input", (event) => { state.q = event.target.value; renderGrid(); });
document.querySelectorAll(".sort[data-sort]").forEach((button) => {
  button.onclick = () => {
    state.sort = button.dataset.sort;
    document.querySelectorAll(".sort[data-sort]").forEach((el) => el.classList.toggle("is-on", el === button));
    renderGrid();
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
$("close").onclick = closeWatch;
$("menu").onclick = () => document.querySelector(".shelves").classList.toggle("is-open");
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
