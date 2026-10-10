def slim(item):
    tags = item.get("tags") or []
    kept = [tag for tag in tags if tag in TOOLS or tag in {"video", "animated", "animated_gif", "sound"}]
    extra = [tag for tag in tags if tag not in kept][:16]
    return {
        "source": item.get("source"),
        "source_id": item.get("source_id"),
        "md5": item.get("md5"),
        "score": item.get("score") or 0,
        "rating": item.get("rating"),
        "tags": kept + extra,
        "copyright_tags": item.get("copyright_tags") or [],
        "character_tags": item.get("character_tags") or [],
        "file_url": item.get("file_url"),
        "preview_url": item.get("preview_url"),
        "duration": item.get("duration"),
        "post_url": item.get("post_url"),
        "created_at": item.get("created_at"),
    }


def save(items, state):
    names = []
    cards = []
    chunks = range(0, max(len(items), 1), PART)
    for index, start in enumerate(chunks, 1):
        chunk = items[start:start + PART]
        name = f"videos-{index}.json"
        card = f"cards-{index}.json"
        (DATA / name).write_text(json.dumps(chunk, ensure_ascii=False))
        (DATA / card).write_text(json.dumps([slim(item) for item in chunk], ensure_ascii=False))
        names.append(name)
        cards.append(card)
    for path in DATA.glob("videos-*.json"):
        if path.name not in names:
            path.unlink()
    for path in DATA.glob("cards-*.json"):
        if path.name not in cards:
            path.unlink()
    if VIDEOS.exists():
        VIDEOS.unlink()
    (DATA / "catalog.json").write_text(json.dumps({"parts": cards, "count": len(items)}, ensure_ascii=False))
    STATE.write_text(json.dumps(state, ensure_ascii=False, indent=2))
