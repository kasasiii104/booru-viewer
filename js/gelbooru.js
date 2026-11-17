function blockedHost(item) {
  return item && (item.source === "gelbooru" || String(item.file_url || "").includes("gelbooru.com"));
}
function localThumb(item) {
  return item && item.preview_url && !String(item.preview_url).includes("gelbooru.com");
}
const openItemDirect = openItem;
openItem = function (item) {
  $("origin").textContent = "元のページで開く";
  return openItemDirect(item);
};
const renderGridDirect = renderGrid;
renderGrid = function () {
  renderGridDirect();
  const all = filtered();
  const rows = all;
  [...$("grid").children].forEach((card, index) => {
    const item = rows[index];
    if (!item || !blockedHost(item)) return;
    const thumb = card.querySelector(".thumb");
    if (!thumb || localThumb(item)) return;
    thumb.classList.add("external");
    thumb.style.backgroundImage = "";
    const play = thumb.querySelector(".play");
    if (play) play.textContent = "Gelbooru";
  });
};
