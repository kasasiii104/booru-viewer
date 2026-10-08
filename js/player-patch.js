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
    const dy = event.clientY - startY;
    if (dy > 70) { closeWatch(); return; }
    if (moved) return;
    play.remove();
    video.play();
  };
  video.onloadedmetadata = () => { $("sub").textContent = [names.workName, "スコア " + (item.score || 0), clock(video.duration)].filter(Boolean).join(" · "); };
  video.onerror = () => { stage.innerHTML = "<p>この場では再生できません。元のページを開いてください。</p>"; };
  stage.append(video, play);
  const box = $("tagbox");
  box.innerHTML = "";
  [tagGroup("作品", names.works), tagGroup("キャラ", names.characters), tagGroup("制作", tags.filter((t) => TOOLS.includes(t))), tagGroup("タグ", tags.filter((t) => !TOOLS.includes(t) && !names.works.includes(t) && !names.characters.includes(t)))]
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
