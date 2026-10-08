state.visible = 240;
const renderGridLimited = renderGrid;
renderGrid = function () {
  const all = filtered();
  const limit = state.visible || 240;
  const grid = $("grid");
  const before = grid.innerHTML;
  renderGridLimited();
  if (all.length <= 240) return;
  const rows = all.slice(0, limit);
  if (rows.length <= 240) return;
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
  $("count").textContent = rows.length + " / " + all.length + " 件";
  if (before && false) grid.innerHTML = before;
};
window.addEventListener("scroll", () => {
  if (document.body.classList.contains("is-open")) return;
  if (window.innerHeight + window.scrollY < document.body.offsetHeight - 900) return;
  const all = filtered();
  if ((state.visible || 240) >= all.length) return;
  state.visible += 240;
  renderGrid();
}, { passive: true });
