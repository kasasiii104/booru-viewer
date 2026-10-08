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
  const rows = source.filter((row) => !q || row.name.toLowerCase().includes(q) || row.id.includes(q)).slice(0, 60);
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
