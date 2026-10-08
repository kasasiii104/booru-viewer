function blockedHost(item) {
  return item && (item.source === "gelbooru" || String(item.file_url || "").includes("gelbooru.com"));
}
const openItemDirect = openItem;
openItem = function (item) {
  if (!blockedHost(item)) {
    $("origin").textContent = "元のページで開く";
    return openItemDirect(item);
  }
  stopPreview();
  state.current = item;
  const names = label(item);
  $("title").textContent = names.name;
  $("sub").textContent = [names.workName, "スコア " + (item.score || 0)].filter(Boolean).join(" · ");
  $("origin").href = item.post_url || item.file_url;
  $("origin").textContent = "Gelbooruで再生";
  markFav(item);
  $("stage").innerHTML = "<p>Gelbooruは他サイトからの埋め込みを拒否しています。上のリンクから再生できます。</p>";
  const box = $("tagbox");
  box.innerHTML = "";
  [tagGroup("作品", names.works), tagGroup("キャラ", names.characters), tagGroup("制作", norm(item.tags).filter((tag) => TOOLS.includes(tag))), tagGroup("タグ", plainTags(item))]
    .filter(Boolean).forEach((group) => box.appendChild(group));
  $("modal").hidden = false;
  document.body.classList.add("is-open");
};
const renderGridDirect = renderGrid;
renderGrid = function () {
  renderGridDirect();
  const rows = (state.favOnly ? filtered() : filtered().slice(0, 240));
  [...$("grid").children].forEach((card, index) => {
    const item = rows[index];
    if (!item || !blockedHost(item)) return;
    const thumb = card.querySelector(".thumb");
    if (!thumb) return;
    thumb.classList.add("external");
    thumb.style.backgroundImage = "";
    const play = thumb.querySelector(".play");
    if (play) play.textContent = "Gelbooruで開く";
    thumb.onclick = () => openItem(item);
  });
};
