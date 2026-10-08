function stopPreview() {
  if (state.preview) { state.preview.pause(); state.preview.remove(); state.preview = null; }
}
function playPreview(item, thumb) {
  stopPreview();
  const video = document.createElement("video");
  video.playsInline = true;
  video.muted = true;
  video.loop = false;
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
