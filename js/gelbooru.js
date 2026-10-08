function blockedHost(item) {
  return item && (item.source === "gelbooru" || String(item.file_url || "").includes("gelbooru.com"));
}
function localThumb(item) {
  return item && item.preview_url && !String(item.preview_url).includes("gelbooru.com");
}
function openGelbooru(item) {
  window.open(item.post_url || item.file_url, "_blank", "noopener");
}
const openItemDirect = openItem;
openItem = function (item) {
  if (!blockedHost(item)) {
    $("origin").textContent = "元のページで開く";
    return openItemDirect(item);
  }
  openGelbooru(item);
};
const renderGridDirect = renderGrid;
renderGrid = function () {
  renderGridDirect();
  const rows = (state.favOnly ? filtered() : filtered().slice(0, 240));
  [...$("grid").children].forEach((card, index) => {
    const item = rows[index];
    if (!item || !blockedHost(item)) return;
    const thumb = card.querySelector(".thumb");
    const title = card.querySelector(".title");
    if (thumb) thumb.onclick = () => openGelbooru(item);
    if (title) title.onclick = () => openGelbooru(item);
    if (!thumb || localThumb(item)) return;
    thumb.classList.add("external");
    thumb.style.backgroundImage = "";
    const play = thumb.querySelector(".play");
    if (play) play.textContent = "Gelbooru";
  });
};
