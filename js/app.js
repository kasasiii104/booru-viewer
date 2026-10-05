const state = { items: [], taxonomy: { works: [], characters: [] }, work: "all", character: "", sort: "score", q: "" };

const $ = (id) => document.getElementById(id);

function norm(tags) {
  return (tags || []).map((t) => String(t).toLowerCase()).filter(Boolean);
}

function pretty(tag) {
  return String(tag || "").replaceAll("_", " ");
}

function nameFor(tag) {
  const key = String(tag || "").toLowerCase();
  const known = state.taxonomy.works.find((work) => work.id === key || work.tags.some((t) => t === key));
  return known ? known.name : pretty(key);
}

function workTags(item) {
  const copyright = norm(item.copyright_tags);
  if (copyright.length) return copyright;
  const tags = norm(item.tags);
  return state.taxonomy.works
    .filter((work) => work.tags.some((t) => tags.includes(t)))
    .map((work) => work.id);
}

function matchCharacter(item) {
  const tags = norm(item.tags);
  return state.taxonomy.characters.find((c) => c.tags.some((t) => tags.includes(t)));
}

function label(item) {
  const character = matchCharacter(item);
  const works = workTags(item);
  const name = character ? character.name : (item.tags || []).slice(0, 2).join(" ");
  const workName = works.length ? works.map(nameFor).join(" / ") : "未分類";
  return { name: name || "無題", workName, works };
}

function shelves() {
  const counts = new Map();
  state.items.forEach((item) => {
    workTags(item).forEach((tag) => counts.set(tag, (counts.get(tag) || 0) + 1));
  });
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1] || nameFor(a[0]).localeCompare(nameFor(b[0]), "ja"))
    .map(([tag, count]) => ({ id: tag, name: nameFor(tag), count }));
}

function filtered() {
  const q = state.q.trim().toLowerCase();
  let rows = state.items.filter((item) => {
    const works = workTags(item);
    const character = matchCharacter(item);
    if (state.work === "uncategorized" && works.length) return false;
    if (state.work !== "all" && state.work !== "uncategorized" && !works.includes(state.work)) return false;
    if (state.character && (!character || character.id !== state.character)) return false;
    if (!q) return true;
    const hay = [label(item).name, label(item).workName, ...works, ...(item.tags || [])].join(" ").toLowerCase();
    return hay.includes(q);
  });
  rows.sort((a, b) => state.sort === "new"
    ? String(b.created_at).localeCompare(String(a.created_at))
    : (b.score || 0) - (a.score || 0));
  return rows;
}

function renderNav() {
  const nav = $("works");
  nav.innerHTML = "";
  const add = (id, text) => {
    const button = document.createElement("button");
    button.className = "work" + (state.work === id ? " is-on" : "");
    button.textContent = text;
    button.onclick = () => { state.work = id; state.character = ""; render(); };
    nav.appendChild(button);
  };
  add("all", "すべて");
  add("uncategorized", "未分類");
  shelves().forEach((work) => add(work.id, work.name));
}

function renderChips() {
  const box = $("chips");
  box.innerHTML = "";
  const chars = state.taxonomy.characters.filter((c) => state.work === "all" || c.work === state.work || c.tags.includes(state.work));
  chars.forEach((character) => {
    const button = document.createElement("button");
    button.className = "chip" + (state.character === character.id ? " is-on" : "");
    button.textContent = character.name;
    button.onclick = () => {
      state.character = state.character === character.id ? "" : character.id;
      render();
    };
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
    const card = document.createElement("article");
    card.className = "card";
    const names = label(item);
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

function openItem(item) {
  const names = label(item);
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
  video.onerror = () => {
    stage.innerHTML = "<p>この場では再生できません。元のページを開いてください。</p>";
  };
  stage.appendChild(video);
  $("modal").hidden = false;
}

function render() {
  renderNav();
  renderChips();
  renderGrid();
}

$("q").addEventListener("input", (event) => { state.q = event.target.value; renderGrid(); });
document.querySelectorAll(".sort").forEach((button) => {
  button.onclick = () => {
    state.sort = button.dataset.sort;
    document.querySelectorAll(".sort").forEach((el) => el.classList.toggle("is-on", el === button));
    renderGrid();
  };
});
$("close").onclick = () => {
  $("stage").innerHTML = "";
  $("modal").hidden = true;
};

Promise.all([
  fetch("data/videos.json?v=" + Date.now()).then((r) => r.json()),
  fetch("data/taxonomy.json?v=" + Date.now()).then((r) => r.json())
]).then(([items, taxonomy]) => {
  state.items = Array.isArray(items) ? items : [];
  state.taxonomy = taxonomy;
  render();
}).catch(() => {
  $("empty").hidden = false;
  $("empty").textContent = "データを読めませんでした。";
});
